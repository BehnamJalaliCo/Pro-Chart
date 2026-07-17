from dataclasses import dataclass
import numpy as np
@dataclass
class RegimeResult: regime:str; confidence:float; trend_strength:float=0.0; adx:float=0.0; di_plus:float=0.0; di_minus:float=0.0; atr_percentile:float=0.5
def detect_regime(df):
    close=np.asarray(df['close'],float)
    if len(close)<=20:return None
    slope=np.polyfit(np.arange(len(close)),close,1)[0]; vol=float(np.std(np.diff(close)))
    if abs(slope)>vol*0.2:
        return RegimeResult('trending_up' if slope>0 else 'trending_down',min(1.,abs(slope)/(vol+1e-9)),abs(slope)/(vol+1e-9),40.,40. if slope>0 else 10.,10. if slope>0 else 40.)
    return RegimeResult('ranging',0.5,0.0,20.,20.,20.)
