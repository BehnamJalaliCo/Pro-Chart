"""انتشارِ محتوای اینستاگرام — تولیدِ کاور/کپشنِ AI، انتشارِ تکی/چنداکانتی/زمان‌بندی + حذفِ خودکار."""
from __future__ import annotations

import html as _html
import os
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import IgAccount, IgAutoReply, IgContent, IgMessage, async_session_factory
from src.core.logger import get_logger
from src.llm.client import llm_client

logger = get_logger(__name__)
IG_WORKER = os.environ.get("IG_WORKER_URL", "http://ig-worker:8090")
CHART_HTML = os.environ.get("CHART_RENDERER_HTML_URL", "http://chart-renderer:8086/render-html")
MEDIA_DIR = os.environ.get("IG_MEDIA_DIR", "/app/ig_media")


async def _worker(path: str, json_body: dict, timeout: float = 180):
    async with httpx.AsyncClient(timeout=timeout) as cl:
        r = await cl.post(f"{IG_WORKER}{path}", json=json_body)
        r.raise_for_status()
        return r.json()


# ─────────────── تولیدِ کپشنِ AI ───────────────
async def gen_caption(prompt: str, lang: str = "fa") -> str | None:
    system = ("تو کپشن‌نویسِ حرفه‌ایِ اینستاگرامِ پیجِ Coinepro (آموزشِ فارکس) هستی. "
              "کپشنِ جذاب، کوتاه، با ایموجیِ مناسب و یک call-to-action بنویس. "
              "در پایان ۵ تا ۸ هشتگِ مرتبطِ فارسی/انگلیسی بگذار. فقط متنِ کپشن را بده.")
    for attempt in range(2):
        try:
            out = await llm_client.complete(prompt, system=system, system_replace=True, timeout=90)
            if out and out.strip():
                return out.strip()
        except Exception as e:
            logger.warning("gen_caption_failed", attempt=attempt, error=str(e)[:150])
    return None


# ─────────────── تولیدِ کاملِ محتوا با AI (موضوع → همه‌چیز) ───────────────
async def gen_full_content(topic: str, post_type: str = "reel", keyword: str | None = None, cta: str = "dm") -> dict:
    """از یک موضوع، کلِ بستهٔ محتوا را می‌سازد. اگر keyword بدهی، صحنهٔ آخرِ ویدیو و کپشن
    حتماً همان کلیدواژه را به‌عنوان CTA می‌گویند (cta=dm → «در دایرکت بفرست»، comment → «کامنت کن»)."""
    import json as _json
    import re as _re
    cta_fa = "در دایرکتِ همین پیج بفرستد" if cta == "dm" else "زیرِ همین پست کامنت کند"
    kw_rule = (
        f"کلیدواژهٔ این محتوا «{keyword}» است (آن را در خروجی هم در فیلدِ keyword بگذار). "
        f"صحنهٔ آخرِ video_prompt و انتهای caption حتماً دعوت کنند که مخاطب کلمهٔ «{keyword}» را {cta_fa} تا لینک/هدیه را بگیرد."
        if keyword else
        "یک کلمهٔ کلیدیِ ساده و مرتبط با موضوع برای keyword انتخاب کن و در صحنهٔ آخرِ ویدیو و کپشن، دعوت کن مخاطب آن کلمه را بفرستد."
    )
    system = (
        "تو استراتژیستِ محتوای اینستاگرامِ پیجِ Coinepro (آموزشِ فارکس، رباتِ سیگنال، آکادمی، کانال) هستی. "
        "از موضوعِ کاربر یک بستهٔ کاملِ محتوای حرفه‌ای بساز. خروجی فقط JSON باشد بدونِ توضیح، با کلیدها: "
        "{\"title\":\"عنوانِ کوتاه\",\"video_prompt\":\"سناریوی ویدیوی کوتاه (۴ تا ۶ صحنه)؛ صحنهٔ آخر = دعوت به ارسالِ کلیدواژه\","
        "\"caption\":\"کپشنِ جذابِ فارسی با ایموجی\",\"hashtags\":\"۸ تا ۱۲ هشتگِ مرتبط\","
        "\"keyword\":\"کلمهٔ کلیدی\",\"reply_text\":\"متنِ کوتاهِ پاسخِ دایرکت وقتی کلیدواژه می‌آید\"}. "
        f"{kw_rule} لحن حرفه‌ای و گرم؛ بدونِ غلطِ املایی."
    )
    prompt = f"موضوع: {topic}\nنوعِ محتوا: {post_type}"
    raw = None
    for attempt in range(2):
        try:
            raw = await llm_client.complete(prompt, system=system, system_replace=True, timeout=120)
            if raw and raw.strip():
                break
        except Exception as e:
            logger.warning("gen_full_content_failed", attempt=attempt, error=str(e)[:150])
    if not raw:
        return {}
    m = _re.search(r"\{.*\}", raw, _re.S)
    try:
        data = _json.loads(m.group(0) if m else raw)
    except Exception:
        return {"caption": raw.strip()[:1500]}
    out = {k: (str(v).strip() if v is not None else "") for k, v in data.items()}
    if keyword:
        out["keyword"] = keyword
    return out


