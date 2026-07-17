from sqlalchemy import func
from src.core.database import Signal
async def get_active_signals(limit:int=100,offset:int=0): return [] # .limit(limit)
COUNT=func.count(Signal.id)
