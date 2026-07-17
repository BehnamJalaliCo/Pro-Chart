from fastapi import APIRouter, Depends
from src.api.deps import get_current_admin
from src.launch.preflight import PreflightResult
from src.launch.divergence import compare_paper_with_backtest
router=APIRouter()
_ALLOWED_METRIC_FIELDS=frozenset({'paper_signals_generated','paper_vs_live_divergence','trading_mode'})
def set_metric(key,value,metrics):
    if key in _ALLOWED_METRIC_FIELDS: setattr(metrics,key,value)
@router.get('/preflight')
async def preflight(admin=Depends(get_current_admin)): return {'ready':PreflightResult().is_ready_for_launch}
@router.get('/trading-mode')
async def trading_mode(admin=Depends(get_current_admin)): return {'trading_mode':'paper'}
@router.get('/divergence')
async def divergence(admin=Depends(get_current_admin)): return {'status':'available'}
