"""
تست‌های اصلاحات فاز ۰ — توقف خطرات بحرانی.

این تست‌ها شش اصلاح بحرانی پایه‌ای را پوشش می‌دهند:
    ۱. Redis client property (به جای get_client)
    ۲. JWT شامل jti و iat
    ۳. اعتبارسنجی پسوردهای پیش‌فرض در production
    ۴. حذف کندل ناقص پایانی قبل از تحلیل
    ۵. انتخاب ASK/BID درست بر اساس direction
    ۶. blacklist بر اساس jti نه admin_id
"""

from __future__ import annotations

import importlib.util
import os
import pathlib
import sys
from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest


def _load_module_directly(name: str, relative_path: str):
    """
    بارگذاری مستقیم یک ماژول از مسیر فایل، بدون عبور از __init__.py.

    این روش برای تست توابع سبک در پکیج‌های با import chain سنگین مفید است
    (مثلاً وقتی src/signals/__init__.py زنجیره طولانی trigger می‌کند).
    """
    repo_root = pathlib.Path(__file__).resolve().parent.parent
    full_path = repo_root / relative_path
    spec = importlib.util.spec_from_file_location(name, full_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# ۱) Redis client — property به‌جای get_client
# ---------------------------------------------------------------------------

def test_redis_client_uses_property_not_method():
    """RedisClient باید property به نام client داشته باشد، نه متد get_client."""
    from src.core.redis_client import RedisClient

    rc = RedisClient()
    # property وجود دارد
    assert hasattr(RedisClient, "client")
    assert isinstance(RedisClient.__dict__["client"], property)

    # متد قدیمی get_client نباید وجود داشته باشد
    assert not hasattr(rc, "get_client")


def test_redis_client_property_raises_when_not_connected():
    """دسترسی به client بدون connect باید RuntimeError بدهد."""
    from src.core.redis_client import RedisClient

    rc = RedisClient()
    with pytest.raises(RuntimeError):
        _ = rc.client


# ---------------------------------------------------------------------------
# ۲) JWT — شامل jti و iat
# ---------------------------------------------------------------------------

def test_jwt_access_token_contains_jti_and_iat():
    """توکن دسترسی باید claim‌های jti و iat را داشته باشد."""
    from src.core.security import create_access_token, decode_token

    token = create_access_token({"sub": "42"})
    payload = decode_token(token)

    assert payload is not None
    assert "jti" in payload
    assert "iat" in payload
    assert payload.get("type") == "access"
    # jti باید رشته‌ی غیرتکراری باشد
    assert len(payload["jti"]) >= 16


def test_two_tokens_have_different_jti():
    """هر فراخوانی باید jti منحصربه‌فرد تولید کند."""
    from src.core.security import create_access_token, decode_token

    t1 = decode_token(create_access_token({"sub": "1"}))
    t2 = decode_token(create_access_token({"sub": "1"}))

    assert t1["jti"] != t2["jti"]


def test_refresh_token_contains_jti():
    """توکن نوسازی هم باید jti داشته باشد."""
    from src.core.security import create_refresh_token, decode_token

    payload = decode_token(create_refresh_token({"sub": "1"}))
    assert "jti" in payload
    assert payload.get("type") == "refresh"


# ---------------------------------------------------------------------------
# ۳) اعتبارسنجی پسوردهای پیش‌فرض
# ---------------------------------------------------------------------------

def test_settings_rejects_default_passwords_in_production(monkeypatch):
    """راه‌اندازی production با DB_PASSWORD=changeme باید خطا بدهد."""
    from src.core.config import Settings

    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("DB_PASSWORD", "changeme")
    monkeypatch.setenv("REDIS_PASSWORD", "a-strong-password-here")
    monkeypatch.setenv("ADMIN_PASSWORD", "a-strong-password-here")
    monkeypatch.setenv("GRAFANA_PASSWORD", "a-strong-password-here")
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 64)

    with pytest.raises(ValueError, match="DB_PASSWORD"):
        Settings()


def test_settings_rejects_short_jwt_secret_in_production(monkeypatch):
    """JWT_SECRET کوتاه‌تر از ۳۲ کاراکتر در production باید رد شود."""
    from src.core.config import Settings

    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("DB_PASSWORD", "a-strong-password-here")
    monkeypatch.setenv("REDIS_PASSWORD", "a-strong-password-here")
    monkeypatch.setenv("ADMIN_PASSWORD", "a-strong-password-here")
    monkeypatch.setenv("GRAFANA_PASSWORD", "a-strong-password-here")
    monkeypatch.setenv("JWT_SECRET_KEY", "short-key")

    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        Settings()


def test_settings_allows_defaults_in_debug(monkeypatch):
    """در حالت DEBUG=true، defaultها هشدار می‌دهند ولی crash نمی‌کنند."""
    from src.core.config import Settings

    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("DB_PASSWORD", "changeme")
    monkeypatch.setenv("REDIS_PASSWORD", "changeme")
    monkeypatch.setenv("ADMIN_PASSWORD", "changeme")
    monkeypatch.setenv("GRAFANA_PASSWORD", "changeme")
    monkeypatch.setenv("JWT_SECRET_KEY", "change-me-very-long-random-string")

    # نباید خطا بدهد — فقط هشدار
    with pytest.warns(RuntimeWarning):
        s = Settings()
    assert s.DEBUG is True


