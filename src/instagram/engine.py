"""موتورِ پاسخِ هوشمندِ اینستاگرام — معماریِ «آشکارساز → صف → فرستندهٔ نرخ‌دار».

- detect_and_enqueue(): سریع (هر ~۲۵s) همهٔ کامنت/دایرکتِ جدید را تشخیص می‌دهد، متنِ پاسخ
  را می‌سازد و در صفِ Redis می‌گذارد (هیچ‌کدام گم نمی‌شود، حتی صدها کامنتِ هم‌زمان). فرم‌ها
  چون گفتگوی زنده‌اند بلافاصله ارسال می‌شوند.
- drain_queue(): از صف با سقفِ ساعتیِ امن و فاصله می‌فرستد (ضدِ بنِ اکانتِ غیررسمی).

ضدِ تکرار: ig_inbox.ext_id. ضدِ بک‌لاگ: timestamp ≥ زمانِ ساختِ قاعده.
"""
from __future__ import annotations

import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from src.core.config import settings
from src.core.database import (
    IgAccount, IgAutoReply, IgForm, IgInbox, IgMessage,
)
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.llm.client import llm_client

logger = get_logger(__name__)


@asynccontextmanager
async def _task_db():
    """سشن با engineِ مستقلِ NullPool روی loopِ فعلیِ تسک (جلوگیری از «attached to a different loop»)."""
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    SF = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with SF() as db:
            yield db
    finally:
        await engine.dispose()


async def _ensure_redis():
    """اتصالِ تازه برای هر اجرا، با keepalive + health-check تا در طولِ pollِ طولانی idle-close نشود."""
    import redis.asyncio as aioredis
    from src.core.config import settings
    redis_client._pool = aioredis.from_url(
        settings.REDIS_URL, encoding="utf-8", decode_responses=True,
        socket_keepalive=True, health_check_interval=15, retry_on_timeout=True)
    await redis_client._pool.ping()


IG_WORKER = os.environ.get("IG_WORKER_URL", "http://ig-worker:8090")
SENDQ = "ig:sendq"                  # صفِ ارسال (Redis list)
DEFAULT_RATE_CAP = 60              # سقفِ ارسالِ امنِ پیش‌فرض در ساعت (قابلِ‌تنظیم)


async def _worker(method: str, path: str, json_body: dict | None = None, timeout: float = 120):
    async with httpx.AsyncClient(timeout=timeout) as cl:
        r = await cl.request(method, f"{IG_WORKER}{path}", json=json_body)
        r.raise_for_status()
        return r.json()


def _kw_hit(mode: str, value: str, t: str) -> bool:
    v = str(value).strip().lower()
    if not v:
        return False
    return t == v if mode == "equal" else v in t


def match(rule: IgAutoReply, text: str) -> bool:
    """تطبیق — هر کلمه می‌تواند مودِ خودش (برابر/شامل) را داشته باشد یا از مودِ کلیِ قاعده."""
    t = (text or "").strip().lower()
    if rule.match_mode == "any":
        return True
    for k in (rule.keywords or []):
        if isinstance(k, dict):
            if _kw_hit(k.get("mode") or rule.match_mode, k.get("value", ""), t):
                return True
        elif _kw_hit(rule.match_mode, k, t):
            return True
    return False


def _products_text(msg: IgMessage) -> str:
    lines = []
    for p in (msg.products or [])[:8]:
        seg = f"🛍️ {p.get('title', '')}"
        if p.get("subtitle"):
            seg += f" — {p['subtitle']}"
        if p.get("link"):
            seg += f"\n{p['link']}"
        lines.append(seg)
    return "\n\n".join(lines)


async def _schedule_reminder(rule: IgAutoReply, account_id: int, user_pk: str):
    """زمان‌بندیِ پیامِ یادآوری در ZSETِ Redis (score = زمانِ سررسید)."""
    if not (rule.reminder and rule.reminder_hours and rule.reminder_message_id):
        return
    import time as _t
    due = _t.time() + int(rule.reminder_hours) * 3600
    payload = json.dumps({"account_id": account_id, "user_pk": user_pk, "message_id": rule.reminder_message_id})
    await redis_client.client.zadd("ig:reminders", {payload: due})


