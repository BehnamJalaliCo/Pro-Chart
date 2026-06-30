"""کلاینت رندر چارت — کندل‌های نماد را به سرویس chart-renderer می‌فرستد و
PNG عکس چارت (با خطوط Entry/SL/TP) می‌گیرد. fail-soft: در هر خطا None.
"""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx
import pandas as pd

from src.core.logger import get_logger
from src.data.feed_manager import feed_manager

logger = get_logger("bot.chart_client")

_URL = os.getenv("CHART_RENDERER_URL", "http://chart-renderer:8086/render")
_MAX_CANDLES = 80  # تعداد کندل اخیر برای نمایش


def _to_lwc_candles(df: pd.DataFrame) -> list[dict]:
    """تبدیل DataFrame به فرمت lightweight-charts: {time, open, high, low, close}."""
    df = df.tail(_MAX_CANDLES)
    ts = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    out: list[dict] = []
    for t, o, h, l, c in zip(ts, df["open"], df["high"], df["low"], df["close"]):
        if pd.isna(t):
            continue
        out.append({
            "time": int(t.timestamp()),
            "open": round(float(o), 6),
            "high": round(float(h), 6),
            "low": round(float(l), 6),
            "close": round(float(c), 6),
        })
    # lightweight-charts نیاز به زمانِ صعودیِ یکتا دارد
    seen = set()
    uniq = []
    for r in out:
        if r["time"] in seen:
            continue
        seen.add(r["time"])
        uniq.append(r)
    return uniq


async def render_signal_chart(signal: dict[str, Any]) -> Optional[bytes]:
    """عکس PNG چارت برای یک سیگنال؛ None در صورت هر خطا (fail-soft)."""
    try:
        symbol = signal.get("symbol")
        timeframe = signal.get("timeframe") or "H1"
        if not symbol:
            return None

        df = await feed_manager.get_candles(symbol, timeframe)
        if df is None or len(df) < 5:
            logger.warning("chart_no_candles", symbol=symbol)
            return None
        candles = _to_lwc_candles(df)
        if len(candles) < 5:
            return None

        def _f(v: Any) -> Optional[float]:
            try:
                return float(v) if v is not None else None
            except (TypeError, ValueError):
                return None

        # قیمت ورود: میانهٔ زون اگر موجود، وگرنه entry_price
        ez_lo, ez_hi = _f(signal.get("entry_zone_low")), _f(signal.get("entry_zone_high"))
        entry = (ez_lo + ez_hi) / 2 if (ez_lo and ez_hi) else _f(signal.get("entry_price"))

        payload = {
            "symbol": symbol,
            "timeframe": timeframe,
            "direction": (signal.get("direction") or "long").lower(),
            "candles": candles,
            "entry": entry,
            "sl": _f(signal.get("sl")),
            "tp1": _f(signal.get("tp1")),
            "tp2": _f(signal.get("tp2")),
            "tp3": _f(signal.get("tp3")),
        }

        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(_URL, json=payload)
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
                return r.content
            logger.warning("chart_render_failed", symbol=symbol, status=r.status_code)
            return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("chart_client_error", error=str(exc))
        return None
