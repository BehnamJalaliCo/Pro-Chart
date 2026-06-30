"""پنلِ مستقلِ اینستاگرام (Multi-Tenant) — روی /ig.

هر کاربرِ IG با یوزرنیم/پسوردِ خودش وارد می‌شود و فقط اکانت‌های خودش (تا max_accounts)
را می‌بیند/مدیریت می‌کند. fork از admin_instagram با گاردِ مالکیت + scope="ig".
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from datetime import datetime as _dt
from typing import Optional

import httpx
from fastapi import APIRouter, Body, Depends, File, Header, HTTPException, Query, Request, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.core.crypto import decrypt_secret, encrypt_secret
from src.core.database import (
    IGUser,
    IgAccount,
    IgAutopilot,
    IgAutoReply,
    IgContent,
    IgForm,
    IgInbox,
    IgMessage,
    async_session_factory,
)
from src.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_access_token,
    verify_password,
    verify_refresh_token,
)

MEDIA_DIR = os.environ.get("IG_MEDIA_DIR", "/app/ig_media")
IG_WORKER = os.environ.get("IG_WORKER_URL", "http://ig-worker:8090")
router = APIRouter()

# فیچرهای قابلِ‌قفل توسطِ ادمین (پیش‌فرض همه باز)
PERM_KEYS = ["accounts", "smart_reply", "content", "autopilot", "forms", "inbox", "ai"]
_PERM_LABEL = {"accounts": "افزودنِ اکانت", "smart_reply": "پاسخِ هوشمند", "content": "انتشارِ محتوا",
               "autopilot": "خلبانِ خودکار", "forms": "فرم‌ساز", "inbox": "صندوق", "ai": "هوشِ مصنوعی"}


def _perms_of(u: IGUser) -> dict:
    raw = getattr(u, "permissions", None) or {}
    return {k: bool(raw.get(k, True)) for k in PERM_KEYS}


def _require_perm(u: IGUser, key: str) -> None:
    if not _perms_of(u).get(key, True):
        raise HTTPException(403, f"دسترسی «{_PERM_LABEL.get(key, key)}» توسطِ مدیر برای حسابِ شما قفل شده است.")


# ═══════════════ احراز هویتِ کاربرِ IG (scope="ig") ═══════════════
async def current_ig_user(authorization: Optional[str] = Header(default=None),
                          db: AsyncSession = Depends(get_db)) -> IGUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "ابتدا وارد شوید.")
    p = verify_access_token(authorization.split(" ", 1)[1].strip())
    if not p or p.get("scope") != "ig":
        raise HTTPException(401, "توکن نامعتبر است.")
    sub = str(p.get("sub", ""))
    uid = int(sub.split(":", 1)[1]) if ":" in sub else 0
    u = (await db.execute(select(IGUser).where(IGUser.id == uid, IGUser.is_active.is_(True)))).scalar_one_or_none()
    if not u:
        raise HTTPException(401, "کاربر یافت نشد یا غیرفعال است.")
    u.last_active_at = datetime.now(timezone.utc)
    await db.commit()
    return u


async def _owned(db: AsyncSession, user: IGUser, account_id) -> IgAccount:
    acc = (await db.execute(select(IgAccount).where(
        IgAccount.id == int(account_id), IgAccount.owner_id == user.id))).scalar_one_or_none()
    if not acc:
        raise HTTPException(404, "اکانت یافت نشد یا متعلق به شما نیست.")
    return acc


async def _owned_ids(db: AsyncSession, user: IGUser) -> set[int]:
    rows = (await db.execute(select(IgAccount.id).where(IgAccount.owner_id == user.id))).scalars().all()
    return set(int(x) for x in rows)


# ═══════════════ صدا زدنِ ig-worker با account_id + self-heal ═══════════════
async def _login_worker(acc: IgAccount) -> dict:
    pw = decrypt_secret(acc.enc_password or "") or ""
    totp = decrypt_secret(acc.enc_totp or "") if acc.enc_totp else None
    async with httpx.AsyncClient(timeout=150) as cl:
        r = await cl.post(f"{IG_WORKER}/login", json={"account_id": str(acc.id), "username": acc.username,
                                                      "password": pw, "totp_secret": totp})
        return r.json()


async def _call(acc: IgAccount, method: str, path: str, body: dict | None = None, timeout: float = 90):
    params = {"account_id": str(acc.id)} if method.upper() == "GET" else None
    jb = None
    if method.upper() != "GET":
        jb = dict(body or {})
        jb["account_id"] = str(acc.id)
    async with httpx.AsyncClient(timeout=timeout) as cl:
        r = await cl.request(method, f"{IG_WORKER}{path}", json=jb, params=params)
        if r.status_code == 401 and "session_expired" in r.text and acc.enc_password:
            await _login_worker(acc)  # self-heal با کرِدِنشیالِ رمزنگاری‌شده
            r = await cl.request(method, f"{IG_WORKER}{path}", json=jb, params=params)
        r.raise_for_status()
        return r.json()


# ═══════════════ Auth routes ═══════════════
@router.post("/auth/login")
async def login(data: dict = Body(...), request: Request = None, db: AsyncSession = Depends(get_db)):
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    # نام کاربری بدونِ حساسیت به حروفِ بزرگ/کوچک (رمز همچنان حساس است)
    u = (await db.execute(select(IGUser).where(func.lower(IGUser.username) == username.lower()))).scalar_one_or_none()
    if not u or not u.is_active or not verify_password(password, u.password_hash):
        raise HTTPException(401, "نام کاربری یا رمز عبور اشتباه است.")
    u.last_active_at = datetime.now(timezone.utc)
    u.login_count = (u.login_count or 0) + 1
    if request is not None:
        u.last_login_ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
                           or (request.client.host if request.client else None))
    await db.commit()
    return {"access_token": create_access_token(data={"sub": f"ig:{u.id}", "scope": "ig"}),
            "refresh_token": create_refresh_token(data={"sub": f"ig:{u.id}", "scope": "ig"}),
            "user": {"id": u.id, "username": u.username, "display_name": u.display_name,
                     "max_accounts": u.max_accounts, "is_admin_seed": u.is_admin_seed,
                     "permissions": _perms_of(u)}}


@router.post("/auth/refresh")
async def refresh(data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    p = verify_refresh_token((data.get("refresh_token") or "").strip())
    if not p or p.get("scope") != "ig":
        raise HTTPException(401, "توکن نامعتبر است.")
    uid = int(str(p.get("sub", "ig:0")).split(":", 1)[1])
    u = (await db.execute(select(IGUser).where(IGUser.id == uid, IGUser.is_active.is_(True)))).scalar_one_or_none()
    if not u:
        raise HTTPException(401, "کاربر یافت نشد.")
    return {"access_token": create_access_token(data={"sub": f"ig:{u.id}", "scope": "ig"}),
            "refresh_token": create_refresh_token(data={"sub": f"ig:{u.id}", "scope": "ig"})}


@router.get("/me")
async def me(u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    cnt = len(await _owned_ids(db, u))
    return {"id": u.id, "username": u.username, "display_name": u.display_name,
            "max_accounts": u.max_accounts, "accounts_used": cnt, "is_admin_seed": u.is_admin_seed,
            "permissions": _perms_of(u)}


# ═══════════════ اکانت‌ها ═══════════════
def _acc_out(a: IgAccount) -> dict:
    return {"id": a.id, "username": a.username, "full_name": a.full_name, "ig_pk": a.ig_pk,
            "avatar_url": a.avatar_url, "status": a.status, "is_active": a.is_active,
            "smart_enabled": a.smart_enabled, "has_creds": bool(a.enc_password),
            "last_login_at": a.last_login_at.isoformat() if a.last_login_at else None,
            "last_error": a.last_error, "created_at": a.created_at.isoformat() if a.created_at else None}


@router.get("/accounts")
async def list_accounts(u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(IgAccount).where(IgAccount.owner_id == u.id).order_by(IgAccount.id))).scalars().all()
    return [_acc_out(a) for a in rows]


@router.post("/accounts")
async def add_account(data: dict = Body(...), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    """افزودنِ اکانتِ اینستاگرام: یوزر/پس(+۲FA) → لاگین در worker → ذخیرهٔ رمزنگاری‌شده."""
    _require_perm(u, "accounts")
    if len(await _owned_ids(db, u)) >= u.max_accounts:
        raise HTTPException(403, f"به سقفِ {u.max_accounts} اکانت رسیده‌اید.")
    username = (data.get("username") or "").strip().lstrip("@").lower()
    password = data.get("password") or ""
    totp = (data.get("totp_secret") or "").strip() or None
    code = (data.get("verification_code") or "").strip() or None
    if not username or not password:
        raise HTTPException(400, "یوزرنیم و پسوردِ اینستاگرام لازم است.")
    exists = (await db.execute(select(IgAccount).where(IgAccount.username == username))).scalar_one_or_none()
    if exists and exists.owner_id != u.id:
        raise HTTPException(409, "این اکانت قبلاً ثبت شده است.")
    acc = exists or IgAccount(username=username, owner_id=u.id)
    acc.owner_id = u.id
    acc.enc_password = encrypt_secret(password)
    acc.enc_totp = encrypt_secret(totp) if totp else None
    if not exists:
        db.add(acc)
    await db.flush()
    try:
        res = await _login_worker_raw(acc.id, username, password, totp, code)
    except Exception as e:  # noqa: BLE001
        await db.rollback()
        raise HTTPException(502, f"اتصال به اینستاگرام ناموفق: {str(e)[:200]}")
    if not res.get("ok"):
        acc.status = "challenge" if res.get("challenge") else "error"
        acc.last_error = (res.get("error") or "")[:500]
        await db.commit()
        return {"ok": False, "challenge": bool(res.get("challenge")), "account": _acc_out(acc),
                "message": "نیاز به کدِ تأیید (۲FA)" if res.get("challenge") else res.get("error")}
    acc.ig_pk = res.get("pk")
    acc.full_name = res.get("full_name")
    acc.avatar_url = res.get("avatar")
    acc.status = "online"
    acc.last_login_at = datetime.now(timezone.utc)
    acc.last_error = None
    acc.is_active = True
    acc.session_path = f"sessions/{acc.id}.json"
    await db.commit()
    return {"ok": True, "account": _acc_out(acc)}


async def _login_worker_raw(account_id, username, password, totp, code):
    async with httpx.AsyncClient(timeout=150) as cl:
        r = await cl.post(f"{IG_WORKER}/login", json={"account_id": str(account_id), "username": username,
                                                      "password": password, "totp_secret": totp, "verification_code": code})
        return r.json()


@router.delete("/accounts/{account_id}")
async def remove_account(account_id: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    acc = await _owned(db, u, account_id)
    try:
        async with httpx.AsyncClient(timeout=30) as cl:
            await cl.post(f"{IG_WORKER}/logout", json={"account_id": str(acc.id)})
    except Exception:
        pass
    await db.execute(delete(IgAccount).where(IgAccount.id == acc.id))
    await db.commit()
    return {"ok": True}


@router.post("/accounts/{account_id}/smart-toggle")
async def smart_toggle(account_id: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    acc = await _owned(db, u, account_id)
    acc.smart_enabled = not acc.smart_enabled
    await db.commit()
    return {"id": acc.id, "smart_enabled": acc.smart_enabled}


@router.get("/accounts/{account_id}/media")
async def account_media(account_id: int, amount: int = Query(12), refresh: bool = Query(False),
                        u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    acc = await _owned(db, u, account_id)
    from src.core.redis_client import redis_client
    key = f"ig:mediacache:{acc.id}:{amount}"
    if not refresh:
        cached = await redis_client.get_json(key)
        if cached:
            return cached
    try:
        res = await _call(acc, "POST", "/user_media", {"amount": amount})
    except Exception as e:
        raise HTTPException(502, f"دریافتِ رسانه ناموفق: {str(e)[:200]}")
    try:
        await redis_client.set_json(key, res, expire=600)
    except Exception:
        pass
    return res


@router.get("/accounts/{account_id}/live")
async def account_live(account_id: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    acc = await _owned(db, u, account_id)
    try:
        st = await _call(acc, "GET", "/status")
        return {"online": st.get("online"), "followers": st.get("followers"),
                "following": st.get("following"), "media_count": st.get("media_count")}
    except Exception as e:
        return {"online": False, "error": str(e)[:200]}


# ═══════════════ پیشخوان (scoped) ═══════════════
@router.get("/dashboard")
async def dashboard(u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    ids = await _owned_ids(db, u)
    since = datetime.now(timezone.utc) - timedelta(days=7)
    if not ids:
        return {"smart_reply": {"dm_sent": 0, "comment_sent": 0, "active_rules": 0},
                "content": {"published": 0, "scheduled": 0, "drafts": 0}, "recent_messages": [], "accounts": 0}

    async def _c(model, *conds):
        return (await db.execute(select(func.count()).select_from(model).where(*conds))).scalar() or 0

    dm = await _c(IgInbox, IgInbox.account_id.in_(ids), IgInbox.kind == "direct", IgInbox.text_out.isnot(None), IgInbox.created_at >= since)
    cm = await _c(IgInbox, IgInbox.account_id.in_(ids), IgInbox.kind == "comment", IgInbox.text_out.isnot(None), IgInbox.created_at >= since)
    rules = await _c(IgAutoReply, IgAutoReply.account_id.in_(ids), IgAutoReply.enabled.is_(True))
    recent = (await db.execute(select(IgInbox).where(IgInbox.account_id.in_(ids)).order_by(IgInbox.id.desc()).limit(8))).scalars().all()
    # محتوای متعلق به اکانت‌های کاربر (account_ids JSONB overlap → فیلترِ پایتونی روی ۲۰۰ ردیفِ اخیر)
    contents = (await db.execute(select(IgContent).order_by(IgContent.id.desc()).limit(200))).scalars().all()
    mine = [c for c in contents if ids & set(int(x) for x in (c.account_ids or []))]
    pub = sum(1 for c in mine if c.status == "published")
    sch = sum(1 for c in mine if c.status == "scheduled")
    dr = sum(1 for c in mine if c.status == "draft")
    msgs = [{"kind": m.kind, "from": m.from_username, "text": (m.text_in or "")[:80],
             "at": m.created_at.isoformat() if m.created_at else None} for m in recent]
    return {"smart_reply": {"dm_sent": dm, "comment_sent": cm, "active_rules": rules},
            "content": {"published": pub, "scheduled": sch, "drafts": dr},
            "recent_messages": msgs, "accounts": len(ids)}


# ═══════════════ پیام‌ها ═══════════════
def _msg_out(m: IgMessage) -> dict:
    return {"id": m.id, "account_id": m.account_id, "title": m.title, "msg_type": m.msg_type,
            "text": m.text, "buttons": m.buttons, "file_url": m.file_url, "file_kind": m.file_kind,
            "products": m.products}


@router.get("/accounts/{account_id}/messages")
async def list_messages(account_id: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    await _owned(db, u, account_id)
    rows = (await db.execute(select(IgMessage).where(IgMessage.account_id == account_id).order_by(IgMessage.id.desc()))).scalars().all()
    return [_msg_out(m) for m in rows]


@router.post("/messages")
async def create_message(data: dict = Body(...), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    if not data.get("account_id") or not data.get("title"):
        raise HTTPException(400, "account_id و title لازم است.")
    await _owned(db, u, data["account_id"])
    m = IgMessage(account_id=int(data["account_id"]), title=data["title"][:255],
                  msg_type=data.get("msg_type", "text"), text=data.get("text"), buttons=data.get("buttons"),
                  file_url=data.get("file_url"), file_kind=data.get("file_kind"), products=data.get("products"))
    db.add(m); await db.commit(); await db.refresh(m)
    return _msg_out(m)


async def _owned_row(db, user, model, rid):
    r = (await db.execute(select(model).where(model.id == int(rid)))).scalar_one_or_none()
    if r is None:
        raise HTTPException(404, "یافت نشد.")
    await _owned(db, user, r.account_id)
    return r


@router.put("/messages/{mid}")
async def update_message(mid: int, data: dict = Body(...), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    m = await _owned_row(db, u, IgMessage, mid)
    for f in ("title", "msg_type", "text", "buttons", "file_url", "file_kind", "products"):
        if f in data:
            setattr(m, f, data[f])
    await db.commit(); return _msg_out(m)


@router.delete("/messages/{mid}")
async def delete_message(mid: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    await _owned_row(db, u, IgMessage, mid)
    await db.execute(delete(IgMessage).where(IgMessage.id == mid)); await db.commit()
    return {"ok": True}


# ═══════════════ پاسخِ خودکار ═══════════════
_RULE_FIELDS = ("title", "on_direct", "on_comment", "match_mode", "keywords", "message_id", "message_ids",
                "require_follow", "follow_message", "follow_button_text", "specific_media", "reminder",
                "reminder_hours", "reminder_message_id", "comment_after_dm", "max_replies", "like_dm",
                "use_ai", "ai_prompt", "enabled")


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
async def list_rules(account_id: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    await _owned(db, u, account_id)
    rows = (await db.execute(select(IgAutoReply).where(IgAutoReply.account_id == account_id).order_by(IgAutoReply.id.desc()))).scalars().all()
    titles = {m.id: m.title for m in (await db.execute(select(IgMessage).where(IgMessage.account_id == account_id))).scalars().all()}
    return [_rule_out(r, titles) for r in rows]


@router.post("/auto-replies")
async def create_rule(data: dict = Body(...), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    _require_perm(u, "smart_reply")
    if not data.get("account_id"):
        raise HTTPException(400, "account_id لازم است.")
    await _owned(db, u, data["account_id"])
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
async def update_rule(rid: int, data: dict = Body(...), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    r = await _owned_row(db, u, IgAutoReply, rid)
    for f in _RULE_FIELDS:
        if f in data:
            setattr(r, f, data[f])
    await db.commit(); return _rule_out(r)


@router.post("/auto-replies/{rid}/toggle")
async def toggle_rule(rid: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    r = await _owned_row(db, u, IgAutoReply, rid)
    r.enabled = not r.enabled; await db.commit()
    return {"id": r.id, "enabled": r.enabled}


@router.delete("/auto-replies/{rid}")
async def delete_rule(rid: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    await _owned_row(db, u, IgAutoReply, rid)
    await db.execute(delete(IgAutoReply).where(IgAutoReply.id == rid)); await db.commit()
    return {"ok": True}


# ═══════════════ صندوق ═══════════════
@router.get("/accounts/{account_id}/inbox")
async def inbox(account_id: int, kind: str = Query("comment"), limit: int = Query(50),
                u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    await _owned(db, u, account_id)
    rows = (await db.execute(select(IgInbox).where(IgInbox.account_id == account_id, IgInbox.kind == kind)
            .order_by(IgInbox.id.desc()).limit(min(limit, 200)))).scalars().all()
    return [{"id": r.id, "from": r.from_username, "media_code": r.media_code, "text_in": r.text_in,
             "text_out": r.text_out, "handled": r.handled,
             "at": r.created_at.isoformat() if r.created_at else None} for r in rows]


# ═══════════════ فرم‌ساز ═══════════════
_FORM_FIELDS = ("title", "start_trigger", "questions", "cancel_trigger", "cancel_message", "end_message", "enabled")


def _form_out(f: IgForm) -> dict:
    return {"id": f.id, "account_id": f.account_id, "title": f.title, "start_trigger": f.start_trigger,
            "questions": f.questions or [], "cancel_trigger": f.cancel_trigger, "cancel_message": f.cancel_message,
            "end_message": f.end_message, "enabled": f.enabled,
            "created_at": f.created_at.isoformat() if f.created_at else None}


@router.get("/accounts/{account_id}/forms")
async def list_forms(account_id: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    await _owned(db, u, account_id)
    rows = (await db.execute(select(IgForm).where(IgForm.account_id == account_id).order_by(IgForm.id.desc()))).scalars().all()
    return [_form_out(f) for f in rows]


@router.post("/forms")
async def create_form(data: dict = Body(...), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    _require_perm(u, "forms")
    if not data.get("account_id") or not data.get("title") or not data.get("start_trigger"):
        raise HTTPException(400, "account_id و title و دستورِ شروع لازم است.")
    await _owned(db, u, data["account_id"])
    f = IgForm(account_id=int(data["account_id"]))
    for fld in _FORM_FIELDS:
        if fld in data:
            setattr(f, fld, data[fld])
    db.add(f); await db.commit(); await db.refresh(f)
    return _form_out(f)


@router.put("/forms/{fid}")
async def update_form(fid: int, data: dict = Body(...), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    f = await _owned_row(db, u, IgForm, fid)
    for fld in _FORM_FIELDS:
        if fld in data:
            setattr(f, fld, data[fld])
    await db.commit(); return _form_out(f)


@router.post("/forms/{fid}/toggle")
async def toggle_form(fid: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    f = await _owned_row(db, u, IgForm, fid)
    f.enabled = not f.enabled; await db.commit()
    return {"id": f.id, "enabled": f.enabled}


@router.delete("/forms/{fid}")
async def delete_form(fid: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    await _owned_row(db, u, IgForm, fid)
    await db.execute(delete(IgForm).where(IgForm.id == fid)); await db.commit()
    return {"ok": True}


# ═══════════════ انتشارِ محتوا ═══════════════
def _content_out(c: IgContent) -> dict:
    return {"id": c.id, "account_ids": c.account_ids or [], "post_type": c.post_type, "title": c.title,
            "caption": c.caption, "captions_custom": c.captions_custom, "media_urls": c.media_urls or [],
            "cover_url": c.cover_url, "hashtags": c.hashtags, "first_comment": c.first_comment, "x_thread": c.x_thread,
            "ai_prompt": c.ai_prompt, "source": c.source, "mode": c.mode,
            "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
            "auto_delete_at": c.auto_delete_at.isoformat() if c.auto_delete_at else None,
            "status": c.status, "result": c.result, "gen_video": c.gen_video, "video_prompt": c.video_prompt,
            "video_status": c.video_status, "video_spec": c.video_spec, "auto_reply_keyword": c.auto_reply_keyword,
            "auto_reply_link": c.auto_reply_link, "auto_reply_text": c.auto_reply_text, "auto_reply_done": c.auto_reply_done,
            "published_at": c.published_at.isoformat() if c.published_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None}


_CONTENT_FIELDS = ("account_ids", "post_type", "title", "caption", "captions_custom", "media_urls", "cover_url",
                   "hashtags", "first_comment", "x_thread", "ai_prompt", "source", "gen_video", "video_prompt",
                   "video_spec", "auto_reply_keyword", "auto_reply_link", "auto_reply_text")


def _validate_account_ids(data_ids, owned: set[int]):
    ids = [int(x) for x in (data_ids or [])]
    if not ids:
        raise HTTPException(400, "حداقل یک اکانت انتخاب کن.")
    bad = [i for i in ids if i not in owned]
    if bad:
        raise HTTPException(403, "اکانتِ انتخابی متعلق به شما نیست.")
    return ids


@router.get("/contents")
async def list_contents(status: str = Query(None), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    owned = await _owned_ids(db, u)
    q = select(IgContent).order_by(IgContent.id.desc()).limit(300)
    if status:
        q = q.where(IgContent.status == status)
    rows = (await db.execute(q)).scalars().all()
    mine = [c for c in rows if owned & set(int(x) for x in (c.account_ids or []))]
    return [_content_out(c) for c in mine[:100]]


@router.post("/contents")
async def create_content(data: dict = Body(...), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    _require_perm(u, "content")
    owned = await _owned_ids(db, u)
    _validate_account_ids(data.get("account_ids"), owned)
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


async def _owned_content(db, user, cid) -> IgContent:
    c = (await db.execute(select(IgContent).where(IgContent.id == int(cid)))).scalar_one_or_none()
    if c is None:
        raise HTTPException(404, "یافت نشد.")
    owned = await _owned_ids(db, user)
    if not (owned & set(int(x) for x in (c.account_ids or []))):
        raise HTTPException(403, "متعلق به شما نیست.")
    return c


@router.put("/contents/{cid}")
async def update_content(cid: int, data: dict = Body(...), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    c = await _owned_content(db, u, cid)
    owned = await _owned_ids(db, u)
    if "account_ids" in data:
        _validate_account_ids(data["account_ids"], owned)
    for f in _CONTENT_FIELDS:
        if f in data:
            setattr(c, f, data[f])
    if "scheduled_at" in data:
        c.scheduled_at = _dt.fromisoformat(data["scheduled_at"].replace("Z", "+00:00")) if data["scheduled_at"] else None
    await db.commit(); return _content_out(c)


@router.post("/contents/{cid}/publish")
async def publish_content_now(cid: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    _require_perm(u, "content")
    await _owned_content(db, u, cid)
    from src.instagram.publisher import publish_content
    res = await publish_content(cid)
    c = (await db.execute(select(IgContent).where(IgContent.id == cid))).scalar_one_or_none()
    return {"result": res, "content": _content_out(c) if c else None}


@router.post("/contents/{cid}/generate-video")
async def generate_content_video(cid: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    await _owned_content(db, u, cid)
    from src.instagram.video_gen import generate_video
    res = await generate_video(cid, db)
    c = (await db.execute(select(IgContent).where(IgContent.id == cid))).scalar_one_or_none()
    return {"result": res, "content": _content_out(c) if c else None}


@router.delete("/contents/{cid}")
async def delete_content(cid: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    await _owned_content(db, u, cid)
    await db.execute(delete(IgContent).where(IgContent.id == cid)); await db.commit()
    return {"ok": True}


# ═══════════════ آپلود + AI + کاور ═══════════════
@router.post("/upload")
async def upload_media(file: UploadFile = File(...), u: IGUser = Depends(current_ig_user)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("png", "jpg", "jpeg", "webp", "mp4", "mov"):
        raise HTTPException(400, "فرمتِ مجاز: png/jpg/webp/mp4")
    os.makedirs(MEDIA_DIR, exist_ok=True)
    fname = f"up_{uuid.uuid4().hex[:12]}.{'jpg' if ext == 'jpeg' else ext}"
    data = await file.read()
    if len(data) > 30 * 1024 * 1024:
        raise HTTPException(400, "حجم بیش از ۳۰ مگابایت.")
    with open(os.path.join(MEDIA_DIR, fname), "wb") as f:
        f.write(data)
    return {"filename": fname, "url": f"/api/public/ig-media/{fname}"}


@router.post("/ai/caption")
async def ai_caption(data: dict = Body(...), u: IGUser = Depends(current_ig_user)):
    from src.instagram.publisher import gen_caption
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(400, "پرامپت لازم است.")
    cap = await gen_caption(prompt)
    if not cap:
        raise HTTPException(502, "تولیدِ کپشن ناموفق بود.")
    return {"caption": cap.strip()}


@router.post("/ai/cover")
async def ai_cover(data: dict = Body(...), u: IGUser = Depends(current_ig_user)):
    from src.instagram.publisher import render_cover
    title = (data.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "تیتر لازم است.")
    try:
        fname = await render_cover(title, data.get("subtitle", ""), data.get("behind", ""))
    except Exception as e:
        raise HTTPException(502, f"تولیدِ کاور ناموفق: {str(e)[:200]}")
    return {"filename": fname, "url": f"/api/public/ig-media/{fname}"}


@router.post("/ai/full-content")
async def ai_full_content(data: dict = Body(...), u: IGUser = Depends(current_ig_user)):
    _require_perm(u, "ai")
    from src.instagram.publisher import gen_full_content
    topic = (data.get("topic") or "").strip()
    if not topic:
        raise HTTPException(400, "موضوع لازم است.")
    res = await gen_full_content(topic, data.get("post_type", "reel"))
    if not res:
        raise HTTPException(502, "تولیدِ محتوا ناموفق بود.")
    return res


@router.post("/ai/suggest-topics")
async def ai_suggest_topics(data: dict = Body(...), u: IGUser = Depends(current_ig_user)):
    from src.instagram.publisher import suggest_topics
    res = await suggest_topics(int(data.get("count", 20)), data.get("context", ""))
    if not res:
        raise HTTPException(502, "پیشنهادِ موضوع ناموفق بود.")
    return {"topics": res}


@router.get("/cover/fonts")
async def cover_fonts(u: IGUser = Depends(current_ig_user)):
    from src.instagram.cover import FONTS, RATIOS
    return {"fonts": list(FONTS.keys()), "ratios": list(RATIOS.keys())}


@router.post("/cover/search")
async def cover_search(data: dict = Body(...), u: IGUser = Depends(current_ig_user)):
    from src.instagram.cover import search_elements
    q = (data.get("query") or "").strip()
    if not q:
        raise HTTPException(400, "عبارتِ جستجو لازم است.")
    try:
        return {"results": await search_elements(q)}
    except Exception as e:
        raise HTTPException(502, f"جستجو ناموفق: {str(e)[:160]}")


@router.post("/cover/render")
async def cover_render(data: dict = Body(...), u: IGUser = Depends(current_ig_user)):
    from src.instagram.cover import render_cover
    try:
        return await render_cover(data)
    except Exception as e:
        raise HTTPException(502, f"ساختِ کاور ناموفق: {str(e)[:200]}")


# ═══════════════ خلبانِ خودکار ═══════════════
_AP_FIELDS = ("name", "account_ids", "topics", "campaigns", "post_types", "gen_video", "video_spec", "caption_ai",
              "times", "auto_keyword", "auto_link", "auto_reply_text", "first_comment_ai", "enabled")


def _ap_out(a: IgAutopilot) -> dict:
    return {"id": a.id, "name": a.name, "account_ids": a.account_ids or [], "topics": a.topics or [],
            "campaigns": a.campaigns or [], "post_types": a.post_types or [], "gen_video": a.gen_video,
            "video_spec": a.video_spec or {}, "caption_ai": a.caption_ai, "times": a.times or [],
            "auto_keyword": a.auto_keyword, "auto_link": a.auto_link, "auto_reply_text": a.auto_reply_text,
            "first_comment_ai": a.first_comment_ai, "enabled": a.enabled, "made_count": a.made_count,
            "last_run_at": a.last_run_at.isoformat() if a.last_run_at else None,
            "next_run_at": a.next_run_at.isoformat() if a.next_run_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None}


async def _owned_ap(db, user, aid) -> IgAutopilot:
    a = (await db.execute(select(IgAutopilot).where(IgAutopilot.id == int(aid)))).scalar_one_or_none()
    if a is None:
        raise HTTPException(404, "یافت نشد.")
    owned = await _owned_ids(db, user)
    if not (owned & set(int(x) for x in (a.account_ids or []))):
        raise HTTPException(403, "متعلق به شما نیست.")
    return a


@router.get("/autopilots")
async def list_autopilots(u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    owned = await _owned_ids(db, u)
    rows = (await db.execute(select(IgAutopilot).order_by(IgAutopilot.id.desc()))).scalars().all()
    mine = [a for a in rows if owned & set(int(x) for x in (a.account_ids or []))]
    return [_ap_out(a) for a in mine]


@router.post("/autopilots")
async def create_autopilot(data: dict = Body(...), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    _require_perm(u, "autopilot")
    from src.instagram.autopilot import compute_next_run
    owned = await _owned_ids(db, u)
    _validate_account_ids(data.get("account_ids"), owned)
    if not (data.get("topics") or data.get("campaigns")):
        raise HTTPException(400, "حداقل یک موضوع/کمپین لازم است.")
    a = IgAutopilot()
    for f in _AP_FIELDS:
        if f in data:
            setattr(a, f, data[f])
    a.next_run_at = compute_next_run(a.times)
    db.add(a); await db.commit(); await db.refresh(a)
    return _ap_out(a)


@router.put("/autopilots/{aid}")
async def update_autopilot(aid: int, data: dict = Body(...), u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    from src.instagram.autopilot import compute_next_run
    a = await _owned_ap(db, u, aid)
    owned = await _owned_ids(db, u)
    if "account_ids" in data:
        _validate_account_ids(data["account_ids"], owned)
    for f in _AP_FIELDS:
        if f in data:
            setattr(a, f, data[f])
    if "times" in data:
        a.next_run_at = compute_next_run(a.times)
    await db.commit(); return _ap_out(a)


@router.post("/autopilots/{aid}/toggle")
async def toggle_autopilot(aid: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    a = await _owned_ap(db, u, aid)
    a.enabled = not a.enabled; await db.commit()
    return {"id": a.id, "enabled": a.enabled}


@router.post("/autopilots/{aid}/run-now")
async def run_autopilot_now(aid: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    a = await _owned_ap(db, u, aid)
    a.next_run_at = datetime.now(timezone.utc); await db.commit()
    from src.instagram.autopilot import run_due
    res = await run_due()
    return {"result": res}


@router.delete("/autopilots/{aid}")
async def delete_autopilot(aid: int, u: IGUser = Depends(current_ig_user), db: AsyncSession = Depends(get_db)):
    await _owned_ap(db, u, aid)
    await db.execute(delete(IgAutopilot).where(IgAutopilot.id == aid)); await db.commit()
    return {"ok": True}
