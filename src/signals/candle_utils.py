"""Utilities that keep forming candles out of analytical decisions.

Charting clients may render the current, still-changing candle.  Signal and
backtest calculations must only consume closed candles, otherwise indicators
can repaint and introduce look-ahead bias.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

import pandas as pd


TIMEFRAME_SECONDS: dict[str, int] = {
    "M1": 60,
    "M5": 5 * 60,
    "M15": 15 * 60,
    "M30": 30 * 60,
    "H1": 60 * 60,
    "H2": 2 * 60 * 60,
    "H3": 3 * 60 * 60,
    "H4": 4 * 60 * 60,
    "H6": 6 * 60 * 60,
    "H8": 8 * 60 * 60,
    "H12": 12 * 60 * 60,
    "D": 24 * 60 * 60,
    "D1": 24 * 60 * 60,
    "W": 7 * 24 * 60 * 60,
    "W1": 7 * 24 * 60 * 60,
}


def _timestamp_utc(value: Any) -> pd.Timestamp:
    """Normalize DB/client timestamps, including epoch seconds/milliseconds."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        unit = "ms" if abs(value) >= 10_000_000_000 else "s"
        return pd.to_datetime(value, unit=unit, utc=True)
    return pd.to_datetime(value, utc=True)


def is_candle_closed(
    timestamp: Any,
    timeframe: str,
    *,
    now: Any | None = None,
) -> bool:
    """Return whether a candle that starts at ``timestamp`` has closed.

    Unknown timeframes and invalid timestamps return ``False`` so analytical
    callers fail closed and discard the uncertain last row.
    """
    seconds = TIMEFRAME_SECONDS.get(str(timeframe).upper())
    if seconds is None:
        return False

    try:
        opened_at = _timestamp_utc(timestamp)
        now_utc = pd.Timestamp.now(tz="UTC") if now is None else _timestamp_utc(now)
    except (TypeError, ValueError, OverflowError):
        return False

    return now_utc >= opened_at + pd.Timedelta(seconds=seconds)


def drop_unclosed_candle(df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
    """Drop the final DataFrame row when its candle is not certainly closed."""
    if df is None or df.empty or "timestamp" not in df.columns:
        return df

    if is_candle_closed(df["timestamp"].iloc[-1], timeframe):
        return df

    # Preserve a single row rather than turning a minimal input into an empty
    # frame.  Downstream minimum-history gates still reject it as insufficient.
    return df.iloc[:-1].copy() if len(df) > 1 else df


def drop_unclosed_candle_rows(
    rows: Sequence[Mapping[str, Any]],
    timeframe: str,
    *,
    timestamp_key: str = "t",
    now: Any | None = None,
) -> list[Mapping[str, Any]]:
    """List-row counterpart used by the BazaarNama API analysis pipeline."""
    result = list(rows)
    if not result:
        return result

    last_timestamp = result[-1].get(timestamp_key)
    if is_candle_closed(last_timestamp, timeframe, now=now):
        return result

    return result[:-1] if len(result) > 1 else result
