"""
بازارنما — پنلِ ادمینِ اختصاصی (CORE).

همهٔ endpointها زیرِ prefix `/admin/bn` (انسان در main.py ثبت می‌کند)، احراز با
`get_current_admin` (جدولِ admins اصلی)، خروجی camelCase و EMPTY-SAFE:
هرگز روی دادهٔ خالی 500 نمی‌دهد؛ آرایهٔ خالی / متریکِ صفر برمی‌گرداند.

منابع: academy_students، academy_subscriptions/payment_requests، bn_orders،
bn_ai_signals، bn_watchlists، bn_layouts، bn_scripts، bn_alerts،
bn_exchange_accounts، activity_logs، و کلیدهای Redis (bn:ads/bn:news/bn:calendar).

هرگز رمز/سکرت افشا نمی‌شود (password_hash/enc_key/enc_secret).
"""

from __future__ import annotations

import json as _json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_admin, get_db
from src.core.database import (
    AcademyStudent,
    AcademySubscription,
    ActivityLog,
    Admin,
    BnAiSignal,
    BnAlert,
    BnExchangeAccount,
    BnLayout,
    BnOrder,
    BnScript,
    BnWatchlist,
)
from src.core.logger import get_logger
from src.core.security import hash_password

router = APIRouter()
logger = get_logger(__name__)

_TIERS = ("free", "vip", "premium")
_GUEST_LIKE = "student-9%"  # مهمان‌های موقت — از همهٔ شمارش‌ها/فهرست‌ها حذف می‌شوند


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _f(v) -> float:
    """Decimal/None → float امن (برای مجموع‌های پولی)."""
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def _student_dict(s: AcademyStudent) -> dict:
    """نمایشِ استانداردِ کاربر (camelCase) — بدونِ password_hash."""
    return {
        "id": s.id,
        "username": s.username,
        "email": s.email,
        "fullName": s.full_name,
        "tier": s.tier,
        "status": s.status,
        "expiresAt": _iso(s.expires_at),
        "createdAt": _iso(s.created_at),
        "lastLoginAt": _iso(s.last_login_at),
        "phoneNumber": s.phone_number,
        "phoneVerified": bool(s.phone_verified),
        "accountType": s.account_type,
        "assessmentLevel": s.assessment_level,
    }


async def _log(db: AsyncSession, admin: Admin, action: str, entity_id: int | None,
               details: dict | None = None) -> None:
    """ثبتِ رکوردِ audit (بهترین‌تلاش — نبودِ لاگ نباید عملیات را بشکند)."""
    try:
        db.add(ActivityLog(action=action, entity_type="bn_user", entity_id=entity_id,
                           admin_id=admin.id, details=details or {}))
    except Exception as exc:  # noqa: BLE001
        logger.warning("bn_audit_log_failed", error=str(exc))


async def _get_student(db: AsyncSession, sid: int) -> AcademyStudent:
    s = await db.get(AcademyStudent, int(sid))
    if not s:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    return s


