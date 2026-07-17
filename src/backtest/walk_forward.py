from __future__ import annotations
from dataclasses import dataclass
from datetime import timedelta
from src.backtest.metrics import calculate_metrics

@dataclass
class WalkForwardFold:
    train_start: object; train_end: object; test_start: object; test_end: object

@dataclass
class WalkForwardResult:
    folds: list; aggregated_oos_metrics: object; config: dict

class WalkForwardValidator:
    def run(self, *, signals, candles_by_symbol_tf, train_window: timedelta, test_window: timedelta, step: timedelta|None=None):
        if not signals: raise ValueError("history too short")
        start=min(s.entry_time for s in signals); end=max(s.entry_time for s in signals)
        if end-start < train_window: raise ValueError("history too short")
        step=step or test_window; folds=[]; cursor=start+train_window
        while cursor <= end:
            folds.append(WalkForwardFold(cursor-train_window,cursor,cursor,min(cursor+test_window,end)))
            cursor += step
        return WalkForwardResult(folds, calculate_metrics([]), {"train_window_days":train_window.days,"test_window_days":test_window.days})