async def suggest_topics(count: int = 20, context: str = "") -> list[dict]:
    """فهرستی از موضوع‌های جذابِ ویدیو (مرتبط با پروژه) + کلیدواژهٔ پیشنهادی برای هرکدام."""
    import json as _json
    import re as _re
    n = max(3, min(int(count or 20), 40))
    system = (
        "تو استراتژیستِ محتوای پیجِ Coinepro (آموزشِ فارکس، رباتِ سیگنال، آکادمیِ VIP، کانالِ تلگرام، پنلِ کاربری) هستی. "
        f"{n} موضوعِ جذابِ ویدیوی کوتاهِ اینستاگرام پیشنهاد بده که مخاطب را جذب و به محصولاتِ ما هدایت کند. "
        "برای هر موضوع یک کلیدواژهٔ ساده هم پیشنهاد بده. خروجی فقط JSON: "
        "[{\"topic\":\"...\",\"keyword\":\"...\"}, ...] بدونِ توضیح."
    )
    prompt = (context.strip() or "موضوع‌های متنوع: آموزش فارکس، مدیریت ریسک، روانشناسی، رباتِ سیگنال، آکادمی، تحلیل تکنیکال")
    raw = None
    for attempt in range(2):
        try:
            raw = await llm_client.complete(prompt, system=system, system_replace=True, timeout=120)
            if raw and raw.strip():
                break
        except Exception as e:
            logger.warning("suggest_topics_failed", attempt=attempt, error=str(e)[:150])
    if not raw:
        return []
    m = _re.search(r"\[.*\]", raw, _re.S)
    try:
        data = _json.loads(m.group(0) if m else raw)
    except Exception:
        return []
    out = []
    for it in (data or []):
        if isinstance(it, dict) and it.get("topic"):
            out.append({"topic": str(it["topic"]).strip()[:200], "keyword": str(it.get("keyword") or "").strip()[:40]})
        elif isinstance(it, str) and it.strip():
            out.append({"topic": it.strip()[:200], "keyword": ""})
    return out[:n]


# ─────────────── تولیدِ کاورِ برنددار ───────────────
def _cover_html(title: str, subtitle: str = "") -> str:
    t = _html.escape(title or "")
    s = _html.escape(subtitle or "")
    return f"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@600;800;900&display=swap');
