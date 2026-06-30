"""مسیرهای داشبورد ربات — آمار کلی و تمدید trial کاربر."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_admin, get_db, get_redis, require_role
from src.core.database import (
    Admin,
    ChannelMember,
    PaymentRequest,
    Subscription,
    User,
)
from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class ExtendTrialRequest(BaseModel):
    days: int = Field(2, ge=1, le=365, description="تعداد روز افزوده‌شده به دسترسی")


@router.get("/bot-stats")
async def bot_stats(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """آمار کلی ربات: کاربران، trial، اشتراک فعال، پرداخت‌های در انتظار و درآمد."""
    now = datetime.now(timezone.utc)

    total_users = int((await db.execute(select(func.count(User.id)))).scalar() or 0)
    users_by_status = dict(
        (await db.execute(
            select(User.status, func.count(User.id)).group_by(User.status)
        )).all()
    )
    active_subs = int((await db.execute(
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
    pending_payments = int((await db.execute(
        select(func.count(PaymentRequest.id)).where(PaymentRequest.status == "pending")
    )).scalar() or 0)
    revenue = float((await db.execute(
        select(func.coalesce(func.sum(Subscription.amount_usdt), 0)).where(
            Subscription.plan != "trial"
        )
    )).scalar() or 0)

    return {
        "total_users": total_users,
        "users_by_status": {k: int(v) for k, v in users_by_status.items()},
        "active_subscriptions": active_subs,
        "trial_active": trial_active,
        "paid_active": active_subs - trial_active,
        "pending_payments": pending_payments,
        "total_revenue_usdt": revenue,
    }


@router.post("/bot-users/{user_id}/extend-trial")
async def extend_trial(
    user_id: int,
    body: ExtendTrialRequest,
    admin: Admin = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """تمدید/اعطای دسترسی trial به یک کاربر."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="کاربر یافت نشد.")

    now = datetime.now(timezone.utc)
    sub = (
        await db.execute(
            select(Subscription)
            .where(Subscription.user_id == user_id, Subscription.status == "active")
            .order_by(Subscription.expires_at.desc())
        )
    ).scalars().first()

    grant_event = False
    if sub is not None:
        base = sub.expires_at if sub.expires_at and sub.expires_at > now else now
        sub.expires_at = base + timedelta(days=body.days)
        sub.expiry_processed = False
        sub.reminder_3d_sent = False
        sub.reminder_1d_sent = False
    else:
        sub = Subscription(
            user_id=user.id,
            telegram_id=user.telegram_id,
            plan="trial",
            status="active",
            amount_usdt=0,
            expires_at=now + timedelta(days=body.days),
        )
        db.add(sub)
        # عضویت کانال + رویداد اعطای دسترسی
        db.add(ChannelMember(
            user_id=user.id,
            telegram_id=user.telegram_id,
            channel_id=settings.TELEGRAM_CHANNEL_ID,
            status="invited",
            is_active=True,
        ))
        user.status = "trial"
        grant_event = True

    # commit پیش از enqueue تا consumer ردیف ساخته‌شده را ببیند
    await db.commit()

    if grant_event:
        await redis.rpush("telegram:events", json.dumps({
            "action": "subscription_approved",
            "telegram_id": user.telegram_id,
            "plan_label": "آزمایشی",
        }))

    logger.info("trial_extended", user_id=user_id, days=body.days, admin=admin.username)
    return {"message": f"دسترسی کاربر {body.days} روز تمدید شد.", "expires_at": sub.expires_at.isoformat()}
