"""
تشخیص distribution drift — feature drift و prediction drift.

منطق متخصص:
    وقتی بازار تغییر می‌کند (regime change)، توزیع feature ها از
    train period به live period تغییر می‌کند. اگر این تغییر بزرگ
    باشد، مدل degradation پیدا می‌کند.

    Kolmogorov-Smirnov test روی هر feature: اگر p-value < 0.05 و
    KS statistic > 0.2، drift آماری معنادار است.

    سه نوع drift:
        1. Feature drift: X distribution تغییر کرده
        2. Prediction drift: y_pred distribution تغییر کرده (output)
        3. Concept drift: relationship X→y broken — تشخیص از label نیاز

    این ماژول روی drift های ۱ و ۲ تمرکز دارد.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np


@dataclass
class FeatureDriftReport:
    """گزارش drift یک feature."""

    feature_name: str
    ks_statistic: float
    p_value: float
    is_drift: bool
    severity: str  # "none" | "mild" | "moderate" | "severe"
    train_mean: float
    train_std: float
    live_mean: float
    live_std: float

    def to_dict(self) -> dict:
        return {
            "feature_name": self.feature_name,
            "ks_statistic": round(self.ks_statistic, 4),
            "p_value": round(self.p_value, 4),
            "is_drift": self.is_drift,
            "severity": self.severity,
            "train_mean": round(self.train_mean, 5),
            "train_std": round(self.train_std, 5),
            "live_mean": round(self.live_mean, 5),
            "live_std": round(self.live_std, 5),
        }


@dataclass
class DriftReport:
    """گزارش کلی drift تمام features."""

    features_checked: int = 0
    features_drifted: int = 0
    per_feature: list[FeatureDriftReport] = field(default_factory=list)
    overall_drift_score: float = 0.0
    """میانگین KS statistic روی تمام features"""
    recommendation: str = ""

    def to_dict(self) -> dict:
        return {
            "features_checked": self.features_checked,
            "features_drifted": self.features_drifted,
            "drift_ratio": (
                round(self.features_drifted / self.features_checked, 3)
                if self.features_checked > 0 else 0.0
            ),
            "overall_drift_score": round(self.overall_drift_score, 4),
            "recommendation": self.recommendation,
            "per_feature": [f.to_dict() for f in self.per_feature],
        }


def ks_test_2sample(x: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """
    Kolmogorov-Smirnov 2-sample test — بدون scipy.

    خروجی: (KS_statistic, approximate_p_value)
    """
    x = np.sort(np.asarray(x, dtype=float))
    y = np.sort(np.asarray(y, dtype=float))
    n1, n2 = len(x), len(y)
    if n1 == 0 or n2 == 0:
        return 0.0, 1.0

    # ECDF برای هر sample در نقاط مشترک
    all_vals = np.concatenate([x, y])
    all_vals.sort()

    cdf_x = np.searchsorted(x, all_vals, side="right") / n1
    cdf_y = np.searchsorted(y, all_vals, side="right") / n2

    ks_stat = float(np.max(np.abs(cdf_x - cdf_y)))

    # approximate p-value با Marsaglia–Tsang–Wang formula
    # for KS distribution. این تقریب کافی برای n1+n2 > 20 است.
    en = math.sqrt(n1 * n2 / (n1 + n2))
    lam = (en + 0.12 + 0.11 / en) * ks_stat
    p_value = _ks_p_value(lam)
    return ks_stat, p_value


def _ks_p_value(lam: float) -> float:
    """
    P-value برای KS با Q(λ) = 2 Σ (-1)^(j-1) exp(-2 j² λ²)
    """
    if lam <= 0:
        return 1.0
    s = 0.0
    fac = 2.0
    for j in range(1, 101):
        term = fac * math.exp(-2.0 * j * j * lam * lam)
        s += term
        if abs(term) < 1e-10:
            break
        fac = -fac
    return min(1.0, max(0.0, s))


import math  # noqa: E402 — used by ks_test_2sample


def _severity(ks_stat: float, p_value: float) -> tuple[bool, str]:
    """تعیین severity بر اساس KS statistic و p-value."""
    if p_value >= 0.05:
        return False, "none"
    if ks_stat < 0.1:
        return False, "none"
    if ks_stat < 0.2:
        return True, "mild"
    if ks_stat < 0.35:
        return True, "moderate"
    return True, "severe"


def detect_feature_drift(
    train_features: np.ndarray | list[list[float]],
    live_features: np.ndarray | list[list[float]],
    feature_names: Optional[list[str]] = None,
    ks_threshold: float = 0.1,
    p_threshold: float = 0.05,
    severe_drift_ratio: float = 0.3,
) -> DriftReport:
    """
    تشخیص drift در feature distributions.

    پارامترها:
        train_features: ماتریس (n_train × n_features) — training data
        live_features: ماتریس (n_live × n_features) — recent live data
        feature_names: نام feature ها (اختیاری)
        ks_threshold: حداقل KS برای حساب کردن drift
        p_threshold: حداکثر p-value برای significant
        severe_drift_ratio: اگر این درصد features drift شده باشند، retrain توصیه می‌شود

    خروجی:
        DriftReport
    """
    train_arr = np.asarray(train_features, dtype=float)
    live_arr = np.asarray(live_features, dtype=float)

    if train_arr.ndim == 1:
        train_arr = train_arr.reshape(-1, 1)
    if live_arr.ndim == 1:
        live_arr = live_arr.reshape(-1, 1)

    n_features = train_arr.shape[1]
    if live_arr.shape[1] != n_features:
        raise ValueError(
            f"تعداد feature ها برابر نیست: train={n_features}, live={live_arr.shape[1]}"
        )

    if feature_names is None:
        feature_names = [f"f{i}" for i in range(n_features)]
    elif len(feature_names) != n_features:
        raise ValueError("طول feature_names با تعداد features برابر نیست.")

    report = DriftReport(features_checked=0)
    ks_stats: list[float] = []

    for i, name in enumerate(feature_names):
        train_col = train_arr[:, i]
        live_col = live_arr[:, i]
        # NaN ها را حذف کن
        train_col = train_col[~np.isnan(train_col)]
        live_col = live_col[~np.isnan(live_col)]
        if len(train_col) < 10 or len(live_col) < 10:
            continue

        # فقط feature هایی که واقعاً تست شدند در denominator حساب می‌شوند
        report.features_checked += 1
        ks_stat, p_value = ks_test_2sample(train_col, live_col)
        is_drift, severity = _severity(ks_stat, p_value)
        # حد آستانه‌ی final
        if ks_stat < ks_threshold or p_value > p_threshold:
            is_drift = False
            severity = "none"

        ks_stats.append(ks_stat)
        if is_drift:
            report.features_drifted += 1

        report.per_feature.append(FeatureDriftReport(
            feature_name=name,
            ks_statistic=ks_stat,
            p_value=p_value,
            is_drift=is_drift,
            severity=severity,
            train_mean=float(train_col.mean()),
            train_std=float(train_col.std()),
            live_mean=float(live_col.mean()),
            live_std=float(live_col.std()),
        ))

    report.overall_drift_score = float(np.mean(ks_stats)) if ks_stats else 0.0

    # recommendation
    drift_ratio = (
        report.features_drifted / report.features_checked
        if report.features_checked > 0 else 0.0
    )
    if drift_ratio >= severe_drift_ratio:
        report.recommendation = (
            f"retrain — {drift_ratio:.0%} features drift دارند."
        )
    elif drift_ratio >= severe_drift_ratio / 2:
        report.recommendation = (
            f"monitor — {drift_ratio:.0%} features drift دارند، در مرز قابل‌توجه."
        )
    else:
        report.recommendation = "ok — drift قابل قبول."

    return report


def detect_prediction_drift(
    train_predictions: np.ndarray | list[int],
    live_predictions: np.ndarray | list[int],
    n_classes: int = 3,
) -> dict:
    """
    تشخیص drift در توزیع پیش‌بینی‌ها (output drift).

    قبل از evaluate ML output، اگر توزیع class predictions تغییر کرده،
    حتی اگر accuracy خوب باشد، رفتار مدل تغییر کرده.

    خروجی: dict شامل KL-divergence و class shifts
    """
    train_arr = np.asarray(train_predictions, dtype=int)
    live_arr = np.asarray(live_predictions, dtype=int)

    # توزیع class ها
    train_dist = np.bincount(train_arr, minlength=n_classes).astype(float)
    live_dist = np.bincount(live_arr, minlength=n_classes).astype(float)

    train_dist = train_dist / train_dist.sum() if train_dist.sum() > 0 else train_dist
    live_dist = live_dist / live_dist.sum() if live_dist.sum() > 0 else live_dist

    # KL divergence: Σ p log(p/q)
    eps = 1e-10
    kl = float(np.sum(train_dist * np.log((train_dist + eps) / (live_dist + eps))))

    # تغییر در هر class
    class_shifts = {
        f"class_{i}_shift": float(live_dist[i] - train_dist[i])
        for i in range(n_classes)
    }

    return {
        "kl_divergence": round(kl, 4),
        "train_distribution": train_dist.tolist(),
        "live_distribution": live_dist.tolist(),
        "is_drift": kl > 0.1,
        **class_shifts,
    }
