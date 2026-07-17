"""Position sizing with explicit risk caps."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SizeResult:
    lot_size: float
    risk_dollar: float
    risk_pct: float
    cap_reason: str = ""


class PositionSizer:
    def __init__(self, max_risk_per_trade_pct: float = 2.0) -> None:
        self.max_risk_pct = max(0.0, max_risk_per_trade_pct / 100.0)

    def fixed_fractional(self, *, account_equity: float, risk_pct: float, sl_pips: float, pip_dollar_per_lot: float) -> SizeResult:
        requested = max(0.0, risk_pct / 100.0)
        actual = min(requested, self.max_risk_pct)
        risk = account_equity * actual
        lot = risk / (sl_pips * pip_dollar_per_lot) if sl_pips > 0 and pip_dollar_per_lot > 0 else 0.0
        return SizeResult(lot, risk, actual, "capped at max risk" if actual < requested else "")

    def kelly(self, *, account_equity: float, win_rate: float, avg_win: float, avg_loss: float, sl_pips: float, pip_dollar_per_lot: float, fraction: float = 0.25) -> SizeResult:
        b = avg_win / abs(avg_loss) if avg_loss else 0.0
        edge = (b * win_rate - (1.0 - win_rate)) / b if b else 0.0
        if edge <= 0:
            return SizeResult(0.0, 0.0, 0.0, "negative expectancy")
        return self.fixed_fractional(account_equity=account_equity, risk_pct=edge * fraction * 100.0, sl_pips=sl_pips, pip_dollar_per_lot=pip_dollar_per_lot)

    def volatility_target(self, *, account_equity: float, target_annual_vol_pct: float, current_annualized_volatility: float, sl_pips: float, pip_dollar_per_lot: float) -> SizeResult:
        scale = (target_annual_vol_pct / 100.0) / max(current_annualized_volatility, 1e-9)
        requested = self.max_risk_pct * scale
        risk = account_equity * requested
        lot = risk / (sl_pips * pip_dollar_per_lot) if sl_pips > 0 and pip_dollar_per_lot > 0 else 0.0
        return SizeResult(lot, risk, requested, "volatility target scaling")


def reduce_size_for_drawdown(base_lot: float, *, current_drawdown_pct: float, reduction_threshold_pct: float, max_reduction: float = 0.5) -> tuple[float, str]:
    if current_drawdown_pct <= reduction_threshold_pct:
        return base_lot, "no drawdown reduction"
    ratio = min(1.0, (current_drawdown_pct - reduction_threshold_pct) / max(reduction_threshold_pct, 1e-9))
    reduction = min(max_reduction, ratio * max_reduction)
    return base_lot * (1.0 - reduction), f"drawdown reduction {reduction:.2%}"
