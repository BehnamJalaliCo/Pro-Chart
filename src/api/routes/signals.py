"""
مسیرهای مدیریت سیگنال‌های فارکس.

شامل لیست سیگنال‌ها با فیلتر، مشاهده جزئیات، ایجاد سیگنال دستی،
بستن سیگنال و ویرایش حد سود/ضرر.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.api.deps import get_current_admin, get_db
from src.core.database import Admin, Signal
from src.core.instruments import pip_size_of
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)
router = APIRouter()


class SignalCreateRequest(BaseModel):
    """مدل درخواست ایجاد سیگنال دستی."""

    symbol: str = Field(..., min_length=3, max_length=10, description="نماد ارزی مانند EURUSD")
    direction: str = Field(..., pattern="^(BUY|SELL)$", description="جهت معامله")
    entry_price: float = Field(..., gt=0, description="قیمت ورود")
    take_profit: float = Field(..., gt=0, description="حد سود")
    stop_loss: float = Field(..., gt=0, description="حد ضرر")
    take_profit_2: Optional[float] = Field(None, gt=0, description="حد سود دوم")
    take_profit_3: Optional[float] = Field(None, gt=0, description="حد سود سوم")
    timeframe: Optional[str] = Field(None, description="تایم‌فریم تحلیل")
    notes: Optional[str] = Field(None, max_length=1000, description="توضیحات")


class SignalUpdateRequest(BaseModel):
    """مدل درخواست ویرایش سیگنال."""

    take_profit: Optional[float] = Field(None, gt=0, description="حد سود جدید")
    stop_loss: Optional[float] = Field(None, gt=0, description="حد ضرر جدید")
    take_profit_2: Optional[float] = Field(None, gt=0, description="حد سود دوم جدید")
    take_profit_3: Optional[float] = Field(None, gt=0, description="حد سود سوم جدید")
    notes: Optional[str] = Field(None, max_length=1000, description="توضیحات جدید")


class SignalCloseRequest(BaseModel):
    """مدل درخواست بستن سیگنال."""

    close_price: float = Field(..., gt=0, description="قیمت بسته‌شدن")
    close_reason: Optional[str] = Field(None, description="دلیل بستن")


def _signal_to_dict(signal: Signal) -> dict:
    """
    تبدیل آبجکت سیگنال به دیکشنری.

    فیلدهای اصلی سیگنال را به فرمت مناسب برای پاسخ API تبدیل می‌کند.
    فیلدهای تاریخی به فرمت ISO تبدیل می‌شوند.
    """
    return {
        "id": signal.id,
        "symbol": signal.symbol,
        "direction": signal.direction,
        "entry_price": float(signal.entry_price) if signal.entry_price else None,
        "take_profit": float(signal.tp1) if signal.tp1 else None,
        "stop_loss": float(signal.sl) if signal.sl else None,
        "take_profit_2": float(signal.tp2) if signal.tp2 else None,
        "take_profit_3": float(signal.tp3) if signal.tp3 else None,
        "status": signal.status,
        "pips": float(signal.pnl_pips) if signal.pnl_pips else None,
        "timeframe": signal.timeframe,
        "close_reason": signal.close_reason,
        "created_at": signal.created_at.isoformat() if signal.created_at else None,
        "closed_at": signal.closed_at.isoformat() if signal.closed_at else None,
    }


@router.get("")
async def list_signals(
    symbol: Optional[str] = Query(None, description="فیلتر بر اساس نماد"),
    direction: Optional[str] = Query(None, pattern="^(BUY|SELL)$", description="فیلتر بر اساس جهت"),
    signal_status: Optional[str] = Query(None, alias="status", description="فیلتر بر اساس وضعیت"),
    date_from: Optional[datetime] = Query(None, description="تاریخ شروع"),
    date_to: Optional[datetime] = Query(None, description="تاریخ پایان"),
    page: int = Query(1, ge=1, description="شماره صفحه"),
    per_page: int = Query(20, ge=1, le=100, description="تعداد در هر صفحه"),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    دریافت لیست سیگنال‌ها با قابلیت فیلتر.

    سیگنال‌ها بر اساس نماد، جهت معامله، وضعیت و بازه تاریخی قابل فیلتر
    هستند. نتایج به صورت صفحه‌بندی‌شده و مرتب بر اساس تاریخ (جدیدترین ابتدا)
    برگردانده می‌شوند.
    """
    conditions = []

    if symbol:
        conditions.append(Signal.symbol == symbol.upper())
    if direction:
        conditions.append(Signal.direction == direction.upper())
    if signal_status:
        conditions.append(Signal.status == signal_status)
    if date_from:
        conditions.append(Signal.created_at >= date_from)
    if date_to:
        conditions.append(Signal.created_at <= date_to)

    query = select(Signal)
    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(desc(Signal.created_at))

    # DB-side COUNT — یک عدد به‌جای fetch تمام IDها
    count_query = select(func.count(Signal.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    signals = result.scalars().all()

    return {
        "items": [_signal_to_dict(s) for s in signals],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/active")
async def get_active_signals(
    limit: int = Query(100, ge=1, le=500, description="حداکثر تعداد"),
    offset: int = Query(0, ge=0, description="آغاز از"),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    دریافت لیست سیگنال‌های فعال — paginated.

    قبلاً: بدون limit، می‌توانست تا ۱۰۰۰+ signal × ~۵۰KB = ۵۰MB JSON
    حالا: حداکثر ۵۰۰ در یک response + count مستقل
    """
    # count مستقل با COUNT()
    total = (
        await db.execute(
            select(func.count(Signal.id)).where(Signal.status == "active")
        )
    ).scalar() or 0

    # data با pagination
    result = await db.execute(
        select(Signal)
        .where(Signal.status == "active")
        .order_by(desc(Signal.created_at))
        .limit(limit)
        .offset(offset)
    )
    signals = result.scalars().all()

    return {
        "items": [_signal_to_dict(s) for s in signals],
        "count": len(signals),
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{signal_id}")
async def get_signal(
    signal_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    دریافت جزئیات یک سیگنال.

    اطلاعات کامل سیگنال شامل قیمت‌های ورود، حد سود، حد ضرر، وضعیت
    و تاریخ‌ها را برمی‌گرداند.
    """
    result = await db.execute(select(Signal).where(Signal.id == signal_id))
    signal = result.scalar_one_or_none()

    if signal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="سیگنال یافت نشد.",
        )

    return _signal_to_dict(signal)


@router.post("/{signal_id}/close")
async def close_signal(
    signal_id: int,
    body: SignalCloseRequest,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    بستن دستی یک سیگنال فعال.

    سیگنال را با قیمت بسته‌شدن مشخص‌شده می‌بندد. سود یا ضرر بر حسب
    پیپ محاسبه شده و وضعیت سیگنال به‌روزرسانی می‌شود.
    فقط ادمین‌ها مجاز به انجام این عملیات هستند.
    """
    result = await db.execute(select(Signal).where(Signal.id == signal_id))
    signal = result.scalar_one_or_none()

    if signal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="سیگنال یافت نشد.",
        )

    if signal.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="سیگنال در حال حاضر فعال نیست.",
        )

    signal.closed_at = datetime.now(timezone.utc)
    signal.close_reason = body.close_reason or "manual"

    symbol_upper = signal.symbol.upper()
    entry = Decimal(str(signal.entry_price))
    close = Decimal(str(body.close_price))

    if signal.direction == "BUY":
        price_diff = close - entry
    else:
        price_diff = entry - close

    # اندازه‌ی پیپ بر اساس نماد (فارکس/فلز/شاخص/کریپتو) — منبع واحد
    pip_size = Decimal(str(pip_size_of(symbol_upper)))
    if pip_size > 0:
        pips = float(price_diff / pip_size)
    else:
        pips = 0.0

    signal.pnl_pips = round(pips, 1)
    signal.status = "tp_hit" if pips > 0 else "sl_hit"

    await db.flush()

    # حذف سیگنال فعال از Redis تا tracker دوباره آن را poll/بسته نکند
    await redis_client.remove_active_signal(signal.id)

    logger.info(
        "سیگنال %d توسط ادمین '%s' بسته شد. پیپ: %.1f",
        signal.id,
        admin.username,
        pips,
    )

    return _signal_to_dict(signal)


@router.post("/manual")
async def create_manual_signal(
    body: SignalCreateRequest,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    ایجاد سیگنال دستی.

    ادمین می‌تواند یک سیگنال جدید به صورت دستی ایجاد کند. نماد، جهت،
    قیمت ورود، حد سود و حد ضرر الزامی هستند. سیگنال با وضعیت active
    ایجاد می‌شود.
    """
    signal = Signal(
        symbol=body.symbol.upper(),
        direction=body.direction.upper(),
        signal_type="manual",
        entry_price=body.entry_price,
        tp1=body.take_profit,
        sl=body.stop_loss,
        status="active",
    )

    if body.take_profit_2:
        signal.tp2 = body.take_profit_2
    if body.take_profit_3:
        signal.tp3 = body.take_profit_3
    if body.timeframe:
        signal.timeframe = body.timeframe
    if body.notes:
        signal.analysis_details = {"notes": body.notes}

    db.add(signal)
    await db.flush()
    await db.refresh(signal)

    logger.info(
        "سیگنال دستی %s %s توسط ادمین '%s' ایجاد شد. ID: %d",
        body.direction,
        body.symbol,
        admin.username,
        signal.id,
    )

    return _signal_to_dict(signal)


@router.patch("/{signal_id}")
async def update_signal(
    signal_id: int,
    body: SignalUpdateRequest,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    ویرایش حد سود و حد ضرر سیگنال.

    ادمین می‌تواند حد سود، حد ضرر و توضیحات سیگنال فعال را تغییر دهد.
    فقط فیلدهای ارسال‌شده به‌روزرسانی می‌شوند.
    """
    result = await db.execute(select(Signal).where(Signal.id == signal_id))
    signal = result.scalar_one_or_none()

    if signal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="سیگنال یافت نشد.",
        )

    if signal.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="فقط سیگنال‌های فعال قابل ویرایش هستند.",
        )

    update_fields = body.model_dump(exclude_unset=True)

    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="هیچ فیلدی برای به‌روزرسانی ارسال نشده است.",
        )

    field_map = {
        "take_profit": "tp1",
        "stop_loss": "sl",
        "take_profit_2": "tp2",
        "take_profit_3": "tp3",
    }

    for field_name, value in update_fields.items():
        db_field = field_map.get(field_name, field_name)
        if hasattr(signal, db_field):
            setattr(signal, db_field, value)

    await db.flush()

    logger.info(
        "سیگنال %d توسط ادمین '%s' ویرایش شد. فیلدها: %s",
        signal.id,
        admin.username,
        list(update_fields.keys()),
    )

    return _signal_to_dict(signal)
