"""پنلِ ادمین فاز۸ — بخشِ ۸B: مدیریت کاربران.

قرارداد: `SERVER_HANDOFF_09_admin.md` §۸B. مسیرها زیرِ `/academy/admin/`.
هر mutation: permission + `reason` (ثبت در audit) + `X-Admin-Confirm` برای حساس‌ها.
ماسکِ پیش‌فرضِ ایمیل/موبایل؛ نمایشِ کامل فقط با `users.unmask_email` (و ثبت در audit).
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes import admin_audit
from src.api.routes.admin_panel import require_admin, _require_confirm
from src.api.routes.admin_roles import ASSIGNABLE_ROLES, ROLE_RANK, has_permission, role_for
from src.core.database import (AcademyDevice, AcademyStudent, async_session_factory)
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


def _ms(dt) -> Optional[int]:
    return int(dt.timestamp() * 1000) if dt else None


def mask_email(email: Optional[str]) -> Optional[str]:
    if not email or "@" not in email:
        return email
    name, _, dom = email.partition("@")
    show = name[:2] if len(name) > 2 else name[:1]
    return f"{show}***@{dom}"


def mask_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return phone
    d = re.sub(r"\D", "", phone)
    if len(d) < 4:
        return "***"
    return f"+{d[:2]} {d[2:4]}*** **{d[-2:]}" if phone.startswith("+") or len(d) > 8 else f"{d[:2]}*** **{d[-2:]}"


def _account_status(st) -> str:
    s = (getattr(st, "status", None) or "active").lower()
    if s == "banned":
        return "banned"
    if s == "suspended":
        return "suspended"
    if s in ("disabled", "deleted"):
        return "suspended" if s == "disabled" else "banned"
    return "active"


def _subscription_status(st) -> str:
    now = datetime.now(timezone.utc)
    tier = (getattr(st, "tier", None) or "free").lower()
    exp = getattr(st, "expires_at", None)
    if tier in ("vip", "premium"):
        if exp is None or exp > now:
            return "active"
        return "expired"
    return "none"


def _user_row(st, *, unmask: bool = False) -> dict:
    email = getattr(st, "email", None)
    phone = getattr(st, "phone_number", None)
    return {
        "id": f"u_{st.id}", "name": getattr(st, "full_name", None) or getattr(st, "username", None),
        "email_masked": mask_email(email), "email": email if unmask else None,
        "phone_masked": mask_phone(phone), "phone": phone if unmask else None,
        "joined_at": _ms(getattr(st, "created_at", None)),
        "last_active_at": _ms(getattr(st, "last_login_at", None)),
        "plan": getattr(st, "tier", None), "subscription_status": _subscription_status(st),
        "kyc_status": _kyc_display(getattr(st, "kyc_status", None)),
        "account_status": _account_status(st),
        "lang": "fa",
        "role": (getattr(st, "role", None) or "user"),
    }


def _kyc_display(s: Optional[str]) -> str:
    s = (s or "none").lower()
    return {"approved": "verified", "none": "none", "pending": "pending", "rejected": "rejected"}.get(s, s)


# ── GET /admin/users ──
@router.get("/admin/users")
async def admin_users(query: str = "", plan: str = "", subscription: str = "", kyc: str = "",
                      banned: str = "", lang: str = "", joined_from: Optional[int] = None,
                      joined_to: Optional[int] = None, sort: str = "joined", order: str = "desc",
                      cursor: str = "", limit: int = 25,
                      authorization: Optional[str] = Header(None),
                      st=Depends(require_admin("users.read")), db: AsyncSession = Depends(get_db)) -> dict:
    limit = max(1, min(int(limit), 100))
    offset = int(cursor) if (cursor and cursor.isdigit()) else 0
    conds = []
    q = (query or "").strip()
    if q:
        like = f"%{q}%"
        ors = [AcademyStudent.username.ilike(like), AcademyStudent.full_name.ilike(like),
               AcademyStudent.email.ilike(like)]
        if q.isdigit():
            ors.append(AcademyStudent.id == int(q))
        conds.append(or_(*ors))
    if plan:
        conds.append(AcademyStudent.tier == plan)
    if kyc:
        conds.append(AcademyStudent.kyc_status == ("approved" if kyc == "verified" else kyc))
    if banned.lower() in ("1", "true", "yes"):
        conds.append(AcademyStudent.status == "banned")
    now = datetime.now(timezone.utc)
    if subscription == "active":
        conds.append(AcademyStudent.tier.in_(("vip", "premium")))
        conds.append(or_(AcademyStudent.expires_at.is_(None), AcademyStudent.expires_at > now))
    elif subscription == "expired":
        conds.append(AcademyStudent.expires_at < now)
    elif subscription == "none":
        conds.append(AcademyStudent.tier == "free")
    if joined_from:
        conds.append(AcademyStudent.created_at >= datetime.fromtimestamp(joined_from / 1000, tz=timezone.utc))
    if joined_to:
        conds.append(AcademyStudent.created_at <= datetime.fromtimestamp(joined_to / 1000, tz=timezone.utc))

    sort_col = {"joined": AcademyStudent.created_at, "last_active": AcademyStudent.last_login_at,
                "plan": AcademyStudent.tier}.get(sort, AcademyStudent.created_at)
    sort_col = sort_col.asc() if order == "asc" else sort_col.desc()

    base = select(AcademyStudent)
    for c in conds:
        base = base.where(c)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    rows = (await db.execute(base.order_by(sort_col, AcademyStudent.id.desc())
                             .offset(offset).limit(limit))).scalars().all()
    unmask = has_permission(role_for(st), "users.unmask_email")
    items = [_user_row(r, unmask=unmask) for r in rows]
    next_cursor = str(offset + limit) if (offset + limit) < total else None
    return {"items": items, "next_cursor": next_cursor, "total": int(total)}


# ── GET /admin/users/{id} ──
def _uid(id: str) -> int:
    raw = id[2:] if id.startswith("u_") else id
    if not raw.isdigit():
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "کاربر یافت نشد."}})
    return int(raw)


@router.get("/admin/users/{id}")
async def admin_user_detail(id: str, authorization: Optional[str] = Header(None),
                            st=Depends(require_admin("users.read")), db: AsyncSession = Depends(get_db)) -> dict:
    uid = _uid(id)
    target = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == uid))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "کاربر یافت نشد."}})
    unmask = has_permission(role_for(st), "users.unmask_email")
    row = _user_row(target, unmask=unmask)

    profile = {"full_name": getattr(target, "full_name", None), "tier": getattr(target, "tier", None),
               "avatar_url": None, "xp": None, "created_ip": None}

    subs = []
    if _subscription_status(target) != "none":
        subs.append({"id": f"sub_{target.id}", "plan": target.tier, "status": _subscription_status(target),
                     "started_at": _ms(getattr(target, "created_at", None)),
                     "expires_at": _ms(getattr(target, "expires_at", None)), "source": "manual"})

    payments = []
    try:
        from sqlalchemy import text as _t
        pr = (await db.execute(_t("SELECT id,amount_usdt,status,product,created_at FROM academy_payments "
                                  "WHERE student_id=:s ORDER BY id DESC LIMIT 50"), {"s": uid})).all()
        payments = [{"id": str(p[0]), "amount": float(p[1] or 0), "currency": "USD",
                     "method": "crypto", "status": p[2], "created_at": _ms(p[4]),
                     "reference": p[3], "refundable": False} for p in pr]
    except Exception:  # noqa: BLE001
        payments = []

    kyc = None
    try:
        from sqlalchemy import text as _t
        k = (await db.execute(_t("SELECT status,submitted_at,reviewed_at,reviewer FROM academy_kyc "
                                 "WHERE student_id=:s ORDER BY id DESC LIMIT 1"), {"s": uid})).first()
        if k:
            kyc = {"status": _kyc_display(k[0]), "submitted_at": _ms(k[1]), "reviewed_at": _ms(k[2]),
                   "reviewer": k[3], "documents": []}
    except Exception:  # noqa: BLE001
        kyc = None
    if kyc is None and getattr(target, "kyc_status", "none") not in (None, "none"):
        kyc = {"status": _kyc_display(target.kyc_status), "submitted_at": None, "reviewed_at": None,
               "reviewer": None, "documents": []}

    devices = []
    try:
        dv = (await db.execute(select(AcademyDevice).where(AcademyDevice.student_id == uid))).scalars().all()
        devices = [{"id": str(d.id), "name": getattr(d, "device_name", None), "ip": None,
                    "last_seen": _ms(getattr(d, "last_seen_at", None)), "current": False} for d in dv]
    except Exception:  # noqa: BLE001
        devices = []

    connections = []
    try:
        from src.core.database import BnExchangeAccount
        acc = (await db.execute(select(BnExchangeAccount).where(BnExchangeAccount.student_id == uid))).scalars().all()
        for a in acc:
            ref = getattr(a, "account_ref", None)
            connections.append({"provider": a.kind, "status": "connected" if a.status == "active" else a.status,
                                "masked_account": f"•••• {str(ref)[-4:]}" if ref else None})
    except Exception:  # noqa: BLE001
        connections = []

    admin_actions = (await admin_audit.read(target_type="user", limit=50))
    admin_actions = [e for e in admin_actions.get("items", []) if e.get("target_id") in (str(uid), f"u_{uid}")]

    return {"user": row, "profile": profile, "subscriptions": subs, "payments": payments,
            "kyc": kyc, "devices": devices, "connections": connections,
            "security_activity": [], "admin_actions": admin_actions}


# ── اکشن‌ها ──
async def _load(db, uid) -> AcademyStudent:
    t = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == uid))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "کاربر یافت نشد."}})
    return t


async def _do_action(db, st, uid, action, perm_role, reason, *, apply, sensitive_confirm=None):
    if not (reason or "").strip():
        raise HTTPException(status_code=400, detail={"error": {"code": "reason_required", "message": "reason لازم است."}})
    if sensitive_confirm is not None:
        _require_confirm(sensitive_confirm)
    target = await _load(db, uid)
    apply(target)
    await db.commit()
    await db.refresh(target)
    audit = await admin_audit.record(actor_id=st.id, actor_name=st.username, actor_role=perm_role,
                                     action=action, target_type="user", target_id=uid,
                                     target_label=mask_email(getattr(target, "email", None)) or target.username,
                                     reason=reason)
    return {"accepted": True, "user": _user_row(target, unmask=has_permission(perm_role, "users.unmask_email")),
            "audit": audit}


@router.post("/admin/users/{id}/ban")
async def user_ban(id: str, reason: str = Body(..., embed=True), x_admin_confirm: Optional[str] = Header(None),
                   st=Depends(require_admin("users.ban")), db: AsyncSession = Depends(get_db)):
    return await _do_action(db, st, _uid(id), "users.ban", role_for(st), reason,
                            apply=lambda t: setattr(t, "status", "banned"), sensitive_confirm=x_admin_confirm)


@router.post("/admin/users/{id}/unban")
async def user_unban(id: str, reason: str = Body(..., embed=True),
                     st=Depends(require_admin("users.ban")), db: AsyncSession = Depends(get_db)):
    return await _do_action(db, st, _uid(id), "users.unban", role_for(st), reason,
                            apply=lambda t: setattr(t, "status", "active"))


@router.post("/admin/users/{id}/suspend")
async def user_suspend(id: str, reason: str = Body(..., embed=True), until: Optional[int] = Body(None, embed=True),
                       x_admin_confirm: Optional[str] = Header(None),
                       st=Depends(require_admin("users.suspend")), db: AsyncSession = Depends(get_db)):
    def apply(t):
        t.status = "suspended"
        if until:
            t.suspended_until = datetime.fromtimestamp(until / 1000, tz=timezone.utc)
    return await _do_action(db, st, _uid(id), "users.suspend", role_for(st), reason,
                            apply=apply, sensitive_confirm=x_admin_confirm)


@router.post("/admin/users/{id}/reset-pin")
async def user_reset_pin(id: str, reason: str = Body(..., embed=True),
                         st=Depends(require_admin("users.reset_pin")), db: AsyncSession = Depends(get_db)):
    uid = _uid(id)
    try:
        from src.core.redis_client import redis_client
        await redis_client.client.delete(f"bn:apppin:{uid}")
    except Exception:  # noqa: BLE001
        pass
    return await _do_action(db, st, uid, "users.reset_pin", role_for(st), reason, apply=lambda t: None)


@router.post("/admin/users/{id}/logout-all")
async def user_logout_all(id: str, reason: str = Body(..., embed=True),
                          st=Depends(require_admin("users.logout_devices")), db: AsyncSession = Depends(get_db)):
    uid = _uid(id)
    try:
        dv = (await db.execute(select(AcademyDevice).where(AcademyDevice.student_id == uid))).scalars().all()
        for d in dv:
            await db.delete(d)
    except Exception:  # noqa: BLE001
        pass
    return await _do_action(db, st, uid, "users.logout_devices", role_for(st), reason, apply=lambda t: None)


@router.delete("/admin/users/{id}")
async def user_delete(id: str, reason: str = Body(..., embed=True), x_admin_confirm: Optional[str] = Header(None),
                      st=Depends(require_admin("users.delete")), db: AsyncSession = Depends(get_db)):
    return await _do_action(db, st, _uid(id), "users.delete", role_for(st), reason,
                            apply=lambda t: setattr(t, "status", "deleted"), sensitive_confirm=x_admin_confirm)


# ── تغییرِ نقش (خارج از سند؛ ستونِ role) ──
@router.post("/admin/users/{id}/role")
async def user_set_role(id: str, role: str = Body(..., embed=True), reason: str = Body(..., embed=True),
                        x_admin_confirm: Optional[str] = Header(None),
                        st=Depends(require_admin("users.suspend")), db: AsyncSession = Depends(get_db)):
    """تخصیصِ نقش. actor باید admin+ باشد؛ فقط superadmin می‌تواند admin/superadmin بدهد."""
    new_role = (role or "").strip().lower()
    if new_role not in ASSIGNABLE_ROLES:
        raise HTTPException(status_code=400, detail={"error": {"code": "bad_role",
                            "message": f"نقشِ نامعتبر. مجاز: {ASSIGNABLE_ROLES}"}})
    if not (reason or "").strip():
        raise HTTPException(status_code=400, detail={"error": {"code": "reason_required", "message": "reason لازم است."}})
    _require_confirm(x_admin_confirm)
    actor_role = role_for(st)
    actor_rank = ROLE_RANK.get(actor_role, 0)
    target_rank = ROLE_RANK.get(new_role, 0)
    # فقط superadmin می‌تواند نقشِ admin/superadmin بدهد؛ بقیه فقط نقشِ پایین‌تر از خودشان
    if actor_role != "superadmin" and target_rank >= actor_rank:
        raise HTTPException(status_code=403, detail={"error": {"code": "forbidden",
                            "message": "نمی‌توانید نقشی برابر/بالاترِ خودتان تخصیص دهید.",
                            "required_permission": "superadmin"}})
    target = await _load(db, _uid(id))
    target.role = new_role
    await db.commit()
    await db.refresh(target)
    audit = await admin_audit.record(actor_id=st.id, actor_name=st.username, actor_role=actor_role,
                                     action="users.role", target_type="user", target_id=target.id,
                                     target_label=mask_email(getattr(target, "email", None)) or target.username,
                                     reason=reason, metadata={"new_role": new_role})
    return {"accepted": True, "role": new_role, "user": _user_row(target, unmask=has_permission(actor_role, "users.unmask_email")),
            "audit": audit}
