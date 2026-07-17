"""Deterministic trade performance metrics."""
from __future__ import annotations
from dataclasses import dataclass, field
from collections import defaultdict
from typing import Any

@dataclass
class Metrics:
    total_trades: int = 0; winning_trades: int = 0; losing_trades: int = 0; win_rate: float = 0.0
    profit_factor: float = 0.0; max_drawdown_dollar: float = 0.0; longest_losing_streak: int = 0
    by_symbol: dict[str, "Metrics"] = field(default_factory=dict)
    total_pnl: float = 0.0

def calculate_metrics(trades, group_by_symbol=False):
    m=Metrics(total_trades=len(trades)); equity=peak=0.0; streak=0; gains=losses=0.0
    for t in trades:
        pnl=float(t.net_pnl_dollar); m.total_pnl += pnl; equity += pnl; peak=max(peak,equity); m.max_drawdown_dollar=max(m.max_drawdown_dollar,peak-equity)
        if pnl>0: m.winning_trades+=1; gains+=pnl; streak=0
        else: m.losing_trades+=1; losses+=abs(pnl); streak+=1; m.longest_losing_streak=max(m.longest_losing_streak,streak)
    m.win_rate=m.winning_trades/m.total_trades if m.total_trades else 0.0; m.profit_factor=gains/losses if losses else (float("inf") if gains else 0.0)
    if group_by_symbol:
        groups=defaultdict(list)
        for t in trades: groups[t.symbol].append(t)
        m.by_symbol={k:calculate_metrics(v) for k,v in groups.items()}
    return m

def attribute_by_tag(trades, key):
    groups=defaultdict(list)
    for t in trades:
        value=(t.tags or {}).get(key)
        if value is not None: groups[value].append(t)
    return {k:calculate_metrics(v) for k,v in groups.items()}
