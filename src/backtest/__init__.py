"""
ماژول بک‌تست — اعتبارسنجی استراتژی روی داده‌ی تاریخی.

شامل:
    - مدل هزینه (spread, commission, slippage, swap)
    - شبیه‌ساز معامله
    - متریک‌های عملکرد
    - موتور بک‌تست و walk-forward validation
    - تخصیص (attribution) به اجزای سیگنال
"""

from src.backtest.cost_model import CostModel, SymbolCostProfile
from src.backtest.metrics import PerformanceMetrics, calculate_metrics
from src.backtest.simulator import TradeOutcome, TradeSimulator
from src.backtest.engine import BacktestEngine, BacktestResult
from src.backtest.walk_forward import WalkForwardValidator

__all__ = [
    "CostModel",
    "SymbolCostProfile",
    "PerformanceMetrics",
    "calculate_metrics",
    "TradeOutcome",
    "TradeSimulator",
    "BacktestEngine",
    "BacktestResult",
    "WalkForwardValidator",
]
