"""
بهینه‌سازی Bayesian وزن‌های scorer با Optuna.

منطق متخصص بازار:
    وزن‌های پیش‌فرض scorer (technical=0.4, pattern=0.3, ml=0.3) از
    آسمان نازل نشده‌اند — باید روی داده‌ی تاریخی به‌صورت تجربی پیدا
    شوند. این وزن‌ها همچنین per-symbol متفاوت‌اند:
        XAUUSD: pattern و price action مهم‌تر از ML
        EURUSD: تکنیکال و ML بهتر کار می‌کنند
        Indices: trend-following روی H4 قوی‌تر

    Bayesian optimization (Optuna با TPE sampler) صدها ترکیب وزن را
    روی نتایج بک‌تست تست می‌کند و بهترین را پیدا می‌کند.

نکته‌ی بحرانی: optimization باید روی *out-of-sample* انجام شود.
ما از WalkForwardValidator استفاده می‌کنیم تا overfit نشویم.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Callable, Optional, Sequence

import optuna

from src.backtest.engine import BacktestEngine, BacktestSignal
from src.backtest.walk_forward import WalkForwardValidator
from src.core.logger import get_logger

logger = get_logger(__name__)


@dataclass
class OptimizationResult:
    """نتیجه‌ی یک optimization."""

    symbol: str
    best_params: dict[str, float]
    best_value: float
    n_trials: int
    objective_name: str
    study_summary: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "best_params": dict(self.best_params),
            "best_value": round(self.best_value, 4),
            "n_trials": self.n_trials,
            "objective_name": self.objective_name,
            "study_summary": dict(self.study_summary),
        }


# ── توابع objective ─────────────────────────────────────────


def sharpe_objective(metrics: Any) -> float:
    """Sharpe ratio خروجی بک‌تست."""
    return float(getattr(metrics, "sharpe_ratio", 0.0))


def profit_factor_objective(metrics: Any) -> float:
    """profit factor — با cap روی inf."""
    pf = float(getattr(metrics, "profit_factor", 0.0))
    return min(pf, 20.0) if pf != float("inf") else 20.0


def expectancy_r_objective(metrics: Any) -> float:
    """expectancy in R-multiples (per-trade)."""
    return float(getattr(metrics, "expectancy_r", 0.0))


def calmar_objective(metrics: Any) -> float:
    """Calmar — penalize drawdown."""
    return float(getattr(metrics, "calmar_ratio", 0.0))


# ترکیب چندهدفه: weighted blend
def blended_objective(metrics: Any) -> float:
    """
    ترکیب چندین معیار با تأکید روی stability:
        0.4 × sharpe + 0.3 × calmar + 0.3 × expectancy_r

    این برای جلوگیری از over-fit به یک معیار خاص است.
    """
    sharpe = float(getattr(metrics, "sharpe_ratio", 0.0))
    calmar = float(getattr(metrics, "calmar_ratio", 0.0))
    exp_r = float(getattr(metrics, "expectancy_r", 0.0))
    return 0.4 * sharpe + 0.3 * calmar + 0.3 * exp_r


# ── Scorer Weight Optimizer ───────────────────────────────


@dataclass
class ScorerWeightsParams:
    """فضای پارامتر scorer weights."""

    technical_weight: float
    pattern_weight: float
    ml_weight: float
    multi_tf_bonus: float
    against_trend_penalty: float

    def normalize(self) -> "ScorerWeightsParams":
        """نرمال‌سازی وزن‌های اصلی به جمع ۱."""
        total = self.technical_weight + self.pattern_weight + self.ml_weight
        if total <= 0:
            return self
        return ScorerWeightsParams(
            technical_weight=self.technical_weight / total,
            pattern_weight=self.pattern_weight / total,
            ml_weight=self.ml_weight / total,
            multi_tf_bonus=self.multi_tf_bonus,
            against_trend_penalty=self.against_trend_penalty,
        )


def optimize_scorer_weights(
    signals_with_scores: Sequence[tuple[BacktestSignal, dict[str, float]]],
    candles_by_symbol_tf: dict[tuple[str, str], Any],
    symbol: str,
    n_trials: int = 50,
    objective: Callable[[Any], float] = blended_objective,
    objective_name: str = "blended",
    walk_forward: bool = True,
    seed: int = 42,
) -> OptimizationResult:
    """
    بهینه‌سازی وزن‌های scorer برای یک نماد.

    پارامترها:
        signals_with_scores: لیست (signal, score_components) — هر signal
            باید technical_score/pattern_score/ml_score خام داشته باشد
            تا با وزن‌های جدید بازآرایی شود.
        candles_by_symbol_tf: کندل‌های تاریخی برای بک‌تست
        symbol: نماد مورد بهینه‌سازی
        n_trials: تعداد iteration های Optuna
        objective: تابع هدف
        objective_name: نام برای ثبت
        walk_forward: اگر True، روی walk-forward fold ها — جلوگیری از overfit
        seed: برای reproducibility

    این تابع از خود signals_with_scores می‌سازد:
        BacktestSignal جدید با signal_score = weighted combination و سپس
        فیلتر بر اساس threshold ها.
    """
    if not signals_with_scores:
        raise ValueError("لیست سیگنال خالی است.")

    sampler = optuna.samplers.TPESampler(seed=seed)
    study = optuna.create_study(direction="maximize", sampler=sampler)

    def _trial(trial: optuna.Trial) -> float:
        # فضای پارامتر
        tech_w = trial.suggest_float("technical_weight", 0.1, 0.6)
        pat_w = trial.suggest_float("pattern_weight", 0.1, 0.6)
        ml_w = trial.suggest_float("ml_weight", 0.1, 0.6)
        score_threshold = trial.suggest_int("score_threshold", 60, 85)

        params = ScorerWeightsParams(
            technical_weight=tech_w,
            pattern_weight=pat_w,
            ml_weight=ml_w,
            multi_tf_bonus=5.0,
            against_trend_penalty=-10.0,
        ).normalize()

        # ساخت سیگنال‌های جدید با وزن‌های جدید و threshold
        new_signals = []
        for sig, scores in signals_with_scores:
            tech = scores.get("technical_score", 50)
            pat = scores.get("pattern_score", 50)
            ml = scores.get("ml_score", 50)
            new_score = (
                tech * params.technical_weight
                + pat * params.pattern_weight
                + ml * params.ml_weight
            )
            if new_score < score_threshold:
                continue  # filter شده
            new_signals.append(
                BacktestSignal(
                    symbol=sig.symbol,
                    direction=sig.direction,
                    entry_time=sig.entry_time,
                    entry_price=sig.entry_price,
                    sl=sig.sl,
                    tp1=sig.tp1,
                    tp2=sig.tp2,
                    tp3=sig.tp3,
                    lot_size=sig.lot_size,
                    technical_score=tech,
                    pattern_score=pat,
                    ml_score=ml,
                    signal_score=new_score,
                    metadata=dict(sig.metadata),
                )
            )

        if not new_signals:
            return -10.0  # penalty شدید — وزن‌هایی که هیچ سیگنالی نمی‌گذرند

        # اجرا
        try:
            if walk_forward:
                wf = WalkForwardValidator()
                # حداقل ۹۰ روز برای fold (۶۰ train + ۳۰ test)
                result = wf.run(
                    signals=new_signals,
                    candles_by_symbol_tf=candles_by_symbol_tf,
                    train_window=timedelta(days=60),
                    test_window=timedelta(days=30),
                )
                metrics = result.aggregated_oos_metrics
            else:
                engine = BacktestEngine()
                bt = engine.run(
                    name=f"opt_trial_{trial.number}",
                    signals=new_signals,
                    candles_by_symbol_tf=candles_by_symbol_tf,
                )
                metrics = bt.metrics

            value = objective(metrics)
            # log در trial state
            trial.set_user_attr("total_trades", metrics.total_trades)
            trial.set_user_attr("win_rate", metrics.win_rate)
            trial.set_user_attr("profit_factor", metrics.profit_factor)
            return value
        except Exception as exc:
            logger.warning("optuna_trial_failed", trial=trial.number, error=str(exc))
            return -5.0

    study.optimize(_trial, n_trials=n_trials, show_progress_bar=False)

    return OptimizationResult(
        symbol=symbol,
        best_params=dict(study.best_params),
        best_value=float(study.best_value),
        n_trials=n_trials,
        objective_name=objective_name,
        study_summary={
            "best_trial_attrs": dict(study.best_trial.user_attrs),
            "all_values": [t.value for t in study.trials if t.value is not None],
        },
    )
