"""
مسیرهای عملکرد و آمار سیگنال‌ها.

شامل آمار کلی، روزانه، هفتگی، ماهانه، بر اساس نماد و منحنی سرمایه.
این آمار بر اساس سیگنال‌های بسته‌شده محاسبه می‌شود.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Numeric, and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.api.deps import get_db
from src.core.database import Signal
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


async def _calculate_stats(db: AsyncSession, conditions: list) -> dict:
    """
    محاسبه آمار عملکرد بر اساس شرایط داده‌شده.

    تعداد کل سیگنال‌ها، تعداد برد/باخت، درصد موفقیت، مجموع پیپ و
    میانگین پیپ را محاسبه می‌کند.
    """
    base_filter = [Signal.status.in_(["tp_hit", "sl_hit", "closed"])]
    all_conditions = base_filter + conditions

    query = select(
        func.count(Signal.id).label("total"),
        func.sum(Signal.pnl_pips).label("total_pips"),
        func.avg(Signal.pnl_pips).label("avg_pips"),
        func.max(Signal.pnl_pips).label("best_trade"),
        func.min(Signal.pnl_pips).label("worst_trade"),
    ).where(and_(*all_conditions))

    result = await db.execute(query)
    row = result.one()

    total = row.total or 0
    total_pips = float(row.total_pips) if row.total_pips else 0.0
    avg_pips = float(row.avg_pips) if row.avg_pips else 0.0
    best = float(row.best_trade) if row.best_trade else 0.0
    worst = float(row.worst_trade) if row.worst_trade else 0.0

    win_query = select(func.count(Signal.id)).where(
        and_(*all_conditions, Signal.pnl_pips > 0)
    )
    win_result = await db.execute(win_query)
    wins = win_result.scalar() or 0

    loss_query = select(func.count(Signal.id)).where(
        and_(*all_conditions, Signal.pnl_pips <= 0)
    )
    loss_result = await db.execute(loss_query)
    losses = loss_result.scalar() or 0

    win_rate = (wins / total * 100) if total > 0 else 0.0

    return {
        "total_signals": total,
        "wins": wins,
        "losses": losses,
        "win_rate": round(win_rate, 2),
        "total_pips": round(total_pips, 1),
        "avg_pips": round(avg_pips, 1),
        "best_trade": round(best, 1),
        "worst_trade": round(worst, 1),
    }


@router.get("/summary")
async def performance_summary(db: AsyncSession = Depends(get_db)):
    """
    آمار کلی عملکرد.

    شامل تعداد کل سیگنال‌ها، درصد موفقیت، مجموع و میانگین پیپ،
    بهترین و بدترین معامله. همچنین آمار هفته و ماه جاری نیز
    ارائه می‌شود.
    """
    overall = await _calculate_stats(db, [])

    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    this_week = await _calculate_stats(db, [Signal.created_at >= week_start])
    this_month = await _calculate_stats(db, [Signal.created_at >= month_start])

    active_query = select(func.count(Signal.id)).where(Signal.status == "active")
    active_result = await db.execute(active_query)
    active_count = active_result.scalar() or 0

    return {
        "overall": overall,
        "this_week": this_week,
        "this_month": this_month,
        "active_signals": active_count,
    }


@router.get("/daily")
async def daily_performance(
    days: int = Query(30, ge=1, le=365, description="تعداد روزهای اخیر"),
    db: AsyncSession = Depends(get_db),
):
    """
    آمار عملکرد روزانه.

    آمار پیپ کسب‌شده، تعداد سیگنال و درصد موفقیت برای هر روز در بازه
    مشخص‌شده را برمی‌گرداند. پیش‌فرض ۳۰ روز گذشته.
    """
    # DB-side aggregation با date_trunc + GROUP BY
    # قبلاً: SELECT تمام signals + Python-side bucketing (۵۰۰+ rows in memory)
    # حالا: همان داده ولی aggregated در DB — یک‌سویی DB row per day
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    day_col = func.date_trunc("day", Signal.created_at).label("day")
    pips_col = func.coalesce(Signal.pnl_pips, 0).cast(Numeric)
    stmt = (
        select(
            day_col,
            func.count(Signal.id).label("total"),
            func.sum(func.case((pips_col > 0, 1), else_=0)).label("wins"),
            func.sum(pips_col).label("total_pips"),
        )
        .where(
            and_(
                Signal.status.in_(["tp_hit", "sl_hit", "closed"]),
                Signal.created_at >= start_date,
            )
        )
        .group_by(day_col)
        .order_by(day_col.desc())
    )
    rows = (await db.execute(stmt)).all()

    items = []
    for row in rows:
        total = int(row.total or 0)
        wins = int(row.wins or 0)
        items.append({
            "date": row.day.strftime("%Y-%m-%d") if row.day else None,
            "total_signals": total,
            "wins": wins,
            "losses": total - wins,
            "win_rate": round((wins / total * 100) if total > 0 else 0, 2),
            "pips": round(float(row.total_pips or 0), 1),
        })

    return {"items": items, "days": days}


@router.get("/weekly")
async def weekly_performance(
    weeks: int = Query(12, ge=1, le=52, description="تعداد هفته‌های اخیر"),
    db: AsyncSession = Depends(get_db),
):
    """
    آمار عملکرد هفتگی.

    آمار تجمیعی هر هفته شامل تعداد سیگنال، نرخ موفقیت و پیپ کل
    را برمی‌گرداند.
    """
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(weeks=weeks)

    result = await db.execute(
        select(Signal)
        .where(
            and_(
                Signal.status.in_(["tp_hit", "sl_hit", "closed"]),
                Signal.created_at >= start_date,
            )
        )
        .order_by(Signal.created_at)
    )
    signals = result.scalars().all()

    weekly_data: dict[str, dict] = {}
    for signal in signals:
        iso_cal = signal.created_at.isocalendar()
        week_key = f"{iso_cal.year}-W{iso_cal.week:02d}"
        if week_key not in weekly_data:
            weekly_data[week_key] = {"week": week_key, "total": 0, "wins": 0, "pips": 0.0}

        weekly_data[week_key]["total"] += 1
        pips = float(signal.pnl_pips) if signal.pnl_pips else 0.0
        weekly_data[week_key]["pips"] += pips
        if pips > 0:
            weekly_data[week_key]["wins"] += 1

    items = []
    for week_info in weekly_data.values():
        total = week_info["total"]
        wins = week_info["wins"]
        items.append({
            "week": week_info["week"],
            "total_signals": total,
            "wins": wins,
            "losses": total - wins,
            "win_rate": round((wins / total * 100) if total > 0 else 0, 2),
            "pips": round(week_info["pips"], 1),
        })

    items.sort(key=lambda x: x["week"], reverse=True)

    return {"items": items, "weeks": weeks}


@router.get("/monthly")
async def monthly_performance(
    months: int = Query(12, ge=1, le=24, description="تعداد ماه‌های اخیر"),
    db: AsyncSession = Depends(get_db),
):
    """
    آمار عملکرد ماهانه.

    آمار تجمیعی هر ماه شامل تعداد سیگنال، نرخ موفقیت و پیپ کل
    را برمی‌گرداند.
    """
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=months * 31)

    result = await db.execute(
        select(Signal)
        .where(
            and_(
                Signal.status.in_(["tp_hit", "sl_hit", "closed"]),
                Signal.created_at >= start_date,
            )
        )
        .order_by(Signal.created_at)
    )
    signals = result.scalars().all()

    monthly_data: dict[str, dict] = {}
    for signal in signals:
        month_key = signal.created_at.strftime("%Y-%m")
        if month_key not in monthly_data:
            monthly_data[month_key] = {"month": month_key, "total": 0, "wins": 0, "pips": 0.0}

        monthly_data[month_key]["total"] += 1
        pips = float(signal.pnl_pips) if signal.pnl_pips else 0.0
        monthly_data[month_key]["pips"] += pips
        if pips > 0:
            monthly_data[month_key]["wins"] += 1

    items = []
    for month_info in monthly_data.values():
        total = month_info["total"]
        wins = month_info["wins"]
        items.append({
            "month": month_info["month"],
            "total_signals": total,
            "wins": wins,
            "losses": total - wins,
            "win_rate": round((wins / total * 100) if total > 0 else 0, 2),
            "pips": round(month_info["pips"], 1),
        })

    items.sort(key=lambda x: x["month"], reverse=True)

    return {"items": items, "months": months}


@router.get("/by-symbol")
async def performance_by_symbol(
    date_from: Optional[datetime] = Query(None, description="تاریخ شروع"),
    date_to: Optional[datetime] = Query(None, description="تاریخ پایان"),
    db: AsyncSession = Depends(get_db),
):
    """
    آمار عملکرد تفکیک‌شده بر اساس نماد.

    برای هر نماد ارزی، تعداد سیگنال، نرخ موفقیت و مجموع پیپ
    محاسبه و برگردانده می‌شود.
    """
    conditions = [Signal.status.in_(["tp_hit", "sl_hit", "closed"])]

    if date_from:
        conditions.append(Signal.created_at >= date_from)
    if date_to:
        conditions.append(Signal.created_at <= date_to)

    # DB-side aggregation با GROUP BY symbol
    # قبلاً: SELECT تمام signals + Python-side bucketing
    # حالا: همان داده ولی aggregated در DB — یک row per symbol
    pips_col = func.coalesce(Signal.pnl_pips, 0).cast(Numeric)
    stmt = (
        select(
            Signal.symbol.label("symbol"),
            func.count(Signal.id).label("total"),
            func.sum(func.case((pips_col > 0, 1), else_=0)).label("wins"),
            func.sum(pips_col).label("total_pips"),
        )
        .where(and_(*conditions))
        .group_by(Signal.symbol)
    )
    rows = (await db.execute(stmt)).all()

    items = []
    for row in rows:
        total = int(row.total or 0)
        wins = int(row.wins or 0)
        total_pips = float(row.total_pips or 0)
        items.append({
            "symbol": row.symbol,
            "total_signals": total,
            "wins": wins,
            "losses": total - wins,
            "win_rate": round((wins / total * 100) if total > 0 else 0, 2),
            "total_pips": round(total_pips, 1),
            "avg_pips": round(total_pips / total, 1) if total > 0 else 0.0,
        })

    items.sort(key=lambda x: x["total_pips"], reverse=True)

    return {"items": items}


@router.get("/equity-curve")
async def equity_curve(
    days: int = Query(90, ge=7, le=365, description="تعداد روزهای اخیر"),
    initial_balance: float = Query(10000.0, gt=0, description="موجودی اولیه"),
    pip_value: float = Query(10.0, gt=0, description="ارزش هر پیپ بر حسب دلار"),
    db: AsyncSession = Depends(get_db),
):
    """
    داده‌های منحنی سرمایه (Equity Curve).

    با فرض موجودی اولیه و ارزش هر پیپ، تغییرات سرمایه بر اساس
    سیگنال‌های بسته‌شده محاسبه می‌شود. داده‌ها به صورت نقاط زمانی
    برای رسم نمودار برگردانده می‌شوند.
    """
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    result = await db.execute(
        select(Signal)
        .where(
            and_(
                Signal.status.in_(["tp_hit", "sl_hit", "closed"]),
                Signal.created_at >= start_date,
            )
        )
        .order_by(Signal.created_at)
    )
    signals = result.scalars().all()

    balance = initial_balance
    curve_points = [
        {
            "date": start_date.strftime("%Y-%m-%d"),
            "balance": round(balance, 2),
            "trade_number": 0,
        }
    ]

    for idx, signal in enumerate(signals, 1):
        pips = float(signal.pnl_pips) if signal.pnl_pips else 0.0
        profit = pips * pip_value
        balance += profit

        curve_points.append({
            "date": signal.created_at.strftime("%Y-%m-%d") if signal.created_at else None,
            "balance": round(balance, 2),
            "trade_number": idx,
            "pips": round(pips, 1),
            "profit": round(profit, 2),
            "symbol": signal.symbol,
        })

    peak = initial_balance
    max_drawdown = 0.0
    for point in curve_points:
        if point["balance"] > peak:
            peak = point["balance"]
        dd = ((peak - point["balance"]) / peak * 100) if peak > 0 else 0.0
        if dd > max_drawdown:
            max_drawdown = dd

    return {
        "curve": curve_points,
        "initial_balance": initial_balance,
        "final_balance": round(balance, 2),
        "total_profit": round(balance - initial_balance, 2),
        "return_pct": round(((balance - initial_balance) / initial_balance) * 100, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "total_trades": len(signals),
    }
