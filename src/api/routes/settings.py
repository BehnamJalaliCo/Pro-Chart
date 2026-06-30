"""
مسیرهای مدیریت تنظیمات سیستم.

شامل مشاهده و ویرایش تنظیمات عمومی سیستم و وضعیت مدل‌های یادگیری ماشین.
فقط ادمین‌ها دسترسی دارند.
"""

import json
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from src.api.deps import get_current_admin, get_db, get_redis
from src.core.database import Admin
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

SETTINGS_REDIS_KEY = "system:settings"

DEFAULT_SETTINGS = {
    "signal_auto_close": True,
    "signal_max_duration_hours": 72,
    "risk_per_trade_pct": 2.0,
    "max_concurrent_signals": 10,
    "allowed_symbols": [
        "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD",
        "USDCAD", "NZDUSD", "XAUUSD", "XAGUSD",
    ],
    "allowed_timeframes": ["M15", "M30", "H1", "H4", "D1"],
    "telegram_notifications_enabled": True,
    "telegram_signal_channel_id": None,
    "ml_prediction_enabled": True,
    "ml_min_confidence": 0.7,
    "price_fetch_interval_seconds": 5,
    "maintenance_mode": False,
    "welcome_message": "به ربات سیگنال فارکس کوین‌پرو خوش آمدید!",
}

ML_MODELS_REDIS_KEY = "ml:models:status"


class SettingsUpdateRequest(BaseModel):
    """مدل درخواست به‌روزرسانی تنظیمات."""

    settings: dict[str, Any] = Field(..., description="دیکشنری تنظیمات جدید")


@router.get("")
async def get_settings(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """
    دریافت تنظیمات فعلی سیستم.

    تنظیمات از ردیس خوانده می‌شوند. در صورت عدم وجود، مقادیر پیش‌فرض
    برگردانده شده و در ردیس ذخیره می‌شوند.
    """
    raw = await redis.get(SETTINGS_REDIS_KEY)

    if raw is not None:
        current_settings = json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    else:
        current_settings = dict(DEFAULT_SETTINGS)
        await redis.set(SETTINGS_REDIS_KEY, json.dumps(current_settings))

    merged = dict(DEFAULT_SETTINGS)
    merged.update(current_settings)

    return {
        "settings": merged,
        "last_updated": current_settings.get("_last_updated"),
        "updated_by": current_settings.get("_updated_by"),
    }


@router.put("")
async def update_settings(
    body: SettingsUpdateRequest,
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """
    به‌روزرسانی تنظیمات سیستم.

    تنظیمات جدید با تنظیمات فعلی ادغام می‌شوند. فقط کلیدهای مجاز
    (موجود در تنظیمات پیش‌فرض) قابل تغییر هستند.
    """
    invalid_keys = [k for k in body.settings if k not in DEFAULT_SETTINGS]
    if invalid_keys:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"کلیدهای نامعتبر: {', '.join(invalid_keys)}. کلیدهای مجاز: {', '.join(DEFAULT_SETTINGS.keys())}",
        )

    raw = await redis.get(SETTINGS_REDIS_KEY)
    if raw is not None:
        current = json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    else:
        current = dict(DEFAULT_SETTINGS)

    for key, value in body.settings.items():
        expected_type = type(DEFAULT_SETTINGS[key]) if DEFAULT_SETTINGS[key] is not None else None
        if expected_type is not None and not isinstance(value, expected_type):
            if expected_type is float and isinstance(value, int):
                value = float(value)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"نوع مقدار کلید '{key}' باید {expected_type.__name__} باشد.",
                )
        current[key] = value

    current["_last_updated"] = datetime.now(timezone.utc).isoformat()
    current["_updated_by"] = admin.id

    await redis.set(SETTINGS_REDIS_KEY, json.dumps(current))

    await redis.publish("settings:updated", json.dumps({
        "updated_keys": list(body.settings.keys()),
        "updated_by": admin.id,
        "timestamp": current["_last_updated"],
    }))

    logger.info(
        "تنظیمات توسط ادمین '%s' به‌روز شد. کلیدها: %s",
        admin.username,
        list(body.settings.keys()),
    )

    merged = dict(DEFAULT_SETTINGS)
    merged.update(current)

    return {
        "message": "تنظیمات با موفقیت به‌روزرسانی شد.",
        "settings": merged,
        "updated_keys": list(body.settings.keys()),
    }


@router.get("/ml-models")
async def ml_model_status(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """
    وضعیت مدل‌های یادگیری ماشین.

    اطلاعات هر مدل شامل نام، نسخه، دقت، تاریخ آموزش و وضعیت فعال
    بودن را از ردیس خوانده و برمی‌گرداند.
    """
    raw = await redis.get(ML_MODELS_REDIS_KEY)

    if raw is not None:
        models_data = json.loads(raw.decode() if isinstance(raw, bytes) else raw)
    else:
        models_data = {
            "models": [
                {
                    "name": "signal_classifier",
                    "version": "unknown",
                    "accuracy": None,
                    "last_trained": None,
                    "active": False,
                    "status": "not_loaded",
                },
                {
                    "name": "price_predictor",
                    "version": "unknown",
                    "accuracy": None,
                    "last_trained": None,
                    "active": False,
                    "status": "not_loaded",
                },
                {
                    "name": "risk_assessor",
                    "version": "unknown",
                    "accuracy": None,
                    "last_trained": None,
                    "active": False,
                    "status": "not_loaded",
                },
            ],
        }

    prediction_enabled_raw = await redis.get(SETTINGS_REDIS_KEY)
    prediction_enabled = True
    if prediction_enabled_raw:
        settings_data = json.loads(
            prediction_enabled_raw.decode()
            if isinstance(prediction_enabled_raw, bytes)
            else prediction_enabled_raw
        )
        prediction_enabled = settings_data.get("ml_prediction_enabled", True)

    active_count = sum(1 for m in models_data.get("models", []) if m.get("active"))

    return {
        "models": models_data.get("models", []),
        "total": len(models_data.get("models", [])),
        "active": active_count,
        "prediction_enabled": prediction_enabled,
        "last_checked": datetime.now(timezone.utc).isoformat(),
    }
