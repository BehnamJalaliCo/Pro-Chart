"""Leak-aware feature selection helpers."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class SelectionResult:
    selected_features: list[str]
    pruned_features: list[str]
    n_original: int


def correlation_prune(X: np.ndarray, feature_names: list[str], *, threshold: float = 0.95) -> tuple[list[str], list[str]]:
    corr = np.nan_to_num(np.abs(np.corrcoef(np.asarray(X, dtype=float), rowvar=False)), nan=0.0)
    keep: list[int] = []
    pruned: list[int] = []
    for i in range(corr.shape[0]):
        if any(corr[i, j] >= threshold for j in keep):
            pruned.append(i)
        else:
            keep.append(i)
    return [feature_names[i] for i in keep], [feature_names[i] for i in pruned]


def select_features(X: np.ndarray, y: np.ndarray, feature_names: list[str], *, top_k: int = 20) -> SelectionResult:
    kept, pruned = correlation_prune(X, feature_names)
    indices = [feature_names.index(name) for name in kept]
    scores = [(abs(float(np.corrcoef(np.asarray(X)[:, i], y)[0, 1])) if np.std(X[:, i]) and np.std(y) else 0.0, name) for i, name in zip(indices, kept)]
    scores.sort(reverse=True)
    selected = [name for _, name in scores[:top_k]]
    return SelectionResult(selected_features=selected, pruned_features=pruned, n_original=len(feature_names))
