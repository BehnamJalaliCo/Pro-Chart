"""Regulatory leverage and margin validation."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Regulator(str, Enum):
    FCA = "FCA"
    NFA = "NFA"


@dataclass
class MarginResult:
    allowed: bool
    reason: str
    required_margin: float
    margin_level_pct: float


def max_leverage_for(regulator: Regulator, instrument_category: str) -> float:
    if instrument_category == "fx_major":
        return 30.0 if regulator == Regulator.FCA else 50.0
    return 20.0 if regulator == Regulator.FCA else 30.0


def validate_margin(*, instrument_category: str, lot_size: float, entry_price: float, account_equity: float, used_margin: float, regulator: Regulator, requested_leverage: float | None = None, stop_out_level_pct: float = 50.0) -> MarginResult:
    maximum = max_leverage_for(regulator, instrument_category)
    leverage = requested_leverage or maximum
    if leverage > maximum:
        return MarginResult(False, f"{regulator.value} leverage exceeds limit", 0.0, 0.0)
    notional = abs(lot_size) * 100_000.0 * abs(entry_price)
    required = notional / leverage
    total = used_margin + required
    level = account_equity / total * 100.0 if total > 0 else float("inf")
    if required + used_margin > account_equity:
        return MarginResult(False, "insufficient margin", required, level)
    if level < stop_out_level_pct * 2:
        return MarginResult(False, "margin level close to stop-out", required, level)
    return MarginResult(True, "within margin limits", required, level)