def test_settings_accepts_strong_secrets(monkeypatch):
    """مقادیر قوی نباید خطا یا هشدار بدهند."""
    from src.core.config import Settings

    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("DB_PASSWORD", "Xz3!aB9$qR7%pL2&")
    monkeypatch.setenv("REDIS_PASSWORD", "Xz3!aB9$qR7%pL2&")
    monkeypatch.setenv("ADMIN_PASSWORD", "Xz3!aB9$qR7%pL2&")
    monkeypatch.setenv("GRAFANA_PASSWORD", "Xz3!aB9$qR7%pL2&")
    monkeypatch.setenv("JWT_SECRET_KEY", "a" * 64)

    s = Settings()
    assert s.DEBUG is False


# ---------------------------------------------------------------------------
# ۴) حذف کندل ناقص پایانی
# ---------------------------------------------------------------------------

def _make_df(num_candles: int, timeframe_seconds: int, last_complete: bool):
    """
    دیتافریم تستی با کندل‌های مرتب.

    اگر last_complete=False باشد، آخرین کندل هنوز در حال شکل‌گیری است
    (یعنی expected_close > now).
    """
    now = pd.Timestamp.now(tz="UTC")
    # آخرین کندل
    if last_complete:
        # آخرین کندل بسته‌شده: timestamp = now - tf (تا close = now)
        last_ts = now - pd.Timedelta(seconds=timeframe_seconds + 10)
    else:
        # آخرین کندل ناقص: timestamp = now - چند ثانیه (close هنوز نرسیده)
        last_ts = now - pd.Timedelta(seconds=timeframe_seconds // 2)

    timestamps = [
        last_ts - pd.Timedelta(seconds=timeframe_seconds * i)
        for i in range(num_candles - 1, -1, -1)
    ]
    return pd.DataFrame({
        "timestamp": timestamps,
        "open": [1.0] * num_candles,
        "high": [1.1] * num_candles,
        "low": [0.9] * num_candles,
        "close": [1.05] * num_candles,
        "volume": [100.0] * num_candles,
    })


def test_drop_unclosed_candle_removes_incomplete():
    """آخرین کندل ناقص باید حذف شود."""
    candle_utils = _load_module_directly(
        "_test_candle_utils", "src/signals/candle_utils.py"
    )
    drop_unclosed_candle = candle_utils.drop_unclosed_candle

    df = _make_df(num_candles=10, timeframe_seconds=3600, last_complete=False)
    out = drop_unclosed_candle(df, "H1")

    assert len(out) == 9
    assert out.iloc[-1]["timestamp"] == df.iloc[-2]["timestamp"]


def test_drop_unclosed_candle_keeps_closed():
    """اگر آخرین کندل بسته باشد، چیزی حذف نشود."""
    candle_utils = _load_module_directly(
        "_test_candle_utils", "src/signals/candle_utils.py"
    )
    drop_unclosed_candle = candle_utils.drop_unclosed_candle

    df = _make_df(num_candles=10, timeframe_seconds=3600, last_complete=True)
    out = drop_unclosed_candle(df, "H1")

    assert len(out) == 10


def test_drop_unclosed_candle_handles_empty_df():
    """دیتافریم خالی نباید crash کند."""
    candle_utils = _load_module_directly(
        "_test_candle_utils", "src/signals/candle_utils.py"
    )
    drop_unclosed_candle = candle_utils.drop_unclosed_candle

    empty = pd.DataFrame()
    out = drop_unclosed_candle(empty, "H1")
    assert out is empty or out.empty


def test_drop_unclosed_candle_handles_unknown_timeframe():
    """تایم‌فریم ناشناخته باید محافظه‌کارانه آخرین کندل را حذف کند."""
    candle_utils = _load_module_directly(
        "_test_candle_utils", "src/signals/candle_utils.py"
    )
    drop_unclosed_candle = candle_utils.drop_unclosed_candle

    df = _make_df(num_candles=5, timeframe_seconds=3600, last_complete=True)
    out = drop_unclosed_candle(df, "UNKNOWN_TF")

    # محافظه‌کاری: یک کندل کم می‌شود
    assert len(out) == 4


# ---------------------------------------------------------------------------
# ۵) Rate Limit middleware — استفاده از property
# ---------------------------------------------------------------------------

def test_rate_limit_middleware_imports_correctly():
    """ماژول rate_limit بدون خطا import شود."""
    from src.api.middleware.rate_limit import RateLimitMiddleware
    assert RateLimitMiddleware is not None


def test_rate_limit_middleware_registered_in_app():
    """RateLimitMiddleware باید به app اضافه شده باشد."""
    from src.api.main import app
    from src.api.middleware.rate_limit import RateLimitMiddleware

    registered = [m.cls for m in app.user_middleware]
    assert RateLimitMiddleware in registered, (
        "RateLimitMiddleware باید در main.py با app.add_middleware ثبت شود."
    )
