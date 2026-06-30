"""مسیرهای مدیریت پرداخت‌ها — لیست، تأیید و رد درخواست‌های پرداخت.

تأیید/رد منطق مشترک با ربات را از src.bot.services.access فراخوانی می‌کند و سپس
رویداد را در صف Redis می‌گذارد تا ربات (که Bot زنده دارد) لینک دعوت/پیام را بفرستد.
"""

from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_admin, get_db, get_redis, require_role
from src.bot.services.access import approve_payment, reject_payment
from src.bot.services import subscription as sub_svc
from src.core.database import Admin, PaymentRequest
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class RejectRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=500, description="دلیل رد")


def _payment_to_dict(p: PaymentRequest) -> dict:
    return {
        "id": p.id,
        "user_id": p.user_id,
        "telegram_id": p.telegram_id,
        "plan": p.plan,
        "plan_label": sub_svc.plan_label(p.plan),
        "amount_usdt": float(p.amount_usdt) if p.amount_usdt is not None else None,
        "network": p.network,
        "tx_hash": p.tx_hash,
        "status": p.status,
        "admin_id": p.admin_id,
        "admin_note": p.admin_note,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "reviewed_at": p.reviewed_at.isoformat() if p.reviewed_at else None,
    }


@router.get("")
async def list_payments(
    status_filter: Optional[str] = Query("pending", alias="status", description="فیلتر وضعیت"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if status_filter:
        conditions.append(PaymentRequest.status == status_filter)

    count_q = select(func.count(PaymentRequest.id))
    if conditions:
        count_q = count_q.where(and_(*conditions))
    total = (await db.execute(count_q)).scalar() or 0

    q = select(PaymentRequest)
    if conditions:
        q = q.where(and_(*conditions))
    offset = (page - 1) * per_page
    q = q.order_by(desc(PaymentRequest.created_at)).offset(offset).limit(per_page)
    rows = (await db.execute(q)).scalars().all()

    return {
        "items": [_payment_to_dict(p) for p in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/{payment_id}")
async def get_payment(
    payment_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    p = (
        await db.execute(select(PaymentRequest).where(PaymentRequest.id == payment_id))
    ).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="درخواست پرداخت یافت نشد.")
    return _payment_to_dict(p)


@router.post("/{payment_id}/approve")
async def approve(
    payment_id: int,
    admin: Admin = Depends(require_role("admin")),
    redis=Depends(get_redis),
):
    result = await approve_payment(payment_id, admin_id=admin.id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="درخواست یافت نشد یا قبلاً بررسی شده است.",
        )
    await redis.rpush("telegram:events", json.dumps({
        "action": "subscription_approved",
        "telegram_id": result["telegram_id"],
        "plan_label": result["plan_label"],
    }))
    logger.info("payment_approved", payment_id=payment_id, admin=admin.username)
    return {"message": "پرداخت تأیید و اشتراک فعال شد.", "subscription": result}


@router.post("/{payment_id}/reject")
async def reject(
    payment_id: int,
    body: RejectRequest,
    admin: Admin = Depends(require_role("admin")),
    redis=Depends(get_redis),
):
    result = await reject_payment(payment_id, admin_id=admin.id, note=body.note)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="درخواست یافت نشد یا قبلاً بررسی شده است.",
        )
    await redis.rpush("telegram:events", json.dumps({
        "action": "subscription_rejected",
        "telegram_id": result["telegram_id"],
        "admin_note": result.get("admin_note"),
    }))
    logger.info("payment_rejected", payment_id=payment_id, admin=admin.username)
    return {"message": "پرداخت رد شد.", "telegram_id": result["telegram_id"]}
