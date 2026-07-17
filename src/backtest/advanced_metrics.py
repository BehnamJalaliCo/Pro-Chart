from __future__ import annotations
from dataclasses import dataclass
import math, numpy as np

@dataclass
class AdvancedMetrics:
    mar_ratio: float=0.0; calmar_ratio: float=0.0; omega_ratio: float=0.0; tail_ratio: float=0.0; ulcer_index: float=0.0; psr: float=0.0; dsr: float=0.0; skewness: float=0.0; excess_kurtosis: float=0.0

def compute_omega(returns, threshold=0.0):
    r=np.asarray(returns,dtype=float); gains=np.maximum(r-threshold,0).sum(); losses=np.maximum(threshold-r,0).sum()
    return float(gains/losses) if losses else math.inf
def compute_tail_ratio(returns):
    r=np.asarray(returns,dtype=float)
    if len(r)<4:return 0.0
    q95,q05=np.percentile(r,[95,5]); return float(abs(q95)/abs(q05)) if q05 else math.inf
def compute_psr(sharpe, returns, periods_per_year=252):
    r=np.asarray(returns,dtype=float); n=len(r)
    if n<2:return 0.5
    return float(0.5*(1+math.erf(sharpe*math.sqrt(n-1)/math.sqrt(2))))
def compute_dsr(sharpe, returns, n_trials=1, **kwargs):
    return max(0.0, compute_psr(sharpe,returns,**kwargs)-math.log(max(1,n_trials))/max(1,len(returns)))
def compute_advanced_metrics(returns, periods_per_year=252):
    r=np.asarray(returns,dtype=float)
    if not len(r): return AdvancedMetrics()
    mean=float(r.mean()); std=float(r.std(ddof=1)) if len(r)>1 else 0.0; annual=mean*periods_per_year
    equity=np.cumsum(r); peak=np.maximum.accumulate(equity); dd=peak-equity; maxdd=float(dd.max()) if len(dd) else 0
    ulcer=float(np.sqrt(np.mean((dd/(np.maximum(peak,1e-12))*100)**2)))
    skew=float(((r-mean)**3).mean()/(std**3)) if std else 0.0; kurt=float(((r-mean)**4).mean()/(std**4)-3) if std else 0.0
    return AdvancedMetrics(annual/maxdd if maxdd else 0.0,annual/maxdd if maxdd else 0.0,compute_omega(r),compute_tail_ratio(r),ulcer,compute_psr(mean/std*math.sqrt(periods_per_year) if std else 0,r),compute_dsr(mean/std*math.sqrt(periods_per_year) if std else 0,r),skew,kurt)
