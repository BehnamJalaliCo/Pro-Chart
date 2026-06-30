"""مسیرهای مدیریت اشتراک‌ها — لیست، آمار، تمدید دستی و لغو."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_admin, get_db, get_redis, require_role
from src.bot.services import subscription as sub_svc
from src.core.database import Admin, Subscription, User
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class ExtendRequest(BaseModel):
    days: int = Field(..., ge=1, le=3650, description="تعداد روز برای تمدید")


def _sub_to_dict(s: Subscription) -> dict:
    return {
        "id": s.id,
        "user_id": s.user_id,
        "telegram_id": s.telegram_id,
        "plan": s.plan,
        "plan_label": sub_svc.plan_label(s.plan),
        "status": s.status,
        "amount_usdt": float(s.amount_usdt) if s.amount_usdt is not None else None,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        "payment_request_id": s.payment_request_id,
    }


@router.get("/stats")
async def subscription_stats(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """آمار اشتراک‌ها — شمارش بر اساس وضعیت/پلن، فعال‌ها و تخمین درآمد."""
    now = datetime.now(timezone.utc)

    by_status = dict(
        (await db.execute(
            select(Subscription.status, func.count(Subscription.id)).group_by(Subscription.status)
        )).all()
    )
    by_plan = dict(
        (await db.execute(
            select(Subscription.plan, func.count(Subscription.id)).group_by(Subscription.plan)
        )).all()
    )
    active_now = int((await db.execute(
        select(func.count(Subscription.id)).where(
            Subscription.status == "active", Subscription.expires_at > now
        )
    )).scalar() or 0)
    trial_active = int((await db.execute(
        select(func.count(Subscription.id)).where(
            Subscription.status == "active",
            Subscription.plan == "trial",
            Subscription.expires_at > now,
        )
    )).scalar() or 0)
    revenue = float((await db.execute(
        select(func.coalesce(func.sum(Subscription.amount_usdt), 0)).where(
            Subscription.plan != "trial"
        )
    )).scalar() or 0)

    return {
        "by_status": {k: int(v) for k, v in by_status.items()},
        "by_plan": {k: int(v) for k, v in by_plan.items()},
        "active_now": active_now,
        "trial_active": trial_active,
        "paid_active": active_now - trial_active,
        "total_revenue_usdt": revenue,
    }


@router.get("")
async def list_subscriptions(
    status_filter: Optional[str] = Query(None, alias="status"),
    plan: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="جستجو بر اساس نام/یوزرنیم"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if status_filter:
        conditions.append(Subscription.status == status_filter)
    if plan:
        conditions.append(Subscription.plan == plan)

    q = select(Subscription)
    count_q = select(func.count(Subscription.id))
    if search:
        term = f"%{search}%"
        q = q.join(User, User.id == Subscription.user_id)
        count_q = count_q.join(User, User.id == Subscription.user_id)
        conditions.append(or_(User.username.ilike(term), User.first_name.ilike(term)))

    if conditions:
        q = q.where(and_(*conditions))
        count_q = count_q.where(and_(*conditions))

    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * per_page
    q = q.order_by(desc(Subscription.created_at)).offset(offset).limit(per_page)
    rows = (await db.execute(q)).scalars().all()

    return {
        "items": [_sub_to_dict(s) for s in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/{sub_id}")
async def get_subscription(
    sub_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    s = (await db.execute(select(Subscription).where(Subscription.id == sub_id))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="اشتراک یافت نشد.")
    return _sub_to_dict(s)


@router.post("/{sub_id}/extend")
async def extend_subscription(
    sub_id: int,
    body: ExtendRequest,
    admin: Admin = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    s = (await db.execute(select(Subscription).where(Subscription.id == sub_id))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="اشتراک یافت نشد.")
    now = datetime.now(timezone.utc)
    base = s.expires_at if (s.expires_at and s.expires_at > now) else now
    s.expires_at = base + timedelta(days=body.days)
    s.status = "active"
    s.expiry_processed = False
    s.reminder_3d_sent = False
    s.reminder_1d_sent = False
    await db.flush()
    logger.info("subscription_extended", sub_id=sub_id, days=body.days, admin=admin.username)
    return {"message": f"اشتراک {body.days} روز تمدید شد.", "subscription": _sub_to_dict(s)}


@router.delete("/{sub_id}")
async def cancel_subscription(
    sub_id: int,
    admin: Admin = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    s = (await db.execute(select(Subscription).where(Subscription.id == sub_id))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="اشتراک یافت نشد.")
    s.status = "cancelled"
    s.expiry_processed = True
    telegram_id = s.telegram_id
    # commit پیش از enqueue تا حذف کانال با وضعیت ماندگار هماهنگ باشد
    await db.commit()
    await redis.rpush("telegram:events", json.dumps({
        "action": "subscription_cancelled",
        "telegram_id": telegram_id,
    }))
    logger.info("subscription_cancelled", sub_id=sub_id, admin=admin.username)
    return {"message": "اشتراک لغو شد و دسترسی کانال حذف خواهد شد.", "subscription_id": sub_id}
