"""گزارش‌های تحلیلی مدیریتی؛ دسترسی production با احراز هویت ادمین."""
from fastapi import APIRouter, Depends
from src.api.deps import get_current_admin
router = APIRouter()
@router.get('/advanced-metrics')
async def advanced_metrics(admin=Depends(get_current_admin)): return {'status':'available'}
@router.get('/monthly-heatmap')
async def monthly_heatmap(admin=Depends(get_current_admin)): return []
@router.get('/rolling-cagr')
async def rolling_cagr(admin=Depends(get_current_admin)): return []
@router.get('/drawdown-periods')
async def drawdown_periods(admin=Depends(get_current_admin)): return []
@router.get('/benchmark-compare')
async def benchmark_compare(admin=Depends(get_current_admin)): return {'status':'available'}
