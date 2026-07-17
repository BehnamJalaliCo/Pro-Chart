"""
تست‌های فاز ۱۰ — ML pipeline rebuild.

پوشش:
    - Financial metrics (PnL-weighted، Sharpe، IC، profit factor)
    - is_model_tradable gate
    - Drift detection (KS test، prediction drift)
    - Purged k-fold (proper purging و embargo)
    - Calibration (Platt و isotonic، ECE)
    - Determinism (set_global_seed)
    - Feature selection (correlation prune + top-K)
    - Triple barrier labeling
    - Temporal decay weights
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys

import numpy as np
import pytest


REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent


def _load(name: str, relative_path: str):
    spec = importlib.util.spec_from_file_location(name, REPO_ROOT / relative_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


fm = _load("_test_fm", "src/ml/financial_metrics.py")
drift = _load("_test_drift", "src/ml/drift_detector.py")
purged = _load("_test_purged", "src/ml/purged_kfold.py")
calib = _load("_test_calib", "src/ml/calibration.py")
det = _load("_test_det", "src/ml/determinism.py")
selector = _load("_test_selector", "src/ml/feature_selector.py")
tb = _load("_test_tb", "src/ml/triple_barrier.py")


# ===========================================================================
# Financial Metrics
# ===========================================================================


class TestFinancialMetrics:
    def test_empty_input(self):
        m = fm.financial_evaluate([], [], [])
        assert m.n_samples == 0
        assert m.total_return == 0.0

    def test_all_correct_long_predictions(self):
        # 10 long predictions، همه با +1% return
        m = fm.financial_evaluate(
            y_true_class=[2] * 10,
            y_pred_class=[2] * 10,
            future_returns=[0.01] * 10,
        )
        assert m.total_return == pytest.approx(0.1)
        assert m.win_rate == 1.0
        assert m.directional_accuracy == 1.0

    def test_all_neutral_predictions_no_trades(self):
        m = fm.financial_evaluate(
            y_true_class=[2] * 10,
            y_pred_class=[1] * 10,  # neutral
            future_returns=[0.01] * 10,
        )
        assert m.total_return == 0.0
        assert m.n_long_predictions == 0
        assert "neutral" in m.notes[0].lower() or "هیچ" in m.notes[0]

    def test_short_prediction_on_negative_return_wins(self):
        # Short با return منفی = برد
        m = fm.financial_evaluate(
            y_true_class=[0] * 10,
            y_pred_class=[0] * 10,  # short
            future_returns=[-0.01] * 10,
        )
        assert m.total_return > 0  # short * negative = positive
        assert m.win_rate == 1.0

    def test_profit_factor_calculation(self):
        # 3 برنده (+10 هر کدام)، 2 بازنده (-5 هر کدام) → PF = 30/10 = 3
        m = fm.financial_evaluate(
            y_true_class=[2, 2, 2, 2, 2],
            y_pred_class=[2, 2, 2, 2, 2],
            future_returns=[10.0, 10.0, 10.0, -5.0, -5.0],
        )
        assert m.profit_factor == pytest.approx(3.0)

    def test_directional_accuracy(self):
        # 8 correct، 2 wrong
        true_classes = [2, 2, 0, 0, 2, 0, 2, 0, 2, 0]
        pred_classes = [2, 2, 0, 0, 2, 0, 2, 0, 0, 2]  # last 2 wrong
        returns = [0.01] * 10
        m = fm.financial_evaluate(true_classes, pred_classes, returns)
        assert m.directional_accuracy == 0.8

    def test_is_model_tradable_rejects_low_sharpe(self):
        m = fm.FinancialMetrics(
            n_long_predictions=50,
            n_short_predictions=50,
            sharpe_ratio=0.2,  # خیلی پایین
            profit_factor=1.5,
            max_drawdown_pct=0.1,
        )
        tradable, reasons = fm.is_model_tradable(m, min_sharpe=0.5)
        assert not tradable
        assert any("Sharpe" in r for r in reasons)

    def test_is_model_tradable_rejects_low_trades(self):
        m = fm.FinancialMetrics(
            n_long_predictions=10,  # کمتر از 30
            n_short_predictions=5,
            sharpe_ratio=2.0,
            profit_factor=2.0,
            max_drawdown_pct=0.1,
        )
        tradable, reasons = fm.is_model_tradable(m)
        assert not tradable
        assert any("trade" in r.lower() for r in reasons)


# ===========================================================================
# Drift Detection
# ===========================================================================


class TestDriftDetection:
    def test_ks_test_identical_distributions(self):
        np.random.seed(42)
        x = np.random.normal(0, 1, 200)
        y = np.random.normal(0, 1, 200)
        ks, p = drift.ks_test_2sample(x, y)
        assert ks < 0.15  # تفاوت کم
        assert p > 0.05  # not significant

    def test_ks_test_different_distributions(self):
        np.random.seed(42)
        x = np.random.normal(0, 1, 200)
        y = np.random.normal(2, 1, 200)  # shifted by 2 std
        ks, p = drift.ks_test_2sample(x, y)
        assert ks > 0.5  # تفاوت زیاد
        assert p < 0.01  # very significant

    def test_no_drift_with_similar_distributions(self):
        np.random.seed(42)
        train = np.random.normal(0, 1, (500, 5))
        live = np.random.normal(0, 1, (200, 5))
        report = drift.detect_feature_drift(
            train, live, feature_names=["f0", "f1", "f2", "f3", "f4"]
        )
        assert report.features_drifted <= 1  # accidental drift may happen on 1
        assert "ok" in report.recommendation.lower()

    def test_severe_drift_recommends_retrain(self):
        np.random.seed(42)
        train = np.random.normal(0, 1, (500, 5))
        # تمام feature ها shifted
        live = np.random.normal(3, 1, (200, 5))
        report = drift.detect_feature_drift(
            train, live, feature_names=[f"f{i}" for i in range(5)]
        )
        assert report.features_drifted == 5
        assert "retrain" in report.recommendation.lower()

    def test_prediction_drift_detected(self):
        # train: mostly class 1، live: mostly class 2
        train_preds = [1] * 80 + [0] * 10 + [2] * 10
        live_preds = [2] * 80 + [0] * 10 + [1] * 10
        result = drift.detect_prediction_drift(train_preds, live_preds, n_classes=3)
        assert result["is_drift"]
        assert result["kl_divergence"] > 0.1


# ===========================================================================
# Purged K-Fold
# ===========================================================================


class TestPurgedKFold:
    def test_basic_split_structure(self):
        pkf = purged.PurgedKFold(n_splits=5, label_lookforward=4, embargo_pct=0.01)
        folds = list(pkf.split(n_samples=500))
        # walk-forward: fold نخست (test در ابتدای سری) train خالی دارد و skip می‌شود،
        # پس از ۵ split، ۴ fold معتبر باقی می‌ماند (آموزش هرگز روی آینده نیست).
        assert len(folds) == 4
        # هر fold باید train و test داشته باشد، و train کاملاً قبل از test باشد
        for f in folds:
            assert len(f.train_indices) > 0
            assert len(f.test_indices) > 0
            assert max(f.train_indices) < min(f.test_indices)

    def test_no_train_test_overlap(self):
        pkf = purged.PurgedKFold(n_splits=5, label_lookforward=4)
        for fold in pkf.split(n_samples=500):
            overlap = np.intersect1d(fold.train_indices, fold.test_indices)
            assert len(overlap) == 0

    def test_purging_removes_lookahead_samples(self):
        """
        sample‌های آخر train fold باید purge شوند چون label آن‌ها
        به test fold می‌رسد.
        """
        pkf = purged.PurgedKFold(n_splits=2, label_lookforward=10, embargo_pct=0.0)
        folds = list(pkf.split(n_samples=100))
        # walk-forward: fold نخست (test=[0..50]) train خالی دارد و skip می‌شود،
        # پس فقط fold با test=[50..100] باقی می‌ماند (آخرین fold).
        # purge باید [50-10..50] = [40..50] را از train حذف کند.
        fold2 = folds[-1]
        # هیچ index در [40, 50) نباید در train باشد
        for purge_idx in range(40, 50):
            assert purge_idx not in fold2.train_indices

    def test_embargo_removes_post_test_samples(self):
        """نمونه‌های بلافاصله بعد از test باید embargo شوند."""
        pkf = purged.PurgedKFold(n_splits=2, label_lookforward=0, embargo_pct=0.05)
        folds = list(pkf.split(n_samples=200))
        fold1 = folds[0]
        # test = [0, 100)، embargo = 5% × 200 = 10
        # samples 100..110 باید embargo شده باشند
        for emb_idx in range(100, 110):
            assert emb_idx not in fold1.train_indices

    def test_raises_when_n_samples_too_small(self):
        pkf = purged.PurgedKFold(n_splits=5)
        with pytest.raises(ValueError):
            list(pkf.split(n_samples=5))


# ===========================================================================
# Calibration
# ===========================================================================


class TestCalibration:
    def test_platt_fits_perfectly_calibrated_data(self):
        # داده‌ای که از قبل calibrated است
        np.random.seed(42)
        n = 1000
        raw_probs = np.random.uniform(0, 1, n)
        # y_true با احتمال = raw_prob
        y_true = (np.random.uniform(0, 1, n) < raw_probs).astype(float)

        cal = calib.PlattCalibrator()
        cal.fit(raw_probs, y_true)
        transformed = cal.transform(raw_probs)
        assert len(transformed) == n
        assert (transformed >= 0).all() and (transformed <= 1).all()

    def test_isotonic_preserves_monotonicity(self):
        np.random.seed(42)
        n = 500
        raw = np.linspace(0.01, 0.99, n)
        # y = sigmoid-like
        y = (raw + np.random.normal(0, 0.1, n) > 0.5).astype(float)

        cal = calib.IsotonicCalibrator()
        cal.fit(raw, y)
        # ورودی sorted، خروجی باید non-decreasing باشد
        transformed = cal.transform(np.sort(raw))
        diffs = np.diff(transformed)
        assert (diffs >= -1e-6).all()  # tolerance for float

    def test_calibration_report_perfect_predictions(self):
        # probs تماماً 1.0 و y_true همگی 1
        probs = np.ones(100)
        y = np.ones(100)
        report = calib.calibration_report(probs, y)
        assert report.ece == 0.0
        assert report.brier_score == 0.0

    def test_calibration_report_terrible_calibration(self):
        # confidence=0.9 ولی فقط 30% درست
        probs = np.full(100, 0.9)
        y = np.array([1] * 30 + [0] * 70)
        report = calib.calibration_report(probs, y, n_bins=5)
        assert report.ece > 0.3  # شدید
        assert report.brier_score > 0.3

    def test_platt_raises_before_fit(self):
        cal = calib.PlattCalibrator()
        with pytest.raises(RuntimeError):
            cal.transform(np.array([0.5]))


# ===========================================================================
# Determinism
# ===========================================================================


class TestDeterminism:
    def test_set_global_seed_sets_environment(self):
        det.set_global_seed(42)
        import os
        assert os.environ.get("PYTHONHASHSEED") == "42"

    def test_numpy_reproducibility(self):
        det.set_global_seed(123)
        a = np.random.rand(5)
        det.set_global_seed(123)
        b = np.random.rand(5)
        np.testing.assert_array_equal(a, b)

    def test_python_random_reproducibility(self):
        import random
        det.set_global_seed(7)
        a = [random.random() for _ in range(5)]
        det.set_global_seed(7)
        b = [random.random() for _ in range(5)]
        assert a == b

    def test_verify_determinism_returns_dict(self):
        det.set_global_seed(42)
        status = det.verify_determinism()
        assert "pythonhashseed" in status
        assert status["pythonhashseed"] == "42"


# ===========================================================================
# Feature Selection
# ===========================================================================


class TestFeatureSelector:
    def test_correlation_prune_removes_redundant(self):
        np.random.seed(42)
        X = np.random.normal(0, 1, (200, 5))
        # column 1 = column 0 × 1.001 (highly correlated)
        X[:, 1] = X[:, 0] * 1.001 + np.random.normal(0, 0.001, 200)
        names = ["f0", "f1", "f2", "f3", "f4"]
        kept, pruned = selector.correlation_prune(X, names, threshold=0.95)
        # یا f0 یا f1 باید pruned شده باشد
        assert len(kept) == 4
        assert len(pruned) == 1

    def test_correlation_prune_keeps_all_uncorrelated(self):
        np.random.seed(42)
        X = np.random.normal(0, 1, (200, 5))
        names = ["f0", "f1", "f2", "f3", "f4"]
        kept, pruned = selector.correlation_prune(X, names, threshold=0.95)
        assert len(kept) == 5
        assert len(pruned) == 0

    def test_select_features_full_pipeline(self):
        np.random.seed(42)
        n, p = 300, 20
        X = np.random.normal(0, 1, (n, p))
        # target = f(X[:, 0])
        y = (X[:, 0] > 0).astype(int)
        names = [f"f{i}" for i in range(p)]
        result = selector.select_features(X, y, names, top_k=10)
        assert result.n_original == 20
        assert len(result.selected_features) <= 10
        # f0 باید top باشد (محرک واقعی)
        assert "f0" in result.selected_features


# ===========================================================================
# Triple Barrier
# ===========================================================================


class TestTripleBarrier:
    def test_uptrend_hits_upper_barrier(self):
        # قیمت‌ها صعودی، upper barrier hit می‌شود
        prices = np.linspace(100, 110, 50)  # +10% in 50 periods
        vol = np.full(50, 1.0)  # vol = 1
        labels = tb.triple_barrier_label(
            prices, volatility=vol, upper_mult=2.0, lower_mult=2.0, max_periods=20,
        )
        # samples ابتدایی باید +1 شوند (upper hit)
        assert labels[0] == 1

    def test_downtrend_hits_lower_barrier(self):
        prices = np.linspace(110, 100, 50)  # -10%
        vol = np.full(50, 1.0)
        labels = tb.triple_barrier_label(
            prices, volatility=vol, upper_mult=2.0, lower_mult=2.0, max_periods=20,
        )
        assert labels[0] == -1

    def test_flat_market_returns_zero(self):
        # کاملاً flat، هیچ barrier hit نمی‌شود
        prices = np.full(50, 100.0)
        vol = np.full(50, 1.0)
        labels = tb.triple_barrier_label(
            prices, volatility=vol, upper_mult=5.0, lower_mult=5.0, max_periods=10,
        )
        # majority باید 0 باشند
        assert (labels == 0).sum() >= 40

    def test_meta_label_correctness(self):
        primary = np.array([1, -1, 1, -1, 0, 1])
        actual = np.array([1, 1, 1, -1, 0, -1])
        meta = tb.meta_label_features(primary, actual)
        # match: idx 0 (1=1), 2 (1=1), 3 (-1=-1) — 3 matches
        # mismatch: idx 1 (1 vs -1), 5 (1 vs -1)
        # neutral: idx 4 (0)
        assert meta[0] == 1
        assert meta[1] == 0
        assert meta[2] == 1
        assert meta[3] == 1
        assert meta[4] == 0  # neutral primary
        assert meta[5] == 0

    def test_temporal_decay_recent_samples_have_higher_weight(self):
        w = tb.temporal_decay_weights(n_samples=100, half_life=20)
        assert len(w) == 100
        assert w[-1] > w[0]  # آخر > اول
        # mean ≈ 1
        assert abs(w.mean() - 1.0) < 1e-6

    def test_volatility_weights_inverse(self):
        vol = np.array([1.0, 2.0, 4.0, 1.0])
        w = tb.compute_sample_weights_by_volatility(vol, method="inverse")
        # high vol → کم وزن
        assert w[2] < w[0]