# ═══════════════════════════ آمارِ کلی (dashboard) ═══════════════════════════
@router.get("/stats")
async def stats(admin: Admin = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """متریک‌های داشبورد — همیشه HTTP 200 حتی روی دیتابیسِ خالی."""
    now = _now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    guard = ~AcademyStudent.username.like(_GUEST_LIKE)

    async def _count(stmt) -> int:
        return int((await db.execute(stmt)).scalar() or 0)

    # ── کاربران ──
    total = await _count(select(func.count()).select_from(AcademyStudent).where(guard))
    tier_rows = (await db.execute(
        select(AcademyStudent.tier, func.count()).where(guard).group_by(AcademyStudent.tier)
    )).all()
    tier_map = {(t or "free"): c for t, c in tier_rows}
    status_rows = (await db.execute(
        select(AcademyStudent.status, func.count()).where(guard).group_by(AcademyStudent.status)
    )).all()
    status_map = {(st or "active"): c for st, c in status_rows}

    new_today = await _count(select(func.count()).select_from(AcademyStudent)
                             .where(guard, AcademyStudent.created_at >= today))
    new_7d = await _count(select(func.count()).select_from(AcademyStudent)
                          .where(guard, AcademyStudent.created_at >= now - timedelta(days=7)))
    new_30d = await _count(select(func.count()).select_from(AcademyStudent)
                           .where(guard, AcademyStudent.created_at >= now - timedelta(days=30)))

    users = {
        "total": total,
        "free": int(tier_map.get("free", 0)),
        "vip": int(tier_map.get("vip", 0)),
        "premium": int(tier_map.get("premium", 0)),
        "active": int(status_map.get("active", 0)),
        "disabled": int(status_map.get("disabled", 0)),
        "newToday": new_today,
        "new7d": new_7d,
        "new30d": new_30d,
    }

    # ── اشتراک‌ها ──
    sub_rows = (await db.execute(
        select(AcademySubscription.status, func.count()).group_by(AcademySubscription.status)
    )).all()
    sub_map = {(st or ""): c for st, c in sub_rows}
    subscriptions = {
        "active": int(sub_map.get("active", 0)),
        "expired": int(sub_map.get("expired", 0)),
        "pending": int(sub_map.get("pending", 0)),
    }

    # ── درآمد (مجموعِ USDT از اشتراک‌های آکادمی) ──
    total_usd = _f((await db.execute(
        select(func.coalesce(func.sum(AcademySubscription.amount_usdt), 0))
    )).scalar())
    month_start = today.replace(day=1)
    month_usd = _f((await db.execute(
        select(func.coalesce(func.sum(AcademySubscription.amount_usdt), 0))
        .where(AcademySubscription.started_at >= month_start)
    )).scalar())
    revenue = {"totalUsd": round(total_usd, 2), "monthUsd": round(month_usd, 2)}

    # ── سفارش‌ها ──
    ord_rows = (await db.execute(
        select(BnOrder.status, func.count()).group_by(BnOrder.status)
    )).all()
    ord_map = {(st or ""): c for st, c in ord_rows}
    orders = {
        "total": int(sum(c for _, c in ord_rows)),
        "pending": int(ord_map.get("pending", 0)),
        "filled": int(ord_map.get("filled", 0)),
        "failed": int(ord_map.get("failed", 0)),
    }

    # ── سیگنال‌های AI ──
    ai_total = await _count(select(func.count()).select_from(BnAiSignal)
                            .where(BnAiSignal.status != "deleted"))
    ai_active = await _count(select(func.count()).select_from(BnAiSignal)
                             .where(BnAiSignal.status == "active"))
    ai_signals = {"total": ai_total, "active": ai_active}

    # ── واچ‌لیست‌ها ──
    wl_count = await _count(select(func.count()).select_from(BnWatchlist))

    # ── حساب‌های صرافی ──
    ex_count = await _count(select(func.count()).select_from(BnExchangeAccount))
    ex_verified = await _count(select(func.count()).select_from(BnExchangeAccount)
                               .where(BnExchangeAccount.referral_verified.is_(True)))

    return {
        "users": users,
        "subscriptions": subscriptions,
        "revenue": revenue,
        "orders": orders,
        "aiSignals": ai_signals,
        "watchlists": {"count": wl_count},
        "exchangeAccounts": {"count": ex_count, "verified": ex_verified},
    }


# ═══════════════════════════ ثبت‌نامِ روزانه ═══════════════════════════
@router.get("/signups")
async def signups(days: int = 30, admin: Admin = Depends(get_current_admin),
                  db: AsyncSession = Depends(get_db)):
    """تعدادِ کاربرِ جدید در هر روز (بازهٔ روزها zero-fill می‌شود)."""
    days = max(1, min(int(days or 30), 365))
    now = _now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    guard = ~AcademyStudent.username.like(_GUEST_LIKE)

    day_col = func.date(AcademyStudent.created_at)
    rows = (await db.execute(
        select(day_col, func.count()).where(guard, AcademyStudent.created_at >= start)
        .group_by(day_col)
    )).all()
    # کلیدِ رشته‌ایِ YYYY-MM-DD (func.date ممکن است date یا str بدهد)
    counts = {str(d): int(c) for d, c in rows}

    out = []
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        out.append({"date": d, "count": counts.get(d, 0)})
    return out


# ═══════════════════════════ فهرستِ کاربران ═══════════════════════════
@router.get("/users")
async def users_list(q: str = "", tier: str = "", status: str = "", page: int = 1,
                     limit: int = 25, admin: Admin = Depends(get_current_admin),
                     db: AsyncSession = Depends(get_db)):
    """فهرستِ صفحه‌بندی‌شدهٔ کاربران با فیلترِ جستجو/تیر/وضعیت. مهمان‌های موقت حذف می‌شوند."""
    page = max(1, int(page or 1))
    limit = max(1, min(int(limit or 25), 200))
    conds = [~AcademyStudent.username.like(_GUEST_LIKE)]

    ql = (q or "").strip().lower()
    if ql:
        like = f"%{ql}%"
        conds.append(
            func.lower(func.coalesce(AcademyStudent.username, "")).like(like)
            | func.lower(func.coalesce(AcademyStudent.email, "")).like(like)
            | func.lower(func.coalesce(AcademyStudent.full_name, "")).like(like)
        )
    if tier in _TIERS:
        conds.append(AcademyStudent.tier == tier)
    if status in ("active", "disabled"):
        conds.append(AcademyStudent.status == status)

    total = int((await db.execute(
        select(func.count()).select_from(AcademyStudent).where(*conds)
    )).scalar() or 0)

    rows = (await db.execute(
        select(AcademyStudent).where(*conds)
        .order_by(AcademyStudent.created_at.desc())
        .offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    pages = (total + limit - 1) // limit if total else 0
    return {
        "items": [_student_dict(s) for s in rows],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


# ═══════════════════════════ جزئیاتِ یک کاربر ═══════════════════════════
@router.get("/users/{user_id}")
async def user_detail(user_id: int, admin: Admin = Depends(get_current_admin),
                      db: AsyncSession = Depends(get_db)):
    s = await _get_student(db, user_id)

    async def _cnt(model) -> int:
        return int((await db.execute(
            select(func.count()).select_from(model).where(model.student_id == s.id)
        )).scalar() or 0)

    out = _student_dict(s)
    out["notes"] = s.notes
    out["stats"] = {
        "watchlists": await _cnt(BnWatchlist),
        "orders": await _cnt(BnOrder),
        "aiSignals": await _cnt(BnAiSignal),
        "exchangeAccounts": await _cnt(BnExchangeAccount),
    }
    return out


# ═══════════════════════════ ساختِ کاربر ═══════════════════════════
@router.post("/users")
async def user_create(username: str = Body(..., embed=True),
                      password: str = Body(..., embed=True),
                      email: str = Body("", embed=True),
                      fullName: str = Body("", embed=True),
                      tier: str = Body("free", embed=True),
                      days: int = Body(0, embed=True),
                      admin: Admin = Depends(get_current_admin),
                      db: AsyncSession = Depends(get_db)):
    uname = (username or "").strip().lower()
    if len(uname) < 3:
        raise HTTPException(status_code=400, detail="نام‌کاربری حداقل ۳ کاراکتر.")
    if len(password or "") < 6:
        raise HTTPException(status_code=400, detail="رمز حداقل ۶ کاراکتر.")
    if tier not in _TIERS:
        raise HTTPException(status_code=400, detail="تیرِ نامعتبر.")
    if (await db.execute(
        select(AcademyStudent.id).where(AcademyStudent.username == uname)
    )).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="این نام‌کاربری قبلاً گرفته شده.")

    expires_at = None
    if tier != "free" and int(days or 0) > 0:
        expires_at = _now() + timedelta(days=int(days))

    s = AcademyStudent(
        username=uname,
        password_hash=hash_password(password),
        email=(email or "").strip() or None,
        full_name=(fullName or "").strip() or None,
        tier=tier,
        status="active",
        expires_at=expires_at,
        created_by=admin.id,
    )
    db.add(s)
    await db.flush()
    await _log(db, admin, "bn_user_create", s.id, {"username": uname, "tier": tier})
    await db.commit()
    logger.info("bn_user_create", sid=s.id, admin=admin.id)
    return _student_dict(s)


# ═══════════════════════════ تغییرِ تیر ═══════════════════════════
@router.post("/users/{user_id}/tier")
async def user_set_tier(user_id: int, tier: str = Body(..., embed=True),
                        days: int = Body(30, embed=True),
                        admin: Admin = Depends(get_current_admin),
                        db: AsyncSession = Depends(get_db)):
    if tier not in _TIERS:
        raise HTTPException(status_code=400, detail="تیرِ نامعتبر.")
    s = await _get_student(db, user_id)
    s.tier = tier
    if tier == "free":
        s.expires_at = None
    elif int(days or 0) > 0:
        s.expires_at = _now() + timedelta(days=int(days))
    await _log(db, admin, "bn_user_set_tier", s.id, {"tier": tier, "days": int(days or 0)})
    await db.commit()
    return {"ok": True, "id": s.id, "tier": s.tier, "expiresAt": _iso(s.expires_at)}


# ═══════════════════════════ تغییرِ وضعیت ═══════════════════════════
@router.post("/users/{user_id}/status")
async def user_set_status(user_id: int, status: str = Body(..., embed=True),
                          admin: Admin = Depends(get_current_admin),
                          db: AsyncSession = Depends(get_db)):
    if status not in ("active", "disabled"):
        raise HTTPException(status_code=400, detail="وضعیتِ نامعتبر.")
    s = await _get_student(db, user_id)
    s.status = status
    await _log(db, admin, "bn_user_set_status", s.id, {"status": status})
    await db.commit()
    return {"ok": True, "id": s.id, "status": s.status}


# ═══════════════════════════ تمدیدِ اشتراک ═══════════════════════════
@router.post("/users/{user_id}/extend")
async def user_extend(user_id: int, days: int = Body(..., embed=True),
                      admin: Admin = Depends(get_current_admin),
                      db: AsyncSession = Depends(get_db)):
    d = int(days or 0)
    if d == 0:
        raise HTTPException(status_code=400, detail="تعدادِ روز لازم است.")
    s = await _get_student(db, user_id)
    # پایهٔ تمدید: اگر اشتراکِ فعال دارد از انقضای فعلی، وگرنه از حالا
    base = s.expires_at if (s.expires_at and s.expires_at > _now()) else _now()
    s.expires_at = base + timedelta(days=d)
    await _log(db, admin, "bn_user_extend", s.id, {"days": d})
    await db.commit()
    return {"ok": True, "id": s.id, "expiresAt": _iso(s.expires_at)}


# ═══════════════════════════ بازنشانیِ رمز ═══════════════════════════
@router.post("/users/{user_id}/reset-password")
async def user_reset_password(user_id: int, password: str = Body(..., embed=True),
                              admin: Admin = Depends(get_current_admin),
                              db: AsyncSession = Depends(get_db)):
    if len(password or "") < 6:
        raise HTTPException(status_code=400, detail="رمز حداقل ۶ کاراکتر.")
    s = await _get_student(db, user_id)
    s.password_hash = hash_password(password)
    await _log(db, admin, "bn_user_reset_password", s.id, {})
    await db.commit()
    return {"ok": True, "id": s.id}


# ═══════════════════════════ ویرایشِ پروفایل ═══════════════════════════
@router.patch("/users/{user_id}")
async def user_patch(user_id: int, payload: dict = Body(...),
                     admin: Admin = Depends(get_current_admin),
                     db: AsyncSession = Depends(get_db)):
    s = await _get_student(db, user_id)
    if "fullName" in payload:
        s.full_name = (payload.get("fullName") or "").strip() or None
    if "email" in payload:
        s.email = (payload.get("email") or "").strip() or None
    if "phoneNumber" in payload:
        s.phone_number = (payload.get("phoneNumber") or "").strip() or None
    if "notes" in payload:
        s.notes = (payload.get("notes") or "").strip() or None
    await _log(db, admin, "bn_user_patch", s.id, {"fields": list(payload.keys())})
    await db.commit()
    return _student_dict(s)


# ═══════════════════════════ نمای کلیِ چارت‌ها ═══════════════════════════
@router.get("/charts-overview")
async def charts_overview(admin: Admin = Depends(get_current_admin),
                          db: AsyncSession = Depends(get_db)):
    """آمارِ واچ‌لیست‌ها/چیدمان‌ها/اسکریپت‌ها/آلارم‌ها + پرتکرارترین نمادها."""
    async def _cnt(stmt) -> int:
        return int((await db.execute(stmt)).scalar() or 0)

    wl_count = await _cnt(select(func.count()).select_from(BnWatchlist))

    # پرتکرارترین نمادها — symbols یک آرایهٔ JSONB است؛ در پایتون تجمیع می‌شود
    freq: dict[str, int] = {}
    sym_rows = (await db.execute(select(BnWatchlist.symbols))).scalars().all()
    for syms in sym_rows:
        if not syms:
            continue
        for sym in syms:
            key = str(sym).upper().strip()
            if key:
                freq[key] = freq.get(key, 0) + 1
    top = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)[:10]
    top_symbols = [{"symbol": k, "count": v} for k, v in top]

    layouts = await _cnt(select(func.count()).select_from(BnLayout))
    scripts = await _cnt(select(func.count()).select_from(BnScript))
    alerts = await _cnt(select(func.count()).select_from(BnAlert))
    alerts_active = await _cnt(select(func.count()).select_from(BnAlert)
                               .where(BnAlert.active.is_(True)))

    return {
        "watchlists": {"count": wl_count, "topSymbols": top_symbols},
        "layouts": {"count": layouts},
        "scripts": {"count": scripts},
        "alerts": {"count": alerts, "active": alerts_active},
    }


# ═══════════════════════════ تبلیغاتِ منو (Redis) ═══════════════════════════
async def _read_ads() -> dict:
    from src.core.redis_client import redis_client
    try:
        raw = await redis_client.client.get("bn:ads")
        return _json.loads(raw) if raw else {}
    except Exception:  # noqa: BLE001
        return {}


@router.get("/ads")
async def ads_get(admin: Admin = Depends(get_current_admin)):
    """جایگاه‌های تبلیغاتیِ منو (لوگو/متن/لینک/فعال) از Redis کلیدِ bn:ads."""
    return {"slots": await _read_ads()}


@router.post("/ads")
async def ads_set(slot: str = Body(..., embed=True), logo: str = Body("", embed=True),
                  text: str = Body("", embed=True), link: str = Body("", embed=True),
                  active: bool = Body(True, embed=True),
                  admin: Admin = Depends(get_current_admin)):
    """تنظیمِ یک جایگاهِ تبلیغاتی. active=false → حذفِ جایگاه."""
    from src.core.redis_client import redis_client
    slot = (slot or "").strip()
    if not slot:
        raise HTTPException(status_code=400, detail="نامِ جایگاه لازم است.")
    d = await _read_ads()
    if not active and slot in d:
        del d[slot]
    else:
        d[slot] = {"logo": logo, "text": text, "link": link, "active": bool(active)}
    try:
        await redis_client.client.set("bn:ads", _json.dumps(d))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail="ذخیره در Redis ناموفق بود.") from exc
    logger.info("bn_ads_set", slot=slot, admin=admin.id)
    return {"ok": True, "slots": d}


# ═══════════════════════════ اخبار / تقویم (Redis) ═══════════════════════════
@router.get("/news")
async def news(admin: Admin = Depends(get_current_admin)):
    """اخبارِ بازار (فارسی) از Redis کلیدِ bn:news."""
    from src.core.redis_client import redis_client
    try:
        items = await redis_client.get_json("bn:news")
        return {"items": items or []}
    except Exception:  # noqa: BLE001
        return {"items": []}


@router.get("/calendar")
async def calendar(admin: Admin = Depends(get_current_admin)):
    """تقویمِ اقتصادی از Redis کلیدِ bn:calendar."""
    from src.core.redis_client import redis_client
    try:
        items = await redis_client.get_json("bn:calendar")
        return {"items": items or []}
    except Exception:  # noqa: BLE001
        return {"items": []}


# ═══════════════════════════ گزارشِ فعالیت (audit) ═══════════════════════════
@router.get("/audit")
async def audit(limit: int = 100, admin: Admin = Depends(get_current_admin),
                db: AsyncSession = Depends(get_db)):
    """آخرین رکوردهای activity_logs (جدیدترین اول)."""
    limit = max(1, min(int(limit or 100), 500))
    rows = (await db.execute(
        select(ActivityLog).order_by(ActivityLog.id.desc()).limit(limit)
    )).scalars().all()
    return [
        {
            "id": r.id,
            "action": r.action,
            "entityType": r.entity_type,
            "entityId": r.entity_id,
            "adminId": r.admin_id,
            "createdAt": _iso(r.created_at),
            "details": r.details or {},
        }
        for r in rows
    ]
