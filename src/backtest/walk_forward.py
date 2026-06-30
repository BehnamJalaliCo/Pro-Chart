"""
Walk-forward validation — اعتبارسنجی استراتژی روی پنجره‌های متوالی.

منطق متخصص بازار:
    Walk-forward از مهم‌ترین تکنیک‌های اعتبارسنجی استراتژی است چون
    overfit را آشکار می‌کند: مدل/استراتژی روی هر فولد روی داده‌ی
    قدیم آموزش/تنظیم می‌شود و روی داده‌ی *آینده* تست می‌گردد.

    دو نوع walk-forward:
        - anchored: شروع آموزش ثابت، پایان آن جلو می‌رود
        - rolling: پنجره‌ی train با اندازه‌ی ثابت روی زمان slide می‌کند
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable, Dict, List, Optional, Sequence

import pandas as pd

from src.backtest.cost_model import CostModel
from src.backtest.engine import BacktestEngine, BacktestResult, BacktestSignal
from src.backtest.metrics import PerformanceMetrics, calculate_metrics
from src.backtest.simulator import TradeOutcome


@dataclass
class WalkForwardFold:
    """یک فولد walk-forward."""

    fold_index: int
    train_start: datetime
    train_end: datetime
    test_start: datetime
    test_end: datetime
    test_signals: int
    test_trades: int
    test_metrics: PerformanceMetrics

    def to_dict(self) -> dict:
        return {
            "fold_index": self.fold_index,
            "train_start": self.train_start.isoformat(),
            "train_end": self.train_end.isoformat(),
            "test_start": self.test_start.isoformat(),
            "test_end": self.test_end.isoformat(),
            "test_signals": self.test_signals,
            "test_trades": self.test_trades,
            "test_metrics": self.test_metrics.to_dict(),
        }


@dataclass
class WalkForwardResult:
    """نتیجه‌ی کلی walk-forward."""

    folds: List[WalkForwardFold]
    aggregated_oos_metrics: PerformanceMetrics
    config: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "fold_count": len(self.folds),
            "folds": [f.to_dict() for f in self.folds],
            "aggregated_oos_metrics": self.aggregated_oos_metrics.to_dict(),
            "config": dict(self.config),
        }


class WalkForwardValidator:
    """
    اعتبارسنج walk-forward.

    استراتژی پیش‌فرض: rolling window
        train_window: پنجره‌ی آموزش
        test_window: پنجره‌ی تست (out-of-sample)
        step: مقدار حرکت rolling
    """

    def __init__(
        self,
        cost_model: Optional[CostModel] = None,
        initial_balance: float = 10_000.0,
        risk_per_trade_pct: float = 1.0,
    ) -> None:
        self._cost = cost_model or CostModel.default()
        self._initial_balance = initial_balance
        self._risk_per_trade_pct = risk_per_trade_pct

    def run(
        self,
        signals: Sequence[BacktestSignal],
        candles_by_symbol_tf: Dict[tuple[str, str], pd.DataFrame],
        train_window: timedelta,
        test_window: timedelta,
        step: Optional[timedelta] = None,
        primary_timeframe: str = "H1",
        on_train: Optional[Callable[[List[BacktestSignal]], None]] = None,
    ) -> WalkForwardResult:
        """
        اجرای walk-forward.

        پارامترها:
            signals: تمام سیگنال‌ها (به ترتیب زمانی)
            candles_by_symbol_tf: کندل‌های تاریخی
            train_window: طول پنجره‌ی آموزش
            test_window: طول پنجره‌ی تست
            step: گام rolling (پیش‌فرض = test_window → folds non-overlapping)
            primary_timeframe: تایم‌فریم اصلی
            on_train: callback اختیاری در ابتدای هر فولد —
                      گیرنده‌ی سیگنال‌های train. (مثلاً برای retrain ML)

        خروجی:
            WalkForwardResult
        """
        if not signals:
            raise ValueError("لیست سیگنال خالی است.")
        if step is None:
            step = test_window

        sorted_sigs = sorted(signals, key=lambda s: s.entry_time)
        history_start = sorted_sigs[0].entry_time
        history_end = sorted_sigs[-1].entry_time

        if history_end - history_start < train_window + test_window:
            raise ValueError(
                "تاریخچه برای حتی یک فولد walk-forward کافی نیست. "
                "train+test باید کمتر از طول تاریخچه باشد."
            )

        engine = BacktestEngine(
            cost_model=self._cost,
            initial_balance=self._initial_balance,
        )

        folds: List[WalkForwardFold] = []
        all_oos_trades: List[TradeOutcome] = []

        fold_idx = 0
        train_start = history_start
        while True:
            train_end = train_start + train_window
            test_start = train_end
            test_end = test_start + test_window

            if test_end > history_end:
                break

            train_sigs = [s for s in sorted_sigs if train_start <= s.entry_time < train_end]
            test_sigs = [s for s in sorted_sigs if test_start <= s.entry_time < test_end]

            if on_train is not None:
                # فرصت retrain ML روی train_sigs (در نسخه‌ی بعد، روی کندل‌ها)
                on_train(train_sigs)

            if test_sigs:
                bt = engine.run(
                    name=f"wf_fold_{fold_idx}",
                    signals=test_sigs,
                    candles_by_symbol_tf=candles_by_symbol_tf,
                    primary_timeframe=primary_timeframe,
                    risk_per_trade_pct=self._risk_per_trade_pct,
                )
                fold_metrics = bt.metrics
                fold_trades = bt.trades
                all_oos_trades.extend(fold_trades)
            else:
                fold_metrics = PerformanceMetrics()
                fold_trades = []

            folds.append(
                WalkForwardFold(
                    fold_index=fold_idx,
                    train_start=train_start,
                    train_end=train_end,
                    test_start=test_start,
                    test_end=test_end,
                    test_signals=len(test_sigs),
                    test_trades=len(fold_trades),
                    test_metrics=fold_metrics,
                )
            )
            fold_idx += 1
            train_start = train_start + step

        aggregated = calculate_metrics(all_oos_trades)

        return WalkForwardResult(
            folds=folds,
            aggregated_oos_metrics=aggregated,
            config={
                "train_window_days": train_window.days,
                "test_window_days": test_window.days,
                "step_days": step.days,
                "primary_timeframe": primary_timeframe,
                "n_folds": len(folds),
            },
        )
