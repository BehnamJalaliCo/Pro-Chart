from __future__ import annotations
from dataclasses import dataclass,field
import hashlib, numpy as np
@dataclass
class Stats: profit_factor:float; avg_r:float
@dataclass
class ABReport:
    delta_avg_r:float; sample_size_adequate:bool; is_significant:bool; recommendation:str; a_stats:Stats; b_stats:Stats; notes:list[str]=field(default_factory=list)
class Experiment:
    def __init__(self,name,traffic_split=.5): self.name=name; self.traffic_split=traffic_split
    def assign(self,key):
        x=int(hashlib.sha256(f'{self.name}:{key}'.encode()).hexdigest()[:8],16)/0xffffffff
        return 'variant' if x<self.traffic_split else 'control'
def _stats(r,p):
    loss=sum(-x for x in p if x<0); gain=sum(x for x in p if x>0); return Stats(gain/loss if loss else float('inf'),float(np.mean(r)) if r else 0.)
def analyze_ab_test(name,a_r,a_p,b_r,b_p):
    a,b=_stats(a_r,a_p),_stats(b_r,b_p); adequate=len(a_r)>=30 and len(b_r)>=30; delta=b.avg_r-a.avg_r; sig=adequate and delta>0.3
    if not adequate:return ABReport(delta,False,False,'تأخیر تا جمع‌آوری دادهٔ بیشتر',a,b,['حجم نمونه کم'])
    return ABReport(delta,True,sig,'B بهتر است' if sig else 'تفاوت معنادار نیست',a,b)
