from __future__ import annotations
from dataclasses import dataclass

@dataclass
class LossSnapshot:
    total_loss: float=0.0; consecutive_losses: int=0; signals_emitted: int=0; locked: bool=False

class DailyLossLimit:
    def __init__(self, redis_client=None, max_daily_loss_dollar=1000.0, max_daily_loss_pct=5.0, max_consecutive_losses=5, max_signals_per_day=100):
        self.redis_client=redis_client; self.max_daily_loss_dollar=max_daily_loss_dollar; self.max_daily_loss_pct=max_daily_loss_pct; self.max_consecutive_losses=max_consecutive_losses; self.max_signals_per_day=max_signals_per_day; self._s=LossSnapshot()
    async def record_trade_outcome(self,pnl):
        if pnl<0:self._s.total_loss += -float(pnl); self._s.consecutive_losses += 1
        else:self._s.consecutive_losses=0
    async def record_signal_emitted(self): self._s.signals_emitted += 1
    async def can_emit_signal(self,account_balance=None):
        if self._s.locked:return False,"قفل دستی فعال است"
        if self._s.total_loss >= self.max_daily_loss_dollar:return False,"حد زیان مطلق روزانه رد شد"
        if account_balance and self._s.total_loss/account_balance*100 >= self.max_daily_loss_pct:return False,"حد زیان درصدی رد شد"
        if self._s.consecutive_losses >= self.max_consecutive_losses:return False,"حد زیان‌های متوالی رد شد"
        if self._s.signals_emitted >= self.max_signals_per_day:return False,"سقف سیگنال روزانه رد شد"
        return True,None
    async def snapshot(self): return self._s
    async def manual_lock(self,reason): self._s.locked=True
    async def manual_unlock(self): self._s.locked=False
