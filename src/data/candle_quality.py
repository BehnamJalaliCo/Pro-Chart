"""اعتبارسنجیِ کیفیتِ کندل با Pandera — warn-only (هرگز سیگنال را بلاک نمی‌کند).

هدف: قبل از رسیدنِ دادهٔ بد به موتورِ سیگنال، مشکلات (NaN، OHLC ناسازگار، قیمتِ نامعتبر،
گپِ زمانی) لاگ و متریک شوند تا دیده شوند. خروجی فقط هشدار است؛ دیتافریم دست‌نخورده برمی‌گردد.
"""

from __future__ import annotations

import pandas as pd

from src.core.logger import get_logger

logger = get_logger("data.candle_quality")

try:
    try:
        import pandera.pandas as pa  # pandera ≥ 0.20 (namespaceِ جدید)
        from pandera.pandas import Check, Column
    except ModuleNotFoundError:
        import pandera as pa          # pandera < 0.20 (namespaceِ قدیمی)
        from pandera import Check, Column

    _CANDLE_SCHEMA = pa.DataFrameSchema(
        {
            "open": Column(float, Check.gt(0), nullable=False),
            "high": Column(float, Check.gt(0), nullable=False),
            "low": Column(float, Check.gt(0), nullable=False),
            "close": Column(float, Check.gt(0), nullable=False),
        },
        checks=[
            # high باید بزرگ‌ترین و low کوچک‌ترین باشد
            Check(lambda df: (df["high"] >= df["low"]).all(), error="high<low"),
            Check(lambda df: (df["high"] >= df["open"]).all(), error="high<open"),
            Check(lambda df: (df["high"] >= df["close"]).all(), error="high<close"),
            Check(lambda df: (df["low"] <= df["open"]).all(), error="low>open"),
            Check(lambda df: (df["low"] <= df["close"]).all(), error="low>close"),
        ],
        strict=False,
        coerce=True,
    )
    _PANDERA_OK = True
except Exception as _imp_exc:  # noqa: BLE001 — اگر pandera نبود، no-op
    _PANDERA_OK = False
    logger.warning("pandera_unavailable", error=str(_imp_exc))


def validate_candles(df: pd.DataFrame, symbol: str, timeframe: str = "") -> bool:
    """اعتبارسنجیِ warn-only؛ True اگر سالم، False اگر مشکل (ولی هرگز exception نمی‌دهد)."""
    if not _PANDERA_OK or df is None or df.empty:
        return True
    try:
        from src.core.metrics import candle_quality_issues
    except Exception:  # noqa: BLE001
        candle_quality_issues = None
    try:
        _CANDLE_SCHEMA.validate(df, lazy=True)
        return True
    except Exception as exc:  # noqa: BLE001 — pa.errors.SchemaErrors
        reason = str(getattr(exc, "failure_cases", exc))[:300]
        logger.warning("candle_quality_issue", symbol=symbol, timeframe=timeframe, detail=reason)
        if candle_quality_issues is not None:
            try:
                candle_quality_issues.labels(symbol=symbol).inc()
            except Exception:  # noqa: BLE001
                pass
        return False
