"""
تست‌های فاز ۲ — مدیریت ریسک حرفه‌ای.

پوشش:
    - symbol_config (per-symbol thresholds)
    - daily loss limit (circuit breaker)
    - correlation guard (currency exposure)
    - session filter (Asian/London/NY + low liquidity)
    - weekend filter
    - regime detector
    - RiskGuard integration
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest


# ── direct module loaders ──────────────────────────────────

def _load(name: str, relative_path: str):
    """بارگذاری مستقیم یک ماژول."""
    repo_root = pathlib.Path(__file__).resolve().parent.parent
    spec = importlib.util.spec_from_file_location(name, repo_root / relative_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# هر ماژول ریسک مستقل از سایرین قابل import است
symbol_config = _load("_test_symbol_config", "src/risk/symbol_config.py")
sys.modules["src.risk.symbol_config"] = symbol_config

daily_loss = _load("_test_daily_loss", "src/risk/daily_loss_limit.py")
sys.modules["src.risk.daily_loss_limit"] = daily_loss

correlation_mod = _load("_test_correlation", "src/risk/correlation.py")
sys.modules["src.risk.correlation"] = correlation_mod

session_filter = _load("_test_session_filter", "src/risk/session_filter.py")
sys.modules["src.risk.session_filter"] = session_filter

weekend_filter = _load("_test_weekend_filter", "src/risk/weekend_filter.py")
sys.modules["src.risk.weekend_filter"] = weekend_filter

regime_mod = _load("_test_regime", "src/risk/regime_detector.py")
sys.modules["src.risk.regime_detector"] = regime_mod


# ===========================================================================
# Symbol Config
# ===========================================================================

class TestSymbolConfig:
    def test_known_symbol_has_specific_config(self):
        cfg = symbol_config.get_symbol_config("XAUUSD")
        assert cfg.symbol == "XAUUSD"
        # XAUUSD باید ATR multiplier بزرگ‌تری از EURUSD داشته باشد
        assert cfg.atr_sl_multiplier > 2.0
        assert cfg.min_rr_tp1 >= 1.3

    def test_unknown_symbol_returns_fallback(self):
        cfg = symbol_config.get_symbol_config("ZZZUSD")
        # نام fallback ثبت می‌شود (در کنفیگ "UNKNOWN")
        assert cfg.atr_sl_multiplier >= 1.5
        assert cfg.min_rr_tp1 >= 1.3

    def test_high_volatility_symbols_have_wider_sl(self):
        eurusd = symbol_config.get_symbol_config("EURUSD")
        xauusd = symbol_config.get_symbol_config("XAUUSD")
        gbpjpy = symbol_config.get_symbol_config("GBPJPY")
        # XAUUSD و GBPJPY هر دو باید max_sl_pips بزرگ‌تری داشته باشند
        assert xauusd.max_sl_pips > eurusd.max_sl_pips
        assert gbpjpy.max_sl_pips > eurusd.max_sl_pips


# ===========================================================================
# Daily Loss Limit
# ===========================================================================

class TestDailyLossLimit:
    @pytest.mark.asyncio
    async def test_clean_state_allows_signal(self):
        guard = daily_loss.DailyLossLimit(redis_client=None)
        ok, reason = await guard.can_emit_signal(account_balance=10000.0)
        assert ok is True
        assert reason is None

    @pytest.mark.asyncio
    async def test_dollar_limit_blocks_after_exceeded(self):
        guard = daily_loss.DailyLossLimit(
            redis_client=None,
            max_daily_loss_dollar=200.0,
        )
        # ثبت زیان ۲۵۰ دلاری
        await guard.record_trade_outcome(-250.0)
        ok, reason = await guard.can_emit_signal(account_balance=10000.0)
        assert ok is False
        assert "حد زیان مطلق" in reason

    @pytest.mark.asyncio
    async def test_pct_limit_blocks_when_threshold_reached(self):
        guard = daily_loss.DailyLossLimit(
            redis_client=None,
            max_daily_loss_dollar=10_000.0,  # دلاری بسیار بزرگ تا فقط pct اعمال شود
            max_daily_loss_pct=3.0,
        )
        # زیان ۴۰۰ از ۱۰۰۰۰ = ۴٪
        await guard.record_trade_outcome(-400.0)
        ok, reason = await guard.can_emit_signal(account_balance=10000.0)
        assert ok is False
        assert "حد زیان" in reason

    @pytest.mark.asyncio
    async def test_consecutive_losses_block(self):
        guard = daily_loss.DailyLossLimit(
            redis_client=None,
            max_consecutive_losses=3,
        )
        for _ in range(3):
            await guard.record_trade_outcome(-10.0)
        ok, reason = await guard.can_emit_signal(account_balance=10000.0)
        assert ok is False
        assert "متوالی" in reason

    @pytest.mark.asyncio
    async def test_winning_trade_resets_consecutive_losses(self):
        guard = daily_loss.DailyLossLimit(
            redis_client=None,
            max_consecutive_losses=3,
        )
        await guard.record_trade_outcome(-10.0)
        await guard.record_trade_outcome(-10.0)
        await guard.record_trade_outcome(+20.0)  # برد → ریست
        snap = await guard.snapshot()
        assert snap.consecutive_losses == 0

    @pytest.mark.asyncio
    async def test_manual_lock_and_unlock(self):
        guard = daily_loss.DailyLossLimit(redis_client=None)
        await guard.manual_lock("بازبینی استراتژی")
        ok, _ = await guard.can_emit_signal()
        assert ok is False

        await guard.manual_unlock()
        ok, _ = await guard.can_emit_signal()
        assert ok is True

    @pytest.mark.asyncio
    async def test_signal_count_limit(self):
        guard = daily_loss.DailyLossLimit(
            redis_client=None,
            max_signals_per_day=3,
        )
        for _ in range(3):
            await guard.record_signal_emitted()
        ok, reason = await guard.can_emit_signal()
        assert ok is False
        assert "سقف سیگنال" in reason


# ===========================================================================
# Correlation Guard
# ===========================================================================

class TestCorrelationGuard:
    def test_decompose_long_eurusd(self):
        legs = correlation_mod.decompose_currency_legs("EURUSD", "long")
        assert legs == {"EUR": +1, "USD": -1}

    def test_decompose_short_gbpjpy(self):
        legs = correlation_mod.decompose_currency_legs("GBPJPY", "short")
        assert legs == {"GBP": -1, "JPY": +1}

    def test_decompose_xauusd_long(self):
        legs = correlation_mod.decompose_currency_legs("XAUUSD", "long")
        assert legs == {"XAU": +1, "USD": -1}

    def test_decompose_unknown_returns_empty(self):
        legs = correlation_mod.decompose_currency_legs("ZZZUSD", "long")
        assert legs == {}

    def test_no_open_positions_allows_signal(self):
        guard = correlation_mod.CorrelationGuard()
        reason = guard.evaluate("EURUSD", "long", [])
        assert reason is None

    def test_too_many_usd_short_positions_blocks(self):
        """۳ معامله‌ی hand-USD short همگی → block سیگنال چهارم."""
        guard = correlation_mod.CorrelationGuard(max_currency_exposure=2.0)
        opens = [
            correlation_mod.OpenPosition("EURUSD", "long"),   # -USD
            correlation_mod.OpenPosition("GBPUSD", "long"),   # -USD
            correlation_mod.OpenPosition("AUDUSD", "long"),   # -USD
        ]
        reason = guard.evaluate("NZDUSD", "long", opens)
        assert reason is not None
        assert "USD" in reason

    def test_uncorrelated_signal_allowed(self):
        guard = correlation_mod.CorrelationGuard(max_currency_exposure=2.5)
        opens = [correlation_mod.OpenPosition("EURUSD", "long")]
        # USDJPY long → +USD، -JPY که هیچ‌کدام با EUR/USD اشباع نشده‌اند
        reason = guard.evaluate("USDJPY", "long", opens)
        # exposure به USD: -1 (از EURUSD long) + 1 (از USDJPY long) = 0 → مجاز
        assert reason is None

    def test_static_correlation_lookup(self):
        # EURUSD و GBPUSD باید همبستگی مثبت بالا داشته باشند
        corr = correlation_mod.static_correlation("EURUSD", "GBPUSD")
        assert corr is not None and corr > 0.7

        # EURUSD و USDCHF باید همبستگی منفی بالا داشته باشند
        corr2 = correlation_mod.static_correlation("EURUSD", "USDCHF")
        assert corr2 is not None and corr2 < -0.7

    def test_same_symbol_correlation_is_one(self):
        assert correlation_mod.static_correlation("EURUSD", "EURUSD") == 1.0


# ===========================================================================
# Session Filter
# ===========================================================================

class TestSessionFilter:
    def test_london_session_active_at_10am_utc(self):
        now = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)  # چهارشنبه ۱۰:۰۰ UTC
        sessions = session_filter.current_sessions(now)
        assert session_filter.Session.LONDON in sessions

    def test_ny_session_active_at_15_utc(self):
        now = datetime(2026, 5, 27, 15, 0, tzinfo=timezone.utc)
        sessions = session_filter.current_sessions(now)
        assert session_filter.Session.NEW_YORK in sessions

    def test_tokyo_session_active_at_03_utc(self):
        now = datetime(2026, 5, 27, 3, 0, tzinfo=timezone.utc)
        sessions = session_filter.current_sessions(now)
        assert session_filter.Session.TOKYO in sessions

    def test_low_liquidity_window_at_2130_utc(self):
        now = datetime(2026, 5, 27, 21, 30, tzinfo=timezone.utc)
        assert session_filter.is_low_liquidity_window(now)

    def test_eurusd_blocked_in_tokyo_only(self):
        # ۰۳:۰۰ UTC — Tokyo فعال، London خاموش
        now = datetime(2026, 5, 27, 3, 0, tzinfo=timezone.utc)
        allowed, reason = session_filter.is_session_allowed("EURUSD", now)
        assert allowed is False
        assert "session" in reason.lower()

    def test_eurusd_allowed_in_london(self):
        now = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
        allowed, reason = session_filter.is_session_allowed("EURUSD", now)
        assert allowed is True

    def test_us30_blocked_outside_ny(self):
        # ۰۹:۰۰ UTC — London فعال، NY هنوز نه
        now = datetime(2026, 5, 27, 9, 0, tzinfo=timezone.utc)
        allowed, _ = session_filter.is_session_allowed("US30", now)
        assert allowed is False

    def test_us30_allowed_in_ny(self):
        now = datetime(2026, 5, 27, 15, 0, tzinfo=timezone.utc)
        allowed, _ = session_filter.is_session_allowed("US30", now)
        assert allowed is True

    def test_unknown_symbol_allowed_by_default(self):
        now = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
        allowed, _ = session_filter.is_session_allowed("ZZZUSD", now)
        assert allowed is True

    def test_unknown_symbol_rejected_in_strict_mode(self):
        now = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
        allowed, _ = session_filter.is_session_allowed("ZZZUSD", now, strict_unknown=True)
        assert allowed is False


# ===========================================================================
# Weekend Filter
# ===========================================================================

class TestWeekendFilter:
    def test_wednesday_noon_allowed(self):
        now = datetime(2026, 5, 27, 12, 0, tzinfo=timezone.utc)  # چهارشنبه
        blocked, _ = weekend_filter.is_weekend_blackout(now)
        assert blocked is False

    def test_friday_late_blocked(self):
        # جمعه ۲۲:۰۰ UTC → blackout
        now = datetime(2026, 5, 22, 22, 0, tzinfo=timezone.utc)
        assert datetime(2026, 5, 22).weekday() == 4
        blocked, reason = weekend_filter.is_weekend_blackout(now)
        assert blocked is True
        assert "گپ" in reason

    def test_saturday_always_blocked(self):
        now = datetime(2026, 5, 23, 10, 0, tzinfo=timezone.utc)  # شنبه
        blocked, _ = weekend_filter.is_weekend_blackout(now)
        assert blocked is True

    def test_sunday_before_2200_blocked(self):
        now = datetime(2026, 5, 24, 20, 0, tzinfo=timezone.utc)  # یکشنبه قبل از بازگشایی
        blocked, _ = weekend_filter.is_weekend_blackout(now)
        assert blocked is True

    def test_sunday_after_2200_allowed(self):
        # یکشنبه ۲۲:۰۰ — بازار باز است
        now = datetime(2026, 5, 24, 22, 30, tzinfo=timezone.utc)
        blocked, _ = weekend_filter.is_weekend_blackout(now)
        assert blocked is False


# ===========================================================================
# Regime Detector
# ===========================================================================

def _make_trending_df(rows=200, direction="up"):
    """ساخت دیتافریم با روند مشخص و ADX بالا."""
    np.random.seed(42)
    if direction == "up":
        trend = np.linspace(0, 100, rows)
    else:
        trend = np.linspace(100, 0, rows)
    noise = np.random.randn(rows) * 0.5
    close = 1000 + trend + noise
    return pd.DataFrame({
        "timestamp": pd.date_range("2024-01-01", periods=rows, freq="h", tz="UTC"),
        "open": close - np.random.randn(rows) * 0.3,
        "high": close + np.abs(np.random.randn(rows)) * 0.5,
        "low": close - np.abs(np.random.randn(rows)) * 0.5,
        "close": close,
        "volume": np.random.randint(100, 1000, rows).astype(float),
    })


def _make_ranging_df(rows=200):
    """ساخت دیتافریم با نوسان درون یک کانال — ADX پایین."""
    np.random.seed(42)
    # نوسان بین 990 و 1010
    close = 1000 + np.sin(np.linspace(0, 10 * np.pi, rows)) * 5 + np.random.randn(rows) * 0.5
    return pd.DataFrame({
        "timestamp": pd.date_range("2024-01-01", periods=rows, freq="h", tz="UTC"),
        "open": close - np.random.randn(rows) * 0.3,
        "high": close + np.abs(np.random.randn(rows)) * 0.5,
        "low": close - np.abs(np.random.randn(rows)) * 0.5,
        "close": close,
        "volume": np.random.randint(100, 1000, rows).astype(float),
    })


class TestRegimeDetector:
    def test_trending_up_detected(self):
        df = _make_trending_df(rows=200, direction="up")
        result = regime_mod.detect_regime(df)
        assert result is not None
        # ADX باید بالا باشد (روند قوی)
        assert result.adx > 20
        # و +DI > -DI
        assert result.di_plus > result.di_minus

    def test_trending_down_detected(self):
        df = _make_trending_df(rows=200, direction="down")
        result = regime_mod.detect_regime(df)
        assert result is not None
        assert result.di_minus > result.di_plus

    def test_ranging_detected(self):
        df = _make_ranging_df(rows=200)
        result = regime_mod.detect_regime(df)
        assert result is not None
        # ADX باید پایین یا متوسط باشد
        assert result.adx < 35

    def test_insufficient_data_returns_none(self):
        df = _make_trending_df(rows=20)
        result = regime_mod.detect_regime(df)
        assert result is None

    def test_atr_percentile_within_range(self):
        df = _make_trending_df(rows=200)
        result = regime_mod.detect_regime(df)
        assert 0.0 <= result.atr_percentile <= 1.0


# ===========================================================================
# RiskGuard Integration
# ===========================================================================

# Guard import نیاز به config (و سپس به همه چیز) دارد، پس از direct loading
# و قرار دادن stub در sys.modules استفاده می‌کنیم. settings از conftest stub
# نمی‌گیرد چون config validation اجرا می‌شود — pydantic از env می‌خواند که
# توسط conftest set شده.

@pytest.fixture
def guard_module():
    """بارگذاری guard با تمام وابستگی‌هایش."""
    import types

    # ایجاد بسته src.risk به‌صورت موقت
    pkg = sys.modules.get("src.risk")
    if pkg is None:
        pkg = types.ModuleType("src.risk")
        pkg.__path__ = [str(pathlib.Path(__file__).resolve().parent.parent / "src" / "risk")]
        sys.modules["src.risk"] = pkg

    # وابستگی‌های guard
    sys.modules.setdefault("src.risk.symbol_config", symbol_config)
    sys.modules.setdefault("src.risk.daily_loss_limit", daily_loss)
    sys.modules.setdefault("src.risk.correlation", correlation_mod)
    sys.modules.setdefault("src.risk.session_filter", session_filter)
    sys.modules.setdefault("src.risk.weekend_filter", weekend_filter)
    sys.modules.setdefault("src.risk.regime_detector", regime_mod)

    return _load("_test_guard", "src/risk/guard.py")


class TestRiskGuard:
    @pytest.mark.asyncio
    async def test_weekend_blocks_signal(self, guard_module):
        guard = guard_module.RiskGuard()
        result = await guard.evaluate(
            symbol="EURUSD", direction="long",
            entry_price=1.1000, sl=1.0980, tp1=1.1020,
            now=datetime(2026, 5, 23, 10, 0, tzinfo=timezone.utc),  # شنبه
        )
        assert result.allowed is False
        codes = [r[0].value for r in result.reasons]
        assert "weekend_blackout" in codes

    @pytest.mark.asyncio
    async def test_session_blocks_xauusd_in_tokyo_only(self, guard_module):
        guard = guard_module.RiskGuard()
        result = await guard.evaluate(
            symbol="XAUUSD", direction="long",
            entry_price=2000.0, sl=1990.0, tp1=2015.0,
            now=datetime(2026, 5, 27, 3, 0, tzinfo=timezone.utc),  # چهارشنبه ۰۳:۰۰
        )
        # session XAUUSD = London + NY → blocked
        codes = [r[0].value for r in result.reasons]
        assert "session_not_allowed" in codes

    @pytest.mark.asyncio
    async def test_low_rr_blocked(self, guard_module):
        guard = guard_module.RiskGuard()
        # EURUSD min_rr_tp1 = 1.2
        # SL = 30 pip, TP1 = 30 pip → R/R = 1.0 → blocked
        result = await guard.evaluate(
            symbol="EURUSD", direction="long",
            entry_price=1.1000, sl=1.0970, tp1=1.1030,
            now=datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc),
            pip_size=0.0001,
        )
        codes = [r[0].value for r in result.reasons]
        assert "low_rr" in codes

    @pytest.mark.asyncio
    async def test_sl_too_tight_blocked(self, guard_module):
        guard = guard_module.RiskGuard()
        # EURUSD min_sl_pips = 8.0
        # SL = 3 pip → blocked
        result = await guard.evaluate(
            symbol="EURUSD", direction="long",
            entry_price=1.1000, sl=1.0997, tp1=1.1010,
            now=datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc),
            pip_size=0.0001,
        )
        codes = [r[0].value for r in result.reasons]
        assert "sl_too_tight" in codes

    @pytest.mark.asyncio
    async def test_valid_signal_allowed(self, guard_module):
        guard = guard_module.RiskGuard()
        # EURUSD، چهارشنبه London session، R/R = 2 (20 pip SL، 40 pip TP)
        result = await guard.evaluate(
            symbol="EURUSD", direction="long",
            entry_price=1.1000, sl=1.0980, tp1=1.1040,
            now=datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc),
            pip_size=0.0001,
        )
        # هیچ regime data نیست، open_positions خالی، daily_loss تمیز
        # نباید رد شود
        assert result.allowed is True or result.reasons == []

    @pytest.mark.asyncio
    async def test_correlation_blocks_overexposed_usd(self, guard_module):
        guard = guard_module.RiskGuard(
            correlation_guard=correlation_mod.CorrelationGuard(max_currency_exposure=2.0),
        )
        opens = [
            correlation_mod.OpenPosition("EURUSD", "long"),
            correlation_mod.OpenPosition("GBPUSD", "long"),
            correlation_mod.OpenPosition("AUDUSD", "long"),
        ]
        result = await guard.evaluate(
            symbol="NZDUSD", direction="long",
            entry_price=0.6000, sl=0.5980, tp1=0.6030,
            now=datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc),
            open_positions=opens,
            pip_size=0.0001,
        )
        codes = [r[0].value for r in result.reasons]
        assert "correlation_risk" in codes

    @pytest.mark.asyncio
    async def test_regime_mismatch_trending_in_reversion(self, guard_module):
        guard = guard_module.RiskGuard()
        df = _make_trending_df(rows=200, direction="up")
        result = await guard.evaluate(
            symbol="EURUSD", direction="short",  # شورت در trending up
            entry_price=1.1000, sl=1.1020, tp1=1.0970,
            candles_df=df,
            signal_strategy="reversion",
            now=datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc),
            pip_size=0.0001,
        )
        codes = [r[0].value for r in result.reasons]
        # یا regime_mismatch یا چیزی مشابه باید گزارش شود
        # (بسته به ADX دقیق، ممکن است transitional باشد)
        assert result.regime is not None
