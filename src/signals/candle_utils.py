"""
ابزارهای کار با کندل — جلوگیری از look-ahead bias.

این ماژول توابع سبکی برای پاک‌سازی کندل ناقص و تشخیص زمان بسته‌شدن
ارائه می‌دهد و عمداً بدون وابستگی به ماژول‌های تحلیلی سنگین است
تا قابل import در test و backtester باشد.
"""

from __future__ import annotations

from typing import Dict

import pandas as pd


# ── مدت زمان هر تایم‌فریم به ثانیه ──────────────────────────
TIMEFRAME_SECONDS: Dict[str, int] = {
    "M1": 60,
    "M5": 60 * 5,
    "M15": 60 * 15,
    "M30": 60 * 30,
    "H1": 60 * 60,
    "H4": 60 * 60 * 4,
    "D1": 60 * 60 * 24,
    "W1": 60 * 60 * 24 * 7,
}


def drop_unclosed_candle(df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
    """
    حذف آخرین کندل اگر هنوز بسته نشده باشد.

    منطق بازار مالی: تحلیل باید روی کندل کاملاً بسته انجام شود.
    تا قبل از بسته‌شدن کندل، مقادیر OHLC نوسانی است و اندیکاتورها/الگوها
    ممکن است ظاهر شوند و سپس ناپدید گردند (look-ahead bias).

    تشخیص "ناقص بودن":
        اگر زمان فعلی UTC کمتر از (timestamp کندل آخر + مدت تایم‌فریم) باشد،
        کندل آخر هنوز در حال شکل‌گیری است.

    پارامترها:
        df: دیتافریم کندل با ستون timestamp (UTC)
        timeframe: نام تایم‌فریم (مثل H1)

    خروجی:
        دیتافریم با حداکثر یک ردیف کمتر
    """
    if df is None or df.empty or "timestamp" not in df.columns:
        return df

    tf_seconds = TIMEFRAME_SECONDS.get(timeframe)
    if tf_seconds is None:
        # تایم‌فریم ناشناخته → محافظه‌کارانه آخرین ردیف حذف
        return df.iloc[:-1].copy() if len(df) > 1 else df

    try:
        last_ts = pd.to_datetime(df["timestamp"].iloc[-1], utc=True)
    except Exception:
        return df.iloc[:-1].copy() if len(df) > 1 else df

    expected_close = last_ts + pd.Timedelta(seconds=tf_seconds)
    now_utc = pd.Timestamp.now(tz="UTC")

    if now_utc < expected_close:
        return df.iloc[:-1].copy() if len(df) > 1 else df

    return df
