"""گزارش‌گر عملکرد — گزارش حرفه‌ای هفتگی از معاملات بسته‌شده با Claude."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from src.core.config import settings
from src.core.database import Signal, async_session_factory
from src.core.logger import get_logger
from src.llm.client import llm_client

logger = get_logger("llm.reporter")

_SYSTEM = (
    "تو تحلیل‌گر ارشد CoinePro FX هستی. بر اساس آمار عملکردِ داده‌شده یک گزارش هفتگیِ "
    "حرفه‌ای، صادقانه و کوتاه به فارسی برای کانال بنویس. اگر هفته ضعیف بود صادق باش و "
    "بر مدیریت ریسک تأکید کن؛ اگر خوب بود اغراق نکن. ۳ تا ۵ جمله. بدون عنوان و مارک‌داون. "
    "هیچ عددی از خودت نساز؛ فقط از آمارِ داده‌شده استفاده کن."
)


async def _collect_stats(days: int = 7) -> dict | None:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    async with async_session_factory() as s:
        rows = (
            await s.execute(
                select(Signal).where(
                    Signal.status == "CLOSED", Signal.closed_at >= since
                )
            )
        ).scalars().all()
    if not rows:
        return None
    total = len(rows)
    wins = sum(1 for r in rows if (r.pnl_pips or 0) > 0)
    losses = sum(1 for r in rows if (r.pnl_pips or 0) < 0)
    pips = sum(float(r.pnl_pips or 0) for r in rows)
    by_target: dict[str, int] = {}
    for r in rows:
        t = (r.hit_target or r.close_reason or "—")
        by_target[t] = by_target.get(t, 0) + 1
    best = max(rows, key=lambda r: float(r.pnl_pips or 0))
    worst = min(rows, key=lambda r: float(r.pnl_pips or 0))
    return {
        "روزها": days,
        "تعداد": total,
        "برد": wins,
        "باخت": losses,
        "نرخ برد": round(wins / total * 100, 1) if total else 0,
        "مجموع پیپ": round(pips, 1),
        "برخورد اهداف": by_target,
        "بهترین": {"نماد": best.symbol, "پیپ": round(float(best.pnl_pips or 0), 1)},
        "بدترین": {"نماد": worst.symbol, "پیپ": round(float(worst.pnl_pips or 0), 1)},
    }


async def build_weekly_report(days: int = 7) -> str | None:
    """متن گزارش هفتگی (یا None اگر داده/LLM نبود)."""
    if not settings.LLM_ENABLED:
        return None
    stats = await _collect_stats(days)
    if stats is None:
        return None
    try:
        text = await llm_client.complete(
            "این آمار عملکرد را به گزارش هفتگی تبدیل کن:\n\n"
            + json.dumps(stats, ensure_ascii=False),
            system=_SYSTEM,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("report_failed", error=str(exc))
        return None
    return text.strip() if text else None
