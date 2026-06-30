"""
Probability Calibration — Platt scaling و isotonic regression.

منطق متخصص بازار:
    XGBoost/LightGBM روی classification، probability ها را به‌صورت raw
    sigmoid output برمی‌گردانند که معمولاً over-confident هستند:
    "confidence=0.95" واقعاً ۹۵٪ احتمال درست بودن نیست — شاید فقط ۸۰٪.

    این مهم است چون risk_manager به confidence اعتماد می‌کند:
        - position size = f(confidence)
        - threshold برای trade = confidence > 0.7

    اگر confidence calibrated نباشد، تصمیمات سایز معامله غلط می‌شوند.

    دو روش استاندارد:
        - Platt scaling: sigmoid fit روی validation set
        - Isotonic regression: non-parametric، نیاز به sample بیشتر

    این ماژول هر دو را با interface شبیه sklearn ارائه می‌دهد.

References:
    Platt (1999), Niculescu-Mizil & Caruana (2005)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np


@dataclass
class ReliabilityBin:
    """یک bin از reliability diagram."""

    bin_low: float
    bin_high: float
    mean_predicted: float
    mean_actual: float
    count: int

    def to_dict(self) -> dict:
        return {
            "bin_low": round(self.bin_low, 3),
            "bin_high": round(self.bin_high, 3),
            "mean_predicted": round(self.mean_predicted, 4),
            "mean_actual": round(self.mean_actual, 4),
            "count": self.count,
        }


@dataclass
class CalibrationReport:
    """گزارش کیفیت calibration."""

    ece: float  # Expected Calibration Error
    mce: float  # Maximum Calibration Error
    brier_score: float
    bins: list[ReliabilityBin] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "ece": round(self.ece, 4),
            "mce": round(self.mce, 4),
            "brier_score": round(self.brier_score, 4),
            "is_well_calibrated": self.ece < 0.05,
            "bins": [b.to_dict() for b in self.bins],
        }


# ───────────────── Calibrators ─────────────────────────


class PlattCalibrator:
    """
    Platt scaling — fit یک sigmoid روی validation predictions.

    p_calibrated = 1 / (1 + exp(a * raw_prob + b))
    """

    def __init__(self) -> None:
        self.a: float = 0.0
        self.b: float = 0.0
        self.fitted: bool = False

    def fit(self, raw_probs: np.ndarray, y_true: np.ndarray) -> "PlattCalibrator":
        """
        Fit a, b با gradient descent ساده روی log-loss.
        """
        raw = np.asarray(raw_probs, dtype=float).clip(1e-6, 1 - 1e-6)
        y = np.asarray(y_true, dtype=float)
        if len(raw) != len(y):
            raise ValueError("طول raw_probs و y_true باید برابر باشد.")

        # Initial: a=1, b=0
        a, b = 1.0, 0.0
        lr = 0.05
        for _ in range(500):
            z = a * raw + b
            p = 1.0 / (1.0 + np.exp(-z))
            grad_a = float(np.mean((p - y) * raw))
            grad_b = float(np.mean(p - y))
            a -= lr * grad_a
            b -= lr * grad_b
            if abs(grad_a) < 1e-6 and abs(grad_b) < 1e-6:
                break

        # کلیپ a به مقدار غیرمنفی: a منفی sigmoid را معکوس می‌کند و باعث
        # کوچک‌شدن position size در بالاترین confidence می‌شود.
        a = max(0.0, a)

        self.a = a
        self.b = b
        self.fitted = True
        return self

    def transform(self, raw_probs: np.ndarray) -> np.ndarray:
        """تبدیل probability خام به calibrated."""
        if not self.fitted:
            raise RuntimeError("PlattCalibrator هنوز fit نشده.")
        raw = np.asarray(raw_probs, dtype=float).clip(1e-6, 1 - 1e-6)
        z = self.a * raw + self.b
        return 1.0 / (1.0 + np.exp(-z))


class IsotonicCalibrator:
    """
    Isotonic regression calibration — non-parametric، monotonic.

    مزیت: distribution-free، بهتر برای داده‌های with non-sigmoid distortion
    عیب: نیاز به sample بیشتر (>500) برای stable result
    """

    def __init__(self) -> None:
        self._x: np.ndarray = np.array([])  # sorted unique probs
        self._y: np.ndarray = np.array([])  # calibrated values
        self.fitted: bool = False

    def fit(self, raw_probs: np.ndarray, y_true: np.ndarray) -> "IsotonicCalibrator":
        """Fit با pool adjacent violators algorithm (PAV)."""
        raw = np.asarray(raw_probs, dtype=float)
        y = np.asarray(y_true, dtype=float)
        if len(raw) != len(y):
            raise ValueError("طول raw_probs و y_true باید برابر باشد.")

        # sort by raw probability
        order = np.argsort(raw, kind="stable")
        x_sorted = raw[order]
        y_sorted = y[order]

        # PAV: حفظ monotonicity با merge کردن adjacent violators
        # ساختار: lists از (sum_y, count) برای هر block
        sums = list(y_sorted.astype(float))
        counts = [1] * len(y_sorted)

        i = 0
        while i < len(sums) - 1:
            if sums[i] / counts[i] > sums[i + 1] / counts[i + 1]:
                # violation — merge i و i+1
                sums[i] += sums[i + 1]
                counts[i] += counts[i + 1]
                del sums[i + 1]
                del counts[i + 1]
                # backtrack
                if i > 0:
                    i -= 1
            else:
                i += 1

        # ساخت stepwise function
        out_y = []
        out_x = []
        idx = 0
        for s, c in zip(sums, counts):
            avg = s / c
            block_x = x_sorted[idx:idx + c]
            out_x.append(block_x.mean())
            out_y.append(avg)
            idx += c

        self._x = np.array(out_x)
        self._y = np.array(out_y)
        self.fitted = True
        return self

    def transform(self, raw_probs: np.ndarray) -> np.ndarray:
        """Linear interpolation روی monotonic regression."""
        if not self.fitted:
            raise RuntimeError("IsotonicCalibrator هنوز fit نشده.")
        raw = np.asarray(raw_probs, dtype=float)
        return np.interp(raw, self._x, self._y)


# ───────────────── Evaluation ──────────────────────────


def calibration_report(
    probs: np.ndarray,
    y_true: np.ndarray,
    n_bins: int = 10,
) -> CalibrationReport:
    """
    گزارش reliability diagram + ECE + Brier score.

    ECE = میانگین وزنی |confidence - accuracy| روی bin ها
    MCE = حداکثر |confidence - accuracy| روی bin ها
    Brier = mean squared error
    """
    probs = np.asarray(probs, dtype=float)
    y = np.asarray(y_true, dtype=float)
    n = len(probs)
    if n == 0:
        return CalibrationReport(ece=0.0, mce=0.0, brier_score=0.0)

    bin_edges = np.linspace(0, 1, n_bins + 1)
    bins: list[ReliabilityBin] = []
    ece = 0.0
    mce = 0.0

    for i in range(n_bins):
        low, high = bin_edges[i], bin_edges[i + 1]
        if i == n_bins - 1:
            mask = (probs >= low) & (probs <= high)
        else:
            mask = (probs >= low) & (probs < high)
        count = int(mask.sum())
        if count == 0:
            continue
        mean_pred = float(probs[mask].mean())
        mean_actual = float(y[mask].mean())
        bins.append(ReliabilityBin(
            bin_low=low,
            bin_high=high,
            mean_predicted=mean_pred,
            mean_actual=mean_actual,
            count=count,
        ))
        gap = abs(mean_pred - mean_actual)
        ece += (count / n) * gap
        if gap > mce:
            mce = gap

    brier = float(np.mean((probs - y) ** 2))

    return CalibrationReport(ece=ece, mce=mce, brier_score=brier, bins=bins)
