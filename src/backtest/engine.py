from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from src.backtest.cost_model import CostModel
from src.backtest.simulator import TradeSimulator, TradeOutcome
from src.backtest.metrics import calculate_metrics, attribute_by_tag

@dataclass
class BacktestSignal:
    symbol: str; direction: str; entry_time: datetime; entry_price: float; sl: float; tp1: float; tp2: float|None=None; tp3: float|None=None
    technical_score: float=0.0; pattern_score: float=0.0; ml_score: float=0.0; signal_score: float=0.0
    def dominant_component(self):
        vals={"technical":self.technical_score,"pattern":self.pattern_score,"ml":self.ml_score}; mx=max(vals.values())
        return "mixed" if list(vals.values()).count(mx)>1 else max(vals,key=vals.get)

@dataclass
class BacktestResult:
    name: str; initial_balance: float; final_balance: float; total_signals: int; trades: list[TradeOutcome]
    attribution_by_component: dict = field(default_factory=dict)

class BacktestEngine:
    def __init__(self, initial_balance=10000.0, cost_model=None): self.initial_balance=initial_balance; self.cost_model=cost_model or CostModel.default()
    def _calculate_lot_size(self, signal, balance, risk_pct=1.0):
        p=self.cost_model.profile(signal.symbol); risk=abs(signal.entry_price-signal.sl)/p.pip_size
        return (balance*risk_pct/100)/(risk*p.pip_dollar_per_lot) if risk else 0.0
    def run(self, name, signals, candles_by_symbol_tf, primary_timeframe="H1"):
        sim=TradeSimulator(self.cost_model); trades=[]
        for s in signals:
            candles=candles_by_symbol_tf.get((s.symbol,primary_timeframe))
            if candles is None: continue
            future=candles[candles["timestamp"]>s.entry_time]
            t=sim.simulate(symbol=s.symbol,direction=s.direction,entry_time=s.entry_time,entry_price_mid=s.entry_price,sl=s.sl,tp1=s.tp1,tp2=s.tp2,tp3=s.tp3,future_candles=future,lot_size=self._calculate_lot_size(s,self.initial_balance),tags={"dominant_component":s.dominant_component()})
            trades.append(t)
        return BacktestResult(name,self.initial_balance,self.initial_balance+sum(t.net_pnl_dollar for t in trades),len(signals),trades,attribute_by_tag(trades,"dominant_component"))
