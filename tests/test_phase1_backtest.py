"""
تست‌های فاز ۱ — backtester، cost model، simulator، metrics، walk-forward.

این تست‌ها از _load_module_directly در test_phase0_fixes.py الگو می‌گیرند
تا بدون نیاز به chain سنگین imports اجرا شوند.
"""

from __future__ import annotations

import importlib.util
import math
import pathlib
import sys
from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest


def _load(name: str, relative_path: str):
    """بارگذاری مستقیم یک ماژول از مسیر فایل."""
    repo_root = pathlib.Path(__file__).resolve().parent.parent
    spec = importlib.util.spec_from_file_location(
        name, repo_root / relative_path
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# ── ماژول‌ها را یک‌بار به‌صورت direct بارگذاری می‌کنیم ──
# ترتیب مهم: cost_model اول، سپس simulator که به cost_model وابسته است
_cost_model_mod = _load("_test_cost_model", "src/backtest/cost_model.py")
# simulator به cost_model import می‌کند (src.backtest.cost_model)
# ما باید نام import آن را map کنیم
sys.modules["src.backtest.cost_model"] = _cost_model_mod
_simulator_mod = _load("_test_simulator", "src/backtest/simulator.py")
sys.modules["src.backtest.simulator"] = _simulator_mod
_metrics_mod = _load("_test_metrics", "src/backtest/metrics.py")
sys.modules["src.backtest.metrics"] = _metrics_mod
_engine_mod = _load("_test_bt_engine", "src/backtest/engine.py")
sys.modules["src.backtest.engine"] = _engine_mod
_wf_mod = _load("_test_walk_forward", "src/backtest/walk_forward.py")

CostModel = _cost_model_mod.CostModel
SymbolCostProfile = _cost_model_mod.SymbolCostProfile
TradeSimulator = _simulator_mod.TradeSimulator
ExitReason = _simulator_mod.ExitReason
TradeOutcome = _simulator_mod.TradeOutcome
calculate_metrics = _metrics_mod.calculate_metrics
attribute_by_tag = _metrics_mod.attribute_by_tag
BacktestEngine = _engine_mod.BacktestEngine
BacktestSignal = _engine_mod.BacktestSignal
WalkForwardValidator = _wf_mod.WalkForwardValidator


# ===========================================================================
# Cost Model
# ===========================================================================

class TestCostModel:
    def test_default_profile_has_known_symbols(self):
        cm = CostModel.default()
        eurusd = cm.profile("EURUSD")
        assert eurusd.pip_size == 0.0001
        assert eurusd.spread_pips > 0
        assert eurusd.pip_dollar_per_lot == 10.0

    def test_unknown_symbol_returns_conservative_profile(self):
        cm = CostModel.default()
        unknown = cm.profile("ZZZUSD")
        assert unknown.pip_size > 0
        # spread محافظه‌کارانه (بزرگ)
        assert unknown.spread_pips >= 2.0

    def test_entry_slippage_worsens_price(self):
        cm = CostModel.default()
        # LONG: قیمت بدتر یعنی بالاتر
        long_price = cm.apply_entry_slippage("EURUSD", "long", 1.1000)
        assert long_price > 1.1000
        # SHORT: قیمت بدتر یعنی پایین‌تر
        short_price = cm.apply_entry_slippage("EURUSD", "short", 1.1000)
        assert short_price < 1.1000

    def test_stop_slippage_makes_loss_worse(self):
        cm = CostModel.default()
        # LONG stop: قیمت پایین‌تر اجرا می‌شود
        long_stop = cm.apply_stop_slippage("EURUSD", "long", 1.0900)
        assert long_stop < 1.0900

    def test_swap_count_triple_on_wednesday(self):
        cm = CostModel.default()
        # نگه‌داشتن از سه‌شنبه ساعت ۱۲:۰۰ تا پنج‌شنبه ساعت ۱۲:۰۰
        # → یک شب rollover سه‌شنبه (×1) + یک شب چهارشنبه (×3) = ۴ شب معادل
        start = datetime(2026, 5, 26, 12, 0, tzinfo=timezone.utc)  # سه‌شنبه
        end = datetime(2026, 5, 28, 12, 0, tzinfo=timezone.utc)    # پنج‌شنبه
        # _count_rollover_nights در فضای داخلی
        nights = cm._count_rollover_nights(start, end)
        assert nights == 4.0  # 1 (سه‌شنبه شب) + 3 (چهارشنبه شب triple)

    def test_swap_count_zero_over_weekend(self):
        cm = CostModel.default()
        # نگه‌داشتن از جمعه ظهر تا یکشنبه ظهر → بازار بسته است
        start = datetime(2026, 5, 22, 12, 0, tzinfo=timezone.utc)  # جمعه
        end = datetime(2026, 5, 24, 12, 0, tzinfo=timezone.utc)    # یکشنبه
        nights = cm._count_rollover_nights(start, end)
        assert nights == 0.0


# ===========================================================================
# Trade Simulator
# ===========================================================================

def _make_future_candles(
    entry_time: datetime,
    prices: list,
    tf_seconds: int = 3600,
) -> pd.DataFrame:
    """ساخت کندل‌های آینده با لیست (open, high, low, close)."""
    rows = []
    for i, (o, h, l, c) in enumerate(prices):
        ts = entry_time + timedelta(seconds=tf_seconds * (i + 1))
        rows.append({"timestamp": ts, "open": o, "high": h, "low": l, "close": c, "volume": 100.0})
    return pd.DataFrame(rows)


class TestTradeSimulator:
    def test_long_hits_tp1(self):
        cm = CostModel.default()
        sim = TradeSimulator(cm)
        entry_time = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
        # entry=1.1000, SL=1.0980 (-20pip), TP1=1.1020 (+20pip)
        # کندل اول: قیمت می‌رود تا 1.1025 → TP1 hit
        future = _make_future_candles(
            entry_time,
            [(1.1000, 1.1025, 1.0995, 1.1020)],
        )
        out = sim.simulate(
            symbol="EURUSD", direction="long",
            entry_time=entry_time, entry_price_mid=1.1000,
            sl=1.0980, tp1=1.1020, tp2=None, tp3=None,
            future_candles=future, lot_size=1.0,
        )
        assert out.exit_reason == ExitReason.TAKE_PROFIT_1
        # سود ناخالص باید حدود +20 pip باشد منهای اسپرد/اسلیپج
        assert out.net_pips > 0

    def test_long_hits_sl(self):
        cm = CostModel.default()
        sim = TradeSimulator(cm)
        entry_time = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
        # کندل: قیمت می‌افتد تا 1.0975 → SL hit
        future = _make_future_candles(
            entry_time,
            [(1.1000, 1.1005, 1.0975, 1.0985)],
        )
        out = sim.simulate(
            symbol="EURUSD", direction="long",
            entry_time=entry_time, entry_price_mid=1.1000,
            sl=1.0980, tp1=1.1020, tp2=None, tp3=None,
            future_candles=future, lot_size=1.0,
        )
        assert out.exit_reason == ExitReason.STOP_LOSS
        assert out.net_pnl_dollar < 0

    def test_long_gap_down_below_sl_fills_at_open(self):
        cm = CostModel.default()
        sim = TradeSimulator(cm)
        entry_time = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
        # کندل بعدی gap-down: open=1.0950 (پایین‌تر از SL=1.0980)
        future = _make_future_candles(
            entry_time,
            [(1.0950, 1.0960, 1.0940, 1.0945)],
        )
        out = sim.simulate(
            symbol="EURUSD", direction="long",
            entry_time=entry_time, entry_price_mid=1.1000,
            sl=1.0980, tp1=1.1020, tp2=None, tp3=None,
            future_candles=future, lot_size=1.0,
        )
        assert out.exit_reason == ExitReason.STOP_LOSS
        # exit_price باید نزدیک open کندل (1.0950) باشد، نه SL (1.0980)
        # یعنی ضرر بیشتر از معمول
        # exit شامل half spread و slippage هم می‌شود
        # for long: exit = 1.0950 - half_spread - stop_slip
        assert out.exit_price < 1.0975

    def test_short_hits_tp1(self):
        cm = CostModel.default()
        sim = TradeSimulator(cm)
        entry_time = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
        # SHORT: entry=1.1000, SL=1.1020 (+20pip), TP1=1.0980 (-20pip)
        # کندل: قیمت می‌افتد تا 1.0975 → TP1 hit
        future = _make_future_candles(
            entry_time,
            [(1.1000, 1.1005, 1.0975, 1.0980)],
        )
        out = sim.simulate(
            symbol="EURUSD", direction="short",
            entry_time=entry_time, entry_price_mid=1.1000,
            sl=1.1020, tp1=1.0980, tp2=None, tp3=None,
            future_candles=future, lot_size=1.0,
        )
        assert out.exit_reason == ExitReason.TAKE_PROFIT_1
        assert out.net_pnl_dollar > 0

    def test_simultaneous_sl_and_tp_pessimistic_stop_wins(self):
        """اگر هم SL و هم TP در یک کندل hit شدند، باید SL برنده باشد."""
        cm = CostModel.default()
        sim = TradeSimulator(cm)
        entry_time = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
        # کندل high=TP و low=SL در یک کندل
        future = _make_future_candles(
            entry_time,
            [(1.1000, 1.1025, 1.0975, 1.1010)],
        )
        out = sim.simulate(
            symbol="EURUSD", direction="long",
            entry_time=entry_time, entry_price_mid=1.1000,
            sl=1.0980, tp1=1.1020, tp2=None, tp3=None,
            future_candles=future, lot_size=1.0,
        )
        # محافظه‌کارانه: stop باید برنده باشد
        assert out.exit_reason == ExitReason.STOP_LOSS

    def test_timeout_when_no_target_hit(self):
        cm = CostModel.default()
        sim = TradeSimulator(cm, max_bars=3)
        entry_time = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
        # ۳ کندل که هیچ‌کدام SL/TP را hit نمی‌کنند
        future = _make_future_candles(
            entry_time,
            [(1.1000, 1.1010, 1.0990, 1.1005)] * 3,
        )
        out = sim.simulate(
            symbol="EURUSD", direction="long",
            entry_time=entry_time, entry_price_mid=1.1000,
            sl=1.0980, tp1=1.1020, tp2=None, tp3=None,
            future_candles=future, lot_size=1.0,
        )
        assert out.exit_reason == ExitReason.TIMEOUT


# ===========================================================================
# Metrics
# ===========================================================================

def _make_trade(symbol: str, pnl_dollar: float, r: float, **kwargs) -> TradeOutcome:
    """trade کمکی برای تست metrics."""
    now = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
    return TradeOutcome(
        symbol=symbol,
        direction=kwargs.get("direction", "long"),
        entry_time=now,
        entry_price=1.0,
        exit_time=now + timedelta(hours=1),
        exit_price=1.0,
        exit_reason=ExitReason.TAKE_PROFIT_1 if pnl_dollar > 0 else ExitReason.STOP_LOSS,
        lot_size=1.0,
        gross_pips=pnl_dollar / 10,
        spread_cost_pips=1.0,
        slippage_cost_pips=1.0,
        net_pips=pnl_dollar / 10,
        gross_pnl_dollar=pnl_dollar,
        commission_dollar=0.0,
        swap_dollar=0.0,
        net_pnl_dollar=pnl_dollar,
        r_multiple=r,
        duration_minutes=60,
        candles_held=1,
        tags=kwargs.get("tags", {}),
    )


class TestMetrics:
    def test_win_rate_calculation(self):
        trades = [
            _make_trade("EURUSD", 100, 1.0),
            _make_trade("EURUSD", 100, 1.0),
            _make_trade("EURUSD", -50, -1.0),
        ]
        m = calculate_metrics(trades)
        assert m.total_trades == 3
        assert m.winning_trades == 2
        assert m.losing_trades == 1
        assert m.win_rate == pytest.approx(2 / 3, rel=1e-3)

    def test_profit_factor(self):
        trades = [
            _make_trade("EURUSD", 200, 2.0),
            _make_trade("EURUSD", -100, -1.0),
        ]
        m = calculate_metrics(trades)
        assert m.profit_factor == pytest.approx(2.0)

    def test_max_drawdown(self):
        trades = [
            _make_trade("EURUSD", 100, 1.0),    # equity = 100
            _make_trade("EURUSD", -50, -0.5),   # equity = 50 (DD = 50)
            _make_trade("EURUSD", -50, -0.5),   # equity = 0  (DD = 100 ← max)
            _make_trade("EURUSD", 150, 1.5),    # equity = 150
        ]
        m = calculate_metrics(trades)
        assert m.max_drawdown_dollar == pytest.approx(100.0)

    def test_longest_losing_streak(self):
        trades = [
            _make_trade("EURUSD", 100, 1.0),
            _make_trade("EURUSD", -10, -0.1),
            _make_trade("EURUSD", -10, -0.1),
            _make_trade("EURUSD", -10, -0.1),
            _make_trade("EURUSD", 100, 1.0),
        ]
        m = calculate_metrics(trades)
        assert m.longest_losing_streak == 3

    def test_per_symbol_attribution(self):
        trades = [
            _make_trade("EURUSD", 100, 1.0),
            _make_trade("XAUUSD", -50, -0.5),
            _make_trade("EURUSD", -20, -0.2),
        ]
        m = calculate_metrics(trades, group_by_symbol=True)
        assert "EURUSD" in m.by_symbol
        assert "XAUUSD" in m.by_symbol
        assert m.by_symbol["EURUSD"].total_trades == 2
        assert m.by_symbol["XAUUSD"].total_trades == 1

    def test_attribute_by_tag_groups_correctly(self):
        trades = [
            _make_trade("EURUSD", 100, 1.0, tags={"dominant_component": "technical"}),
            _make_trade("EURUSD", -50, -0.5, tags={"dominant_component": "technical"}),
            _make_trade("EURUSD", 200, 2.0, tags={"dominant_component": "ml"}),
        ]
        attr = attribute_by_tag(trades, "dominant_component")
        assert "technical" in attr
        assert "ml" in attr
        assert attr["technical"].total_trades == 2
        assert attr["ml"].total_trades == 1


# ===========================================================================
# Backtest Engine — Smoke test
# ===========================================================================

class TestBacktestEngine:
    def test_run_with_one_winning_signal(self):
        entry_time = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
        future = _make_future_candles(
            entry_time,
            [(1.1000, 1.1025, 1.0995, 1.1020)],  # TP1 hit
        )
        # کندل اول DataFrame باید زمان قبل از entry را پوشش دهد چون
        # _slice_future از ts > entry_time فیلتر می‌کند. تست‌مان درست است
        # چون future_candles از زمان بعد شروع می‌شوند.
        engine = BacktestEngine()
        sig = BacktestSignal(
            symbol="EURUSD", direction="long",
            entry_time=entry_time, entry_price=1.1000,
            sl=1.0980, tp1=1.1020, tp2=1.1040, tp3=1.1060,
            technical_score=80, pattern_score=60, ml_score=55,
            signal_score=75,
        )
        result = engine.run(
            name="smoke",
            signals=[sig],
            candles_by_symbol_tf={("EURUSD", "H1"): future},
            primary_timeframe="H1",
        )
        assert result.total_signals == 1
        assert len(result.trades) == 1
        assert result.trades[0].exit_reason in (
            ExitReason.TAKE_PROFIT_1,
            ExitReason.TAKE_PROFIT_2,
            ExitReason.TAKE_PROFIT_3,
        )

    def test_dominant_component_detection(self):
        sig = BacktestSignal(
            symbol="EURUSD", direction="long",
            entry_time=datetime.now(timezone.utc),
            entry_price=1.0, sl=0.99, tp1=1.01,
            technical_score=85, pattern_score=55, ml_score=52,
        )
        assert sig.dominant_component() == "technical"

        sig2 = BacktestSignal(
            symbol="EURUSD", direction="long",
            entry_time=datetime.now(timezone.utc),
            entry_price=1.0, sl=0.99, tp1=1.01,
            technical_score=51, pattern_score=51, ml_score=51,
        )
        assert sig2.dominant_component() == "mixed"

    def test_lot_size_respects_risk_pct(self):
        engine = BacktestEngine(initial_balance=10_000.0)
        sig = BacktestSignal(
            symbol="EURUSD", direction="long",
            entry_time=datetime.now(timezone.utc),
            entry_price=1.1000, sl=1.0980, tp1=1.1020,
        )
        lot = engine._calculate_lot_size(sig, balance=10_000.0, risk_pct=1.0)
        # Risk = $100. SL = 20 pip. lot = 100 / (20 * 10) = 0.5
        assert lot == pytest.approx(0.5, rel=0.01)


# ===========================================================================
# Walk-forward
# ===========================================================================

class TestEndToEnd:
    """تست‌های یکپارچه — backtester + cost + metrics."""

    def test_full_run_with_mixed_outcomes_and_attribution(self):
        """
        ۳ سیگنال با dominant_component متفاوت اجرا می‌کنیم:
        - یکی technical-driven که برنده است
        - یکی pattern-driven که بازنده است
        - یکی ml-driven که برنده است

        انتظار: attribution باید تمایز را نشان دهد.
        """
        engine = BacktestEngine(initial_balance=10_000.0)
        base = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)

        # signal 1: tech-driven، LONG، TP hit
        sig1 = BacktestSignal(
            symbol="EURUSD", direction="long",
            entry_time=base, entry_price=1.1000,
            sl=1.0980, tp1=1.1020,
            technical_score=85, pattern_score=55, ml_score=52,
        )
        future1 = _make_future_candles(
            base, [(1.1005, 1.1025, 1.1000, 1.1020)]
        )

        # signal 2: pattern-driven، LONG، SL hit
        sig2 = BacktestSignal(
            symbol="EURUSD", direction="long",
            entry_time=base + timedelta(hours=2),
            entry_price=1.1020, sl=1.1000, tp1=1.1040,
            technical_score=55, pattern_score=85, ml_score=52,
        )
        # کندل آینده برای sig2 → SL hit
        future2 = _make_future_candles(
            base + timedelta(hours=2),
            [(1.1015, 1.1018, 1.0998, 1.1002)],
        )

        # signal 3: ml-driven، SHORT، TP hit
        sig3 = BacktestSignal(
            symbol="EURUSD", direction="short",
            entry_time=base + timedelta(hours=4),
            entry_price=1.1010, sl=1.1030, tp1=1.0990,
            technical_score=55, pattern_score=55, ml_score=85,
        )
        future3 = _make_future_candles(
            base + timedelta(hours=4),
            [(1.1005, 1.1010, 1.0985, 1.0990)],
        )

        # ترکیب کندل‌ها در یک DataFrame واحد بر اساس symbol
        all_candles = pd.concat([future1, future2, future3], ignore_index=True)

        result = engine.run(
            name="e2e_test",
            signals=[sig1, sig2, sig3],
            candles_by_symbol_tf={("EURUSD", "H1"): all_candles},
            primary_timeframe="H1",
        )

        assert result.total_signals == 3
        # ۳ trade کامل شده‌اند
        assert len(result.trades) == 3
        # attribution باید سه bucket داشته باشد
        assert "technical" in result.attribution_by_component
        assert "pattern" in result.attribution_by_component
        assert "ml" in result.attribution_by_component
        # technical و ml باید win داشته باشند، pattern نه
        assert result.attribution_by_component["technical"].winning_trades >= 1
        assert result.attribution_by_component["ml"].winning_trades >= 1
        # final_balance باید با net_pnl کل ها همخوان باشد
        total_pnl = sum(t.net_pnl_dollar for t in result.trades)
        assert result.final_balance == pytest.approx(
            result.initial_balance + total_pnl, abs=0.01
        )

    def test_cost_model_meaningfully_reduces_profit(self):
        """
        یک معامله TP1 hit با و بدون cost پروفایل مقایسه می‌شود.
        cost باید سود ناخالص را کاهش دهد (به‌خاطر spread + slippage).
        """
        # cost استاندارد
        cm_standard = CostModel.default()
        sim_standard = TradeSimulator(cm_standard)

        # cost صفر (پروفایل سفارشی)
        cm_zero = CostModel({
            "EURUSD": SymbolCostProfile(
                symbol="EURUSD",
                pip_size=0.0001,
                pip_dollar_per_lot=10.0,
                spread_pips=0.0,
                commission_per_side_per_lot=0.0,
                swap_long_pips_per_night=0.0,
                swap_short_pips_per_night=0.0,
                entry_slippage_pips=0.0,
                stop_slippage_pips=0.0,
            )
        })
        sim_zero = TradeSimulator(cm_zero)

        entry_time = datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
        future = _make_future_candles(
            entry_time,
            [(1.1000, 1.1025, 1.0995, 1.1020)],
        )

        kwargs = dict(
            symbol="EURUSD", direction="long",
            entry_time=entry_time, entry_price_mid=1.1000,
            sl=1.0980, tp1=1.1020, tp2=None, tp3=None,
            future_candles=future, lot_size=1.0,
        )

        out_with_cost = sim_standard.simulate(**kwargs)
        out_zero_cost = sim_zero.simulate(**kwargs)

        # سود با cost باید کمتر از سود بدون cost باشد
        assert out_with_cost.net_pnl_dollar < out_zero_cost.net_pnl_dollar


