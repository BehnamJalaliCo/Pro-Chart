"""
متریک‌های ارزیابی ML برای trading — به‌جای accuracy/F1.

منطق متخصص بازار:
    مدلی با accuracy=60% ممکن است P&L منفی داشته باشد و مدلی با
    accuracy=52% ممکن است سود ساز باشد. در trading، معیار درست
    "آیا predict ها به PnL تبدیل می‌شوند؟" است نه "آیا class درست را زدیم؟"

    بنابراین این ماژول متریک‌های زیر را ارائه می‌دهد:
        - PnL-weighted accuracy: weight هر prediction = |future_return|
        - Sharpe ratio (annualized)
        - Profit factor
        - Win/loss expectancy
        - Information coefficient (rank correlation با future return)
        - Hit rate per regime (trending vs ranging)

استفاده:
    from src.ml.financial_metrics import financial_evaluate
    score = financial_evaluate(y_true_class, y_pred_class, future_returns)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Sequence

import numpy as np


@dataclass
class FinancialMetrics:
    """متریک‌های مالی یک مدل classifier."""

    n_samples: int = 0
    n_long_predictions: int = 0
    n_short_predictions: int = 0
    n_neutral_predictions: int = 0

    # PnL-based
    total_return: float = 0.0
    mean_return_per_trade: float = 0.0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    expectancy: float = 0.0

    # Information
    information_coefficient: float = 0.0
    """رابطه‌ی رتبه بین prediction confidence و actual return"""

    # Direction accuracy (سنتی) برای reference
    directional_accuracy: float = 0.0
    pnl_weighted_accuracy: float = 0.0

    # Drawdown
    max_drawdown_pct: float = 0.0

    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "n_samples": self.n_samples,
            "n_long_predictions": self.n_long_predictions,
            "n_short_predictions": self.n_short_predictions,
            "n_neutral_predictions": self.n_neutral_predictions,
            "total_return": round(self.total_return, 4),
            "mean_return_per_trade": round(self.mean_return_per_trade, 5),
            "win_rate": round(self.win_rate, 4),
            "profit_factor": round(self.profit_factor, 3),
            "sharpe_ratio": round(self.sharpe_ratio, 3),
            "sortino_ratio": round(self.sortino_ratio, 3),
            "expectancy": round(self.expectancy, 5),
            "information_coefficient": round(self.information_coefficient, 4),
            "directional_accuracy": round(self.directional_accuracy, 4),
            "pnl_weighted_accuracy": round(self.pnl_weighted_accuracy, 4),
            "max_drawdown_pct": round(self.max_drawdown_pct, 4),
            "notes": list(self.notes),
        }


# ── target_class قرارداد ──────────────────────────────────
# مطابق feature_engine.py:
#   0 = Short, 1 = Neutral, 2 = Long
SHORT_CLASS = 0
NEUTRAL_CLASS = 1
LONG_CLASS = 2


def _class_to_direction(cls: int) -> int:
    """0 → -1, 1 → 0, 2 → +1"""
    if cls == LONG_CLASS:
        return 1
    if cls == SHORT_CLASS:
        return -1
    return 0


def financial_evaluate(
    y_true_class: Sequence[int],
    y_pred_class: Sequence[int],
    future_returns: Sequence[float],
    confidence: Sequence[float] | None = None,
    periods_per_year: int = 252,
) -> FinancialMetrics:
    """
    ارزیابی مالی یک classifier روی future returns.

    پارامترها:
        y_true_class: کلاس واقعی (0/1/2)
        y_pred_class: کلاس پیش‌بینی‌شده (0/1/2)
        future_returns: بازده مستقیم آینده برای هر sample (نه pct، خود number)
        confidence: اعتماد به pred (برای IC). اگر None، uniform استفاده می‌شود.
        periods_per_year: تعداد bar در سال برای annualize Sharpe/Sortino.
            این مقدار باید با resolution کندل‌ها مطابقت داشته باشد، نه پیش‌فرض روزانه:
            پیش‌فرض ۲۵۲ فقط برای کندل روزانه (D1) درست است؛ برای intraday باید
            متناسب بزرگ‌تر باشد (مثلاً M15 → 252*96، H1 → 252*24، H4 → 252*6).
            استفاده از ۲۵۲ روی کندل intraday، Sharpe را تا چند برابر کم‌برآورد
            می‌کند و ممکن است مدل معتبر را پشت min_sharpe رد کند.

    خروجی:
        FinancialMetrics
    """
    n = len(y_true_class)
    if n == 0:
        return FinancialMetrics(notes=["empty input"])
    if not (len(y_pred_class) == n and len(future_returns) == n):
        raise ValueError("طول تمام sequence ها باید برابر باشد.")

    metrics = FinancialMetrics(n_samples=n)

    y_true_arr = np.asarray(y_true_class)
    y_pred_arr = np.asarray(y_pred_class)
    rets = np.asarray(future_returns, dtype=float)

    # شمارش جهت‌ها
    metrics.n_long_predictions = int(np.sum(y_pred_arr == LONG_CLASS))
    metrics.n_short_predictions = int(np.sum(y_pred_arr == SHORT_CLASS))
    metrics.n_neutral_predictions = int(np.sum(y_pred_arr == NEUTRAL_CLASS))

    # PnL برای هر sample: direction × future_return
    pred_direction = np.array([_class_to_direction(c) for c in y_pred_arr])
    pnls = pred_direction * rets

    # فقط trade شده‌ها (نه neutral)
    trade_mask = pred_direction != 0
    n_trades = int(trade_mask.sum())
    traded_pnls = pnls[trade_mask] if n_trades > 0 else np.array([])

    metrics.total_return = float(traded_pnls.sum())

    if n_trades > 0:
        metrics.mean_return_per_trade = float(traded_pnls.mean())
        wins = int((traded_pnls > 0).sum())
        metrics.win_rate = wins / n_trades

        gross_profit = float(traded_pnls[traded_pnls > 0].sum())
        gross_loss = float(-traded_pnls[traded_pnls < 0].sum())
        metrics.profit_factor = (
            gross_profit / gross_loss if gross_loss > 0 else math.inf
        )

        # سالانه‌سازی بر اساس «تعداد معاملات در سال» (نه فرکانس بار) —
        # traded_pnls بازده per-trade است؛ ضریب درست sqrt(trades/year) است.
        trades_per_year = (n_trades * periods_per_year / n) if n > 0 else periods_per_year
        ann = math.sqrt(max(trades_per_year, 1e-9))

        # Sharpe (sample-based، annualized با فرکانس واقعی معاملات)
        if n_trades > 1 and traded_pnls.std(ddof=1) > 0:
            metrics.sharpe_ratio = float(
                traded_pnls.mean() / traded_pnls.std(ddof=1) * ann
            )

        # Sortino — downside deviation روی «تمام» معاملات (min(r,0)^2)، نه فقط بازنده‌ها
        downside_dev = float(np.sqrt((np.minimum(traded_pnls, 0.0) ** 2).mean()))
        if downside_dev > 0:
            metrics.sortino_ratio = float(traded_pnls.mean() / downside_dev * ann)

        # Expectancy
        avg_win = float(traded_pnls[traded_pnls > 0].mean()) if wins > 0 else 0.0
        avg_loss = (
            float(traded_pnls[traded_pnls < 0].mean()) if (n_trades - wins) > 0 else 0.0
        )
        metrics.expectancy = (
            metrics.win_rate * avg_win + (1 - metrics.win_rate) * avg_loss
        )

        # Max drawdown
        # equity را با 0.0 شروع می‌کنیم تا در fold های تماماً زیان‌ده،
        # peak هرگز در 0 گیر نکند و drawdown صفر گزارش نشود.
        equity = np.concatenate(([0.0], np.cumsum(traded_pnls)))
        peak = np.maximum.accumulate(equity)
        # جایی که peak <= 0 است (هنوز هیچ سودی ثبت نشده)، خود زیان انباشته
        # را به‌عنوان drawdown گزارش می‌کنیم تا fold زیان‌ده نامرئی نشود.
        dd = np.where(peak > 0, (peak - equity) / peak, equity * -1)
        metrics.max_drawdown_pct = float(dd.max())

    # Directional accuracy (سنتی) — برای reference
    true_direction = np.array([_class_to_direction(c) for c in y_true_arr])
    matches = (pred_direction == true_direction).astype(float)
    metrics.directional_accuracy = float(matches.mean())

    # PnL-weighted accuracy: weight = |future_return|
    weights = np.abs(rets)
    if weights.sum() > 0:
        metrics.pnl_weighted_accuracy = float(
            (matches * weights).sum() / weights.sum()
        )

    # Information Coefficient (rank correlation)
    if confidence is not None and len(confidence) == n:
        try:
            conf = np.asarray(confidence, dtype=float)
            # signed confidence: + برای long، - برای short
            signed_conf = conf * pred_direction
            # Spearman rank correlation با future return
            ic = _spearman_corr(signed_conf, rets)
            metrics.information_coefficient = float(ic)
        except Exception:
            metrics.information_coefficient = 0.0

    if n_trades == 0:
        metrics.notes.append(
            "هیچ trade ای انجام نشد — تمام پیش‌بینی‌ها neutral بودند."
        )

    return metrics


def _spearman_corr(x: np.ndarray, y: np.ndarray) -> float:
    """Spearman rank correlation بدون scipy."""
    if len(x) < 2:
        return 0.0
    rx = _rankdata(x)
    ry = _rankdata(y)
    rx_mean = rx.mean()
    ry_mean = ry.mean()
    num = float(((rx - rx_mean) * (ry - ry_mean)).sum())
    den = float(np.sqrt(((rx - rx_mean) ** 2).sum() * ((ry - ry_mean) ** 2).sum()))
    if den == 0:
        return 0.0
    return num / den


def _rankdata(arr: np.ndarray) -> np.ndarray:
    """Rank هر عنصر — handle ties با میانگین."""
    n = len(arr)
    sorted_idx = np.argsort(arr, kind="mergesort")
    ranks = np.empty(n, dtype=float)
    i = 0
    while i < n:
        j = i + 1
        # find ties
        while j < n and arr[sorted_idx[j]] == arr[sorted_idx[i]]:
            j += 1
        rank_avg = (i + j + 1) / 2.0  # 1-indexed average
        for k in range(i, j):
            ranks[sorted_idx[k]] = rank_avg
        i = j
    return ranks


# ── کنترل کیفیت ────────────────────────────────────────────


def is_model_tradable(
    metrics: FinancialMetrics,
    min_sharpe: float = 0.5,
    min_profit_factor: float = 1.2,
    min_trades: int = 30,
    max_drawdown: float = 0.3,
) -> tuple[bool, list[str]]:
    """
    بررسی اینکه آیا مدل آماده‌ی trade شدن است.

    این تابع به‌عنوان gate قبل از deployment استفاده می‌شود.
    """
    reasons: list[str] = []
    n_trades = (
        metrics.n_long_predictions + metrics.n_short_predictions
    )
    if n_trades < min_trades:
        reasons.append(f"تعداد trade ها ({n_trades}) کمتر از {min_trades}.")
    if metrics.sharpe_ratio < min_sharpe:
        reasons.append(
            f"Sharpe ({metrics.sharpe_ratio:.2f}) کمتر از حداقل {min_sharpe}."
        )
    if metrics.profit_factor != math.inf and metrics.profit_factor < min_profit_factor:
        reasons.append(
            f"Profit factor ({metrics.profit_factor:.2f}) کمتر از {min_profit_factor}."
        )
    if metrics.max_drawdown_pct > max_drawdown:
        reasons.append(
            f"Max drawdown ({metrics.max_drawdown_pct:.1%}) بیش از {max_drawdown:.0%}."
        )
    return len(reasons) == 0, reasons
