"""فیکسچرهای مشترک تست"""

import os
import sys
import asyncio
from typing import AsyncGenerator

import pytest
import numpy as np
import pandas as pd

# ── stub برای pandas_ta در محیط‌هایی که نصب نیست ──
# (در Docker واقعی پروژه نصب می‌شود — این فقط برای local test)
if "pandas_ta" not in sys.modules:
    try:
        import pandas_ta  # noqa: F401
    except ImportError:
        import types

        _stub = types.ModuleType("pandas_ta")

        def _nop(*args, **kwargs):
            """تابع خنثی — برای جلوگیری از crash در import"""
            import pandas as _pd
            return _pd.Series(dtype=float)

        for fn in [
            "ema", "sma", "rsi", "macd", "atr", "adx", "bbands", "stoch",
            "stochrsi", "cci", "willr", "mfi", "obv", "vwap", "ad",
            "supertrend", "psar", "ichimoku", "donchian", "kc", "ao",
            "cmf", "roc", "trix", "uo", "wma", "hma", "vwma", "dpo",
        ]:
            setattr(_stub, fn, _nop)

        sys.modules["pandas_ta"] = _stub

# تنظیم متغیرهای محیطی برای تست
# DEBUG=true تا اعتبارسنجی امنیتی Settings در تست crash نکند
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
# کلید تست — به اندازه کافی طولانی است تا از اعتبارسنجی عبور کند
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-jwt-tokens-only-do-not-use-in-prod-xyz")
os.environ.setdefault("ADMIN_SECRET_KEY", "test-admin-secret-key")


@pytest.fixture(scope="session")
def event_loop():
    """ایجاد event loop برای تست‌های async."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def sample_ohlcv_df() -> pd.DataFrame:
    """دیتافریم نمونه OHLCV برای تست."""
    np.random.seed(42)
    rows = 300
    dates = pd.date_range("2024-01-01", periods=rows, freq="h", tz="UTC")
    close = 2000 + np.cumsum(np.random.randn(rows) * 2)
    high = close + np.abs(np.random.randn(rows)) * 3
    low = close - np.abs(np.random.randn(rows)) * 3
    open_ = close + np.random.randn(rows) * 1

    return pd.DataFrame({
        "timestamp": dates,
        "open": open_,
        "high": high,
        "low": low,
        "close": close,
        "volume": np.random.randint(100, 10000, rows).astype(float),
    })


@pytest.fixture
def sample_signal_data() -> dict:
    """داده نمونه سیگنال."""
    return {
        "symbol": "XAUUSD",
        "direction": "long",
        "signal_type": "STRONG",
        "entry_price": 2045.50,
        "entry_zone_low": 2044.80,
        "entry_zone_high": 2045.50,
        "sl": 2038.20,
        "tp1": 2052.80,
        "tp2": 2059.00,
        "tp3": 2068.50,
        "signal_score": 87,
        "technical_score": 85,
        "pattern_score": 80,
        "ml_score": 90,
        "timeframe": "H1",
        "mtf_confirmation": {"H1": True, "H4": True, "D1": True},
        "analysis_details": {
            "key_points": [
                "شکست مقاومت + پولبک تأیید شده",
                "RSI: 62 (صعودی)",
                "MACD: تقاطع صعودی",
            ],
        },
    }


@pytest.fixture
def sample_performance() -> dict:
    """داده نمونه عملکرد."""
    return {
        "win_rate": 73,
        "avg_rr": 2.1,
        "total_signals": 156,
        "win_count": 114,
    }


@pytest.fixture
def uptrend_df() -> pd.DataFrame:
    """دیتافریم با روند صعودی."""
    np.random.seed(42)
    rows = 250
    dates = pd.date_range("2024-01-01", periods=rows, freq="h", tz="UTC")
    trend = np.linspace(0, 50, rows)
    noise = np.random.randn(rows) * 2
    close = 2000 + trend + noise
    high = close + np.abs(np.random.randn(rows)) * 3
    low = close - np.abs(np.random.randn(rows)) * 3
    open_ = close + np.random.randn(rows) * 1

    return pd.DataFrame({
        "timestamp": dates,
        "open": open_,
        "high": high,
        "low": low,
        "close": close,
        "volume": np.random.randint(100, 10000, rows).astype(float),
    })


@pytest.fixture
def downtrend_df() -> pd.DataFrame:
    """دیتافریم با روند نزولی."""
    np.random.seed(42)
    rows = 250
    dates = pd.date_range("2024-01-01", periods=rows, freq="h", tz="UTC")
    trend = np.linspace(50, 0, rows)
    noise = np.random.randn(rows) * 2
    close = 2000 + trend + noise
    high = close + np.abs(np.random.randn(rows)) * 3
    low = close - np.abs(np.random.randn(rows)) * 3
    open_ = close + np.random.randn(rows) * 1

    return pd.DataFrame({
        "timestamp": dates,
        "open": open_,
        "high": high,
        "low": low,
        "close": close,
        "volume": np.random.randint(100, 10000, rows).astype(float),
    })
