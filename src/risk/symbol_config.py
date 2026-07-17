"""Per-instrument risk thresholds with conservative unknown fallback."""
from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class SymbolConfig:
    symbol: str
    atr_sl_multiplier: float = 2.0
    min_rr_tp1: float = 1.5
    max_sl_pips: float = 100.0
    max_position_pct: float = 1.0

_CONFIGS = {
    "EURUSD": SymbolConfig("EURUSD", 2.0, 1.5, 80.0),
    "XAUUSD": SymbolConfig("XAUUSD", 2.8, 1.5, 500.0),
    "GBPJPY": SymbolConfig("GBPJPY", 2.5, 1.5, 220.0),
    "USDJPY": SymbolConfig("USDJPY", 2.1, 1.5, 120.0),
}
_FALLBACK = SymbolConfig("UNKNOWN", 2.0, 1.5, 150.0)

def get_symbol_config(symbol: str) -> SymbolConfig:
    return _CONFIGS.get(symbol.upper(), _FALLBACK)
