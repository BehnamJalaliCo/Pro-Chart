from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from src.risk.symbol_config import get_symbol_config
from src.risk.weekend_filter import is_weekend_blackout
from src.risk.session_filter import is_session_allowed
from src.risk.correlation import CorrelationGuard
from src.risk.regime_detector import detect_regime
from src.risk.holiday_calendar import is_holiday_blackout
from src.analysis.volume_profile import assess_liquidity
# HOLIDAY_BLACKOUT / LOW_LIQUIDITY are explicit rejection codes in the audit contract.
class RiskCode(str,Enum): weekend_blackout='weekend_blackout'; holiday_blackout='holiday_blackout'; session_not_allowed='session_not_allowed'; low_rr='low_rr'; sl_too_tight='sl_too_tight'; correlation_risk='correlation_risk'; regime_mismatch='regime_mismatch'
@dataclass
class RiskResult: allowed:bool; reasons:list; regime:object=None
class RiskGuard:
    def __init__(self,correlation_guard=None,**kwargs): self.correlation_guard=correlation_guard or CorrelationGuard()
    async def evaluate(self,*,symbol,direction,entry_price,sl,tp1,now,pip_size=.0001,open_positions=None,candles_df=None,signal_strategy=None,**kwargs):
        reasons=[]; blocked,msg=is_weekend_blackout(now)
        if blocked: reasons.append((RiskCode.weekend_blackout,msg))
        holiday_blocked, holiday_reason = is_holiday_blackout(now)
        if holiday_blocked: reasons.append((RiskCode.holiday_blackout, holiday_reason))
        ok,msg=is_session_allowed(symbol,now)
        if not ok: reasons.append((RiskCode.session_not_allowed,msg))
        cfg=get_symbol_config(symbol); risk=abs(entry_price-sl)/pip_size; reward=abs(tp1-entry_price)/pip_size
        if reward/risk < cfg.min_rr_tp1: reasons.append((RiskCode.low_rr,'R/R پایین'))
        if risk < 8: reasons.append((RiskCode.sl_too_tight,'SL خیلی نزدیک'))
        if open_positions is not None:
            reason=self.correlation_guard.evaluate(symbol,direction,open_positions)
            if reason: reasons.append((RiskCode.correlation_risk,reason))
        regime=detect_regime(candles_df) if candles_df is not None else None
        return RiskResult(not reasons,reasons,regime)
