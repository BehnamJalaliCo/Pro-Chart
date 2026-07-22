"""پنلِ ادمینِ مرکزی — کنترلِ اشتراکِ همهٔ سرورها از یک‌جا (به‌خواستِ مالک، آیتم ۱).

مدلِ واقعی: هویّت/اشتراکِ کاربر **مرکزی** است (همهٔ سرورها با همان SSO/tier احراز می‌کنند).
پس یک toggle در مرکز → روی همهٔ سرورها اعمال می‌شود (کریپتو/فارکس/چارت/سیگنال/کپی).
این ماژول سه چیز می‌دهد:
- `GET  /academy/admin/servers`              نظارت: فهرست+سلامتِ زندهٔ سرورها + شمارشِ مشترکین.
- `GET  /academy/admin/users/{id}/entitlements`  نمای دسترسیِ کاربر روی هر سرور.
- `POST /academy/admin/users/{id}/subscription/toggle`  فعال/غیرفعال‌کردنِ اشتراک (تک‌کلیدی، audited).

مسیرها زیرِ `/academy/admin`؛ auth = `require_admin(...)` (توکنِ ادمین + مجوزِ granular).
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Body, Depends, Header, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes import admin_audit
from src.api.routes.admin_panel import _require_confirm, require_admin
from src.api.routes.admin_roles import role_for
from src.api.routes.admin_users import _uid, mask_email
from src.core.database import AcademyStudent
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


def _ms(dt) -> Optional[int]:
    return int(dt.timestamp() * 1000) if dt else None


def _active(dt) -> bool:
    return bool(dt and dt > datetime.now(timezone.utc))


# ── فهرستِ سرورهای شبکهٔ خصوصیِ prochart-internal (10.10.1.0/24) ──
def _servers() -> list[dict]:
    return [
        {"id": "hub", "name": "Po-Chart Hub (API مرکزی)", "role": "api/auth/subscriptions",
         "health": os.getenv("BN_SELF_HEALTH_URL", "http://127.0.0.1:8000/health")},
        {"id": "central-auth", "name": "App Central Auth (SSO)", "role": "sso",
         "health": os.getenv("BN_CENTRAL_AUTH_URL", "http://10.10.1.1:8100") + "/health"},
        {"id": "crypto", "name": "TraydeYar (کریپتو/exec/سیگنال)", "role": "crypto",
         "health": os.getenv("BN_CRYPTO_SVC_URL", "http://10.10.1.4:8000") + "/health"},
        {"id": "forex", "name": "CoinePro-FX (فارکس/سیگنال)", "role": "forex",
         "health": os.getenv("BN_FOREX_SVC_URL", "http://10.10.1.3:8000") + "/health"},
    ]


async def _probe(cli: httpx.AsyncClient, url: str) -> dict:
    try:
        r = await cli.get(url, timeout=4.0)
        return {"up": r.status_code < 500, "status": r.status_code}
    except Exception as e:  # noqa: BLE001
        return {"up": False, "status": None, "error": str(e)[:80]}


@router.get("/admin/servers")
async def admin_servers(st=Depends(require_admin("overview.read")),
                        db: AsyncSession = Depends(get_db)) -> dict:
    """نظارتِ مرکزی: سلامتِ زندهٔ سرورها + شمارشِ مشترکینِ فعال به‌تفکیکِ tier."""
    servers = _servers()
    async with httpx.AsyncClient() as cli:
        for s in servers:
            s["health"] = await _probe(cli, s.pop("health"))
    # شمارشِ مشترکین (مرکزی — همان روی همهٔ سرورها اعمال می‌شود)
    now = datetime.now(timezone.utc)
    rows = (await db.execute(text(
        "SELECT COALESCE(tier,'free') AS t, COUNT(*) c, "
        "COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at > :now) act "
        "FROM academy_students GROUP BY 1 ORDER BY 2 DESC"), {"now": now})).all()
    tiers = [{"tier": r[0], "total": int(r[1]), "active": int(r[2])} for r in rows]
    total = sum(t["total"] for t in tiers)
    paid_active = sum(t["active"] for t in tiers if t["tier"] not in ("free", None))
    return {"servers": servers, "subscribers": {
        "total_users": total, "paid_active": paid_active, "by_tier": tiers},
        "note": "اشتراک مرکزی است؛ toggle در مرکز روی همهٔ سرورها اعمال می‌شود."}


# ── نگاشتِ tier/flag → دسترسیِ هر سرور ──
def _entitlements(target: AcademyStudent) -> dict:
    now = datetime.now(timezone.utc)
    tier = (getattr(target, "tier", None) or "free")
    paid = tier in ("vip", "premium") and (_active(getattr(target, "expires_at", None)) or getattr(target, "expires_at", None) is None)
    prochart = paid or _active(getattr(target, "prochart_until", None))
    per_server = [
        {"server": "hub", "features": ["chart", "markets", "portfolio", "home"],
         "enabled": True, "until": None},
        {"server": "crypto", "features": ["crypto_signals", "crypto_exec", "copy_crypto"],
         "enabled": bool(prochart), "until": _ms(getattr(target, "expires_at", None)),
         "copy": bool(getattr(target, "copy_crypto", False))},
        {"server": "forex", "features": ["forex_signals", "copy_forex"],
         "enabled": bool(_active(getattr(target, "forex_signal_until", None)) or prochart),
         "signals_until": _ms(getattr(target, "forex_signal_until", None)),
         "copy_until": _ms(getattr(target, "forex_copy_until", None)),
         "copy": bool(getattr(target, "copy_forex", False))},
    ]
    return {
        "user_id": f"u_{target.id}",
        "user_masked": mask_email(getattr(target, "email", None)) or target.username,
        "tier": tier, "paid_active": bool(paid),
        "expires_at": _ms(getattr(target, "expires_at", None)),
        "prochart_until": _ms(getattr(target, "prochart_until", None)),
        "servers": per_server,
        "propagation": "central-sso",
    }


async def _student(db: AsyncSession, uid: int) -> Optional[AcademyStudent]:
    return (await db.execute(select(AcademyStudent).where(AcademyStudent.id == uid))).scalar_one_or_none()


@router.get("/admin/users/{id}/entitlements")
async def admin_user_entitlements(id: str, st=Depends(require_admin("subscriptions.read")),
                                  db: AsyncSession = Depends(get_db)) -> dict:
    """نمای دسترسیِ کاربر روی همهٔ سرورها (از tier/flag مرکزی مشتق می‌شود)."""
    target = await _student(db, _uid(id))
    if not target:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "کاربر یافت نشد."}})
    return _entitlements(target)


@router.post("/admin/users/{id}/subscription/toggle")
async def admin_subscription_toggle(
    id: str,
    enabled: bool = Body(..., embed=True),
    plan: str = Body("vip", embed=True),
    duration_days: int = Body(30, embed=True),
    reason: str = Body(..., embed=True),
    x_admin_confirm: Optional[str] = Header(None),
    st=Depends(require_admin("subscriptions.grant")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """فعال/غیرفعال‌کردنِ اشتراکِ کاربر — تک‌کلیدی. مرکزی؛ روی همهٔ سرورها اعمال می‌شود.

    enabled=true → tier=plan تا duration_days روز فعال. enabled=false → tier=free فوری."""
    if not (reason or "").strip():
        raise HTTPException(status_code=400, detail={"error": {"code": "reason_required", "message": "reason لازم است."}})
    _require_confirm(x_admin_confirm)
    target = await _student(db, _uid(id))
    if not target:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "کاربر یافت نشد."}})
    now = datetime.now(timezone.utc)
    if enabled:
        dd = max(1, int(duration_days or 30))
        pl = plan if plan in ("vip", "premium") else "vip"
        expires = now + timedelta(days=dd)
        target.tier = pl
        target.expires_at = expires
        if hasattr(target, "prochart_until"):
            target.prochart_until = expires
        sub_status = "active"
    else:
        target.tier = "free"
        target.expires_at = now
        if hasattr(target, "prochart_until"):
            target.prochart_until = now
        expires = now
        sub_status = "disabled"
    try:
        await db.execute(text(
            "INSERT INTO academy_subscriptions (student_id,tier,status,amount_usdt,started_at,expires_at,created_at) "
            "VALUES (:s,:t,:st,0,:sa,:ea,now())"),
            {"s": target.id, "t": target.tier, "st": sub_status, "sa": now, "ea": expires})
    except Exception as e:  # noqa: BLE001
        logger.warning("toggle_sub_insert_failed", error=str(e))
    await db.commit()
    await db.refresh(target)
    audit = await admin_audit.record(
        actor_id=st.id, actor_name=st.username, actor_role=role_for(st),
        action="subscriptions.toggle", target_type="user", target_id=target.id,
        target_label=mask_email(getattr(target, "email", None)) or target.username,
        reason=reason, metadata={"enabled": enabled, "plan": target.tier, "duration_days": duration_days})
    return {"accepted": True, "enabled": enabled, "entitlements": _entitlements(target), "audit": audit}
