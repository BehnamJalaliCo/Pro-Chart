import asyncio
from src.risk.daily_loss_limit import DailyLossLimit
class SignalTracker:
    def __init__(self): self.daily=DailyLossLimit()
    async def _close_signal(self,pnl): await self.daily.record_trade_outcome(pnl)
    async def _check_all_signals(self,signals):
        # asyncio.gather coordinates checks concurrently under a semaphore.
        semaphore=asyncio.Semaphore(10)
        async def check(s):
            async with semaphore:return s
        return await asyncio.gather(*(check(s) for s in signals))
