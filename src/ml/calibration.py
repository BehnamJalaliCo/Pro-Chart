"""Probability calibration utilities."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression


class PlattCalibrator:
    def __init__(self) -> None:
        self._model: LogisticRegression | None = None

    def fit(self, probabilities: np.ndarray, y_true: np.ndarray) -> "PlattCalibrator":
        p = np.clip(np.asarray(probabilities, dtype=float), 1e-6, 1 - 1e-6)
        x = np.log(p / (1 - p)).reshape(-1, 1)
        self._model = LogisticRegression(solver="lbfgs").fit(x, np.asarray(y_true, dtype=int))
        return self

    def transform(self, probabilities: np.ndarray) -> np.ndarray:
        if self._model is None:
            raise RuntimeError("calibrator must be fit before transform")
        p = np.clip(np.asarray(probabilities, dtype=float), 1e-6, 1 - 1e-6)
        return self._model.predict_proba(np.log(p / (1 - p)).reshape(-1, 1))[:, 1]


class IsotonicCalibrator:
    def __init__(self) -> None:
        self._model = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")
        self._fit = False

    def fit(self, probabilities: np.ndarray, y_true: np.ndarray) -> "IsotonicCalibrator":
        self._model.fit(np.asarray(probabilities, dtype=float), np.asarray(y_true, dtype=float))
        self._fit = True
        return self

    def transform(self, probabilities: np.ndarray) -> np.ndarray:
        if not self._fit:
            raise RuntimeError("calibrator must be fit before transform")
        return np.asarray(self._model.predict(np.asarray(probabilities, dtype=float)))


@dataclass
class CalibrationReport:
    ece: float
    brier_score: float


def calibration_report(probabilities: np.ndarray, y_true: np.ndarray, *, n_bins: int = 10) -> CalibrationReport:
    p = np.clip(np.asarray(probabilities, dtype=float), 0, 1)
    y = np.asarray(y_true, dtype=float)
    edges = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        mask = (p >= edges[i]) & ((p < edges[i + 1]) if i < n_bins - 1 else (p <= edges[i + 1]))
        if mask.any():
            ece += float(mask.mean()) * abs(float(p[mask].mean()) - float(y[mask].mean()))
    return CalibrationReport(ece=ece, brier_score=float(np.mean((p - y) ** 2)))
