"""
تاریخچهٔ سود/زیانِ معاملات (ادمین) — از دیلِ واقعیِ MT5 (trade_history).

نمای حرفه‌ای: فهرستِ هر معامله با کمیسیون/سواپ/خالص، جمعِ روزانه، آمارِ کلیدی
(نرخِ برد، profit factor، انتظارِ ریاضی، افتِ سرمایه)، منحنیِ equity، فیلتر،
پاک‌کردنِ تاریخچه و خروجیِ CSV. account_uid=0 = مَستر، N = کاربرِ کپی.
"""

import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_admin, get_db
from src.core.database import Admin, TradeHistory

router = APIRouter()


def _f(v):
    return float(v) if v is not None else 0.0


def _filters(uid, start, end, symbol, result, reason):
    conds = [TradeHistory.account_uid == uid]
    if start:
        conds.append(TradeHistory.close_time >= start)
    if end:
        conds.append(TradeHistory.close_time <= end)
    if symbol:
        conds.append(TradeHistory.symbol == symbol.upper())
    if reason:
        conds.append(TradeHistory.close_reason == reason)
    if result == "win":
        conds.append(TradeHistory.net_profit > 0)
    elif result == "loss":
        conds.append(TradeHistory.net_profit < 0)
    return conds


def _row(t: TradeHistory) -> dict:
    return {
        "id": t.id, "deal_id": t.deal_id, "signal_id": t.signal_id,
        "symbol": t.symbol, "direction": t.direction, "volume": _f(t.volume),
        "entry_price": _f(t.entry_price), "exit_price": _f(t.exit_price),
        "open_time": t.open_time.isoformat() if t.open_time else None,
        "close_time": t.close_time.isoformat() if t.close_time else None,
        "duration_sec": t.duration_sec,
        "gross_profit": _f(t.gross_profit), "commission": _f(t.commission),
        "swap": _f(t.swap), "spread_cost": _f(t.spread_cost),
        "net_profit": _f(t.net_profit), "pips": _f(t.pips),
        "close_reason": t.close_reason, "balance_after": _f(t.balance_after),
    }


