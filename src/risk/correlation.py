from __future__ import annotations
from dataclasses import dataclass
from collections import defaultdict
_KNOWN={"EURUSD":("EUR","USD"),"GBPUSD":("GBP","USD"),"AUDUSD":("AUD","USD"),"NZDUSD":("NZD","USD"),"GBPJPY":("GBP","JPY"),"USDCHF":("USD","CHF")}
def decompose_currency_legs(symbol,direction):
    s=symbol.upper()
    if s.startswith("XAU") or s.startswith("XAG"): return {s[:3]:1 if direction=="long" else -1,"USD":-1 if direction=="long" else 1}
    if s not in _KNOWN:return {}
    base,quote=_KNOWN.get(s,(s[:3],s[3:6])); sign=1 if direction=="long" else -1; return {base:sign,quote:-sign}
@dataclass
class OpenPosition: symbol:str; direction:str
class CorrelationGuard:
    def __init__(self,max_currency_exposure=3.0): self.max_currency_exposure=max_currency_exposure
    def check(self,symbol,direction,open_positions):
        exp=defaultdict(float)
        for p in open_positions:
            for c,v in decompose_currency_legs(p.symbol,p.direction).items(): exp[c]+=abs(v)
        for c,v in decompose_currency_legs(symbol,direction).items():
            if exp[c]+abs(v)>self.max_currency_exposure:return False,f"exposure {c} بیش از حد"
        return True,None
    def is_allowed(self,*args,**kwargs): return self.check(*args,**kwargs)
    def evaluate(self,symbol,direction,open_positions):
        ok,reason=self.check(symbol,direction,open_positions); return None if ok else reason
def static_correlation(a,b):
    if a==b:return 1.0
    return 0.85 if {a,b}=={"EURUSD","GBPUSD"} else (-0.75 if {a,b}=={"EURUSD","USDCHF"} else 0.0)
