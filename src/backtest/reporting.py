from __future__ import annotations
from dataclasses import dataclass,field
from collections import defaultdict
import numpy as np, math
@dataclass
class HeatmapRow:
    year:int; months:dict=field(default_factory=dict); n_trades:dict=field(default_factory=dict); annual_return_pct:float=0.0
@dataclass
class RollingPoint: timestamp:object; value:float; sample_size:int
@dataclass
class DrawdownPeriod: start:object; trough:object; end:object|None; drawdown_pct:float; is_ongoing:bool
@dataclass
class BenchmarkComparison: benchmark_name:str; alpha_pct:float=0.; beta:float=0.; correlation:float=0.; information_ratio:float=0.; n_periods:int=0
def build_monthly_heatmap(timestamps,pnls,initial_balance=10000):
    groups=defaultdict(list)
    for t,p in zip(timestamps,pnls): groups[(t.year,t.month)].append(float(p))
    rows={}
    bal=initial_balance
    for (y,m),vals in sorted(groups.items()):
        row=rows.setdefault(y,HeatmapRow(y)); row.months[m]=sum(vals)/bal*100; row.n_trades[m]=len(vals); bal+=sum(vals)
    for row in rows.values(): row.annual_return_pct=(np.prod([1+v/100 for v in row.months.values()])-1)*100
    return list(rows.values())
def rolling_cagr(ts,pnls,window_days=365,step_days=30,initial_balance=10000):
    out=[]; cum=initial_balance
    for t,p in zip(ts,pnls):
        cum+=p
        if (t-ts[0]).days>=window_days: out.append(RollingPoint(t,((cum/initial_balance)**(365/window_days)-1),1))
    return out[::max(1,step_days)]
def rolling_sharpe(ts,returns,window_days=60,step_days=14):
    out=[]
    for i,t in enumerate(ts):
        vals=np.asarray(returns[max(0,i-window_days+1):i+1]);
        if len(vals)>=10: out.append(RollingPoint(t,float(vals.mean()/vals.std(ddof=1)) if vals.std(ddof=1) else 0.,len(vals)))
    return out[::max(1,step_days)]
def identify_drawdown_periods(ts,pnls,initial_balance=10000,min_drawdown_pct=.01):
    eq=initial_balance; peak=eq; start=None; trough=None; low=0.; out=[]
    for t,p in zip(ts,pnls):
        eq+=p
        if eq>peak:
            if start is not None: out.append(DrawdownPeriod(start,trough,t,low,False))
            peak=eq; start=trough=None; low=0.; continue
        dd=(peak-eq)/peak
        if dd>=min_drawdown_pct:
            if start is None:start=t
            if dd>low:low=dd; trough=t
    if start is not None: out.append(DrawdownPeriod(start,trough,None,low,True))
    return sorted(out,key=lambda x:x.drawdown_pct,reverse=True)
def compare_to_benchmark(strategy,benchmark,benchmark_name='Benchmark'):
    s=np.asarray(strategy,float); b=np.asarray(benchmark,float); n=len(s)
    if n<10:return BenchmarkComparison(benchmark_name,n_periods=n)
    cov=np.cov(s,b,ddof=1)[0,1]; var=np.var(b,ddof=1); beta=float(cov/var) if var else 0.; corr=float(np.corrcoef(s,b)[0,1]); alpha=float((s.mean()-beta*b.mean())*100); te=s-beta*b; ir=float(te.mean()/te.std(ddof=1)) if te.std(ddof=1) else 0.
    return BenchmarkComparison(benchmark_name,alpha,beta,corr,ir,n)
