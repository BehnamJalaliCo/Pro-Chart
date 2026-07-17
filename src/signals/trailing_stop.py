from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
import pandas as pd
class TrailingStage(str,Enum): INITIAL='initial'; BREAKEVEN='breakeven'; LOCKED_TP1='locked_tp1'
@dataclass
class TrailingState:
    direction:str; entry_price:float; initial_sl:float; current_sl:float; stage:TrailingStage; tp1_price:float; tp2_price:float; tp3_price:float|None=None
def chandelier_exit(df,direction,atr,multiplier=3.,lookback=22):
    if len(df)<lookback:return None
    return float(df['high'].tail(lookback).max()-atr*multiplier if direction=='long' else df['low'].tail(lookback).min()+atr*multiplier)
def update_trailing(state,current_price):
    s=TrailingState(**vars(state))
    if s.direction=='long':
        if s.stage is TrailingStage.INITIAL and current_price>=s.tp1_price:s.stage=TrailingStage.BREAKEVEN;s.current_sl=max(s.current_sl,s.entry_price)
        elif s.stage is TrailingStage.BREAKEVEN and current_price>=s.tp2_price:s.stage=TrailingStage.LOCKED_TP1;s.current_sl=max(s.current_sl,s.tp1_price)
    else:
        if s.stage is TrailingStage.INITIAL and current_price<=s.tp1_price:s.stage=TrailingStage.BREAKEVEN;s.current_sl=min(s.current_sl,s.entry_price)
        elif s.stage is TrailingStage.BREAKEVEN and current_price<=s.tp2_price:s.stage=TrailingStage.LOCKED_TP1;s.current_sl=min(s.current_sl,s.tp1_price)
    return s
