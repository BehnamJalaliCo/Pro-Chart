"""
ماژولِ مستقلِ «اینستاگرام» در پنلِ ادمین (روی /admin/instagram). هیچ ربطی به آکادمی ندارد.

از سرویسِ ig-worker (instagrapi) برای عملیاتِ زنده استفاده می‌کند و وضعیت/قواعد/محتوا را در
جدول‌های ig_* نگه می‌دارد. همه نیازمندِ نقشِ admin.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import httpx
import uuid
from datetime import datetime as _dt

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, require_role
from src.core.database import (
    Admin,
    IgAccount,
    IgAutopilot,
    IgAutoReply,
    IgContent,
    IgForm,
    IgInbox,
    IgMessage,
)

MEDIA_DIR = os.environ.get("IG_MEDIA_DIR", "/app/ig_media")

router = APIRouter()

IG_WORKER = os.environ.get("IG_WORKER_URL", "http://ig-worker:8090")


async def _worker(method: str, path: str, json: dict | None = None, timeout: float = 90):
    """فراخوانیِ سرویسِ ig-worker."""
    async with httpx.AsyncClient(timeout=timeout) as cl:
        r = await cl.request(method, f"{IG_WORKER}{path}", json=json)
        r.raise_for_status()
        return r.json()


# ─────────────────────────── اکانت‌ها ───────────────────────────
@router.get("/accounts")
async def list_accounts(_: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(IgAccount).order_by(IgAccount.id))).scalars().all()
    return [{"id": a.id, "username": a.username, "full_name": a.full_name, "ig_pk": a.ig_pk,
             "avatar_url": a.avatar_url, "status": a.status, "is_active": a.is_active,
             "smart_enabled": a.smart_enabled,
             "last_login_at": a.last_login_at.isoformat() if a.last_login_at else None,
             "last_error": a.last_error,
             "created_at": a.created_at.isoformat() if a.created_at else None} for a in rows]


@router.post("/accounts/sync")
async def sync_accounts(_: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    """وضعیتِ زندهٔ اکانتِ متصل را از ig-worker می‌گیرد و در ig_accounts upsert می‌کند."""
    try:
        st = await _worker("GET", "/status")
    except Exception as e:
        raise HTTPException(502, f"ig-worker در دسترس نیست: {str(e)[:200]}")
    if not st.get("online"):
        # حتی در خطا، اگر اکانتی هست وضعیتش را error کن
        raise HTTPException(502, f"اتصال ناموفق: {st.get('error', 'unknown')[:200]}")
    username = st["username"]
    acc = (await db.execute(select(IgAccount).where(IgAccount.username == username))).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if acc is None:
        acc = IgAccount(username=username)
        db.add(acc)
    acc.ig_pk = st.get("pk")
    acc.full_name = st.get("full_name")
    acc.avatar_url = st.get("avatar")
    acc.status = "online"
    acc.last_login_at = now
    acc.last_error = None
    acc.is_active = True
    await db.commit()
    await db.refresh(acc)
    return {"id": acc.id, "username": acc.username, "full_name": acc.full_name,
            "followers": st.get("followers"), "following": st.get("following"),
            "media_count": st.get("media_count"), "avatar_url": acc.avatar_url, "status": acc.status}


@router.post("/accounts/{account_id}/smart-toggle")
async def smart_toggle(account_id: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    """روشن/خاموش‌کردنِ پاسخِ هوشمندِ یک اکانت."""
    acc = (await db.execute(select(IgAccount).where(IgAccount.id == account_id))).scalar_one_or_none()
    if acc is None:
        raise HTTPException(404, "اکانت یافت نشد.")
    acc.smart_enabled = not acc.smart_enabled
    await db.commit()
    return {"id": acc.id, "smart_enabled": acc.smart_enabled}


@router.get("/accounts/{account_id}/media")
async def account_media(account_id: int, amount: int = Query(12), refresh: bool = Query(False), _: Admin = Depends(require_role("admin"))):
    """گریدِ پست/ریلزهای اکانت — برای «فعال‌سازی برای یک پستِ خاص». کشِ ۱۰دقیقه‌ای تا لودِ سریع."""
    from src.core.redis_client import redis_client
    key = f"ig:mediacache:{account_id}:{amount}"
    if not refresh:
        cached = await redis_client.get_json(key)
        if cached:
            return cached
    try:
        res = await _worker("POST", "/user_media", {"amount": amount})
    except Exception as e:
        raise HTTPException(502, f"دریافتِ رسانه ناموفق: {str(e)[:200]}")
    try:
        await redis_client.set_json(key, res, expire=600)
    except Exception:
        pass
    return res


@router.get("/accounts/{account_id}/live")
async def account_live(account_id: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    """آمارِ زندهٔ اکانت (فالوور/پست) مستقیم از ig-worker."""
    acc = (await db.execute(select(IgAccount).where(IgAccount.id == account_id))).scalar_one_or_none()
    if acc is None:
        raise HTTPException(404, "اکانت یافت نشد.")
    try:
        st = await _worker("GET", "/status")
        return {"online": st.get("online"), "followers": st.get("followers"),
                "following": st.get("following"), "media_count": st.get("media_count")}
    except Exception as e:
        return {"online": False, "error": str(e)[:200]}


# ─────────────────────────── پیشخوان (آمار) ───────────────────────────
@router.get("/dashboard")
async def dashboard(_: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=7)

    async def _count(model, *conds):
        return (await db.execute(select(func.count()).select_from(model).where(*conds))).scalar() or 0

    dm_sent = await _count(IgInbox, IgInbox.kind == "direct", IgInbox.text_out.isnot(None), IgInbox.created_at >= since)
    cm_sent = await _count(IgInbox, IgInbox.kind == "comment", IgInbox.text_out.isnot(None), IgInbox.created_at >= since)
    published = await _count(IgContent, IgContent.status == "published")
    scheduled = await _count(IgContent, IgContent.status == "scheduled")
    drafts = await _count(IgContent, IgContent.status == "draft")
    rules = await _count(IgAutoReply, IgAutoReply.enabled.is_(True))

    recent = (await db.execute(select(IgInbox).order_by(IgInbox.id.desc()).limit(8))).scalars().all()
    msgs = [{"kind": m.kind, "from": m.from_username, "text": (m.text_in or "")[:80],
             "at": m.created_at.isoformat() if m.created_at else None} for m in recent]

    return {"smart_reply": {"dm_sent": dm_sent, "comment_sent": cm_sent, "active_rules": rules},
            "content": {"published": published, "scheduled": scheduled, "drafts": drafts},
            "recent_messages": msgs}


# ─────────────────────────── پیام‌ها (قابلِ‌استفادهٔ مجدد) ───────────────────────────
def _msg_out(m: IgMessage) -> dict:
    return {"id": m.id, "account_id": m.account_id, "title": m.title, "msg_type": m.msg_type,
            "text": m.text, "buttons": m.buttons, "file_url": m.file_url, "file_kind": m.file_kind,
            "products": m.products}


@router.get("/accounts/{account_id}/messages")
async def list_messages(account_id: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(IgMessage).where(IgMessage.account_id == account_id).order_by(IgMessage.id.desc()))).scalars().all()
    return [_msg_out(m) for m in rows]


@router.post("/messages")
async def create_message(data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    if not data.get("account_id") or not data.get("title"):
        raise HTTPException(400, "account_id و title لازم است.")
    m = IgMessage(account_id=int(data["account_id"]), title=data["title"][:255],
                  msg_type=data.get("msg_type", "text"), text=data.get("text"),
                  buttons=data.get("buttons"), file_url=data.get("file_url"),
                  file_kind=data.get("file_kind"), products=data.get("products"))
    db.add(m); await db.commit(); await db.refresh(m)
    return _msg_out(m)


@router.put("/messages/{mid}")
async def update_message(mid: int, data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    m = (await db.execute(select(IgMessage).where(IgMessage.id == mid))).scalar_one_or_none()
    if m is None:
        raise HTTPException(404, "یافت نشد.")
    for f in ("title", "msg_type", "text", "buttons", "file_url", "file_kind", "products"):
        if f in data:
            setattr(m, f, data[f])
    await db.commit(); return _msg_out(m)


@router.delete("/messages/{mid}")
async def delete_message(mid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(IgMessage).where(IgMessage.id == mid)); await db.commit()
    return {"ok": True}


# ─────────────────────────── پاسخِ خودکار (جزئیاتِ دستور) ───────────────────────────
_RULE_FIELDS = ("title", "on_direct", "on_comment", "match_mode", "keywords", "message_id", "message_ids",
                "require_follow", "follow_message", "follow_button_text", "specific_media",
                "reminder", "reminder_hours", "reminder_message_id", "comment_after_dm",
                "max_replies", "like_dm", "use_ai", "ai_prompt", "enabled")


def _rule_out(r: IgAutoReply, titles: dict | None = None) -> dict:
    titles = titles or {}
    ids = list(r.message_ids or ([r.message_id] if r.message_id else []))
    return {"id": r.id, "account_id": r.account_id, "title": r.title, "on_direct": r.on_direct,
            "on_comment": r.on_comment, "match_mode": r.match_mode, "keywords": r.keywords or [],
            "message_id": r.message_id, "message_ids": ids, "message_title": titles.get(r.message_id),
            "message_titles": [titles.get(int(i)) for i in ids], "require_follow": r.require_follow,
            "follow_message": r.follow_message, "follow_button_text": r.follow_button_text,
            "specific_media": r.specific_media, "reminder": r.reminder, "reminder_hours": r.reminder_hours,
            "reminder_message_id": r.reminder_message_id, "comment_after_dm": r.comment_after_dm,
            "max_replies": r.max_replies, "like_dm": r.like_dm, "use_ai": r.use_ai, "ai_prompt": r.ai_prompt,
            "enabled": r.enabled, "sent_count": r.sent_count,
            "created_at": r.created_at.isoformat() if r.created_at else None}


@router.get("/accounts/{account_id}/auto-replies")
async def list_rules(account_id: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(IgAutoReply).where(IgAutoReply.account_id == account_id).order_by(IgAutoReply.id.desc()))).scalars().all()
    titles = {m.id: m.title for m in (await db.execute(select(IgMessage).where(IgMessage.account_id == account_id))).scalars().all()}
    return [_rule_out(r, titles) for r in rows]


@router.post("/auto-replies")
async def create_rule(data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    if not data.get("account_id"):
        raise HTTPException(400, "account_id لازم است.")
    if not data.get("on_direct") and not data.get("on_comment"):
        raise HTTPException(400, "حداقل یکی از دایرکت/کامنت را انتخاب کن.")
    if data.get("match_mode") in ("equal", "contains") and not (data.get("keywords") or []):
        raise HTTPException(400, "برای «برابر/شامل» حداقل یک مقدار لازم است.")
    r = IgAutoReply(account_id=int(data["account_id"]))
    for f in _RULE_FIELDS:
        if f in data:
            setattr(r, f, data[f])
    db.add(r); await db.commit(); await db.refresh(r)
    return _rule_out(r)


@router.put("/auto-replies/{rid}")
async def update_rule(rid: int, data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    r = (await db.execute(select(IgAutoReply).where(IgAutoReply.id == rid))).scalar_one_or_none()
    if r is None:
        raise HTTPException(404, "یافت نشد.")
    for f in _RULE_FIELDS:
        if f in data:
            setattr(r, f, data[f])
    await db.commit(); return _rule_out(r)


@router.post("/auto-replies/{rid}/toggle")
async def toggle_rule(rid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    r = (await db.execute(select(IgAutoReply).where(IgAutoReply.id == rid))).scalar_one_or_none()
    if r is None:
        raise HTTPException(404, "یافت نشد.")
    r.enabled = not r.enabled; await db.commit()
    return {"id": r.id, "enabled": r.enabled}


@router.delete("/auto-replies/{rid}")
async def delete_rule(rid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(IgAutoReply).where(IgAutoReply.id == rid)); await db.commit()
    return {"ok": True}


@router.post("/poll-now")
async def poll_now(_: Admin = Depends(require_role("admin"))):
    """اجرای دستیِ یک دورِ پاسخِ خودکار (برای تست)."""
    from src.instagram.engine import poll_and_reply
    return await poll_and_reply()


@router.get("/settings")
async def get_settings(_: Admin = Depends(require_role("admin"))):
    """نرخِ ارسالِ امن + وضعیتِ صف + ارسالِ این ساعت."""
    from src.instagram.engine import _rate_cap, _rate_used, queue_len
    return {"rate_cap": await _rate_cap(), "sent_this_hour": await _rate_used(), "queue": await queue_len()}


@router.post("/settings")
async def set_settings(data: dict = Body(...), _: Admin = Depends(require_role("admin"))):
    """تنظیمِ سقفِ ارسال در ساعت (احتیاط: برای اکانتِ غیررسمی محافظه‌کار بمان)."""
    from src.core.redis_client import redis_client
    cap = int(data.get("rate_cap", 60))
    cap = max(1, min(cap, 1000))
    await redis_client.set_json("ig:rate_cap", cap, expire=31536000)  # ~۱ سال (ماندگار)
    return {"rate_cap": cap}


# ─────────────────────────── صندوق (پیام‌ها/نظرات) ───────────────────────────
@router.get("/accounts/{account_id}/inbox")
async def inbox(account_id: int, kind: str = Query("comment"), limit: int = Query(50),
                _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(IgInbox).where(
        IgInbox.account_id == account_id, IgInbox.kind == kind)
        .order_by(IgInbox.id.desc()).limit(min(limit, 200)))).scalars().all()
    return [{"id": r.id, "from": r.from_username, "media_code": r.media_code,
             "text_in": r.text_in, "text_out": r.text_out, "handled": r.handled,
             "at": r.created_at.isoformat() if r.created_at else None} for r in rows]


# ─────────────────────────── فرم‌ساز ───────────────────────────
_FORM_FIELDS = ("title", "start_trigger", "questions", "cancel_trigger",
                "cancel_message", "end_message", "enabled")


def _form_out(f: IgForm) -> dict:
    return {"id": f.id, "account_id": f.account_id, "title": f.title,
            "start_trigger": f.start_trigger, "questions": f.questions or [],
            "cancel_trigger": f.cancel_trigger, "cancel_message": f.cancel_message,
            "end_message": f.end_message, "enabled": f.enabled,
            "created_at": f.created_at.isoformat() if f.created_at else None}


@router.get("/accounts/{account_id}/forms")
async def list_forms(account_id: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(IgForm).where(IgForm.account_id == account_id).order_by(IgForm.id.desc()))).scalars().all()
    return [_form_out(f) for f in rows]


@router.post("/forms")
async def create_form(data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    if not data.get("account_id") or not data.get("title"):
        raise HTTPException(400, "account_id و title لازم است.")
    if not data.get("start_trigger"):
        raise HTTPException(400, "دستورِ شروع لازم است.")
    f = IgForm(account_id=int(data["account_id"]))
    for fld in _FORM_FIELDS:
        if fld in data:
            setattr(f, fld, data[fld])
    db.add(f); await db.commit(); await db.refresh(f)
    return _form_out(f)


@router.put("/forms/{fid}")
async def update_form(fid: int, data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    f = (await db.execute(select(IgForm).where(IgForm.id == fid))).scalar_one_or_none()
    if f is None:
        raise HTTPException(404, "یافت نشد.")
    for fld in _FORM_FIELDS:
        if fld in data:
            setattr(f, fld, data[fld])
    await db.commit(); return _form_out(f)


# ─────────────────────────── انتشارِ محتوا (فاز ۴) ───────────────────────────
def _content_out(c: IgContent) -> dict:
    return {"id": c.id, "account_ids": c.account_ids or [], "post_type": c.post_type, "title": c.title, "caption": c.caption,
            "captions_custom": c.captions_custom, "media_urls": c.media_urls or [], "cover_url": c.cover_url,
            "hashtags": c.hashtags, "first_comment": c.first_comment, "x_thread": c.x_thread,
            "ai_prompt": c.ai_prompt, "source": c.source, "mode": c.mode,
            "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
            "auto_delete_at": c.auto_delete_at.isoformat() if c.auto_delete_at else None,
            "status": c.status, "result": c.result,
            "gen_video": c.gen_video, "video_prompt": c.video_prompt, "video_status": c.video_status, "video_spec": c.video_spec,
            "auto_reply_keyword": c.auto_reply_keyword, "auto_reply_link": c.auto_reply_link,
            "auto_reply_text": c.auto_reply_text, "auto_reply_done": c.auto_reply_done,
            "published_at": c.published_at.isoformat() if c.published_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None}


_CONTENT_FIELDS = ("account_ids", "post_type", "title", "caption", "captions_custom", "media_urls", "cover_url",
                   "hashtags", "first_comment", "x_thread", "ai_prompt", "source",
                   "gen_video", "video_prompt", "video_spec", "auto_reply_keyword", "auto_reply_link", "auto_reply_text")


@router.get("/contents")
async def list_contents(status: str = Query(None), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    q = select(IgContent).order_by(IgContent.id.desc()).limit(100)
    if status:
        q = q.where(IgContent.status == status)
    rows = (await db.execute(q)).scalars().all()
    return [_content_out(c) for c in rows]


@router.post("/contents")
async def create_content(data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    c = IgContent()
    for f in _CONTENT_FIELDS:
        if f in data:
            setattr(c, f, data[f])
    c.mode = data.get("mode", "draft")
    if data.get("scheduled_at"):
        c.scheduled_at = _dt.fromisoformat(data["scheduled_at"].replace("Z", "+00:00"))
    if data.get("auto_delete_at"):
        c.auto_delete_at = _dt.fromisoformat(data["auto_delete_at"].replace("Z", "+00:00"))
    c.status = {"now": "publishing", "schedule": "scheduled", "draft": "draft"}.get(c.mode, "draft")
    if data.get("gen_video"):
        # ویدیو باید اول خودکار ساخته شود → انتشار از مسیرِ زمان‌بندی (publish_due منتظرِ آماده‌شدنِ ویدیو می‌ماند)
        c.gen_video = True
        c.video_status = "pending"
        if c.mode == "now":
            c.scheduled_at = datetime.now(timezone.utc)
        c.status = "scheduled" if c.mode in ("now", "schedule") else "draft"
    db.add(c); await db.commit(); await db.refresh(c)
    if c.mode == "now" and not c.gen_video:
        from src.instagram.publisher import publish_content
        await publish_content(c.id)
        await db.refresh(c)
    return _content_out(c)


@router.post("/contents/{cid}/generate-video")
async def generate_content_video(cid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    """ساختِ فوریِ ویدیو (پیش‌نمایش/تست). ممکن است چند دقیقه طول بکشد."""
    from src.instagram.video_gen import generate_video
    res = await generate_video(cid, db)
    c = (await db.execute(select(IgContent).where(IgContent.id == cid))).scalar_one_or_none()
    return {"result": res, "content": _content_out(c) if c else None}


@router.put("/contents/{cid}")
async def update_content(cid: int, data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(IgContent).where(IgContent.id == cid))).scalar_one_or_none()
    if c is None:
        raise HTTPException(404, "یافت نشد.")
    for f in _CONTENT_FIELDS:
        if f in data:
            setattr(c, f, data[f])
    if "scheduled_at" in data:
        c.scheduled_at = _dt.fromisoformat(data["scheduled_at"].replace("Z", "+00:00")) if data["scheduled_at"] else None
    await db.commit(); return _content_out(c)


@router.post("/contents/{cid}/publish")
async def publish_content_now(cid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    from src.instagram.publisher import publish_content
    res = await publish_content(cid)
    c = (await db.execute(select(IgContent).where(IgContent.id == cid))).scalar_one_or_none()
    return {"result": res, "content": _content_out(c) if c else None}


@router.delete("/contents/{cid}")
async def delete_content(cid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(IgContent).where(IgContent.id == cid)); await db.commit()
    return {"ok": True}


@router.post("/upload")
async def upload_media(file: UploadFile = File(...), _: Admin = Depends(require_role("admin"))):
    """آپلودِ عکس/ویدیو به ig_media؛ نامِ فایل را برمی‌گرداند."""
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("png", "jpg", "jpeg", "webp", "mp4", "mov"):
        raise HTTPException(400, "فرمتِ مجاز: png/jpg/webp/mp4 (روی آیفون اگر HEIC بود، از «انتخابِ گزینهٔ سازگار» یا اسکرین‌شات استفاده کنید)")
    os.makedirs(MEDIA_DIR, exist_ok=True)
    fname = f"up_{uuid.uuid4().hex[:12]}.{'jpg' if ext == 'jpeg' else ext}"
    data = await file.read()
    if len(data) > 30 * 1024 * 1024:
        raise HTTPException(400, "حجم بیش از ۳۰ مگابایت.")
    with open(os.path.join(MEDIA_DIR, fname), "wb") as f:
        f.write(data)
    return {"filename": fname, "url": f"/api/public/ig-media/{fname}"}


@router.post("/ai/caption")
async def ai_caption(data: dict = Body(...), _: Admin = Depends(require_role("admin"))):
    """تولیدِ کپشن با Claude از روی پرامپت."""
    from src.instagram.publisher import gen_caption
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(400, "پرامپت لازم است.")
    cap = await gen_caption(prompt)
    if not cap:
        raise HTTPException(502, "تولیدِ کپشن ناموفق بود.")
    return {"caption": cap.strip()}


@router.post("/ai/cover")
async def ai_cover(data: dict = Body(...), _: Admin = Depends(require_role("admin"))):
    """تولیدِ کاورِ برنددار از روی تیتر/زیرتیتر."""
    from src.instagram.publisher import render_cover
    title = (data.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "تیتر لازم است.")
    try:
        fname = await render_cover(title, data.get("subtitle", ""), data.get("behind", ""))
    except Exception as e:
        raise HTTPException(502, f"تولیدِ کاور ناموفق: {str(e)[:200]}")
    return {"filename": fname, "url": f"/api/public/ig-media/{fname}"}


# ─────────────────────────── سازندهٔ کاورِ پیشرفته (المان + متن) ───────────────────────────
@router.get("/cover/fonts")
async def cover_fonts(_: Admin = Depends(require_role("admin"))):
    from src.instagram.cover import FONTS, RATIOS
    return {"fonts": list(FONTS.keys()), "ratios": list(RATIOS.keys())}


@router.post("/cover/search")
async def cover_search(data: dict = Body(...), _: Admin = Depends(require_role("admin"))):
    """سرچِ المان/نماد در اینترنت (Iconify) → آیکن‌های شفاف."""
    from src.instagram.cover import search_elements
    q = (data.get("query") or "").strip()
    if not q:
        raise HTTPException(400, "عبارتِ جستجو لازم است.")
    try:
        return {"results": await search_elements(q)}
    except Exception as e:
        raise HTTPException(502, f"جستجو ناموفق: {str(e)[:160]}")


@router.post("/cover/render")
async def cover_render(data: dict = Body(...), _: Admin = Depends(require_role("admin"))):
    """ساختِ کاور: پس‌زمینه + المانِ شفاف + متنِ سفید/زرد + متنِ محوِ پشت."""
    from src.instagram.cover import render_cover
    try:
        return await render_cover(data)
    except Exception as e:
        raise HTTPException(502, f"ساختِ کاور ناموفق: {str(e)[:200]}")


@router.post("/ai/full-content")
async def ai_full_content(data: dict = Body(...), _: Admin = Depends(require_role("admin"))):
    """از یک موضوع، کلِ بستهٔ محتوا را با AI می‌سازد (پرامپتِ ویدیو + کپشن + هشتگ + کلیدواژه + پاسخ)."""
    from src.instagram.publisher import gen_full_content
    topic = (data.get("topic") or "").strip()
    if not topic:
        raise HTTPException(400, "موضوع لازم است.")
    res = await gen_full_content(topic, data.get("post_type", "reel"))
    if not res:
        raise HTTPException(502, "تولیدِ محتوا ناموفق بود؛ دوباره تلاش کن.")
    return res


@router.post("/ai/suggest-topics")
async def ai_suggest_topics(data: dict = Body(...), _: Admin = Depends(require_role("admin"))):
    """پیشنهادِ موضوع‌های ویدیو (مرتبط با پروژه) + کلیدواژهٔ هرکدام — برای خلبانِ خودکار."""
    from src.instagram.publisher import suggest_topics
    res = await suggest_topics(int(data.get("count", 20)), data.get("context", ""))
    if not res:
        raise HTTPException(502, "پیشنهادِ موضوع ناموفق بود؛ دوباره تلاش کن.")
    return {"topics": res}


# ─────────────────────────── خلبانِ خودکار (Auto-Pilot) ───────────────────────────
_AP_FIELDS = ("name", "account_ids", "topics", "campaigns", "post_types", "gen_video", "video_spec", "caption_ai",
             "times", "auto_keyword", "auto_link", "auto_reply_text", "first_comment_ai", "enabled")


def _ap_out(a: IgAutopilot) -> dict:
    return {"id": a.id, "name": a.name, "account_ids": a.account_ids or [], "topics": a.topics or [],
            "campaigns": a.campaigns or [],
            "post_types": a.post_types or [], "gen_video": a.gen_video, "video_spec": a.video_spec or {},
            "caption_ai": a.caption_ai, "times": a.times or [], "auto_keyword": a.auto_keyword,
            "auto_link": a.auto_link, "auto_reply_text": a.auto_reply_text, "first_comment_ai": a.first_comment_ai,
            "enabled": a.enabled, "made_count": a.made_count,
            "last_run_at": a.last_run_at.isoformat() if a.last_run_at else None,
            "next_run_at": a.next_run_at.isoformat() if a.next_run_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None}


@router.get("/autopilots")
async def list_autopilots(_: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(IgAutopilot).order_by(IgAutopilot.id.desc()))).scalars().all()
    return [_ap_out(a) for a in rows]


@router.post("/autopilots")
async def create_autopilot(data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    from src.instagram.autopilot import compute_next_run
    if not (data.get("topics") or []):
        raise HTTPException(400, "حداقل یک موضوع لازم است.")
    a = IgAutopilot()
    for f in _AP_FIELDS:
        if f in data:
            setattr(a, f, data[f])
    a.next_run_at = compute_next_run(a.times)
    db.add(a); await db.commit(); await db.refresh(a)
    return _ap_out(a)


@router.put("/autopilots/{aid}")
async def update_autopilot(aid: int, data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    from src.instagram.autopilot import compute_next_run
    a = (await db.execute(select(IgAutopilot).where(IgAutopilot.id == aid))).scalar_one_or_none()
    if a is None:
        raise HTTPException(404, "یافت نشد.")
    for f in _AP_FIELDS:
        if f in data:
            setattr(a, f, data[f])
    if "times" in data:
        a.next_run_at = compute_next_run(a.times)
    await db.commit(); return _ap_out(a)


@router.post("/autopilots/{aid}/toggle")
async def toggle_autopilot(aid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    a = (await db.execute(select(IgAutopilot).where(IgAutopilot.id == aid))).scalar_one_or_none()
    if a is None:
        raise HTTPException(404, "یافت نشد.")
    a.enabled = not a.enabled; await db.commit()
    return {"id": a.id, "enabled": a.enabled}


@router.post("/autopilots/{aid}/run-now")
async def run_autopilot_now(aid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    """یک محتوا را همین الان بساز (تست)."""
    from datetime import datetime, timezone
    a = (await db.execute(select(IgAutopilot).where(IgAutopilot.id == aid))).scalar_one_or_none()
    if a is None:
        raise HTTPException(404, "یافت نشد.")
    a.next_run_at = datetime.now(timezone.utc); await db.commit()
    from src.instagram.autopilot import run_due
    res = await run_due()
    return {"result": res}


@router.delete("/autopilots/{aid}")
async def delete_autopilot(aid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(IgAutopilot).where(IgAutopilot.id == aid)); await db.commit()
    return {"ok": True}


@router.post("/forms/{fid}/toggle")
async def toggle_form(fid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    f = (await db.execute(select(IgForm).where(IgForm.id == fid))).scalar_one_or_none()
    if f is None:
        raise HTTPException(404, "یافت نشد.")
    f.enabled = not f.enabled; await db.commit()
    return {"id": f.id, "enabled": f.enabled}


@router.delete("/forms/{fid}")
async def delete_form(fid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(IgForm).where(IgForm.id == fid)); await db.commit()
    return {"ok": True}
