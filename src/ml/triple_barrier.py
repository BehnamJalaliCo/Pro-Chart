"""
Triple Barrier Method — Lopez de Prado labeling (AFML Ch. 3).

منطق متخصص بازار:
    Labeling سنتی (return بعد از N کندل) دو مشکل دارد:
        1. Class imbalance: اکثر returns کوچک‌اند → Neutral اشباع می‌شود
        2. Lookahead arbitrary: چرا N=4؟ چرا نه N=10؟

    Triple barrier:
        - upper barrier: price + k * volatility (take-profit مفروض)
        - lower barrier: price - k * volatility (stop-loss مفروض)
        - vertical barrier: t + max_periods (timeout)

    Label = اولین barrier که touch می‌شود:
        +1 → upper hit (long would win)
        -1 → lower hit (long would lose)
         0 → timeout (no clear signal)

    این روش binary است (long/short) ولی می‌توان meta-label اضافه کرد:
    "آیا این پیش‌بینی direction قابل اعتماد است؟" — این جلوی false signals
    را می‌گیرد.

References:
    Marcos Lopez de Prado, "Advances in Financial Machine Learning" (2018), Ch. 3
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd


def triple_barrier_label(
    prices: pd.Series | np.ndarray,
    volatility: pd.Series | np.ndarray | None = None,
    upper_mult: float = 2.0,
    lower_mult: float = 2.0,
    max_periods: int = 20,
    min_periods: int = 1,
) -> np.ndarray:
    """
    تولید triple-barrier labels برای هر sample.

    پارامترها:
        prices: سری قیمت‌ها (close معمولاً)
        volatility: ATR یا rolling std — اگر None، rolling std محاسبه می‌شود
        upper_mult: ضریب برای upper barrier (default 2× vol = ~95th percentile move)
        lower_mult: ضریب برای lower barrier
        max_periods: حداکثر period تا timeout (vertical barrier)
        min_periods: حداقل period قبل از barrier check

    خروجی:
        ndarray با shape (n,) شامل {-1, 0, +1}
            +1 = upper hit first
            -1 = lower hit first
             0 = vertical timeout
    """
    p = np.asarray(prices, dtype=float)
    n = len(p)
    if n == 0:
        return np.array([], dtype=int)

    # محاسبه volatility اگر داده نشده
    if volatility is None:
        # rolling std بازده ۲۰-period
        s = pd.Series(p)
        returns = s.pct_change()
        vol = returns.rolling(20).std().ffill().fillna(returns.std()).values
        # volatility به قیمت‌ها برمی‌گردد: vol_price = vol_return * price
        vol = vol * p
    else:
        vol = np.asarray(volatility, dtype=float)
        if len(vol) != n:
            raise ValueError("طول volatility باید با prices برابر باشد.")

    labels = np.zeros(n, dtype=int)

    for i in range(n - 1):
        if vol[i] <= 0:
            labels[i] = 0
            continue

        upper = p[i] + upper_mult * vol[i]
        lower = p[i] - lower_mult * vol[i]
        end = min(n, i + max_periods + 1)

        # بررسی هر barrier
        for j in range(i + min_periods, end):
            if p[j] >= upper:
                labels[i] = +1
                break
            if p[j] <= lower:
                labels[i] = -1
                break
        # اگر هیچ‌کدام hit نشد، label = 0 (timeout)

    # آخرین sample کافی نیست برای lookforward
    labels[-1] = 0
    return labels


def meta_label_features(
    primary_predictions: np.ndarray,
    triple_barrier_labels: np.ndarray,
) -> np.ndarray:
    """
    تولید meta-labels: "آیا primary prediction درست بوده؟"

    پارامترها:
        primary_predictions: pred از مدل اولیه ({-1, 0, +1})
        triple_barrier_labels: true labels از triple barrier ({-1, 0, +1})

    خروجی:
        ndarray (n,) با {0, 1}
            1 = primary prediction درست بود (در همان جهت hit شد)
            0 = primary prediction غلط بود یا neutral

    استفاده:
        مرحله ۱) primary model: predict جهت
        مرحله ۲) meta model: predict "آیا این prediction قابل اعتماد است؟"
        فقط اگر meta_pred=1 معامله انجام شود.
        نتیجه: precision بهتر به قیمت recall کمتر.
    """
    primary = np.asarray(primary_predictions, dtype=int)
    actual = np.asarray(triple_barrier_labels, dtype=int)
    if len(primary) != len(actual):
        raise ValueError("طول primary و actual باید برابر باشد.")

    # meta_label = 1 اگر جهت‌ها match کرده‌اند و نه neutral
    same_direction = (primary != 0) & (primary == actual)
    return same_direction.astype(int)


def compute_sample_weights_by_volatility(
    volatility: np.ndarray,
    method: str = "inverse",
) -> np.ndarray:
    """
    وزن sample ها بر اساس volatility.

    منطق:
        - inverse (پیش‌فرض): دوره‌ی low-volatility سیگنال شفاف‌تر دارد
          → وزن بیشتر
        - direct: دوره‌ی high-volatility informative‌تر → وزن بیشتر

    این یک trade-off است؛ AFML "direct" را پیشنهاد می‌کند چون
    high-volatility periods برای trading مفیدترند.
    """
    vol = np.asarray(volatility, dtype=float)
    vol = np.where(vol > 0, vol, vol[vol > 0].mean() if (vol > 0).any() else 1.0)
    if method == "inverse":
        w = 1.0 / vol
    elif method == "direct":
        w = vol
    else:
        raise ValueError(f"method ناشناخته: {method}")
    # normalize so mean=1
    return w / w.mean() if w.mean() > 0 else w


def temporal_decay_weights(
    n_samples: int,
    half_life: int = 500,
) -> np.ndarray:
    """
    وزن exponential decay برای temporal samples.

    رفتار:
        - sample جدید (آخر)  → وزن ~1
        - sample قدیم        → وزن exp(-Δ / half_life)
        - normalize: mean=1

    پارامترها:
        n_samples: تعداد کل samples (مرتب از قدیم به جدید)
        half_life: تعداد period که وزن نصف می‌شود
    """
    if n_samples <= 0:
        return np.array([])
    ages = np.arange(n_samples - 1, -1, -1, dtype=float)
    w = np.exp(-ages * np.log(2) / half_life)
    return w / w.mean() if w.mean() > 0 else w
