"""
دروازهٔ اعتبارسنجیِ کپی‌ترید (Phase 5) — سپرِ حقوقی.

کپیِ کاربران با پولِ واقعی فقط زمانی فعال می‌شود که «مَسترِ روی حسابِ واقعی» در
پنجرهٔ اخیر سوددهیِ مثبت و پایدار نشان داده باشد. تا قبلِ آن، کاربر روی پولِ واقعی
کپی نمی‌کند — این دقیقاً جلوی ادعای «رباتِ ضررده مرا ورشکست کرد» را می‌گیرد.

(طبقِ قیدِ مالک: اعتبارسنجی روی حسابِ واقعیِ خودش است، نه دمو.)

معیارها (همه باید برقرار باشند):
  - حداقل تعدادِ معاملهٔ بسته‌شده در پنجره (نمونهٔ کافی)
  - انتظارِ ریاضیِ مثبت (هر معامله به‌طور متوسط سود)
  - profit factor ≥ آستانه
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)

CACHE_KEY = "copy:master_validation"
CACHE_TTL = 600   # ۱۰ دقیقه


async def compute_master_validation(db: AsyncSession) -> dict[str, Any]:
    """محاسبهٔ زندهٔ وضعیتِ اعتبارسنجیِ مَستر (uid=0) و کشِ آن."""
    from src.analytics.performance import performance_report
    rep = await performance_report(db, uid=0, days=settings.COPY_VAL_WINDOW_DAYS)
    o = rep.get("overall", {})
    trades = int(o.get("trades", 0) or 0)
    pf = float(o.get("profit_factor", 0) or 0)
    expectancy = float(o.get("expectancy", 0) or 0)
    reasons = []
    if trades < settings.COPY_VAL_MIN_TRADES:
        reasons.append(f"نمونهٔ کم ({trades}<{settings.COPY_VAL_MIN_TRADES})")
    if expectancy <= 0:
        reasons.append(f"انتظارِ غیرمثبت ({expectancy})")
    if pf < settings.COPY_VAL_MIN_PF:
        reasons.append(f"profit factor پایین ({pf}<{settings.COPY_VAL_MIN_PF})")
    validated = (not settings.COPY_VALIDATION_ENABLED) or (len(reasons) == 0)
    out = {
        "validated": validated,
        "enforced": settings.COPY_VALIDATION_ENABLED,
        "reasons": reasons,
        "window_days": settings.COPY_VAL_WINDOW_DAYS,
        "trades": trades, "profit_factor": pf, "expectancy": expectancy,
        "winrate_pct": o.get("winrate_pct"), "net": o.get("net"),
        "sharpe": o.get("sharpe"), "max_drawdown": o.get("max_drawdown"),
    }
    try:
        await redis_client.client.set(CACHE_KEY, json.dumps(out), ex=CACHE_TTL)
    except Exception:  # noqa: BLE001
        pass
    return out


async def is_master_validated() -> bool:
    """خواندنِ سریعِ وضعیتِ اعتبارسنجی از کش (مسیرِ داغِ gating). در نبودِ کش، خودش
    یک‌بار محاسبه می‌کند. در هر خطا → False (محافظه‌کار: کپی فعال نشود)."""
    if not settings.COPY_VALIDATION_ENABLED:
        return True
    try:
        c = await redis_client.client.get(CACHE_KEY)
        if c is not None:
            return bool(json.loads(c).get("validated"))
    except Exception:  # noqa: BLE001
        pass
    try:
        from src.core.database import async_session_factory
        async with async_session_factory() as db:
            res = await compute_master_validation(db)
        return bool(res.get("validated"))
    except Exception as exc:  # noqa: BLE001 — محافظه‌کار
        logger.warning("master_validation_failed", error=str(exc))
        return False
