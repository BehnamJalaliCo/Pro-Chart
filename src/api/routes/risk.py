from fastapi import APIRouter,Depends
from src.api.deps import get_current_admin
router=APIRouter()
@router.get("/daily")
async def daily(admin=Depends(get_current_admin)): return {}
@router.post("/lock")
async def lock(admin=Depends(get_current_admin)): return {'locked':True}
@router.post("/unlock")
async def unlock(admin=Depends(get_current_admin)): return {'locked':False}
@router.get("/rejections")
async def rejections(admin=Depends(get_current_admin)): return []
@router.get("/positions")
async def positions(admin=Depends(get_current_admin)): return []
@router.get("/regimes")
async def regimes(admin=Depends(get_current_admin)): return []
