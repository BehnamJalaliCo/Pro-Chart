"""
مسیرهای API مدیریت ریسک — وضعیت daily limit، سیگنال‌های رد شده، رژیم بازار.

این API ها صفحه‌ی RiskPage در admin panel را پشتیبانی می‌کنند.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from src.api.deps import get_current_admin, get_redis
from src.core.config import settings
from src.core.database import Admin
from src.core.logger import get_logger
from src.risk.correlation import decompose_currency_legs
from src.risk.daily_loss_limit import DailyLossLimit

logger = get_logger(__name__)
router = APIRouter()


# ── مدل‌های Pydantic ──────────────────────────────────────


class DailyStatusResponse(BaseModel):
    """تصویر فعلی وضعیت ریسک روزانه."""

    date_key: str
    realized_pnl: float = 0.0
    signal_count: int = 0
    consecutive_losses: int = 0
    is_locked: bool = False
    locked_reason: Optional[str] = None
    reset_at: Optional[datetime] = None


class RejectionEntry(BaseModel):
    """یک سیگنال رد شده."""

    timestamp: datetime
    symbol: str
    direction: str
    reasons: List[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class OpenPositionEntry(BaseModel):
    """یک معامله‌ی باز."""

    symbol: str
    direction: str
    entry_time: Optional[datetime] = None
    entry_price: Optional[float] = None
    currency_legs: dict = Field(default_factory=dict)
    risk_weight: float = 1.0


class RegimeEntry(BaseModel):
    """رژیم بازار یک نماد."""

    symbol: str
    regime: str
    adx: float = 0.0
    atr: float = 0.0
    atr_percentile: float = 0.0


class LockRequest(BaseModel):
    """درخواست قفل دستی."""

    reason: str = Field(..., min_length=3, max_length=200)


# ── helpers ────────────────────────────────────────────────


def _get_daily_limit(redis_client) -> DailyLossLimit:
    """ساخت instance با Redis client از dependency."""
    return DailyLossLimit(redis_client=redis_client)


# ── Endpoints ──────────────────────────────────────────────


@router.get("/daily", response_model=DailyStatusResponse)
async def get_daily_status(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """وضعیت فعلی circuit breaker روزانه."""
    daily = _get_daily_limit(redis)
    snap = await daily.snapshot()
    return DailyStatusResponse(
        date_key=snap.date_key,
        realized_pnl=snap.realized_pnl,
        signal_count=snap.signal_count,
        consecutive_losses=snap.consecutive_losses,
        is_locked=snap.is_locked,
        locked_reason=snap.locked_reason,
        reset_at=snap.reset_at,
    )


@router.post("/lock", status_code=status.HTTP_204_NO_CONTENT)
async def manual_lock(
    body: LockRequest,
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """قفل دستی سیستم تا rollover بعدی."""
    daily = _get_daily_limit(redis)
    await daily.manual_lock(body.reason)
    logger.info("risk_manual_lock", admin=admin.username, reason=body.reason)


@router.post("/unlock", status_code=status.HTTP_204_NO_CONTENT)
async def manual_unlock(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """آزادسازی دستی circuit breaker."""
    daily = _get_daily_limit(redis)
    await daily.manual_unlock()
    logger.info("risk_manual_unlock", admin=admin.username)


@router.get("/rejections", response_model=List[RejectionEntry])
async def get_rejections(
    limit: int = Query(50, ge=1, le=500),
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """
    لیست سیگنال‌های اخیراً رد‌شده توسط RiskGuard.

    این داده از Redis stream خوانده می‌شود (در فاز بعد، Engine موقع
    رد یک سیگنال آن را در `risk:rejections` می‌نویسد).
    """
    try:
        raw_list = await redis.lrange("risk:rejections", 0, limit - 1)
    except Exception as exc:
        logger.warning("rejections_read_failed", error=str(exc))
        return []

    out: list[dict] = []
    import orjson
    for raw in raw_list or []:
        try:
            out.append(orjson.loads(raw))
        except Exception:
            continue
    return out


@router.get("/positions", response_model=List[OpenPositionEntry])
async def get_open_positions(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """معاملات باز فعلی به‌همراه تجزیه‌ی currency legs."""
    try:
        active = await redis.keys("signal:active:*")
    except Exception as exc:
        logger.warning("positions_read_failed", error=str(exc))
        return []

    positions: list[dict] = []
    import orjson
    for key in active or []:
        try:
            raw = await redis.get(key)
            if not raw:
                continue
            sig = orjson.loads(raw)
            symbol = sig.get("symbol", "")
            direction = sig.get("direction", "long")
            legs = decompose_currency_legs(symbol, direction)
            positions.append({
                "symbol": symbol,
                "direction": direction,
                "entry_time": sig.get("created_at") or sig.get("entry_time"),
                "entry_price": sig.get("entry_price"),
                "currency_legs": legs,
                "risk_weight": 1.0,
            })
        except Exception:
            continue
    return positions


@router.get("/regimes", response_model=List[RegimeEntry])
async def get_regimes(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """
    رژیم بازار برای هر نماد.

    این داده در `risk:regime:{symbol}` توسط signal engine ذخیره می‌شود
    در هر چرخه‌ی تحلیل.
    """
    out: list[dict] = []
    import orjson
    for symbol in settings.SYMBOLS:
        try:
            raw = await redis.get(f"risk:regime:{symbol}")
            if not raw:
                continue
            data = orjson.loads(raw)
            out.append({
                "symbol": symbol,
                "regime": data.get("regime", "unknown"),
                "adx": float(data.get("adx", 0.0) or 0.0),
                "atr": float(data.get("atr", 0.0) or 0.0),
                "atr_percentile": float(data.get("atr_percentile", 0.0) or 0.0),
            })
        except Exception:
            continue
    return out
