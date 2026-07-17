"""
تست‌های فاز ۳ — بهینه‌سازی موتور سیگنال.

پوشش:
    - ML scaler (fit/save/load/transform)
    - Multi-timeframe net calculation و bias
    - Volume profile و liquidity assessment
    - A/B test framework (assignment + statistical test)
    - Optuna optimizer (smoke test)
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest


def _load(name: str, relative_path: str):
    repo_root = pathlib.Path(__file__).resolve().parent.parent
    spec = importlib.util.spec_from_file_location(name, repo_root / relative_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# ── ماژول‌ها ──
scaler_mod = _load("_test_scaler", "src/ml/scaler.py")
mtf_mod = _load("_test_mtf", "src/analysis/multi_timeframe.py")
volume_mod = _load("_test_volume", "src/analysis/volume_profile.py")
ab_mod = _load("_test_ab", "src/signals/ab_test.py")


# ===========================================================================
# ML Feature Scaler
# ===========================================================================

class TestFeatureScaler:
    def test_fit_robust_scaler(self):
        df = pd.DataFrame({
            "feature_a": [1.0, 2.0, 3.0, 4.0, 100.0],  # outlier
            "feature_b": [10.0, 20.0, 30.0, 40.0, 50.0],
            "timestamp": pd.date_range("2024-01-01", periods=5, freq="h"),
        })
        s = scaler_mod.fit_scaler(df, ["feature_a", "feature_b"], scaler_type="robust")
        assert s.feature_columns == ["feature_a", "feature_b"]
        assert s.scaler_type == "robust"

    def test_transform_preserves_order(self):
        df = pd.DataFrame({
            "a": [1.0, 2.0, 3.0, 4.0, 5.0],
            "b": [10.0, 20.0, 30.0, 40.0, 50.0],
        })
        s = scaler_mod.fit_scaler(df, ["a", "b"], scaler_type="standard")
        out = s.transform(df)
        assert list(out.columns) == ["a", "b"]
        assert len(out) == len(df)

    def test_transform_with_extra_columns(self):
        train = pd.DataFrame({
            "a": [1.0, 2.0, 3.0, 4.0, 5.0],
            "b": [10.0, 20.0, 30.0, 40.0, 50.0],
        })
        s = scaler_mod.fit_scaler(train, ["a", "b"])

        # داده‌ی inference با ستون اضافی
        infer = pd.DataFrame({
            "a": [2.5],
            "b": [25.0],
            "timestamp": pd.date_range("2024-01-01", periods=1),
            "target": [0],
        })
        out = s.transform(infer)
        assert list(out.columns) == ["a", "b"]

    def test_transform_missing_column_raises(self):
        train = pd.DataFrame({"a": [1.0, 2.0, 3.0, 4.0], "b": [1, 2, 3, 4]})
        s = scaler_mod.fit_scaler(train, ["a", "b"])
        bad = pd.DataFrame({"a": [1.0]})  # b ندارد
        with pytest.raises(ValueError, match="b"):
            s.transform(bad)

    def test_save_and_load_roundtrip(self, tmp_path):
        df = pd.DataFrame({
            "a": [1.0, 2.0, 3.0, 4.0, 5.0],
            "b": [10.0, 20.0, 30.0, 40.0, 50.0],
        })
        s = scaler_mod.fit_scaler(df, ["a", "b"], scaler_type="standard")
        path = tmp_path / "scaler.joblib"
        s.save(path)
        loaded = scaler_mod.FittedScaler.load(path)
        assert loaded.feature_columns == s.feature_columns
        assert loaded.scaler_type == s.scaler_type
        # transform نتیجه‌ی یکسان بدهد
        original = s.transform(df)
        from_loaded = loaded.transform(df)
        np.testing.assert_allclose(original.values, from_loaded.values)

    def test_load_missing_file_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            scaler_mod.FittedScaler.load(tmp_path / "missing.joblib")


# ===========================================================================
# Multi-Timeframe Analyzer
# ===========================================================================

class TestMultiTimeframe:
    def test_aligned_when_all_bullish(self):
        analyzer = mtf_mod.MultiTimeframeAnalyzer()
        analyses = {
            "MN1": {"technical_score": 75},
            "W1": {"technical_score": 70},
            "D1": {"technical_score": 65},
            "H4": {"technical_score": 62},
            "H1": {"technical_score": 60},
            "M15": {"technical_score": 60},
        }
        result = analyzer.analyze({}, analyses)
        assert result["direction"] == "bullish"
        assert result["aligned"] is True
        assert result["higher_tf_bias"] == "bullish"
        assert result["conflict"] is False

    def test_net_confluence_blocks_mixed_signals(self):
        """۳ صعودی + ۲ نزولی → net = 1 → conflict باید گزارش شود."""
        analyzer = mtf_mod.MultiTimeframeAnalyzer()
        analyses = {
            "W1": {"technical_score": 70},   # bullish
            "D1": {"technical_score": 70},   # bullish
            "H4": {"technical_score": 70},   # bullish
            "H1": {"technical_score": 30},   # bearish
            "M15": {"technical_score": 30},  # bearish
        }
        result = analyzer.analyze({}, analyses)
        assert result["bullish_tfs"] == 3
        assert result["bearish_tfs"] == 2
        assert result["net_confluence"] == 1
        # aligned باید False باشد (در نسخه‌ی قدیم True بود)
        assert result["aligned"] is False
        assert result["conflict"] is True

    def test_higher_tf_bias_overrides_short_term(self):
        """W1/D1 صعودی ولی H1/M15 نزولی → bias بلندمدت همچنان صعودی."""
        analyzer = mtf_mod.MultiTimeframeAnalyzer()
        analyses = {
            "W1": {"technical_score": 75},
            "D1": {"technical_score": 70},
            "H1": {"technical_score": 30},
            "M15": {"technical_score": 35},
        }
        result = analyzer.analyze({}, analyses)
        assert result["higher_tf_bias"] == "bullish"

    def test_signal_against_higher_bias_detection(self):
        # سیگنال short در حالی که bias صعودی است
        is_against = mtf_mod.MultiTimeframeAnalyzer.is_signal_against_higher_bias(
            "short", "bullish"
        )
        assert is_against is True
        # سیگنال long در bias صعودی → نه
        assert not mtf_mod.MultiTimeframeAnalyzer.is_signal_against_higher_bias(
            "long", "bullish"
        )

    def test_neutral_when_no_data(self):
        analyzer = mtf_mod.MultiTimeframeAnalyzer()
        result = analyzer.analyze({})
        assert result["direction"] == "neutral"
        assert result["confluence_count"] == 0


# ===========================================================================
# Volume Profile & Liquidity
# ===========================================================================

def _make_volume_df(rows=100):
    np.random.seed(42)
    base = 1.1000
    close = base + np.cumsum(np.random.randn(rows) * 0.0005)
    high = close + np.abs(np.random.randn(rows)) * 0.0003
    low = close - np.abs(np.random.randn(rows)) * 0.0003
    return pd.DataFrame({
        "timestamp": pd.date_range("2024-01-01", periods=rows, freq="h", tz="UTC"),
        "open": close - np.random.randn(rows) * 0.0002,
        "high": high,
        "low": low,
        "close": close,
        "volume": np.random.randint(100, 1000, rows).astype(float),
    })


class TestVolumeProfile:
    def test_vwap_returns_series(self):
        df = _make_volume_df(rows=100)
        vwap = volume_mod.calculate_vwap(df)
        assert len(vwap) == len(df)
        # VWAP باید در محدوده‌ی قیمت‌ها باشد
        assert df["low"].min() <= vwap.iloc[-1] <= df["high"].max()

    def test_volume_profile_finds_poc(self):
        df = _make_volume_df(rows=100)
        vp = volume_mod.calculate_volume_profile(df, bins=40)
        assert vp is not None
        # POC باید در محدوده‌ی قیمت‌ها باشد
        assert df["low"].min() <= vp.poc_price <= df["high"].max()
        # value area در داخل POC
        assert vp.value_area_low <= vp.poc_price <= vp.value_area_high

    def test_volume_profile_returns_none_with_insufficient_data(self):
        df = _make_volume_df(rows=5)
        vp = volume_mod.calculate_volume_profile(df)
        assert vp is None

    def test_low_liquidity_detected(self):
        df = _make_volume_df(rows=100)
        # کم کردن volume کندل آخر به ۱۰٪ میانگین
        df.loc[df.index[-1], "volume"] = df["volume"].iloc[-20:].mean() * 0.1
        assess = volume_mod.assess_liquidity(df, pip_size=0.0001)
        assert assess is not None
        assert assess.is_low_liquidity is True
        assert "حجم کم" in assess.notes[0]

    def test_high_liquidity_detected(self):
        df = _make_volume_df(rows=100)
        df.loc[df.index[-1], "volume"] = df["volume"].iloc[-20:].mean() * 3.0
        assess = volume_mod.assess_liquidity(df, pip_size=0.0001)
        assert assess is not None
        assert assess.is_high_liquidity is True


# ===========================================================================
# A/B Test Framework
# ===========================================================================

class TestABTest:
    def test_deterministic_assignment(self):
        exp = ab_mod.Experiment("test_v2", traffic_split=0.5)
        # یک کلید همیشه به یک variant می‌رود
        a1 = exp.assign("signal_123")
        a2 = exp.assign("signal_123")
        assert a1 == a2

    def test_traffic_split_approximate(self):
        exp = ab_mod.Experiment("test", traffic_split=0.5)
        # ۱۰۰۰ کلید → نسبت B باید نزدیک ۵۰٪ باشد
        b_count = sum(1 for i in range(1000) if exp.assign(f"sig_{i}") == "variant")
        assert 400 < b_count < 600

    def test_zero_traffic_to_variant(self):
        exp = ab_mod.Experiment("test", traffic_split=0.0)
        # هیچ‌کس به variant نمی‌رود
        for i in range(100):
            assert exp.assign(f"sig_{i}") == "control"

    def test_analyze_significant_improvement(self):
        # B واضحاً بهتر است: avg R = 1.5 vs 0.3
        a_r = [0.5, -0.5, 0.3, -0.3, 0.4] * 10  # n=50، avg ~ 0.08
        a_pnl = [50, -50, 30, -30, 40] * 10
        b_r = [1.5, 1.2, 1.8, 0.9, 1.1] * 10  # n=50، همه مثبت
        b_pnl = [150, 120, 180, 90, 110] * 10
        report = ab_mod.analyze_ab_test("test", a_r, a_pnl, b_r, b_pnl)
        assert report.delta_avg_r > 0
        assert report.sample_size_adequate is True
        assert report.is_significant is True
        assert "B بهتر" in report.recommendation

    def test_analyze_no_significant_difference(self):
        # هر دو گروه مشابه
        a_r = [0.5, -0.3, 0.4, -0.4] * 10
        a_pnl = [50, -30, 40, -40] * 10
        b_r = [0.4, -0.4, 0.5, -0.3] * 10
        b_pnl = [40, -40, 50, -30] * 10
        report = ab_mod.analyze_ab_test("test", a_r, a_pnl, b_r, b_pnl)
        # ممکن است یک طرف یا طرف دیگر کمی بهتر باشد، ولی significant نیست
        assert report.is_significant is False

    def test_analyze_inadequate_sample(self):
        # فقط ۵ trade در هر گروه
        report = ab_mod.analyze_ab_test(
            "test", [0.5, 1.0, -0.5, 0.3, -0.1], [50, 100, -50, 30, -10],
            [0.5, 1.0, -0.5, 0.3, -0.1], [50, 100, -50, 30, -10],
        )
        assert report.sample_size_adequate is False
        assert "حجم نمونه کم" in report.notes[0]
        assert "تأخیر" in report.recommendation

    def test_stats_computes_profit_factor(self):
        # ۳ برنده ۵۰، ۲ بازنده ۲۵ → PF = 150 / 50 = 3
        report = ab_mod.analyze_ab_test(
            "test",
            [1.0, 1.0, 1.0, -0.5, -0.5] * 10,
            [50, 50, 50, -25, -25] * 10,
            [1.0, 1.0, 1.0, -0.5, -0.5] * 10,
            [50, 50, 50, -25, -25] * 10,
        )
        # هر دو PF حدود ۳
        assert report.a_stats.profit_factor == pytest.approx(3.0, rel=0.01)
        assert report.b_stats.profit_factor == pytest.approx(3.0, rel=0.01)