class TestWalkForward:
    def test_raises_when_history_too_short(self):
        wf = WalkForwardValidator()
        sigs = [
            BacktestSignal(
                symbol="EURUSD", direction="long",
                entry_time=datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc),
                entry_price=1.0, sl=0.99, tp1=1.01,
            ),
        ]
        with pytest.raises(ValueError):
            wf.run(
                signals=sigs,
                candles_by_symbol_tf={},
                train_window=timedelta(days=30),
                test_window=timedelta(days=10),
            )

    def test_aggregated_metrics_combine_oos_folds(self):
        """متریک aggregated باید از تمام trade های OOS فولدها ساخته شود."""
        wf = WalkForwardValidator()
        base = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
        sigs = []
        for d in range(0, 200, 5):
            sigs.append(BacktestSignal(
                symbol="EURUSD", direction="long",
                entry_time=base + timedelta(days=d),
                entry_price=1.1000, sl=1.0980, tp1=1.1020,
            ))
        result = wf.run(
            signals=sigs,
            candles_by_symbol_tf={},
            train_window=timedelta(days=60),
            test_window=timedelta(days=30),
        )
        # حتی اگر همه trade ها skip شوند، باید aggregated metrics ساخته شود
        assert result.aggregated_oos_metrics is not None
        assert result.config["train_window_days"] == 60
        assert result.config["test_window_days"] == 30

    def test_folds_are_non_overlapping_by_default(self):
        """با step=test_window فولدها دقیقاً پشت سر هم هستند."""
        wf = WalkForwardValidator()
        # سیگنال‌های ساختگی روی ۱۰۰ روز
        base = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
        sigs = []
        for d in range(0, 100, 5):
            sigs.append(BacktestSignal(
                symbol="EURUSD", direction="long",
                entry_time=base + timedelta(days=d),
                entry_price=1.1000, sl=1.0980, tp1=1.1020,
            ))
        # کندل dummy
        # walk-forward فقط روی فولد test معامله شبیه‌سازی می‌کند،
        # ولی چون کندل آینده نمی‌دهیم، همه skip می‌شوند.
        # فقط می‌خواهیم تأیید کنیم که چند فولد ساخته می‌شوند.
        result = wf.run(
            signals=sigs,
            candles_by_symbol_tf={},
            train_window=timedelta(days=30),
            test_window=timedelta(days=10),
        )
        assert len(result.folds) > 0
        # هر فولد جدید باید train_start جدید داشته باشد
        train_starts = [f.train_start for f in result.folds]
        assert len(set(train_starts)) == len(train_starts)
