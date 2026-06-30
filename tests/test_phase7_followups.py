"""
تست‌های follow-up — تکمیل موارد باقی‌مانده از تمام فازها.

پوشش:
    - DST handling در session filter
    - Holiday calendar (Christmas, New Year, Good Friday, Thanksgiving)
    - Volume/liquidity wire-up در RiskGuard
    - Chandelier trailing stop
    - مرکزی‌سازی pip_size (src/core/instruments.py)
    - ادغام scaler در trainer (presence check)
    - اجرای backtest در API (presence check)
    - record_trade_outcome integration در tracker (presence check)
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys
from datetime import date, datetime, timedelta, timezone

import pandas as pd
import pytest


def _load(name: str, relative_path: str):
    repo_root = pathlib.Path(__file__).resolve().parent.parent
    spec = importlib.util.spec_from_file_location(name, repo_root / relative_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent


# ===========================================================================
# DST in Session Filter
# ===========================================================================


class TestDSTHandling:
    @pytest.fixture
    def session_filter(self):
        return _load("_test_sess_dst", "src/risk/session_filter.py")

    def test_eu_dst_in_summer(self, session_filter):
        # ۱۵ ژوئن ۲۰۲۶ — یقیناً DST
        june = datetime(2026, 6, 15, 12, 0, tzinfo=timezone.utc)
        assert session_filter.is_eu_dst(june) is True

    def test_eu_dst_in_winter(self, session_filter):
        # ۱۵ ژانویه ۲۰۲۶ — یقیناً نه DST
        january = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
        assert session_filter.is_eu_dst(january) is False

    def test_us_dst_in_summer(self, session_filter):
        june = datetime(2026, 6, 15, 12, 0, tzinfo=timezone.utc)
        assert session_filter.is_us_dst(june) is True

    def test_london_session_shifts_with_dst(self, session_filter):
        # در DST، London از ۰۷:۰۰ UTC شروع می‌شود (نه ۰۸:۰۰)
        # ۷:۳۰ UTC تابستان: London باز است
        summer_morning = datetime(2026, 6, 15, 7, 30, tzinfo=timezone.utc)
        sessions = session_filter.current_sessions(summer_morning)
        assert session_filter.Session.LONDON in sessions

        # ۷:۳۰ UTC زمستان: London هنوز باز نیست
        winter_morning = datetime(2026, 1, 15, 7, 30, tzinfo=timezone.utc)
        sessions_w = session_filter.current_sessions(winter_morning)
        assert session_filter.Session.LONDON not in sessions_w

    def test_ny_session_shifts_with_dst(self, session_filter):
        # تابستان: NY از ۱۲:۰۰ UTC، زمستان از ۱۳:۰۰ UTC
        summer = datetime(2026, 6, 15, 12, 30, tzinfo=timezone.utc)
        assert session_filter.Session.NEW_YORK in session_filter.current_sessions(summer)

        winter = datetime(2026, 1, 15, 12, 30, tzinfo=timezone.utc)
        assert session_filter.Session.NEW_YORK not in session_filter.current_sessions(winter)


# ===========================================================================
# Holiday Calendar
# ===========================================================================


class TestHolidayCalendar:
    @pytest.fixture
    def holiday_mod(self):
        return _load("_test_holiday", "src/risk/holiday_calendar.py")

    def test_christmas_full_closure(self, holiday_mod):
        h = holiday_mod.get_holiday(date(2026, 12, 25))
        assert h is not None
        assert h.impact == holiday_mod.HolidayImpact.FULL_CLOSURE
        assert "Christmas" in h.name

    def test_new_year_full_closure(self, holiday_mod):
        h = holiday_mod.get_holiday(date(2026, 1, 1))
        assert h is not None
        assert h.impact == holiday_mod.HolidayImpact.FULL_CLOSURE

    def test_us_independence_partial(self, holiday_mod):
        h = holiday_mod.get_holiday(date(2026, 7, 4))
        assert h is not None
        assert h.impact == holiday_mod.HolidayImpact.PARTIAL
        assert "US" in h.affected_markets

    def test_thanksgiving_2026(self, holiday_mod):
        # Thanksgiving 2026 = 26 November (پنجشنبه چهارم)
        h = holiday_mod.get_holiday(date(2026, 11, 26))
        assert h is not None
        assert "Thanksgiving" in h.name

    def test_good_friday_2026(self, holiday_mod):
        # Easter 2026 = 5 April (یکشنبه)
        # Good Friday = 3 April
        h = holiday_mod.get_holiday(date(2026, 4, 3))
        assert h is not None
        assert "Good Friday" in h.name

    def test_regular_day_returns_none(self, holiday_mod):
        h = holiday_mod.get_holiday(date(2026, 5, 15))
        assert h is None

    def test_is_holiday_blackout_christmas(self, holiday_mod):
        now = datetime(2026, 12, 25, 14, 0, tzinfo=timezone.utc)
        blocked, reason = holiday_mod.is_holiday_blackout(now)
        assert blocked is True
        assert reason and "Christmas" in reason

    def test_is_holiday_blackout_regular_day(self, holiday_mod):
        now = datetime(2026, 5, 15, 14, 0, tzinfo=timezone.utc)
        blocked, _ = holiday_mod.is_holiday_blackout(now)
        assert blocked is False


# ===========================================================================
# Chandelier Trailing Stop
# ===========================================================================


class TestChandelierTrailing:
    @pytest.fixture
    def trailing_mod(self):
        return _load("_test_trailing", "src/signals/trailing_stop.py")

    def _make_df(self, highs, lows):
        return pd.DataFrame({
            "timestamp": pd.date_range("2026-01-01", periods=len(highs), freq="h", tz="UTC"),
            "open": highs, "high": highs, "low": lows, "close": highs,
        })

    def test_chandelier_long(self, trailing_mod):
        # high اخیر = 1.1100، ATR = 0.0010
        df = self._make_df([1.1100] * 25, [1.1000] * 25)
        sl = trailing_mod.chandelier_exit(df, "long", atr=0.0010, multiplier=3.0)
        # SL = 1.1100 - 0.0030 = 1.1070
        assert sl == pytest.approx(1.1070, abs=1e-6)

    def test_chandelier_short(self, trailing_mod):
        df = self._make_df([1.1100] * 25, [1.1000] * 25)
        sl = trailing_mod.chandelier_exit(df, "short", atr=0.0010, multiplier=3.0)
        # SL = 1.1000 + 0.0030 = 1.1030
        assert sl == pytest.approx(1.1030, abs=1e-6)

    def test_chandelier_insufficient_data(self, trailing_mod):
        df = self._make_df([1.1100] * 5, [1.1000] * 5)
        sl = trailing_mod.chandelier_exit(df, "long", atr=0.0010, lookback=22)
        assert sl is None

    def test_trailing_moves_to_breakeven_after_tp1(self, trailing_mod):
        state = trailing_mod.TrailingState(
            direction="long",
            entry_price=1.1000,
            initial_sl=1.0980,
            current_sl=1.0980,
            stage=trailing_mod.TrailingStage.INITIAL,
            tp1_price=1.1020,
            tp2_price=1.1040,
            tp3_price=1.1060,
        )
        # TP1 hit
        new_state = trailing_mod.update_trailing(state, current_price=1.1025)
        assert new_state.stage == trailing_mod.TrailingStage.BREAKEVEN
        assert new_state.current_sl == pytest.approx(1.1000, abs=1e-6)

    def test_trailing_locks_tp1_after_tp2(self, trailing_mod):
        state = trailing_mod.TrailingState(
            direction="long",
            entry_price=1.1000,
            initial_sl=1.0980,
            current_sl=1.1000,  # قبلاً breakeven
            stage=trailing_mod.TrailingStage.BREAKEVEN,
            tp1_price=1.1020,
            tp2_price=1.1040,
        )
        new_state = trailing_mod.update_trailing(state, current_price=1.1045)
        assert new_state.stage == trailing_mod.TrailingStage.LOCKED_TP1
        assert new_state.current_sl >= 1.1020

    def test_trailing_never_moves_backward(self, trailing_mod):
        state = trailing_mod.TrailingState(
            direction="long",
            entry_price=1.1000,
            initial_sl=1.0980,
            current_sl=1.1020,  # already locked at TP1
            stage=trailing_mod.TrailingStage.LOCKED_TP1,
            tp1_price=1.1020,
            tp2_price=1.1040,
        )
        # قیمت پایین می‌آید — SL نباید عقب برود
        new_state = trailing_mod.update_trailing(state, current_price=1.1015)
        assert new_state.current_sl >= 1.1020


# ===========================================================================
# Instruments module (pip_size centralization)
# ===========================================================================


class TestInstrumentsModule:
    @pytest.fixture
    def instruments(self):
        return _load("_test_instruments", "src/core/instruments.py")

    def test_eurusd_spec(self, instruments):
        spec = instruments.get_instrument("EURUSD")
        assert spec.pip_size == 0.0001
        assert spec.pip_dollar_per_lot == 10.0
        assert spec.category == "fx_major"

    def test_xauusd_spec(self, instruments):
        spec = instruments.get_instrument("XAUUSD")
        assert spec.pip_size == 0.1
        assert spec.category == "metal"

    def test_unknown_falls_back(self, instruments):
        spec = instruments.get_instrument("ZZZUSD")
        # Should not raise; falls back
        assert spec.pip_size > 0

    def test_helper_functions(self, instruments):
        assert instruments.pip_size_of("EURUSD") == 0.0001
        assert instruments.pip_dollar_of("EURUSD") == 10.0
        assert "یورو" in instruments.display_name_fa("EURUSD")
        assert len(instruments.all_symbols()) >= 15


# ===========================================================================
# Source-level integration checks (no live deps needed)
# ===========================================================================


class TestIntegrationPresence:
    """تأیید اینکه integration ها در فایل‌های منبع نوشته شده‌اند."""

    def test_tracker_records_to_daily_loss(self):
        """SignalTracker._close_signal باید daily.record_trade_outcome را صدا بزند."""
        content = (REPO_ROOT / "src/signals/tracker.py").read_text(encoding="utf-8")
        assert "DailyLossLimit" in content
        assert "record_trade_outcome" in content

    def test_riskguard_uses_holiday_calendar(self):
        content = (REPO_ROOT / "src/risk/guard.py").read_text(encoding="utf-8")
        assert "is_holiday_blackout" in content
        assert "HOLIDAY_BLACKOUT" in content

    def test_riskguard_checks_liquidity(self):
        content = (REPO_ROOT / "src/risk/guard.py").read_text(encoding="utf-8")
        assert "assess_liquidity" in content
        assert "LOW_LIQUIDITY" in content

    def test_trainer_saves_scaler(self):
        content = (REPO_ROOT / "src/ml/trainer.py").read_text(encoding="utf-8")
        assert "_fit_and_save_scaler" in content
        assert "fit_scaler" in content
        # هر سه train_* باید scaler save را صدا بزنند
        save_calls = content.count("self._fit_and_save_scaler(")
        assert save_calls >= 3, f"تعداد ذخیره scaler: {save_calls} (انتظار >=3)"

    def test_backtest_api_runs_engine(self):
        """_execute_backtest_in_background باید BacktestEngine را اجرا کند نه stub."""
        content = (REPO_ROOT / "src/api/routes/backtest.py").read_text(encoding="utf-8")
        assert "BacktestEngine" in content
        assert "engine.run(" in content
        # stub قبلی باید رفته باشد
        assert "stub run" not in content

    def test_launch_api_registered(self):
        content = (REPO_ROOT / "src/api/main.py").read_text(encoding="utf-8")
        assert "launch," in content or "launch\n" in content
        assert "/admin/launch" in content

    def test_launch_routes_admin_protected(self):
        content = (REPO_ROOT / "src/api/routes/launch.py").read_text(encoding="utf-8")
        # تمام endpoint ها باید get_current_admin داشته باشند
        assert "get_current_admin" in content
        assert "preflight" in content
        assert "divergence" in content
        assert "trading_mode" in content or "trading-mode" in content


# ===========================================================================
# RiskGuard with new filters (E2E)
# ===========================================================================


class TestRiskGuardWithNewFilters:
    """تأیید کارکرد holiday و liquidity در یک eval کامل."""

    @pytest.fixture
    def setup_modules(self):
        # تمام وابستگی‌ها به‌صورت direct load می‌کنیم
        sym_cfg = _load("_test_sc", "src/risk/symbol_config.py")
        sys.modules["src.risk.symbol_config"] = sym_cfg
        daily = _load("_test_dl", "src/risk/daily_loss_limit.py")
        sys.modules["src.risk.daily_loss_limit"] = daily
        corr = _load("_test_co", "src/risk/correlation.py")
        sys.modules["src.risk.correlation"] = corr
        sess = _load("_test_se", "src/risk/session_filter.py")
        sys.modules["src.risk.session_filter"] = sess
        wknd = _load("_test_wk", "src/risk/weekend_filter.py")
        sys.modules["src.risk.weekend_filter"] = wknd
        regime = _load("_test_re", "src/risk/regime_detector.py")
        sys.modules["src.risk.regime_detector"] = regime
        holiday = _load("_test_hol", "src/risk/holiday_calendar.py")
        sys.modules["src.risk.holiday_calendar"] = holiday
        vol = _load("_test_vol", "src/analysis/volume_profile.py")
        sys.modules["src.analysis.volume_profile"] = vol
        # ساخت parent package
        import types
        if "src.risk" not in sys.modules:
            pkg = types.ModuleType("src.risk")
            pkg.__path__ = [str(REPO_ROOT / "src" / "risk")]
            sys.modules["src.risk"] = pkg
        guard = _load("_test_g", "src/risk/guard.py")
        return guard

    @pytest.mark.asyncio
    async def test_christmas_blocks_signal(self, setup_modules):
        guard_mod = setup_modules
        guard = guard_mod.RiskGuard(publish_rejections_to_redis=False)
        result = await guard.evaluate(
            symbol="EURUSD", direction="long",
            entry_price=1.1000, sl=1.0980, tp1=1.1040,
            now=datetime(2026, 12, 25, 14, 0, tzinfo=timezone.utc),
            pip_size=0.0001,
        )
        codes = [r[0].value for r in result.reasons]
        assert "holiday_blackout" in codes
