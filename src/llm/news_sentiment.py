"""اخبار/سنتیمنت — Claude رویدادهای پرریسکِ تقویم اقتصادی را تفسیر می‌کند.

خروجی نرم/advisory: per-currency سطح ریسک + یک یادداشت کوتاه، ذخیره در Redis
(`llm:news_risk`). مصرف به‌صورت soft (نمایش در ادمین / یادداشت)، نه گیت سخت، تا
LLM به‌اشتباه جلوی سیگنال معتبر را نگیرد.
"""

from __future__ import annotations

import json
import re

from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.llm.client import llm_client

logger = get_logger("llm.news_sentiment")

REDIS_KEY = "llm:news_risk"

_SYSTEM = (
    "تو تحلیل‌گر ماکروی بازار فارکس هستی. بر اساس فهرست رویدادهای اقتصادیِ پرتأثیرِ "
    "امروز، برای هر ارز اصلی یک سطح ریسک تعیین کن (low/medium/high) و یک یادداشت کوتاه. "
    "فقط JSON پاسخ بده، بدون توضیح اضافه:\n"
    '{"overall": "low|medium|high", "by_currency": {"USD": {"risk":"...","note":"..."}, ...}}'
)


async def _today_events() -> list[dict]:
    try:
        from src.signals.news_filter import NewsFilter
        nf = NewsFilter()
        try:
            return await nf.get_today_high_impact()
        finally:
            await nf.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("news_fetch_failed", error=str(exc))
        return []


def _parse(text: str) -> dict | None:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except (ValueError, TypeError):
        return None


async def assess_news_risk() -> dict | None:
    """ارزیابی ریسک خبریِ امروز و ذخیره در Redis. None اگر غیرفعال/بی‌داده."""
    if not (settings.LLM_ENABLED and settings.LLM_NEWS_ENABLED):
        return None
    events = await _today_events()
    if not events:
        result = {"overall": "low", "by_currency": {}, "note": "no high-impact events"}
        await _store(result)
        return result
    compact = [
        {"cur": e.get("currency"), "title": e.get("title"), "time": e.get("event_time")}
        for e in events[:25]
    ]
    try:
        text = await llm_client.complete(
            "رویدادهای پرتأثیر امروز:\n\n" + json.dumps(compact, ensure_ascii=False),
            system=_SYSTEM, cache_ttl=3600,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("news_assess_failed", error=str(exc))
        return None
    parsed = _parse(text or "")
    if parsed is None:
        return None
    await _store(parsed)
    return parsed


async def _store(result: dict) -> None:
    try:
        await redis_client.client.set(REDIS_KEY, json.dumps(result, ensure_ascii=False), ex=14400)
    except Exception:  # noqa: BLE001
        pass


async def get_news_risk() -> dict | None:
    """خواندن آخرین ارزیابی ریسک خبری از Redis (برای ادمین/نمایش)."""
    try:
        raw = await redis_client.client.get(REDIS_KEY)
        return json.loads(raw) if raw else None
    except Exception:  # noqa: BLE001
        return None
