"""Pure risk-level calculation for signal previews and execution gates."""

from __future__ import annotations

from typing import Any


class RiskManager:
    """Calculate deterministic SL/TP levels from ATR and nearby structure."""

    def calculate_levels(
        self,
        *,
        entry_price: float,
        direction: str,
        atr: float,
        nearest_support: float | None = None,
        nearest_resistance: float | None = None,
        symbol: str = "",
    ) -> dict[str, Any]:
        if entry_price <= 0 or atr <= 0:
            raise ValueError("entry_price and atr must be positive")
        side = direction.lower()
        if side not in {"long", "short"}:
            raise ValueError("direction must be long or short")
        risk = max(float(atr) * 1.5, 1e-9)
        if side == "long":
            sl = min(entry_price - risk, nearest_support) if nearest_support and nearest_support < entry_price else entry_price - risk
            levels = (entry_price + risk, entry_price + 2 * risk, entry_price + 3 * risk)
        else:
            sl = max(entry_price + risk, nearest_resistance) if nearest_resistance and nearest_resistance > entry_price else entry_price + risk
            levels = (entry_price - risk, entry_price - 2 * risk, entry_price - 3 * risk)
        return {"symbol": symbol, "direction": side, "entry_price": entry_price, "sl": round(sl, 8), "tp1": round(levels[0], 8), "tp2": round(levels[1], 8), "tp3": round(levels[2], 8)}
