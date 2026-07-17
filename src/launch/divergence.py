from dataclasses import dataclass,field
@dataclass
class MetricDivergence: name:str; direction:str; paper_value:float; backtest_value:float
@dataclass
class DivergenceReport: recommendation:str; overall_degraded:bool; metrics:list[MetricDivergence]=field(default_factory=list); notes:list[str]=field(default_factory=list)
def compare_paper_with_backtest(paper,backtest,paper_period_days=14,min_paper_trades=20):
    if paper.total_trades<min_paper_trades:return DivergenceReport('wait_for_more_data',False,notes=[f'paper trades کمتر از {min_paper_trades}'])
    names=['win_rate','profit_factor','expectancy_r','sharpe_ratio','avg_net_pips']; ms=[]
    for n in names:
        p=getattr(paper,n,0.); b=getattr(backtest,n,0.); d='degraded' if p<b*.8 else 'improved' if p>b*1.2 else 'unchanged'; ms.append(MetricDivergence(n,d,p,b))
    bad=sum(m.direction=='degraded' for m in ms); overall=bad>=2
    return DivergenceReport('block_launch' if overall else 'proceed_with_launch',overall,ms,[])
