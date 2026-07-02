"""مدیریتِ «کاربران IG» در پنلِ ادمین — اشرافِ کامل + آمارِ جامع + کنترلِ کرِدِنشیال و قفلِ فیچرها.
همه نیازمندِ نقشِ admin."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, require_role
from src.core.crypto import decrypt_secret, encrypt_secret
from src.core.database import (
    ActivityLog,
    Admin,
    IGUser,
    IgAccount,
    IgAutopilot,
    IgAutoReply,
    IgContent,
    IgForm,
    IgInbox,
    IgMessage,
)
from src.core.security import hash_password

router = APIRouter()

# فیچرهای قابلِ‌قفل توسطِ ادمین (پیش‌فرض همه باز)
PERMISSIONS = [
    {"key": "accounts", "label": "افزودنِ اکانتِ اینستاگرام"},
    {"key": "smart_reply", "label": "پاسخِ هوشمند و دستورها"},
    {"key": "content", "label": "ساخت و انتشارِ محتوا"},
    {"key": "autopilot", "label": "خلبانِ خودکار (اتوماسیون)"},
    {"key": "forms", "label": "فرم‌سازِ دایرکت"},
    {"key": "inbox", "label": "صندوقِ پیام‌ها"},
    {"key": "ai", "label": "استفاده از هوشِ مصنوعی"},
]
PERM_KEYS = [p["key"] for p in PERMISSIONS]


def _perms_full(raw: dict | None) -> dict:
    raw = raw or {}
    return {k: bool(raw.get(k, True)) for k in PERM_KEYS}


# ═══════════════ آمارِ جامع per-user ═══════════════
async def _analytics(db: AsyncSession) -> dict:
    accs = (await db.execute(select(IgAccount))).scalars().all()
    by_owner: dict[int, list] = {}
    acc_owner: dict[int, int] = {}
    for a in accs:
        if a.owner_id:
            by_owner.setdefault(a.owner_id, []).append(a)
            acc_owner[a.id] = a.owner_id

    def _o(aid):
        return acc_owner.get(int(aid))

    # محتوا per owner (published/scheduled/draft)
    contents = (await db.execute(select(IgContent.account_ids, IgContent.status))).all()
    posts: dict[int, int] = {}
    scheduled: dict[int, int] = {}
    drafts: dict[int, int] = {}
    for acc_ids, st in contents:
        owners = set(_o(x) for x in (acc_ids or []) if _o(x))
        for ow in owners:
            if st == "published":
                posts[ow] = posts.get(ow, 0) + 1
            elif st == "scheduled":
                scheduled[ow] = scheduled.get(ow, 0) + 1
            elif st == "draft":
                drafts[ow] = drafts.get(ow, 0) + 1

    # اینباکس ۳۰ روز (پاسخ‌داده‌شده) per owner
    since = datetime.now(timezone.utc) - timedelta(days=30)
    rows = (await db.execute(
        select(IgInbox.account_id, IgInbox.kind, func.count())
        .where(IgInbox.text_out.isnot(None), IgInbox.created_at >= since)
        .group_by(IgInbox.account_id, IgInbox.kind))).all()
    dm: dict[int, int] = {}
    cm: dict[int, int] = {}
    for aid, kind, n in rows:
        ow = _o(aid)
        if not ow:
            continue
        (dm if kind == "direct" else cm)[ow] = (dm if kind == "direct" else cm).get(ow, 0) + int(n)

    # کلِ اینباکس (هندل‌نشده هم) per owner
    inbox_rows = (await db.execute(select(IgInbox.account_id, func.count()).group_by(IgInbox.account_id))).all()
    inbox_total: dict[int, int] = {}
    for aid, n in inbox_rows:
        ow = _o(aid)
        if ow:
            inbox_total[ow] = inbox_total.get(ow, 0) + int(n)

    # دستورها (کل + فعال)، پیام‌ها، فرم‌ها per owner
    def _count_by_owner(rows_):
        out: dict[int, int] = {}
        for aid, n in rows_:
            ow = _o(aid)
            if ow:
                out[ow] = out.get(ow, 0) + int(n)
        return out

    rules_total = _count_by_owner((await db.execute(
        select(IgAutoReply.account_id, func.count()).group_by(IgAutoReply.account_id))).all())
    rules_active = _count_by_owner((await db.execute(
        select(IgAutoReply.account_id, func.count()).where(IgAutoReply.enabled.is_(True)).group_by(IgAutoReply.account_id))).all())
    msgs = _count_by_owner((await db.execute(
        select(IgMessage.account_id, func.count()).group_by(IgMessage.account_id))).all())
    forms = _count_by_owner((await db.execute(
        select(IgForm.account_id, func.count()).group_by(IgForm.account_id))).all())

    # خلبان‌ها per owner (account_ids JSONB)
    autos = (await db.execute(select(IgAutopilot.account_ids, IgAutopilot.enabled))).all()
    autopilots: dict[int, int] = {}
    autopilots_on: dict[int, int] = {}
    for acc_ids, en in autos:
        owners = set(_o(x) for x in (acc_ids or []) if _o(x))
        for ow in owners:
            autopilots[ow] = autopilots.get(ow, 0) + 1
            if en:
                autopilots_on[ow] = autopilots_on.get(ow, 0) + 1

    return {"by_owner": by_owner, "posts": posts, "scheduled": scheduled, "drafts": drafts,
            "dm": dm, "cm": cm, "inbox_total": inbox_total, "rules_total": rules_total,
            "rules_active": rules_active, "msgs": msgs, "forms": forms,
            "autopilots": autopilots, "autopilots_on": autopilots_on}


def _acc_detail(a: IgAccount) -> dict:
    return {"id": a.id, "username": a.username, "full_name": a.full_name, "status": a.status,
            "smart_enabled": a.smart_enabled, "is_active": a.is_active, "avatar_url": a.avatar_url,
            "ig_pk": a.ig_pk, "has_creds": bool(a.enc_password),
            "last_login_at": a.last_login_at.isoformat() if a.last_login_at else None,
            "last_error": a.last_error}


def _user_out(u: IGUser, ana: dict) -> dict:
    accs = ana["by_owner"].get(u.id, [])
    return {
        "id": u.id, "username": u.username, "display_name": u.display_name,
        "max_accounts": u.max_accounts, "accounts_used": len(accs), "is_active": u.is_active,
        "is_admin_seed": u.is_admin_seed, "has_password": bool(u.enc_login_password),
        "permissions": _perms_full(u.permissions), "notes": u.notes or "",
        "login_count": u.login_count or 0, "last_login_ip": u.last_login_ip,
        "last_active_at": u.last_active_at.isoformat() if u.last_active_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "accounts": [_acc_detail(a) for a in accs],
        "stats": {
            "posts_published": ana["posts"].get(u.id, 0),
            "posts_scheduled": ana["scheduled"].get(u.id, 0),
            "posts_draft": ana["drafts"].get(u.id, 0),
            "dm_sent": ana["dm"].get(u.id, 0), "comment_sent": ana["cm"].get(u.id, 0),
            "inbox_total": ana["inbox_total"].get(u.id, 0),
            "rules_total": ana["rules_total"].get(u.id, 0),
            "active_rules": ana["rules_active"].get(u.id, 0),
            "messages": ana["msgs"].get(u.id, 0), "forms": ana["forms"].get(u.id, 0),
            "autopilots": ana["autopilots"].get(u.id, 0),
            "autopilots_on": ana["autopilots_on"].get(u.id, 0),
            "online_accounts": sum(1 for a in accs if a.status == "online"),
        },
    }


# ═══════════════ فهرست + خلاصه ═══════════════
@router.get("")
async def list_ig_users(_: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    users = (await db.execute(select(IGUser).order_by(IGUser.id))).scalars().all()
    ana = await _analytics(db)
    return [_user_out(u, ana) for u in users]


@router.get("/permissions-schema")
async def perms_schema(_: Admin = Depends(require_role("admin"))):
    return PERMISSIONS


@router.get("/overview")
async def overview(_: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    users = (await db.execute(select(IGUser))).scalars().all()
    ana = await _analytics(db)
    total_acc = (await db.execute(select(func.count()).select_from(IgAccount).where(IgAccount.owner_id.isnot(None)))).scalar() or 0
    online = (await db.execute(select(func.count()).select_from(IgAccount).where(IgAccount.status == "online"))).scalar() or 0
    active_users = sum(1 for u in users if u.is_active)
    return {"total_users": len(users), "active_users": active_users, "total_accounts": total_acc,
            "online_accounts": online, "total_posts": sum(ana["posts"].values()),
            "total_dm": sum(ana["dm"].values()), "total_comment": sum(ana["cm"].values()),
            "total_rules": sum(ana["rules_active"].values()),
            "total_autopilots_on": sum(ana["autopilots_on"].values())}


@router.get("/{uid}")
async def get_ig_user(uid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    u = (await db.execute(select(IGUser).where(IGUser.id == uid))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "کاربر یافت نشد.")
    ana = await _analytics(db)
    return _user_out(u, ana)


# ═══════════════ تایم‌لاینِ فعالیت (چه کرده) ═══════════════
@router.get("/{uid}/activity")
async def user_activity(uid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    u = (await db.execute(select(IGUser).where(IGUser.id == uid))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "کاربر یافت نشد.")
    acc_rows = (await db.execute(select(IgAccount.id, IgAccount.username).where(IgAccount.owner_id == uid))).all()
    acc_ids = [int(a) for a, _u in acc_rows]
    acc_name = {int(a): un for a, un in acc_rows}
    items: list[dict] = []
    if acc_ids:
        # محتوای منتشرشده/زمان‌بندی‌شده
        for c in (await db.execute(select(IgContent).order_by(IgContent.id.desc()).limit(120))).scalars().all():
            owners = set(int(x) for x in (c.account_ids or []) if int(x) in acc_ids)
            if not owners:
                continue
            t = c.published_at or c.scheduled_at or c.created_at
            items.append({"kind": "content", "icon": "send", "at": t.isoformat() if t else None,
                          "title": c.title or (c.caption or "")[:40] or "محتوا",
                          "detail": f"{c.post_type} · {c.status}"})
        # دستورهای ساخته‌شده
        for r in (await db.execute(select(IgAutoReply).where(IgAutoReply.account_id.in_(acc_ids)).order_by(IgAutoReply.id.desc()).limit(40))).scalars().all():
            items.append({"kind": "rule", "icon": "zap", "at": r.created_at.isoformat() if r.created_at else None,
                          "title": r.title or "دستورِ پاسخِ خودکار",
                          "detail": f"@{acc_name.get(r.account_id, '')} · {('فعال' if r.enabled else 'غیرفعال')} · ارسال‌شده: {r.sent_count}"})
        # آخرین پیام‌های هندل‌شده
        for ib in (await db.execute(select(IgInbox).where(IgInbox.account_id.in_(acc_ids)).order_by(IgInbox.id.desc()).limit(40))).scalars().all():
            items.append({"kind": "inbox", "icon": "message", "at": ib.created_at.isoformat() if ib.created_at else None,
                          "title": f"{'دایرکت' if ib.kind == 'direct' else 'کامنت'} از @{ib.from_username or '—'}",
                          "detail": (ib.text_in or "")[:60] + (" → پاسخ داده شد" if ib.text_out else "")})
        # خلبان‌ها
        for ap in (await db.execute(select(IgAutopilot).order_by(IgAutopilot.id.desc()).limit(40))).scalars().all():
            if not set(int(x) for x in (ap.account_ids or []) if int(x) in acc_ids):
                continue
            t = ap.last_run_at or ap.created_at
            items.append({"kind": "autopilot", "icon": "rocket", "at": t.isoformat() if t else None,
                          "title": ap.name or "خلبانِ خودکار",
                          "detail": f"{('فعال' if ap.enabled else 'متوقف')} · ساخته‌شده: {ap.made_count}"})
    items = [i for i in items if i["at"]]
    items.sort(key=lambda x: x["at"], reverse=True)
    return {"items": items[:60]}


# ═══════════════ نمایشِ رمزِ پنل به ادمین ═══════════════
@router.get("/{uid}/password")
async def reveal_password(uid: int, admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    u = (await db.execute(select(IGUser).where(IGUser.id == uid))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "کاربر یافت نشد.")
    # ثبتِ audit trail: هر بار افشای رمز، یک رکورد در activity_logs نوشته می‌شود
    db.add(ActivityLog(
        action="ig_password_reveal",
        entity_type="ig_user",
        entity_id=uid,
        admin_id=admin.id,
        details={"target_uid": uid, "target_username": u.username},
    ))
    await db.commit()
    if not u.enc_login_password:
        return {"password": None, "message": "رمزِ این کاربر قبل از این قابلیت ست شده؛ برای دیدن، یک رمزِ جدید ست کنید."}
    return {"password": decrypt_secret(u.enc_login_password) or None}


# ═══════════════ ساخت/ویرایش ═══════════════
@router.post("")
async def create_ig_user(data: dict = Body(...), admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if len(username) < 3 or len(password) < 6:
        raise HTTPException(400, "نام کاربری حداقل ۳ و رمز حداقل ۶ کاراکتر.")
    if (await db.execute(select(IGUser).where(func.lower(IGUser.username) == username.lower()))).scalar_one_or_none():
        raise HTTPException(409, "این نام کاربری قبلاً وجود دارد.")
    perms = data.get("permissions")
    u = IGUser(username=username, password_hash=hash_password(password),
               enc_login_password=encrypt_secret(password),
               display_name=(data.get("display_name") or "").strip() or None,
               max_accounts=int(data.get("max_accounts", 3)), is_active=True,
               notes=(data.get("notes") or "").strip() or None,
               permissions=_perms_full(perms) if perms is not None else None,
               created_by_admin_id=admin.id)
    db.add(u); await db.commit(); await db.refresh(u)
    ana = await _analytics(db)
    return _user_out(u, ana)


@router.put("/{uid}")
async def update_ig_user(uid: int, data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    u = (await db.execute(select(IGUser).where(IGUser.id == uid))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "کاربر یافت نشد.")
    if "username" in data:
        nu = (data["username"] or "").strip()
        if len(nu) < 3:
            raise HTTPException(400, "نام کاربری حداقل ۳ کاراکتر.")
        if nu != u.username:
            if u.is_admin_seed:
                raise HTTPException(400, "نام کاربریِ ادمینِ اصلی قابلِ تغییر نیست.")
            if (await db.execute(select(IGUser).where(func.lower(IGUser.username) == nu.lower(), IGUser.id != uid))).scalar_one_or_none():
                raise HTTPException(409, "این نام کاربری قبلاً وجود دارد.")
            u.username = nu
    if "display_name" in data:
        u.display_name = (data["display_name"] or "").strip() or None
    if "notes" in data:
        u.notes = (data["notes"] or "").strip() or None
    if "max_accounts" in data:
        u.max_accounts = max(1, min(int(data["max_accounts"]), 20))
    if "is_active" in data:
        u.is_active = bool(data["is_active"])
    if "permissions" in data and data["permissions"] is not None:
        u.permissions = _perms_full(data["permissions"])
    if data.get("password"):
        if len(data["password"]) < 6:
            raise HTTPException(400, "رمز حداقل ۶ کاراکتر.")
        u.password_hash = hash_password(data["password"])
        u.enc_login_password = encrypt_secret(data["password"])
    await db.commit()
    ana = await _analytics(db)
    return _user_out(u, ana)


@router.put("/{uid}/permissions")
async def set_permissions(uid: int, data: dict = Body(...), _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    u = (await db.execute(select(IGUser).where(IGUser.id == uid))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "کاربر یافت نشد.")
    u.permissions = _perms_full(data.get("permissions") or data)
    await db.commit()
    return {"ok": True, "permissions": u.permissions}


@router.delete("/{uid}")
async def delete_ig_user(uid: int, _: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    u = (await db.execute(select(IGUser).where(IGUser.id == uid))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "کاربر یافت نشد.")
    if u.is_admin_seed:
        raise HTTPException(400, "کاربرِ ادمینِ اصلی قابلِ حذف نیست.")
    await db.delete(u)   # CASCADE اکانت‌های متعلقش را هم پاک می‌کند
    await db.commit()
    return {"ok": True}
