"""
Endpointهای کاربرِ بازارنما برای پنلِ user.pro-chart.com — همه با دادهٔ واقعیِ خودِ کاربر.
احرازِ current_student (scope=academy). مکمّلِ bazaarnama.py (سفارش‌های خودِ کاربر + خلاصهٔ داشبورد).
مقادیر ۱۰۰٪ واقعی از DB/Redis. empty-safe. هیچ کلید/سکرت افشا نمی‌شود.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from src.api.deps import get_db
from src.api.routes.academy import current_student
from src.core.database import (
    AcademyStudent,
    AcademySubscription,
    BnAiSignal,
    BnAlert,
    BnExchangeAccount,
    BnLayout,
    BnOrder,
    BnScript,
    BnWatchlist,
)
from src.core.logger import get_logger
from sqlalchemy import func, select

logger = get_logger(__name__)
router = APIRouter()


def _order_dict(o: BnOrder) -> dict:
    return {
        "id": o.id,
        "market": o.market,
        "broker": o.broker,
        "symbol": o.symbol,
        "side": o.side,
        "amount": float(o.amount) if o.amount is not None else 0.0,
        "price": float(o.price) if o.price is not None else None,
        "sl": float(o.sl) if o.sl is not None else None,
        "tp": float(o.tp) if o.tp is not None else None,
        "status": o.status,
        "brokerOrderId": o.broker_order_id,
        "error": o.error,
        "createdAt": o.created_at.isoformat() if o.created_at else None,
    }


@router.get("/my-orders")
async def my_orders(
    status: str = "",
    limit: int = 50,
    st: AcademyStudent = Depends(current_student),
    db=Depends(get_db),
):
    """سفارش‌های واقعیِ خودِ کاربر (bn_orders)."""
    limit = max(1, min(int(limit or 50), 200))
    q = select(BnOrder).where(BnOrder.student_id == st.id)
    if status:
        q = q.where(BnOrder.status == status)
    q = q.order_by(BnOrder.id.desc()).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return {"items": [_order_dict(o) for o in rows], "count": len(rows)}


@router.get("/overview")
async def overview(st: AcademyStudent = Depends(current_student), db=Depends(get_db)):
    """خلاصهٔ واقعیِ داشبوردِ کاربر: پروفایل، اشتراک، اتصال صرافی، شمارش‌ها، سفارش‌های اخیر."""
    now = datetime.now(timezone.utc)

    async def _count(model) -> int:
        try:
            return int((await db.execute(
                select(func.count()).select_from(model).where(model.student_id == st.id)
            )).scalar() or 0)
        except Exception:  # noqa: BLE001
            return 0

    # اشتراکِ فعال (آخرین)
    sub = None
    try:
        srow = (await db.execute(
            select(AcademySubscription).where(AcademySubscription.student_id == st.id)
            .order_by(AcademySubscription.id.desc()).limit(1)
        )).scalar_one_or_none()
        if srow:
            sub = {
                "tier": srow.tier,
                "status": srow.status,
                "amountUsdt": float(srow.amount_usdt) if getattr(srow, "amount_usdt", None) is not None else None,
                "startedAt": srow.started_at.isoformat() if srow.started_at else None,
                "expiresAt": srow.expires_at.isoformat() if srow.expires_at else None,
            }
    except Exception:  # noqa: BLE001
        sub = None

    # اتصالِ صرافی‌ها (بدونِ افشای کلید)
    conns = []
    try:
        for a in (await db.execute(
            select(BnExchangeAccount).where(BnExchangeAccount.student_id == st.id)
        )).scalars().all():
            conns.append({
                "kind": a.kind,
                "accountRef": a.account_ref,
                "referralVerified": bool(a.referral_verified),
                "status": a.status,
            })
    except Exception:  # noqa: BLE001
        pass

    # سفارش‌های اخیر
    recent = []
    try:
        for o in (await db.execute(
            select(BnOrder).where(BnOrder.student_id == st.id).order_by(BnOrder.id.desc()).limit(5)
        )).scalars().all():
            recent.append(_order_dict(o))
    except Exception:  # noqa: BLE001
        pass

    # سیگنال‌های فعالِ AI
    ai_active = 0
    try:
        ai_active = int((await db.execute(
            select(func.count()).select_from(BnAiSignal)
            .where(BnAiSignal.student_id == st.id, BnAiSignal.status == "active")
        )).scalar() or 0)
    except Exception:  # noqa: BLE001
        pass

    effective_tier = st.tier
    if st.expires_at and st.expires_at <= now:
        effective_tier = "free"

    return {
        "profile": {
            "id": st.id,
            "username": st.username,
            "fullName": st.full_name,
            "email": st.email,
            "tier": effective_tier,
            "accountType": st.account_type,
            "expiresAt": st.expires_at.isoformat() if st.expires_at else None,
            "phoneNumber": st.phone_number,
            "phoneVerified": bool(st.phone_verified),
        },
        "subscription": sub,
        "connections": conns,
        "aiSignalsActive": ai_active,
        "counts": {
            "watchlists": await _count(BnWatchlist),
            "orders": await _count(BnOrder),
            "alerts": await _count(BnAlert),
            "layouts": await _count(BnLayout),
            "scripts": await _count(BnScript),
        },
        "recentOrders": recent,
        "serverTime": now.isoformat(),
    }
