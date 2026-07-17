"""Volatility-adjusted execution cost model."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ExecutionResult:
    rejected: bool
    filled_lot: float
    entry_price_actual: float
    spread_pips: float
    slippage_pips: float


@dataclass
class VolatilityAdjustedCostModel:
    base_spread_pips: float = 0.8
    base_slippage_pips: float = 0.4
    large_order_threshold_lot: float = 10.0
    max_rejection_probability: float = 0.25

    @classmethod
    def default(cls) -> "VolatilityAdjustedCostModel":
        return cls()

    def adjusted_spread_pips(self, symbol: str, volatility_percentile: float) -> float:
        return self.base_spread_pips * (1.0 + 4.0 * max(0.0, min(1.0, volatility_percentile)))

    def adjusted_stop_slippage_pips(self, symbol: str, volatility_percentile: float) -> float:
        return self.base_slippage_pips * (1.0 + 3.0 * max(0.0, min(1.0, volatility_percentile)))

    def estimate_fill_percentage(self, symbol: str, lot_size: float, volatility_percentile: float) -> float:
        if lot_size <= self.large_order_threshold_lot:
            return 1.0
        return max(0.1, self.large_order_threshold_lot / lot_size) * (1.0 - 0.25 * max(0.0, min(1.0, volatility_percentile)))

    def rejection_probability(self, lot_size: float, volatility_percentile: float) -> float:
        size_factor = max(0.0, lot_size / max(self.large_order_threshold_lot, 1e-9) - 0.5)
        return min(self.max_rejection_probability, 0.02 + 0.12 * max(0.0, min(1.0, volatility_percentile)) + 0.02 * size_factor)

    def simulate_execution(self, *, symbol: str, direction: str, mid_price: float, lot_size: float, volatility_percentile: float, deterministic: bool = False) -> ExecutionResult:
        reject = False if deterministic else self.rejection_probability(lot_size, volatility_percentile) > 0.5
        spread = self.adjusted_spread_pips(symbol, volatility_percentile)
        slippage = self.adjusted_stop_slippage_pips(symbol, volatility_percentile)
        fill = 0.0 if reject else lot_size * self.estimate_fill_percentage(symbol, lot_size, volatility_percentile)
        pip = 0.0001 if mid_price < 10 else 0.01
        sign = 1 if direction.lower() == "long" else -1
        actual = mid_price + sign * (spread / 2 + slippage) * pip
        return ExecutionResult(reject, fill, actual, spread, slippage)
