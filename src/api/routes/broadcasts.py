"""
مسیرهای مدیریت پیام‌های انبوه (Broadcast).

شامل لیست پیام‌ها، ایجاد پیام جدید، ارسال فوری و بررسی وضعیت تحویل.
فقط ادمین‌ها دسترسی دارند.
"""

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.api.deps import get_current_admin, get_db, get_redis
from src.core.database import Admin, Broadcast
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class BroadcastCreateRequest(BaseModel):
    """مدل درخواست ایجاد پیام انبوه."""

    title: str = Field(..., min_length=1, max_length=200, description="عنوان پیام")
    message: str = Field(..., min_length=1, max_length=4096, description="متن پیام")
    target_plan: Optional[str] = Field(None, description="فیلتر بر اساس پلن (free/premium/all)")
    message_type: str = Field("text", description="نوع پیام (text/photo/document)")
    media_url: Optional[str] = Field(None, description="آدرس فایل رسانه‌ای")
    scheduled_at: Optional[datetime] = Field(None, description="زمان ارسال زمان‌بندی‌شده")


def _broadcast_to_dict(broadcast: Broadcast) -> dict:
    """
    تبدیل آبجکت پیام انبوه به دیکشنری.

    فیلدهای پیام انبوه را به فرمت مناسب برای پاسخ API تبدیل می‌کند.
    """
    return {
        "id": broadcast.id,
        "title": getattr(broadcast, "title", None),
        "message": broadcast.message,
        "target_plan": getattr(broadcast, "target_plan", "all"),
        "message_type": getattr(broadcast, "message_type", "text"),
        "media_url": getattr(broadcast, "media_url", None),
        "status": getattr(broadcast, "status", "draft"),
        "total_recipients": getattr(broadcast, "total_recipients", 0) or 0,
        "delivered": getattr(broadcast, "delivered_count", 0) or 0,
        "failed": getattr(broadcast, "failed_count", 0) or 0,
        "image_url": getattr(broadcast, "image_url", None),
        "scheduled_at": (
            broadcast.scheduled_at.isoformat()
            if getattr(broadcast, "scheduled_at", None)
            else None
        ),
        "sent_at": (
            broadcast.sent_at.isoformat()
            if getattr(broadcast, "sent_at", None)
            else None
        ),
        "created_at": (
            broadcast.created_at.isoformat()
            if getattr(broadcast, "created_at", None)
            else None
        ),
        "created_by": getattr(broadcast, "created_by", None),
    }


