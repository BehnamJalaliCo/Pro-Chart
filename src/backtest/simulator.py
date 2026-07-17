"""Conservative OHLC trade simulator with explicit cost accounting."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
import pandas as pd
from src.backtest.cost_model import CostModel

class ExitReason(str, Enum):
    TAKE_PROFIT_1 = "take_profit_1"; TAKE_PROFIT_2 = "take_profit_2"; TAKE_PROFIT_3 = "take_profit_3"
    STOP_LOSS = "stop_loss"; TIMEOUT = "timeout"

@dataclass
class TradeOutcome:
    symbol: str; direction: str; entry_time: datetime; entry_price: float; exit_time: datetime; exit_price: float
    exit_reason: ExitReason; lot_size: float; gross_pips: float = 0.0; spread_cost_pips: float = 0.0; slippage_cost_pips: float = 0.0
    net_pips: float = 0.0; gross_pnl_dollar: float = 0.0; commission_dollar: float = 0.0; swap_dollar: float = 0.0
    net_pnl_dollar: float = 0.0; r_multiple: float = 0.0; duration_minutes: int = 0; candles_held: int = 0
    tags: dict[str, Any] = field(default_factory=dict)

class TradeSimulator:
    def __init__(self, cost_model: CostModel, max_bars: int = 100) -> None:
        self.cost_model, self.max_bars = cost_model, max_bars
    def simulate(self, *, symbol, direction, entry_time, entry_price_mid, sl, tp1, tp2, tp3, future_candles: pd.DataFrame, lot_size=1.0, tags=None):
        p = self.cost_model.profile(symbol); entry = self.cost_model.apply_entry_slippage(symbol, direction, entry_price_mid)
        chosen = None; reason = ExitReason.TIMEOUT; held = 0
        for _, row in future_candles.head(self.max_bars).iterrows():
            held += 1; o, h, l = float(row["open"]), float(row["high"]), float(row["low"])
            if direction == "long":
                if o <= sl or l <= sl: chosen, reason = (o if o <= sl else self.cost_model.apply_stop_slippage(symbol, direction, sl)), ExitReason.STOP_LOSS; break
                if tp1 is not None and h >= tp1: chosen, reason = float(tp1), ExitReason.TAKE_PROFIT_1; break
                if tp2 is not None and h >= tp2: chosen, reason = float(tp2), ExitReason.TAKE_PROFIT_2; break
                if tp3 is not None and h >= tp3: chosen, reason = float(tp3), ExitReason.TAKE_PROFIT_3; break
            else:
                if o >= sl or h >= sl: chosen, reason = (o if o >= sl else self.cost_model.apply_stop_slippage(symbol, direction, sl)), ExitReason.STOP_LOSS; break
                if tp1 is not None and l <= tp1: chosen, reason = float(tp1), ExitReason.TAKE_PROFIT_1; break
                if tp2 is not None and l <= tp2: chosen, reason = float(tp2), ExitReason.TAKE_PROFIT_2; break
                if tp3 is not None and l <= tp3: chosen, reason = float(tp3), ExitReason.TAKE_PROFIT_3; break
        if chosen is None:
            last = future_candles.head(self.max_bars).iloc[-1] if len(future_candles.head(self.max_bars)) else {"close": entry_price_mid, "timestamp": entry_time}
            chosen, exit_time = float(last["close"]), last.get("timestamp", entry_time)
        else: exit_time = row.get("timestamp", entry_time)
        sign = 1 if direction == "long" else -1; gross_pips = sign * (chosen - entry_price_mid) / p.pip_size
        spread = p.spread_pips; slip = abs(entry-entry_price_mid)/p.pip_size + (p.stop_slippage_pips if reason == ExitReason.STOP_LOSS else 0)
        net_pips = gross_pips - spread - slip; gross = gross_pips * p.pip_dollar_per_lot * lot_size
        commission = self.cost_model.commission_round_turn(symbol, lot_size); swap = self.cost_model.swap_cost_dollar(symbol, direction, entry_time, exit_time, lot_size)
        net = net_pips * p.pip_dollar_per_lot * lot_size - commission + swap
        risk = abs(entry_price_mid-sl)/p.pip_size
        return TradeOutcome(symbol, direction, entry_time, entry, exit_time, chosen, reason, lot_size, gross_pips, spread, slip, net_pips, gross, commission, swap, net, net_pips/risk if risk else 0.0, max(0, int((exit_time-entry_time).total_seconds()/60)), held, tags or {})