async def query_list(db, uid, page=1, per_page=50, start=None, end=None, symbol=None, result=None, reason=None):
    """منطقِ مشترکِ فهرستِ معاملات (ادمین + پنل کاربری)."""
    conds = _filters(uid, start, end, symbol, result, reason)
    total = int((await db.execute(select(func.count()).select_from(TradeHistory).where(and_(*conds)))).scalar() or 0)
    rows = (await db.execute(
        select(TradeHistory).where(and_(*conds))
        .order_by(desc(TradeHistory.close_time)).offset((page - 1) * per_page).limit(per_page)
    )).scalars().all()
    return {"items": [_row(t) for t in rows], "total": total, "page": page,
            "per_page": per_page, "total_pages": (total + per_page - 1) // per_page}


@router.get("")
async def list_history(
    uid: int = Query(0),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
    symbol: str | None = Query(None),
    result: str | None = Query(None, description="win/loss"),
    reason: str | None = Query(None),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await query_list(db, uid, page, per_page, start, end, symbol, result, reason)


async def query_daily(db, uid, days=30):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    day = func.date_trunc("day", TradeHistory.close_time)
    rows = (await db.execute(
        select(
            day.label("d"),
            func.count().label("n"),
            func.sum(TradeHistory.net_profit).label("net"),
            func.sum(TradeHistory.gross_profit).label("gross"),
            func.sum(TradeHistory.commission).label("comm"),
            func.sum(TradeHistory.swap).label("swap"),
            func.sum(func.greatest(TradeHistory.net_profit, 0)).label("wins_sum"),
            func.count().filter(TradeHistory.net_profit > 0).label("wins"),
        ).where(and_(TradeHistory.account_uid == uid, TradeHistory.close_time >= since))
        .group_by("d").order_by("d")
    )).all()
    out = []
    for r in rows:
        n = int(r.n or 0)
        out.append({
            "date": r.d.isoformat() if hasattr(r.d, "isoformat") else str(r.d),
            "trades": n, "net": _f(r.net), "gross": _f(r.gross),
            "commission": _f(r.comm), "swap": _f(r.swap),
            "wins": int(r.wins or 0), "losses": n - int(r.wins or 0),
            "win_rate": round(100 * (r.wins or 0) / n, 1) if n else 0,
        })
    return {"days": days, "items": out}


@router.get("/daily")
async def daily_summary(
    uid: int = Query(0),
    days: int = Query(30, ge=1, le=365),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await query_daily(db, uid, days)


async def query_stats(db, uid, days=30):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    base = and_(TradeHistory.account_uid == uid, TradeHistory.close_time >= since)
    agg = (await db.execute(select(
        func.count(), func.sum(TradeHistory.net_profit),
        func.sum(TradeHistory.gross_profit), func.sum(TradeHistory.commission),
        func.sum(TradeHistory.swap),
        func.count().filter(TradeHistory.net_profit > 0),
        func.sum(func.greatest(TradeHistory.net_profit, 0)),
        func.sum(func.least(TradeHistory.net_profit, 0)),
        func.avg(TradeHistory.net_profit),
        func.max(TradeHistory.net_profit), func.min(TradeHistory.net_profit),
    ).where(base))).one()
    n, net, gross, comm, swap, wins, gain, loss, avg, best, worst = agg
    n = int(n or 0)
    gain = _f(gain)
    loss = abs(_f(loss))
    profit_factor = round(gain / loss, 2) if loss > 0 else (gain and 999.0 or 0.0)
    win_rate = round(100 * (wins or 0) / n, 1) if n else 0.0

    # منحنیِ equity تجمعی (به‌ترتیبِ زمان) + افتِ سرمایه
    seq = (await db.execute(
        select(TradeHistory.close_time, TradeHistory.net_profit)
        .where(base).order_by(TradeHistory.close_time)
    )).all()
    cum = 0.0
    peak = 0.0
    max_dd = 0.0
    curve = []
    for ct, npf in seq:
        cum += _f(npf)
        peak = max(peak, cum)
        max_dd = min(max_dd, cum - peak)
        curve.append({"t": ct.isoformat() if ct else None, "equity": round(cum, 2)})
    return {
        "range_days": days,
        "trades": n, "net": _f(net), "gross": _f(gross),
        "commission": _f(comm), "swap": _f(swap),
        "wins": int(wins or 0), "losses": n - int(wins or 0),
        "win_rate": win_rate, "profit_factor": profit_factor,
        "avg_net": round(_f(avg), 2), "best": _f(best), "worst": _f(worst),
        "max_drawdown": round(max_dd, 2),
        "expectancy": round(_f(net) / n, 2) if n else 0.0,
        "equity_curve": curve[-500:],
    }


@router.get("/stats")
async def history_stats(
    uid: int = Query(0),
    days: int = Query(30, ge=1, le=3650),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await query_stats(db, uid, days)


@router.delete("")
async def clear_history(
    uid: int = Query(0),
    before: datetime | None = Query(None, description="فقط قبل از این تاریخ؛ خالی = همه"),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    conds = [TradeHistory.account_uid == uid]
    if before:
        conds.append(TradeHistory.close_time < before)
    res = await db.execute(delete(TradeHistory).where(and_(*conds)))
    await db.commit()
    return {"ok": True, "deleted": res.rowcount}


@router.get("/export")
async def export_csv(
    uid: int = Query(0),
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    conds = _filters(uid, start, end, None, None, None)
    rows = (await db.execute(select(TradeHistory).where(and_(*conds)).order_by(desc(TradeHistory.close_time)))).scalars().all()
    buf = io.StringIO()
    buf.write("close_time,symbol,direction,volume,entry,exit,pips,gross,commission,swap,net,reason\n")
    for t in rows:
        buf.write(",".join(str(x) for x in [
            t.close_time.isoformat() if t.close_time else "", t.symbol, t.direction,
            _f(t.volume), _f(t.entry_price), _f(t.exit_price), _f(t.pips),
            _f(t.gross_profit), _f(t.commission), _f(t.swap), _f(t.net_profit), t.close_reason or "",
        ]) + "\n")
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=trade_history_{uid}.csv"},
    )


@router.get("/performance")
async def performance(
    uid: int = Query(0),
    days: int = Query(30, ge=1, le=365),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """اسکورکاردِ کوانتِ کامل (Phase 0): انتظار/PF/Sharpe/maxDD + تفکیکِ نماد/ساعت/امتیاز."""
    from src.analytics.performance import performance_report
    return await performance_report(db, uid=uid, days=days)


@router.get("/validation")
async def validation(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """دروازهٔ اعتبارسنجیِ کپی (Phase 5): آیا مَستر سوددهیِ کافی برای فعال‌کردنِ کپیِ
    پولِ واقعی نشان داده؟ + معیارها و دلایل."""
    from src.analytics.validation import compute_master_validation
    return await compute_master_validation(db)
