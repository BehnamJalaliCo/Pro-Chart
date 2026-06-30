"""نریتور ریسک — توضیح ساده‌ی فارسیِ دلایل رد سیگنال توسط RiskGuard (برای ادمین/مانیتورینگ)."""

from __future__ import annotations

import json

from src.core.config import settings
from src.core.logger import get_logger
from src.llm.client import llm_client

logger = get_logger("llm.risk_narrator")

_SYSTEM = (
    "تو دستیار ریسک هستی. یک رد شدنِ سیگنال (با کدهای دلیل) را در یک جمله‌ی کوتاه و "
    "ساده‌ی فارسی برای ادمین توضیح بده. بدون مارک‌داون، فقط همان یک جمله."
)


async def explain_rejection(rejection: dict) -> str | None:
    """توضیح کوتاه یک رد. None اگر LLM غیرفعال/خطا."""
    if not settings.LLM_ENABLED:
        return None
    try:
        text = await llm_client.complete(
            "این رد سیگنال را توضیح بده:\n\n" + json.dumps(rejection, ensure_ascii=False),
            system=_SYSTEM, cache_ttl=1800,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("explain_rejection_failed", error=str(exc))
        return None
    return text.strip() if text else None