*{{margin:0;padding:0;box-sizing:border-box;font-family:'Vazirmatn',sans-serif}}
html,body{{width:1080px;height:1080px;overflow:hidden}}
.s{{position:relative;width:1080px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:34px;padding:0 90px;
  background:radial-gradient(800px 520px at 50% 28%,#11202e 0%,#0a111d 55%,#070b14 100%);color:#e8eef5}}
.g{{position:absolute;border-radius:50%;opacity:.4}}
.g1{{width:520px;height:520px;background:radial-gradient(circle,#0f766e 0%,transparent 70%);top:-120px;left:-90px}}
.g2{{width:460px;height:460px;background:radial-gradient(circle,#155e75 0%,transparent 70%);bottom:-130px;right:-70px}}
.brand{{position:absolute;top:54px;font-size:34px;font-weight:800;color:#34d399;letter-spacing:1px;z-index:2}}
.title{{font-size:88px;font-weight:900;line-height:1.2;z-index:2;
  background:linear-gradient(90deg,#fff,#9ff5d8);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{font-size:42px;color:#aebdcb;line-height:1.6;z-index:2;max-width:880px}}
.u{{width:300px;height:8px;border-radius:8px;background:linear-gradient(90deg,#10b981,#34d399);z-index:2}}
.b{{position:absolute;bottom:60px;font-size:30px;color:#64748b;z-index:2}}
</style></head><body>
<div class="s"><div class="g g1"></div><div class="g g2"></div>
  <div class="brand">Coinepro · آکادمی فارکس</div>
  <div class="title">{t}</div>
  {f'<div class="sub">{s}</div>' if s else ''}
  <div class="u"></div>
  <div class="b">@coineprofx</div>
</div></body></html>"""


async def render_cover(title: str, subtitle: str = "", behind: str = "") -> str:
    """کاورِ سریعِ برنددار می‌سازد — حالا از همان موتورِ حرفه‌ایِ قفل‌شدهٔ cover.render_cover
    (پس‌زمینهٔ نارنجیِ اصل + نوشتهٔ پشتِ Archivo Black + فارسیِ Lalezar + زردِ #FFF600) استفاده می‌کند
    تا هر کاوری که پنل می‌سازد عینِ Real-Cover باشد. نامِ فایل را برمی‌گرداند."""
    from src.instagram.cover import render_cover as _pro_cover
    # تیتر → سفید، زیرتیتر → زرد، نوشتهٔ پشت = کلمهٔ انگلیسیِ موضوع (یا برند)
    res = await _pro_cover({
        "ratio": "1:1",
        "font": "Lalezar",
        # base_filename حذف شد → پیش‌فرضِ baked-شدهٔ نارنجیِ اصل (مستقل از volume)
        "behind_text": (behind or "FOREX"),
        "white_text": title,
        "yellow_text": subtitle,
    })
    return res["filename"]


# ─────────────── انتشار ───────────────
def _final_caption(content: IgContent, account_id: int) -> str:
    cap = content.caption or ""
    if content.captions_custom and str(account_id) in content.captions_custom:
        cap = content.captions_custom[str(account_id)]
    if content.hashtags:
        cap = f"{cap}\n\n{content.hashtags}".strip()
    return cap


async def _wire_auto_reply(c: IgContent, db: AsyncSession) -> None:
    """بعد از انتشار: کلیدواژه → پیام (با دکمهٔ لینک) را به‌صورتِ دایرکتِ هوشمندِ همان پست می‌سازد.
    این همان «در پایان بگو کلمهٔ آموزش را بفرست» است که خودکار به آن پست وصل می‌شود."""
    if not c.auto_reply_keyword or c.auto_reply_done:
        return
    media_pk = None
    for v in (c.result or {}).values():
        if v.get("media_pk"):
            media_pk = str(v["media_pk"]); break
    acc_id = (c.account_ids or [None])[0]
    if acc_id is None:
        acc = (await db.execute(select(IgAccount).where(IgAccount.is_active.is_(True)).limit(1))).scalar_one_or_none()
        acc_id = acc.id if acc else None
    if acc_id is None:
        return
    buttons = [{"label": "🔗 دریافتِ لینک", "kind": "link", "target": c.auto_reply_link}] if c.auto_reply_link else None
    msg = IgMessage(account_id=acc_id, title=f"اتوپاسخ — {c.auto_reply_keyword}",
                    msg_type="button" if buttons else "text",
                    text=(c.auto_reply_text or "این هم همان چیزی که خواستی 👇"), buttons=buttons)
    db.add(msg)
    await db.flush()
    rule = IgAutoReply(account_id=acc_id, title=f"کلیدواژه «{c.auto_reply_keyword}»",
                       on_direct=True, on_comment=True, match_mode="contains",
                       keywords=[{"mode": "contains", "value": c.auto_reply_keyword}],
                       message_id=msg.id, specific_media=media_pk, enabled=True, comment_after_dm=True)
    db.add(rule)
    c.auto_reply_done = True
    await db.commit()
    logger.info("ig_auto_reply_wired", content_id=c.id, keyword=c.auto_reply_keyword, media_pk=media_pk)


async def publish_content(content_id: int, db: AsyncSession | None = None) -> dict:
    own = db is None
    if own:
        db_ctx = async_session_factory()
        db = await db_ctx.__aenter__()
    try:
        c = (await db.execute(select(IgContent).where(IgContent.id == content_id))).scalar_one_or_none()
        if c is None:
            return {"error": "not found"}
        media = c.media_urls or ([c.cover_url] if c.cover_url else [])
        if not media:
            c.status = "failed"; c.result = {"error": "بدونِ رسانه"}; await db.commit()
            return {"error": "no media"}
        acc_ids = c.account_ids or []
        if not acc_ids:
            acc = (await db.execute(select(IgAccount).where(IgAccount.is_active.is_(True)).limit(1))).scalar_one_or_none()
            acc_ids = [acc.id] if acc else []
        c.status = "publishing"; await db.commit()
        result = {}
        pt = (c.post_type or "post").lower()
        if pt == "story":
            kind = "story"
        elif pt == "reel":
            kind = "reel"
        elif len(media) > 1:
            kind = "album"
        elif str(media[0]).lower().endswith((".mp4", ".mov")):
            kind = "video"
        else:
            kind = "photo"
        for aid in acc_ids:
            try:
                out = await _worker("/publish", {"account_id": str(aid), "media": media, "caption": _final_caption(c, aid),
                                                 "kind": kind, "first_comment": c.first_comment})
                result[str(aid)] = {"media_pk": out.get("media_pk"), "code": out.get("code"), "url": out.get("url")}
            except Exception as e:
                result[str(aid)] = {"error": str(e)[:200]}
        ok = any("code" in v for v in result.values())
        c.status = "published" if ok else "failed"
        c.published_at = datetime.now(timezone.utc)
        c.result = result
        await db.commit()
        if ok:
            try:
                await _wire_auto_reply(c, db)
            except Exception as e:
                logger.warning("ig_auto_reply_wire_failed", content_id=content_id, error=str(e)[:200])
        logger.info("ig_content_published", content_id=content_id, ok=ok)
        return {"ok": ok, "result": result}
    finally:
        if own:
            await db_ctx.__aexit__(None, None, None)


async def publish_due() -> dict:
    """محتواهای زمان‌بندی‌شدهٔ سررسیده + حذفِ خودکارِ پست‌های منقضی."""
    from src.instagram.engine import _task_db   # engineِ مستقلِ NullPool روی loopِ تسک
    now = datetime.now(timezone.utc)
    published = 0
    async with _task_db() as db:
        due = (await db.execute(select(IgContent).where(
            IgContent.status == "scheduled", IgContent.scheduled_at.isnot(None),
            IgContent.scheduled_at <= now))).scalars().all()
        for c in due:
            # اگر ویدیوی خودکار هنوز آماده نیست، انتشار را به دورِ بعد موکول کن
            if c.gen_video and c.video_status != "ready":
                continue
            await publish_content(c.id, db=db)
            published += 1
        # حذفِ خودکار
        old = (await db.execute(select(IgContent).where(
            IgContent.status == "published", IgContent.auto_delete_at.isnot(None),
            IgContent.auto_delete_at <= now))).scalars().all()
        for c in old:
            for v in (c.result or {}).values():
                if v.get("media_pk"):
                    try:
                        await _worker("/delete", {"media_pk": v["media_pk"]})
                    except Exception:
                        pass
            c.status = "deleted"; c.auto_delete_at = None
        if old:
            await db.commit()
    return {"published": published}