async def is_follower(user_pk: str, account_id=None, fresh: bool = False) -> bool | None:
    """وضعیتِ فالو با کشِ کوتاهِ Redis (۱۲۰s) — چون user_info سنگین است و تأخیر می‌آورد."""
    key = f"ig:follows:{account_id}:{user_pk}"
    if not fresh:
        cached = await redis_client.get_json(key)
        if cached is not None:
            return cached.get("v")
    try:
        r = await _worker("POST", "/is_follower", {"account_id": account_id, "user_pk": user_pk})
        v = r.get("follows")
    except Exception:
        v = None
    try:
        await redis_client.set_json(key, {"v": v}, expire=120)
    except Exception:
        pass
    return v


# ─────────────── گیتِ فالو («اول فالو کن، بعد «فالو دارم» بفرست») ───────────────
_FG = "ig:fg:"


async def _gate_set(account_id: int, user_pk: str, rule_id: int):
    await redis_client.set_json(f"{_FG}{account_id}:{user_pk}", {"rule_id": int(rule_id)}, expire=86400)


async def _gate_get(account_id: int, user_pk: str) -> dict | None:
    return await redis_client.get_json(f"{_FG}{account_id}:{user_pk}")


async def _gate_clear(account_id: int, user_pk: str):
    await redis_client.delete(f"{_FG}{account_id}:{user_pk}")


def _follow_btn(rule: IgAutoReply) -> str:
    return (rule.follow_button_text or "فالو دارم").strip() if rule else "فالو دارم"


def _follow_parts(rule: IgAutoReply, account_username: str | None = None) -> list[dict]:
    # پیام = فقط همان متنِ تنظیم‌شده + یک دکمه/کارت با کلمهٔ تنظیم‌شده (مثل «فالو دارم»)
    msg = (rule.follow_message or "").strip() or "برای دریافتِ پیام، لطفاً ابتدا صفحهٔ ما را فالو کنید 🙏"
    btn = _follow_btn(rule)
    links = [{"label": btn, "url": f"https://instagram.com/{account_username}"}] if account_username else []
    return [{"type": "text", "text": msg, "links": links}]


async def _seen(db: AsyncSession, account_id: int, ext_id: str) -> bool:
    if not ext_id:
        return False
    q = await db.execute(select(IgInbox.id).where(
        IgInbox.account_id == account_id, IgInbox.ext_id == ext_id).limit(1))
    return q.scalar() is not None


