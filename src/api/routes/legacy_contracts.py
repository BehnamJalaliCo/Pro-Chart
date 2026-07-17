"""Authenticated compatibility endpoints for the pre-panel API contract."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from src.api.deps import get_current_admin, get_db
from src.core.database import Admin, Signal

router = APIRouter()


@router.get("/signals", tags=["سازگاری API"])
async def legacy_signals(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    """Return the old paginated signal shape, protected by admin auth."""
    total = (await db.execute(select(func.count(Signal.id)))).scalar() or 0
    rows = (await db.execute(
        select(Signal).order_by(Signal.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return {"items": [{"id": s.id, "symbol": s.symbol, "status": s.status} for s in rows], "total": int(total), "page": page, "limit": limit}


@router.get("/performance/summary", tags=["سازگاری API"])
async def legacy_performance_summary(
    days: int = Query(30, ge=1, le=3650),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    """Expose the existing analytics report under its historical path."""
    from src.analytics.performance import performance_report

    return await performance_report(db, uid=admin.id, days=days)
