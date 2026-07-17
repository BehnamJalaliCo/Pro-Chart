from __future__ import annotations
from dataclasses import dataclass
import numpy as np
import pandas as pd
@dataclass
class VolumeProfile: poc_price:float; value_area_low:float; value_area_high:float; bins:object=None
@dataclass
class LiquidityAssessment: is_low_liquidity:bool; is_high_liquidity:bool; average_volume:float; current_volume:float; notes:list[str]
def calculate_vwap(df):
    typical=(df['high']+df['low']+df['close'])/3
    return (typical*df['volume']).cumsum()/df['volume'].cumsum()
def calculate_volume_profile(df,bins=50):
    if len(df)<10:return None
    prices=df['close'].to_numpy(); weights=df['volume'].to_numpy(); hist,edges=np.histogram(prices,bins=bins,weights=weights)
    i=int(np.argmax(hist)); poc=(edges[i]+edges[i+1])/2; total=hist.sum(); order=np.argsort(hist)[::-1]; chosen=[]; acc=0
    for j in order:
        chosen.append(j); acc+=hist[j]
        if acc>=total*.7:break
    return VolumeProfile(float(poc),float(edges[min(chosen)]),float(edges[max(chosen)+1]),hist)
def assess_liquidity(df,pip_size=.0001):
    if len(df)<10:return None
    avg=float(df['volume'].iloc[-20:].mean()); cur=float(df['volume'].iloc[-1]); low=cur<avg*.5; high=cur>avg*1.8
    notes=['حجم کم' if low else 'حجم بالا' if high else 'حجم عادی']
    return LiquidityAssessment(low,high,avg,cur,notes)
