"""
Purged K-Fold Cross-Validation — Lopez de Prado (AFML Ch. 7).

منطق متخصص بازار مالی:
    TimeSeriesSplit ساده یک مشکل پنهان دارد. در trading، label هر sample
    معمولاً به future_periods کندل آینده وابسته است (مثلاً target = price
    return در ۴ کندل بعد). این یعنی:

    - sample در index 100 با future_periods=4، به samples 101-104 "نگاه می‌کند"
    - اگر training set شامل index 100 باشد و test set شامل index 101 باشد،
      آن label ها از داده‌ی training "آینده می‌بینند" → lookahead bias

    راه‌حل Lopez de Prado:
        1. Purging: حذف training samples که label آن‌ها در test window می‌افتد
        2. Embargo: یک حاشیه‌ی اضافه بعد از test تا تأثیر serial correlation کاهش

    این روش از over-estimation اعتبار مدل جلوگیری می‌کند.

References:
    Marcos Lopez de Prado, "Advances in Financial Machine Learning" (2018), Ch. 7
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import numpy as np


@dataclass
class PurgedFold:
    """یک fold تولیدشده توسط PurgedKFold."""

    fold_index: int
    train_indices: np.ndarray
    test_indices: np.ndarray
    purged_indices: np.ndarray  # ابتدا train بودند، حذف شدند
    embargo_size: int

    def __post_init__(self):
        # تأیید هیچ overlap بین train و test
        if len(np.intersect1d(self.train_indices, self.test_indices)) > 0:
            raise ValueError("FATAL: train و test overlap دارند — bug در purging")


class PurgedKFold:
    """
    Purged K-Fold CV با embargo برای داده‌ی serial-correlated.

    پارامترها:
        n_splits: تعداد fold ها (پیش‌فرض ۵)
        label_lookforward: تعداد periods که هر label به آینده نگاه می‌کند.
            این معمولاً = forward_periods در feature_engine.build_target.
            مثلاً اگر target = price[t+4] - price[t]، آنگاه lookforward=4.
        embargo_pct: درصد طول test که به‌عنوان embargo حذف شود (پیش‌فرض ۱٪)
    """

    def __init__(
        self,
        n_splits: int = 5,
        label_lookforward: int = 4,
        embargo_pct: float = 0.01,
    ) -> None:
        if n_splits < 2:
            raise ValueError("n_splits باید ≥ 2 باشد.")
        if embargo_pct < 0 or embargo_pct > 0.5:
            raise ValueError("embargo_pct در بازه [0, 0.5] باشد.")
        self.n_splits = n_splits
        self.label_lookforward = label_lookforward
        self.embargo_pct = embargo_pct

    def split(self, n_samples: int) -> Iterator[PurgedFold]:
        """
        تولید fold ها به‌صورت iterator.

        پارامترها:
            n_samples: تعداد کل sample ها (به جای X — index-based)

        خروجی:
            یک generator از PurgedFold
        """
        if n_samples < self.n_splits * 2:
            raise ValueError(
                f"n_samples ({n_samples}) برای {self.n_splits} fold کافی نیست."
            )

        # تقسیم متوالی index به n_splits بخش
        fold_sizes = np.full(self.n_splits, n_samples // self.n_splits, dtype=int)
        fold_sizes[: n_samples % self.n_splits] += 1

        # embargo حداقل به اندازهٔ افق لیبل تا serial-correlation بعد از test هم پوشش یابد
        embargo_size = max(int(n_samples * self.embargo_pct), self.label_lookforward)

        current = 0
        all_indices = np.arange(n_samples)
        boundaries: list[tuple[int, int]] = []
        for fs in fold_sizes:
            boundaries.append((current, current + fs))
            current += fs

        for fold_idx, (test_start, test_end) in enumerate(boundaries):
            test_indices = all_indices[test_start:test_end]

            # سایر indices → کاندید برای train
            train_mask = np.ones(n_samples, dtype=bool)
            train_mask[test_start:test_end] = False

            # ── Walk-forward ──
            # هیچ sample بعد از test window نباید در train باشد (آموزش روی آینده ممنوع).
            train_mask[test_end:] = False

            # ── Purging ──
            # هر sample در train که label آن در test_window می‌افتد، حذف شود.
            # یعنی: training_index + label_lookforward >= test_start
            #   AND training_index < test_start (یعنی قبل از test)
            purge_lower = max(0, test_start - self.label_lookforward)
            if purge_lower < test_start:
                train_mask[purge_lower:test_start] = False

            # ── Embargo ──
            # حذف samples بلافاصله پس از test تا serial correlation کاهش
            embargo_upper = min(n_samples, test_end + embargo_size)
            if test_end < embargo_upper:
                train_mask[test_end:embargo_upper] = False

            train_indices = all_indices[train_mask]
            # walk-forward: fold‌هایی که هیچ نمونه‌ی train قبل از test دارند معنادارند؛
            # fold نخست (test در ابتدای سری) train خالی دارد و باید skip شود — نمی‌توان
            # روی مجموعه‌ی train خالی مدل آموزش داد (رفتار استاندارد TimeSeriesSplit).
            if len(train_indices) == 0:
                continue
            purged_indices = np.setdiff1d(
                all_indices[~train_mask], test_indices, assume_unique=True
            )

            yield PurgedFold(
                fold_index=fold_idx,
                train_indices=train_indices,
                test_indices=test_indices,
                purged_indices=purged_indices,
                embargo_size=embargo_size,
            )

    def get_n_splits(self) -> int:
        return self.n_splits
