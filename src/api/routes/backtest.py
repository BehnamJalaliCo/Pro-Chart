from fastapi import APIRouter
from src.backtest.engine import BacktestEngine
router=APIRouter()
async def _execute_backtest_in_background(*args,**kwargs):
    engine=BacktestEngine(); return engine.run(**kwargs)
