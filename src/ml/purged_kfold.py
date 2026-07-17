"""Walk-forward purged and embargoed time-series folds."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Fold:
    train_indices: np.ndarray
    test_indices: np.ndarray


class PurgedKFold:
    def __init__(self, n_splits: int = 5, label_lookforward: int = 0, embargo_pct: float = 0.0) -> None:
        if n_splits < 2:
            raise ValueError("n_splits must be >= 2")
        self.n_splits = n_splits
        self.label_lookforward = max(0, int(label_lookforward))
        self.embargo_pct = max(0.0, float(embargo_pct))

    def split(self, n_samples: int):
        if n_samples <= self.n_splits:
            raise ValueError("n_samples must be greater than n_splits")
        edges = np.linspace(0, n_samples, self.n_splits + 1, dtype=int)
        embargo = int(n_samples * self.embargo_pct)
        for i in range(self.n_splits):
            test_start, test_end = edges[i], edges[i + 1]
            train_end = max(0, test_start - self.label_lookforward)
            if train_end <= 0:
                if self.label_lookforward == 0:
                    future_start = min(n_samples, test_end + embargo)
                    future = np.arange(future_start, n_samples)
                    if future.size:
                        yield Fold(train_indices=future, test_indices=np.arange(test_start, test_end))
                continue
            train = np.arange(0, train_end)
            if i < self.n_splits - 1 and embargo:
                post_start = test_end
                post_end = min(n_samples, post_start + embargo)
                train = train[train < post_start]
                # future samples are not part of walk-forward train; explicit for clarity
                train = train[train < post_end]
            yield Fold(train_indices=train, test_indices=np.arange(test_start, test_end))