@router.get("/stats")
async def broadcast_stats(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """آمارِ واقعیِ پیام‌های انبوه (برای داشبوردِ بخشِ پیام‌ها)."""
    from sqlalchemy import func as _f
    from src.core.database import User

    row = (await db.execute(select(
        _f.count(Broadcast.id),
        _f.coalesce(_f.sum(Broadcast.total_recipients), 0),
        _f.coalesce(_f.sum(Broadcast.delivered_count), 0),
        _f.coalesce(_f.sum(Broadcast.failed_count), 0),
    ))).one()
    total_bc, total_reach, total_delivered, total_failed = (int(x) for x in row)

    sent_count = (await db.execute(
        select(_f.count(Broadcast.id)).where(Broadcast.status == "sent"))).scalar() or 0
    sending = (await db.execute(
        select(_f.count(Broadcast.id)).where(Broadcast.status == "sending"))).scalar() or 0
    scheduled = (await db.execute(
        select(_f.count(Broadcast.id)).where(Broadcast.status == "scheduled"))).scalar() or 0
    drafts = (await db.execute(
        select(_f.count(Broadcast.id)).where(Broadcast.status == "draft"))).scalar() or 0
    last_sent = (await db.execute(
        select(Broadcast.sent_at).where(Broadcast.sent_at.isnot(None))
        .order_by(desc(Broadcast.sent_at)).limit(1))).scalar()

    # مخاطبینِ واجدِ شرایط (کاربرانِ فعالِ غیرمسدود) = هدفِ واقعیِ ارسالِ بعدی
    audience = (await db.execute(select(_f.count(User.id)).where(
        User.is_active.is_(True), User.is_banned.is_(False)))).scalar() or 0

    delivered_pct = round(100 * total_delivered / total_reach, 1) if total_reach else 0.0
    failed_pct = round(100 * total_failed / total_reach, 1) if total_reach else 0.0
    return {
        "total_broadcasts": total_bc, "sent": sent_count, "sending": sending,
        "scheduled": scheduled, "drafts": drafts,
        "total_reach": total_reach, "total_delivered": total_delivered,
        "total_failed": total_failed, "delivered_pct": delivered_pct,
        "failed_pct": failed_pct, "audience": audience,
        "last_sent_at": last_sent.isoformat() if last_sent else None,
    }


@router.get("")
async def list_broadcasts(
    broadcast_status: Optional[str] = Query(None, alias="status", description="فیلتر وضعیت"),
    page: int = Query(1, ge=1, description="شماره صفحه"),
    per_page: int = Query(20, ge=1, le=100, description="تعداد در هر صفحه"),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    دریافت لیست پیام‌های انبوه.

    پیام‌ها بر اساس وضعیت قابل فیلتر هستند. نتایج به صورت صفحه‌بندی‌شده
    و مرتب بر اساس تاریخ (جدیدترین ابتدا) برگردانده می‌شوند.
    """
    query = select(Broadcast)

    conditions = []
    if broadcast_status:
        if hasattr(Broadcast, "status"):
            conditions.append(Broadcast.status == broadcast_status)

    if conditions:
        from sqlalchemy import and_
        query = query.where(and_(*conditions))

    count_query = select(Broadcast.id)
    if conditions:
        from sqlalchemy import and_
        count_query = count_query.where(and_(*conditions))
    count_result = await db.execute(count_query)
    total = len(count_result.all())

    offset = (page - 1) * per_page
    query = query.order_by(desc(Broadcast.created_at)).offset(offset).limit(per_page)

    result = await db.execute(query)
    broadcasts = result.scalars().all()

    return {
        "items": [_broadcast_to_dict(b) for b in broadcasts],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_broadcast(
    body: BroadcastCreateRequest,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    ایجاد پیام انبوه جدید.

    پیام با وضعیت draft ایجاد می‌شود و باید به صورت جداگانه ارسال شود.
    در صورت تعیین زمان، ارسال زمان‌بندی‌شده خواهد بود.
    """
    broadcast = Broadcast(
        message=body.message,
    )

    if hasattr(Broadcast, "title"):
        broadcast.title = body.title
    if hasattr(Broadcast, "target_plan"):
        broadcast.target_plan = body.target_plan or "all"
    if hasattr(Broadcast, "message_type"):
        broadcast.message_type = body.message_type
    if hasattr(Broadcast, "media_url") and body.media_url:
        broadcast.media_url = body.media_url
    if hasattr(Broadcast, "status"):
        broadcast.status = "scheduled" if body.scheduled_at else "draft"
    if hasattr(Broadcast, "scheduled_at") and body.scheduled_at:
        broadcast.scheduled_at = body.scheduled_at
    if hasattr(Broadcast, "created_by"):
        broadcast.created_by = admin.id
    if hasattr(Broadcast, "created_at"):
        broadcast.created_at = datetime.now(timezone.utc)

    db.add(broadcast)
    await db.flush()
    await db.refresh(broadcast)

    logger.info(
        "پیام انبوه '%s' توسط ادمین '%s' ایجاد شد. ID: %d",
        body.title,
        admin.username,
        broadcast.id,
    )

    return _broadcast_to_dict(broadcast)


@router.post("/{broadcast_id}/send")
async def send_broadcast(
    broadcast_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """
    ارسال فوری پیام انبوه.

    پیام را در صف ارسال ردیس قرار می‌دهد. ورکر تلگرام پیام را
    به تمام کاربران هدف ارسال خواهد کرد.
    """
    result = await db.execute(select(Broadcast).where(Broadcast.id == broadcast_id))
    broadcast = result.scalar_one_or_none()

    if broadcast is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="پیام انبوه یافت نشد.",
        )

    current_status = getattr(broadcast, "status", "draft")
    if current_status in ("sending", "sent"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"پیام در وضعیت '{current_status}' است و قابل ارسال مجدد نیست.",
        )

    if hasattr(broadcast, "status"):
        broadcast.status = "sending"
    if hasattr(broadcast, "sent_at"):
        broadcast.sent_at = datetime.now(timezone.utc)

    await db.flush()

    payload = json.dumps({
        "broadcast_id": broadcast.id,
        "message": broadcast.message,
        "message_type": getattr(broadcast, "message_type", "text"),
        "media_url": getattr(broadcast, "media_url", None),
        "target_plan": getattr(broadcast, "target_plan", "all"),
        "sent_by": admin.id,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })

    await redis.rpush("telegram:broadcasts", payload)

    logger.info(
        "پیام انبوه %d توسط ادمین '%s' برای ارسال در صف قرار گرفت.",
        broadcast.id,
        admin.username,
    )

    return {
        "message": "پیام انبوه برای ارسال در صف قرار گرفت.",
        "broadcast": _broadcast_to_dict(broadcast),
    }


@router.get("/{broadcast_id}/status")
async def broadcast_delivery_status(
    broadcast_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """
    بررسی وضعیت تحویل پیام انبوه.

    تعداد کل گیرندگان، تعداد تحویل‌شده و ناموفق را برمی‌گرداند.
    اطلاعات از دیتابیس و ردیس ترکیب می‌شوند.
    """
    result = await db.execute(select(Broadcast).where(Broadcast.id == broadcast_id))
    broadcast = result.scalar_one_or_none()

    if broadcast is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="پیام انبوه یافت نشد.",
        )

    delivered = getattr(broadcast, "delivered", 0)
    failed = getattr(broadcast, "failed", 0)
    total = getattr(broadcast, "total_recipients", 0)

    live_delivered = await redis.get(f"broadcast:{broadcast_id}:delivered")
    live_failed = await redis.get(f"broadcast:{broadcast_id}:failed")
    live_total = await redis.get(f"broadcast:{broadcast_id}:total")

    if live_delivered is not None:
        delivered = int(live_delivered)
    if live_failed is not None:
        failed = int(live_failed)
    if live_total is not None:
        total = int(live_total)

    current_status = getattr(broadcast, "status", "unknown")
    if current_status == "sending" and total > 0 and (delivered + failed) >= total:
        current_status = "sent"
        if hasattr(broadcast, "status"):
            broadcast.status = "sent"
        if hasattr(broadcast, "delivered"):
            broadcast.delivered = delivered
        if hasattr(broadcast, "failed"):
            broadcast.failed = failed
        if hasattr(broadcast, "total_recipients"):
            broadcast.total_recipients = total
        await db.flush()

    progress = round(((delivered + failed) / total * 100) if total > 0 else 0, 1)

    return {
        "broadcast_id": broadcast.id,
        "status": current_status,
        "total_recipients": total,
        "delivered": delivered,
        "failed": failed,
        "progress_pct": progress,
        "sent_at": (
            broadcast.sent_at.isoformat()
            if getattr(broadcast, "sent_at", None)
            else None
        ),
    }