def _clean_text(s: str | None) -> str:
    """نگارشِ تمیزِ پیام: تریمِ هر خط، جمعِ خطوطِ خالیِ پشتِ‌هم به یک خط، حذفِ فاصله‌های اضافی."""
    if not s:
        return ""
    lines = [ln.rstrip() for ln in str(s).replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    out, blanks = [], 0
    for ln in lines:
        if ln.strip() == "":
            blanks += 1
            if blanks <= 1 and out:
                out.append("")
        else:
            blanks = 0
            # حذفِ فاصله‌های چندتاییِ داخلِ خط
            out.append(" ".join(ln.split()))
    return "\n".join(out).strip()


def _msg_links(msg: IgMessage | None) -> list[dict]:
    """دکمه‌های لینکِ پیام → فهرستِ کارت/دکمه ({label,url}). هرکدام جداگانه به‌صورتِ کارتِ کلیک‌شونده زیرِ پیام می‌رود."""
    out = []
    for b in (getattr(msg, "buttons", None) or []):
        if b.get("kind") == "link" and b.get("target"):
            out.append({"label": (b.get("label") or "").strip(), "url": str(b["target"]).strip()})
    return out


async def _reply_text(rule: IgAutoReply, msg: IgMessage | None, username: str, text_in: str) -> str | None:
    if rule.use_ai and rule.ai_prompt:
        system = ("تو دستیارِ پاسخگوییِ پیجِ اینستاگرامِ Coinepro (آموزشِ فارکس) هستی. "
                  "پاسخِ کوتاه، گرم و حرفه‌ای به فارسیِ روان و بدونِ غلطِ املایی بنویس؛ نگارش تمیز و مرتب، "
                  "لحنِ محترمانه، با ۱ تا ۲ ایموجیِ به‌جا. لینک ننویس (لینک جداگانه به‌صورتِ دکمه ارسال می‌شود). "
                  "فقط متنِ نهاییِ پاسخ را بده، بدونِ توضیحِ اضافه یا علامتِ نقل‌قول.")
        prompt = f"{rule.ai_prompt}\n\nپیامِ کاربر (@{username}): {text_in}"
        out = await llm_client.complete(prompt, system=system, system_replace=True, timeout=60)
        if out:
            return _clean_text(out)[:900]
    if msg and msg.msg_type == "products" and msg.products:
        return _clean_text(_products_text(msg))
    if msg and msg.text:
        # متنِ تمیز؛ لینک‌ها دیگر داخلِ متن نمی‌آیند (به‌صورتِ کارت/دکمهٔ جدا فرستاده می‌شوند)
        return _clean_text(msg.text.replace("{name}", username or ""))
    if msg and msg.buttons:
        labels = [(b.get("label") or "").strip() for b in msg.buttons if b.get("target")]
        return _clean_text("\n".join(f"• {l}" for l in labels if l)) or "👇"
    return None


# ─────────────── چند پیامِ پشت‌سرِهم (متن/رسانه) ───────────────
def _msg_to_part(msg: IgMessage, username: str) -> dict | None:
    """یک IgMessage را به یک «بخشِ» قابلِ‌ارسال تبدیل می‌کند: متن(+لینک) یا رسانه(عکس/ویدیو)."""
    mt = (msg.msg_type or "text").lower()
    if mt == "file" and msg.file_url:
        kind = "video" if (msg.file_kind == "video" or str(msg.file_url).lower().endswith((".mp4", ".mov"))) else "photo"
        cap = _clean_text((msg.text or "").replace("{name}", username or "")) if msg.text else ""
        return {"type": "media", "media": os.path.basename(str(msg.file_url)), "kind": kind, "caption": cap}
    if mt == "products" and msg.products:
        return {"type": "text", "text": _clean_text(_products_text(msg)), "links": []}
    text = _clean_text((msg.text or "").replace("{name}", username or "")) if msg.text else ""
    links = _msg_links(msg)
    if text or links:
        return {"type": "text", "text": text or "👇", "links": links}
    return None


async def _build_parts(rule: IgAutoReply, msgs: dict, username: str, text_in: str) -> list[dict]:
    """فهرستِ بخش‌های پاسخ. اگر use_ai روشن باشد متنِ AI اول می‌آید؛ سپس پیام‌های انتخاب‌شده
    (message_ids مقدم بر message_id) پشت‌سرِهم. هر بخش متن(+لینک) یا رسانه است."""
    parts: list[dict] = []
    if rule.use_ai and rule.ai_prompt:
        txt = await _reply_text(rule, None, username, text_in)
        if txt:
            parts.append({"type": "text", "text": txt, "links": []})
    ids = list(rule.message_ids or ([] if rule.message_id is None else [rule.message_id]))
    for mid in ids:
        msg = msgs.get(int(mid)) if mid is not None else None
        if not msg:
            continue
        p = _msg_to_part(msg, username)
        if p:
            parts.append(p)
    return parts


def _parts_text(parts: list[dict]) -> str:
    """متنِ ترکیبیِ بخش‌ها — برای نمایش در inbox و پاسخِ کامنت."""
    out = []
    for p in parts:
        if p.get("type") == "text" and p.get("text"):
            out.append(p["text"])
        elif p.get("type") == "media":
            out.append(p.get("caption") or "[رسانه]")
    return "\n".join(out).strip()


_PUBLIC_SITE = os.environ.get("PUBLIC_SITE_URL", "https://fx.trade-future.ir")


async def _make_go_link(label: str, url: str) -> str:
    """لینکِ واسطِ OG می‌سازد تا اینستاگرام کارتِ کلیک‌شونده با «عنوانِ دکمه» نشان دهد."""
    url = (url or "").strip()
    if not url:
        return ""
    if not url.lower().startswith(("http://", "https://")):
        url = "https://" + url
    code = uuid.uuid4().hex[:12]
    try:
        await redis_client.set_json(f"ig:go:{code}", {"label": (label or "").strip()[:80], "url": url}, expire=10368000)
        return f"{_PUBLIC_SITE}/api/public/go/{code}"
    except Exception:
        return url


def _compose_with_links(text: str, links: list[dict]) -> str:
    """متن + لینک‌ها (هرکدام با عنوان) را در یک پیامِ واحد و چسبیده می‌سازد.
    (اینستاگرامِ غیررسمی دکمه/کارت رندر نمی‌کند؛ پس عنوان + لینکِ کلیک‌شونده در همان پیام می‌آید.)"""
    chunks = [text.strip()] if (text or "").strip() else []
    for lk in (links or []):
        url = (lk.get("url") or "").strip()
        if not url:
            continue
        if not url.lower().startswith(("http://", "https://")):
            url = "https://" + url
        label = (lk.get("label") or "").strip()
        chunks.append(f"🔗 {label}\n{url}" if label else f"🔗 {url}")
    return "\n\n".join(chunks) if chunks else "👇"


async def _send_parts(user_pk: str, parts: list[dict], account_id=None) -> None:
    """هر بخش را به‌ترتیب به دایرکتِ کاربر می‌فرستد (متن+لینک‌ها در یک پیام؛ رسانه جدا)."""
    for p in parts:
        if p.get("type") == "media" and p.get("media"):
            await _worker("POST", "/dm_send_media", {"account_id": account_id, "user_ids": [user_pk], "media": p["media"],
                                                     "kind": p.get("kind", "photo"), "caption": p.get("caption", "")})
        else:
            msg = _compose_with_links(p.get("text", ""), p.get("links") or [])
            await _worker("POST", "/dm_send", {"account_id": account_id, "user_ids": [user_pk], "text": msg})


# ─────────────── نرخ + صف ───────────────
async def _rate_cap() -> int:
    v = await redis_client.get_json("ig:rate_cap")
    try:
        return int(v) if v else DEFAULT_RATE_CAP
    except Exception:
        return DEFAULT_RATE_CAP


def _hour_key() -> str:
    return "ig:sent:" + datetime.now(timezone.utc).strftime("%Y%m%d%H")


async def _rate_used() -> int:
    v = await redis_client.get_json(_hour_key())
    return int(v) if v else 0


async def _rate_inc():
    k = _hour_key()
    cur = await _rate_used()
    await redis_client.set_json(k, cur + 1, expire=3700)


async def _enqueue(job: dict):
    await redis_client.client.rpush(SENDQ, json.dumps(job))


async def queue_len() -> int:
    try:
        return int(await redis_client.client.llen(SENDQ))
    except Exception:
        return 0


# ─────────────── فرم (گفتگوی حالت‌دار) ───────────────
async def handle_form(forms: list[IgForm], account_id: int, user_pk: str, text: str):
    key = f"ig:form:{account_id}:{user_pk}"
    state = await redis_client.get_json(key)
    t = (text or "").strip()
    if state:
        form = next((f for f in forms if f.id == state["form_id"]), None)
        if not form:
            await redis_client.delete(key); return None
        if form.cancel_trigger and t == form.cancel_trigger.strip():
            await redis_client.delete(key)
            return (form.cancel_message or "لغو شد.", True)
        qs = form.questions or []
        state["answers"].append(t)
        idx = state["idx"] + 1
        if idx < len(qs):
            state["idx"] = idx
            await redis_client.set_json(key, state, expire=3600)
            return (qs[idx], False)
        await redis_client.delete(key)
        return (form.end_message or "ممنون! فرم تکمیل شد. ✅", True)
    for form in forms:
        if form.start_trigger and t == form.start_trigger.strip():
            qs = form.questions or []
            if not qs:
                return None
            await redis_client.set_json(key, {"form_id": form.id, "idx": 0, "answers": []}, expire=3600)
            return (qs[0], False)
    return None


# ─────────────── قفلِ ضدِ هم‌پوشانی (جلوگیری از اجرای موازیِ یک scope) ───────────────
async def _acquire(name: str, ttl: int = 25) -> bool:
    """قفلِ کوتاهِ Redis (SET NX EX). اگر نگیرد یعنی نمونهٔ دیگری در حالِ اجراست → این دور رد می‌شود."""
    try:
        return bool(await redis_client.client.set(f"ig:lock:{name}", "1", nx=True, ex=ttl))
    except Exception:
        return True  # fail-open: اگر Redis مشکل داشت، اجرا را متوقف نکن


async def _release(name: str):
    try:
        await redis_client.client.delete(f"ig:lock:{name}")
    except Exception:
        pass


# ─────────────── آشکارساز (دایرکت: ارسالِ فوری · کامنت: صف‌گذاری) ───────────────
async def detect_and_enqueue(amount: int = 8, scope: str = "all") -> dict:
    """کامنت/دایرکتِ جدید را تشخیص می‌دهد. دایرکت بلافاصله ارسال می‌شود (پاسخِ سریع)؛
    کامنت‌ها در صفِ نرخ‌دار می‌روند. scope: all | dm | comment."""
    await _ensure_redis()
    if not await _acquire(f"detect:{scope}", ttl=25):
        return {"skipped_locked": True}
    stats = {"comments_checked": 0, "dms_checked": 0, "enqueued": 0, "forms_sent": 0, "sent_instant": 0, "errors": 0}
    async with _task_db() as db:
        accounts = (await db.execute(select(IgAccount).where(
            IgAccount.is_active.is_(True), IgAccount.smart_enabled.is_(True)))).scalars().all()
        for acc in accounts:
            rules = (await db.execute(select(IgAutoReply).where(
                IgAutoReply.account_id == acc.id, IgAutoReply.enabled.is_(True)))).scalars().all()
            forms = (await db.execute(select(IgForm).where(
                IgForm.account_id == acc.id, IgForm.enabled.is_(True)))).scalars().all()
            if not rules and not forms:
                continue
            msg_ids = set()
            for r in rules:
                if r.message_ids:
                    msg_ids.update(int(x) for x in r.message_ids)
                elif r.message_id:
                    msg_ids.add(r.message_id)
            msgs = {}
            if msg_ids:
                for m in (await db.execute(select(IgMessage).where(IgMessage.id.in_(list(msg_ids))))).scalars().all():
                    msgs[m.id] = m
            cm_since = min(([r.created_at for r in rules if r.on_comment and r.created_at]), default=None)
            dm_since = min(([r.created_at for r in rules if r.on_direct and r.created_at]
                            + [f.created_at for f in forms if f.created_at]), default=None)

            # ── کامنت‌ها ──
            comment_rules = [r for r in rules if r.on_comment]
            if comment_rules and scope in ("all", "comment"):
                try:
                    # فقط پست‌های مرتبط را بررسی کن (نه همهٔ پست‌ها) → خیلی سریع‌تر
                    spec_pks = [str(r.specific_media) for r in comment_rules
                                if r.specific_media and str(r.specific_media) != "next"]
                    has_general = any((not r.specific_media) or str(r.specific_media) == "next" for r in comment_rules)
                    res = await _worker("POST", "/poll_comments",
                                        {"account_id": acc.id, "media_pks": spec_pks, "recent": 2 if has_general else 0})
                    for c in res.get("comments", []):
                        stats["comments_checked"] += 1
                        ext = f"c:{c['comment_pk']}"
                        if c.get("username") == acc.username:
                            continue
                        if cm_since and c.get("ts") and datetime.fromtimestamp(c["ts"], tz=timezone.utc) < cm_since:
                            continue
                        if await _seen(db, acc.id, ext):
                            continue
                        rule = None
                        for r in comment_rules:
                            if not match(r, c.get("text", "")):
                                continue
                            # «فعال‌سازی برای یک پستِ خاص»
                            sm = r.specific_media
                            if sm == "next":  # bind به جدیدترین پست (یک‌بار)
                                try:
                                    um = await _worker("POST", "/user_media", {"account_id": acc.id, "amount": 1})
                                    newest = (um.get("media") or [{}])[0].get("pk")
                                    if newest:
                                        r.specific_media = newest; await db.commit(); sm = newest
                                except Exception:
                                    sm = None
                            if sm and str(c.get("media_pk")) != str(sm):
                                continue
                            rule = r; break
                        if not rule:
                            continue
                        if rule.max_replies and rule.sent_count >= rule.max_replies:
                            continue
                        # شرطِ فالو — اگر فالو نکرده، پیامِ فالو + گیت (تا با «فالو دارم» باز شود)
                        if rule.require_follow and (await is_follower(c["user_pk"], account_id=acc.id)) is not True:
                            parts = _follow_parts(rule, acc.username)
                            await _gate_set(acc.id, c["user_pk"], rule.id)
                        else:
                            parts = await _build_parts(rule, msgs, c.get("username", ""), c.get("text", ""))
                        if not parts:
                            continue
                        reply = _parts_text(parts)
                        row = IgInbox(account_id=acc.id, kind="comment", from_username=c.get("username"),
                                      media_code=c.get("media_code"), text_in=c.get("text"),
                                      text_out=reply, auto_reply_id=rule.id, handled=False, ext_id=ext)
                        db.add(row); await db.commit(); await db.refresh(row)
                        # ارسالِ فوری (نه صف) — پاسخِ کامنت سریع برسد
                        cap_ok = (await _rate_used()) < (await _rate_cap())
                        sent = False
                        if cap_ok:
                            try:
                                await _send_parts(c["user_pk"], parts, account_id=acc.id)
                                if rule.comment_after_dm:
                                    try:
                                        await _worker("POST", "/comment_reply", {"account_id": acc.id, "media_id": c.get("media_id"),
                                                                                 "text": reply[:300], "comment_pk": c["comment_pk"]})
                                    except Exception:
                                        pass
                                sent = True
                            except Exception as e:
                                logger.warning("ig_comment_instant_failed", error=str(e)[:200])
                        if sent:
                            row.handled = True
                            await _rate_inc()
                            rule.sent_count = (rule.sent_count or 0) + 1
                            await db.commit()
                            await _schedule_reminder(rule, acc.id, c["user_pk"])
                            stats["sent_instant"] += 1
                        else:
                            await _enqueue({"inbox_id": row.id, "account_id": acc.id, "kind": "comment",
                                            "user_pk": c["user_pk"], "media_id": c.get("media_id"),
                                            "comment_pk": c["comment_pk"], "parts": parts, "reply": reply,
                                            "comment_after_dm": bool(rule.comment_after_dm), "rule_id": rule.id})
                            stats["enqueued"] += 1
                except Exception as e:
                    logger.warning("ig_detect_comments_failed", error=str(e)[:200]); stats["errors"] += 1

            # ── دایرکت‌ها (فرم و قاعده هر دو فوری) ──
            direct_rules = [r for r in rules if r.on_direct]
            # حتی برای قاعده‌های فقط‌کامنتِ دارای «شرطِ فالو» هم باید دایرکت poll شود تا «فالو دارم» را بگیریم
            needs_dm = direct_rules or forms or any(r.require_follow for r in rules)
            if needs_dm and scope in ("all", "dm"):
                try:
                    res = await _worker("POST", "/poll_dms", {"account_id": acc.id, "amount": min(amount, 5)})
                    for m in res.get("messages", []):
                        stats["dms_checked"] += 1
                        ext = f"d:{m['msg_id']}"
                        if dm_since and m.get("ts") and datetime.fromtimestamp(m["ts"], tz=timezone.utc) < dm_since:
                            continue
                        if await _seen(db, acc.id, ext):
                            continue
                        # آزادسازیِ گیتِ فالو: کاربرِ منتظر «فالو دارم» را فرستاد → دوباره چک، بعد ارسالِ محتوا
                        gate = await _gate_get(acc.id, m["user_pk"])
                        if gate:
                            grule = next((r for r in rules if r.id == gate.get("rule_id")), None)
                            txt = (m.get("text") or "").strip()
                            btn = _follow_btn(grule)
                            if grule and (btn in txt or "فالو" in txt or "دارم" in txt or "کردم" in txt or "follow" in txt.lower()):
                                status = await is_follower(m["user_pk"], account_id=acc.id, fresh=True)
                                if status is False:
                                    out_parts = [{"type": "text", "text": f"به‌نظر هنوز فالو نکرده‌اید 🙏 لطفاً صفحه را فالو کنید و دوباره «{btn}» را بفرستید.", "links": []}]
                                    release = False
                                else:
                                    out_parts = await _build_parts(grule, msgs, "", txt)
                                    release = True
                                try:
                                    await _send_parts(m["user_pk"], out_parts, account_id=acc.id)
                                    if release:
                                        await _gate_clear(acc.id, m["user_pk"])
                                        grule.sent_count = (grule.sent_count or 0) + 1
                                        await _rate_inc()
                                    stats["sent_instant"] += 1
                                except Exception as e:
                                    logger.warning("ig_gate_release_failed", error=str(e)[:200]); stats["errors"] += 1
                                db.add(IgInbox(account_id=acc.id, kind="direct", from_username=m.get("user_pk"),
                                               text_in=m.get("text"), text_out=_parts_text(out_parts), handled=True,
                                               auto_reply_id=grule.id, ext_id=ext))
                                await db.commit()
                                continue
                        # فرم: پاسخِ فوری (گفتگوی زنده)
                        formed = await handle_form(forms, acc.id, m["user_pk"], m.get("text", "")) if forms else None
                        if formed is not None:
                            reply, _done = formed
                            sent = False
                            try:
                                await _worker("POST", "/dm_send", {"account_id": acc.id, "user_ids": [m["user_pk"]], "text": reply}); sent = True
                            except Exception as e:
                                logger.warning("ig_form_reply_failed", error=str(e)[:200]); stats["errors"] += 1
                            db.add(IgInbox(account_id=acc.id, kind="direct", from_username=m.get("user_pk"),
                                           text_in=m.get("text"), text_out=reply if sent else None,
                                           handled=sent, ext_id=ext))
                            await db.commit()
                            if sent:
                                stats["forms_sent"] += 1
                            continue
                        # قاعده: صف‌گذاری
                        rule = next((r for r in direct_rules if match(r, m.get("text", ""))), None)
                        if not rule:
                            continue
                        if rule.max_replies and rule.sent_count >= rule.max_replies:
                            continue
                        # شرطِ فالو روی دایرکت — پیامِ فالو + گیت
                        if rule.require_follow and (await is_follower(m["user_pk"], account_id=acc.id)) is not True:
                            parts = _follow_parts(rule, acc.username)
                            await _gate_set(acc.id, m["user_pk"], rule.id)
                        else:
                            parts = await _build_parts(rule, msgs, "", m.get("text", ""))
                        if not parts:
                            continue
                        reply = _parts_text(parts)
                        row = IgInbox(account_id=acc.id, kind="direct", from_username=m.get("user_pk"),
                                      text_in=m.get("text"), text_out=reply, auto_reply_id=rule.id,
                                      handled=False, ext_id=ext)
                        db.add(row); await db.commit(); await db.refresh(row)
                        # ارسالِ فوریِ دایرکت (پاسخِ سریع) — اگر سقفِ ساعتی پر بود، در صف می‌ماند
                        cap_ok = (await _rate_used()) < (await _rate_cap())
                        sent = False
                        if cap_ok:
                            try:
                                await _send_parts(m["user_pk"], parts, account_id=acc.id)
                                sent = True
                            except Exception as e:
                                logger.warning("ig_dm_instant_failed", error=str(e)[:200])
                        if sent:
                            row.handled = True
                            await _rate_inc()
                            rule.sent_count = (rule.sent_count or 0) + 1
                            await db.commit()
                            await _schedule_reminder(rule, acc.id, m["user_pk"])
                            stats["sent_instant"] += 1
                        else:
                            await _enqueue({"inbox_id": row.id, "account_id": acc.id, "kind": "direct",
                                            "user_pk": m["user_pk"], "parts": parts, "reply": reply,
                                            "rule_id": rule.id})
                            stats["enqueued"] += 1
                except Exception as e:
                    logger.warning("ig_detect_dms_failed", error=str(e)[:200]); stats["errors"] += 1
    await _release(f"detect:{scope}")
    logger.info("ig_detect_done", **stats)
    return stats


# ─────────────── فرستندهٔ نرخ‌دار ───────────────
async def drain_queue(batch: int = 8) -> dict:
    """از صف با رعایتِ سقفِ ساعتی می‌فرستد. باقی در صف می‌ماند تا دورِ بعد."""
    await _ensure_redis()
    stats = {"sent": 0, "skipped_rate": 0, "errors": 0, "queue": 0}
    if not await _acquire("drain", ttl=25):
        stats["queue"] = await queue_len()
        return stats
    cap = await _rate_cap()
    used = await _rate_used()
    budget = max(0, cap - used)
    if budget <= 0:
        stats["skipped_rate"] = await queue_len()
        stats["queue"] = stats["skipped_rate"]
        await _release("drain")
        return stats
    n = min(batch, budget)
    async with _task_db() as db:
        for _ in range(n):
            raw = await redis_client.client.lpop(SENDQ)
            if not raw:
                break
            job = json.loads(raw)
            ok = False
            try:
                # چند بخش (متن/رسانه) یا حالتِ قدیمیِ تک‌متن
                _aid = job.get("account_id")
                parts = job.get("parts")
                if parts:
                    await _send_parts(job["user_pk"], parts, account_id=_aid)
                else:
                    await _worker("POST", "/dm_send", {"account_id": _aid, "user_ids": [job["user_pk"]], "text": job.get("reply", ""),
                                                       "links": job.get("links") or []})
                ok = True
                if job.get("kind") == "comment" and job.get("comment_after_dm"):
                    try:
                        await _worker("POST", "/comment_reply", {"account_id": _aid, "media_id": job["media_id"],
                                                                 "text": (job.get("reply") or "")[:300], "comment_pk": job["comment_pk"]})
                    except Exception:
                        pass
            except Exception as e:
                logger.warning("ig_send_failed", error=str(e)[:200]); stats["errors"] += 1
            # به‌روزرسانیِ inbox + نرخ + شمارندهٔ قاعده
            row = (await db.execute(select(IgInbox).where(IgInbox.id == job["inbox_id"]))).scalar_one_or_none()
            if row:
                row.handled = ok
                if not ok:
                    row.text_out = None
            if ok:
                await _rate_inc()
                rr = (await db.execute(select(IgAutoReply).where(IgAutoReply.id == job.get("rule_id")))).scalar_one_or_none()
                if rr:
                    rr.sent_count = (rr.sent_count or 0) + 1
                stats["sent"] += 1
            await db.commit()
    await _release("drain")
    stats["queue"] = await queue_len()
    logger.info("ig_drain_done", **stats)
    return stats


async def send_reminders() -> dict:
    """پیام‌های یادآوریِ سررسیده را می‌فرستد (ZSETِ ig:reminders)."""
    await _ensure_redis()
    import time as _t
    now = _t.time()
    sent = 0
    due = await redis_client.client.zrangebyscore("ig:reminders", 0, now, start=0, num=50)
    if not due:
        return {"sent": 0}
    async with _task_db() as db:
        for payload in due:
            await redis_client.client.zrem("ig:reminders", payload)
            try:
                job = json.loads(payload)
                msg = (await db.execute(select(IgMessage).where(IgMessage.id == job["message_id"]))).scalar_one_or_none()
                text = (msg.text if msg else None) or "یادآوری 🔔"
                await _worker("POST", "/dm_send", {"user_ids": [job["user_pk"]], "text": text})
                db.add(IgInbox(account_id=job["account_id"], kind="direct", from_username=job["user_pk"],
                               text_in="(یادآوری)", text_out=text, handled=True, ext_id=f"rem:{payload[:40]}"))
                await db.commit(); sent += 1
            except Exception as e:
                logger.warning("ig_reminder_failed", error=str(e)[:150])
    logger.info("ig_reminders_done", sent=sent)
    return {"sent": sent}


# سازگاری با تستِ دستی قدیمی
async def poll_and_reply(amount: int = 6) -> dict:
    d = await detect_and_enqueue(amount)
    s = await drain_queue(batch=20)
    return {**d, **{f"send_{k}": v for k, v in s.items()}, "replied": s["sent"]}
