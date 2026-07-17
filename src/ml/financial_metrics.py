"""Financial evaluation metrics for directional model predictions."""

from __future__ import annotations

from dataclasses import dataclass, field
from math import sqrt
from typing import Sequence

import numpy as np


@dataclass
class FinancialMetrics:
    n_samples: int = 0
    total_return: float = 0.0
    win_rate: float = 0.0
    directional_accuracy: float = 0.0
    n_long_predictions: int = 0
    n_short_predictions: int = 0
    profit_factor: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown_pct: float = 0.0
    notes: list[str] = field(default_factory=list)


def financial_evaluate(y_true_class: Sequence[int], y_pred_class: Sequence[int], future_returns: Sequence[float]) -> FinancialMetrics:
    n = min(len(y_true_class), len(y_pred_class), len(future_returns))
    if not n:
        return FinancialMetrics(notes=["No samples"])
    true = np.asarray(y_true_class[:n]); pred = np.asarray(y_pred_class[:n]); ret = np.asarray(future_returns[:n], dtype=float)
    active = np.isin(pred, [0, 2])
    pnl = np.where(pred == 2, ret, np.where(pred == 0, -ret, 0.0))
    trades = pnl[active]
    wins, losses = trades[trades > 0], trades[trades < 0]
    directional = active & (pred == true)
    directional_accuracy = float(np.mean(directional[active])) if active.any() else 0.0
    total = float(pnl.sum())
    pf = float(wins.sum() / abs(losses.sum())) if losses.size and losses.sum() else float("inf") if wins.size else 0.0
    sharpe = float(np.mean(trades) / np.std(trades, ddof=1) * sqrt(252)) if trades.size > 1 and np.std(trades, ddof=1) else 0.0
    curve = np.cumsum(pnl); peak = np.maximum.accumulate(curve) if curve.size else np.array([0.0])
    dd = float(np.max(peak - curve)) if curve.size else 0.0
    return FinancialMetrics(n_samples=n, total_return=total, win_rate=float(np.mean(trades > 0)) if trades.size else 0.0, directional_accuracy=directional_accuracy, n_long_predictions=int((pred == 2).sum()), n_short_predictions=int((pred == 0).sum()), profit_factor=pf, sharpe_ratio=sharpe, max_drawdown_pct=dd, notes=["No trades: neutral predictions only"] if not trades.size else [])


def is_model_tradable(metrics: FinancialMetrics, *, min_sharpe: float = 0.5, min_trades: int = 30, min_profit_factor: float = 1.0) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if metrics.sharpe_ratio < min_sharpe:
        reasons.append(f"Sharpe below threshold: {metrics.sharpe_ratio:.2f}")
    if metrics.n_long_predictions + metrics.n_short_predictions < min_trades:
        reasons.append("Not enough trades")
    if metrics.profit_factor < min_profit_factor:
        reasons.append("Profit factor below threshold")
    return not reasons, reasons
