"""Triple-barrier labels and sample weighting."""

from __future__ import annotations

import numpy as np


def triple_barrier_label(prices: np.ndarray, *, volatility: np.ndarray, upper_mult: float = 2.0, lower_mult: float = 2.0, max_periods: int = 20) -> np.ndarray:
    p = np.asarray(prices, dtype=float); vol = np.asarray(volatility, dtype=float)
    labels = np.zeros(len(p), dtype=int)
    for i in range(len(p)):
        end = min(len(p), i + 1 + max_periods)
        upper = p[i] + abs(vol[i]) * upper_mult
        lower = p[i] - abs(vol[i]) * lower_mult
        for value in p[i + 1:end]:
            if value >= upper:
                labels[i] = 1; break
            if value <= lower:
                labels[i] = -1; break
    return labels


def meta_label_features(primary: np.ndarray, actual: np.ndarray) -> np.ndarray:
    p = np.asarray(primary); a = np.asarray(actual)
    return ((p != 0) & (p == a)).astype(int)


def temporal_decay_weights(n_samples: int, half_life: float = 20.0) -> np.ndarray:
    if n_samples <= 0 or half_life <= 0:
        return np.array([], dtype=float)
    age = np.arange(n_samples - 1, -1, -1, dtype=float)
    w = np.power(0.5, age / half_life)
    return w / w.mean()


def compute_sample_weights_by_volatility(volatility: np.ndarray, *, method: str = "inverse") -> np.ndarray:
    v = np.asarray(volatility, dtype=float)
    if method == "inverse":
        raw = 1.0 / np.maximum(v, 1e-12)
    elif method == "sqrt_inverse":
        raw = 1.0 / np.sqrt(np.maximum(v, 1e-12))
    else:
        raise ValueError(f"unsupported volatility weighting method: {method}")
    return raw / raw.mean()
