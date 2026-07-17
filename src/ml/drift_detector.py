"""Statistical drift checks for features and model predictions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np
from scipy.stats import ks_2samp, entropy


@dataclass
class FeatureDriftReport:
    features_drifted: int
    details: list[dict]
    recommendation: str


def ks_test_2sample(x: Sequence[float], y: Sequence[float]) -> tuple[float, float]:
    stat, p = ks_2samp(np.asarray(x, dtype=float), np.asarray(y, dtype=float))
    return float(stat), float(p)


def detect_feature_drift(train: np.ndarray, live: np.ndarray, *, feature_names: Sequence[str], alpha: float = 0.01) -> FeatureDriftReport:
    details = []
    for idx, name in enumerate(feature_names):
        stat, p = ks_test_2sample(train[:, idx], live[:, idx])
        details.append({"feature": name, "ks": stat, "p_value": p, "drifted": p < alpha})
    count = sum(bool(d["drifted"]) for d in details)
    recommendation = "Retrain model: severe feature drift detected" if count >= max(1, len(details) // 2) else "OK: no material feature drift"
    return FeatureDriftReport(features_drifted=count, details=details, recommendation=recommendation)


def detect_prediction_drift(train_preds: Sequence[int], live_preds: Sequence[int], *, n_classes: int) -> dict:
    train = np.bincount(np.asarray(train_preds, dtype=int), minlength=n_classes).astype(float)
    live = np.bincount(np.asarray(live_preds, dtype=int), minlength=n_classes).astype(float)
    train /= max(train.sum(), 1.0); live /= max(live.sum(), 1.0)
    kl = float(entropy(live + 1e-12, train + 1e-12))
    return {"is_drift": kl > 0.1, "kl_divergence": kl, "train_distribution": train.tolist(), "live_distribution": live.tolist()}
