"""
گزارش‌های institutional-grade — heatmap، rolling، drawdown، benchmark.

این endpoint ها داده‌های آماده برای admin dashboard و investor reports
ارائه می‌دهند. تمام endpoint ها admin-only هستند.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_admin, get_db
from src.backtest.advanced_metrics import compute_advanced_metrics
from src.backtest.reporting import (
    build_monthly_heatmap,
    compare_to_benchmark,
    identify_drawdown_periods,
    rolling_cagr,
    rolling_sharpe,
)
from src.core.database import Admin, Signal
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


# ── helpers ─────────────────────────────────────────────


async def _fetch_closed_signals(
    db: AsyncSession,
    symbol: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 50_000,
) -> list[Signal]:
    """خواندن سیگنال‌های closed با فیلتر اختیاری."""
    closed_statuses = ["CLOSED", "tp_hit", "sl_hit", "closed"]
    conditions = [
        Signal.status.in_(closed_statuses),
        Signal.pnl_dollar.isnot(None),
    ]
    if symbol:
        conditions.append(Signal.symbol == symbol)
    if start_date:
        conditions.append(Signal.created_at >= start_date)
    if end_date:
        conditions.append(Signal.created_at <= end_date)

    stmt = (
        select(Signal)
        .where(and_(*conditions))
        .order_by(Signal.created_at)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


def _signals_to_series(signals: list[Signal]) -> tuple[list[datetime], list[float], list[float]]:
    """
    تبدیل لیست signals به (timestamps, pnls_dollar, r_multiples).

    r_multiple = pnl_pips / sl_pips approximation اگر داده‌ی صریح نباشد.
    """
    times: list[datetime] = []
    pnls: list[float] = []
    rs: list[float] = []
    for s in signals:
        if s.closed_at is None or s.pnl_dollar is None:
            continue
        times.append(s.closed_at)
        pnls.append(float(s.pnl_dollar))
        # تخمین R از pnl_pips و SL distance
        if s.pnl_pips and s.entry_price and s.sl:
            sl_dist = abs(float(s.entry_price) - float(s.sl))
            # pip_size ساده: 0.0001 default
            sl_pips = sl_dist * 10_000 if sl_dist < 1 else sl_dist * 100
            if sl_pips > 0:
                rs.append(float(s.pnl_pips) / sl_pips)
            else:
                rs.append(0.0)
        else:
            rs.append(0.0)
    return times, pnls, rs


# ── Endpoints ────────────────────────────────────────────


@router.get("/advanced-metrics")
async def get_advanced_metrics(
    symbol: Optional[str] = Query(None, max_length=10),
    days: int = Query(365, ge=30, le=3650),
    n_trials: int = Query(1, ge=1, le=1000, description="برای DSR"),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    MAR، Calmar، Omega، Ulcer، Tail، PSR، DSR، skewness، kurtosis.
    """
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    signals = await _fetch_closed_signals(db, symbol=symbol, start_date=start, end_date=end)
    _, _, r_multiples = _signals_to_series(signals)

    if len(r_multiples) < 2:
        return {
            "ok": False,
            "reason": "داده‌ی کافی برای محاسبه نیست",
            "n_signals": len(signals),
        }

    metrics = compute_advanced_metrics(
        r_multiples,
        periods_per_year=252,
        n_trials=n_trials,
    )
    return {
        "ok": True,
        "symbol": symbol,
        "days": days,
        "n_signals": len(signals),
        "n_trades": len(r_multiples),
        "metrics": metrics.to_dict(),
    }


@router.get("/monthly-heatmap")
async def get_monthly_heatmap(
    symbol: Optional[str] = Query(None, max_length=10),
    years: int = Query(3, ge=1, le=10),
    initial_balance: float = Query(10_000.0, ge=100.0),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    heatmap بازده ماهانه — برای investor report.
    """
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=365 * years)
    signals = await _fetch_closed_signals(db, symbol=symbol, start_date=start, end_date=end)
    times, pnls, _ = _signals_to_series(signals)

    heatmap = build_monthly_heatmap(
        timestamps=times,
        pnls=pnls,
        initial_balance=initial_balance,
    )
    return {
        "symbol": symbol,
        "n_signals": len(signals),
        "initial_balance": initial_balance,
        "rows": [row.to_dict() for row in heatmap],
    }


@router.get("/rolling-cagr")
async def get_rolling_cagr(
    symbol: Optional[str] = Query(None, max_length=10),
    window_days: int = Query(365, ge=30, le=1095),
    step_days: int = Query(7, ge=1, le=30),
    initial_balance: float = Query(10_000.0, ge=100.0),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """rolling CAGR در پنجره‌ی متحرک — معمولاً ۱۲ ماهه."""
    signals = await _fetch_closed_signals(db, symbol=symbol)
    times, pnls, _ = _signals_to_series(signals)

    points = rolling_cagr(
        timestamps=times,
        pnls=pnls,
        window_days=window_days,
        step_days=step_days,
        initial_balance=initial_balance,
    )
    return {
        "symbol": symbol,
        "window_days": window_days,
        "step_days": step_days,
        "n_points": len(points),
        "points": [p.to_dict() for p in points],
    }


@router.get("/rolling-sharpe")
async def get_rolling_sharpe(
    symbol: Optional[str] = Query(None, max_length=10),
    window_days: int = Query(90, ge=30, le=365),
    step_days: int = Query(7, ge=1, le=30),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """rolling Sharpe ratio."""
    signals = await _fetch_closed_signals(db, symbol=symbol)
    times, _, r_multiples = _signals_to_series(signals)

    points = rolling_sharpe(
        timestamps=times,
        r_multiples=r_multiples,
        window_days=window_days,
        step_days=step_days,
    )
    return {
        "symbol": symbol,
        "window_days": window_days,
        "n_points": len(points),
        "points": [p.to_dict() for p in points],
    }


@router.get("/drawdown-periods")
async def get_drawdown_periods(
    symbol: Optional[str] = Query(None, max_length=10),
    min_dd_pct: float = Query(0.01, ge=0.001, le=0.5, description="حداقل DD برای ثبت"),
    initial_balance: float = Query(10_000.0, ge=100.0),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """تمام drawdown periods — مرتب از worst به best."""
    signals = await _fetch_closed_signals(db, symbol=symbol)
    times, pnls, _ = _signals_to_series(signals)

    periods = identify_drawdown_periods(
        timestamps=times,
        pnls=pnls,
        initial_balance=initial_balance,
        min_drawdown_pct=min_dd_pct,
    )
    return {
        "symbol": symbol,
        "min_dd_pct": min_dd_pct,
        "initial_balance": initial_balance,
        "n_periods": len(periods),
        "periods": [p.to_dict() for p in periods[:50]],  # top 50
    }


@router.post("/benchmark-compare")
async def post_benchmark_compare(
    body: dict,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    مقایسه‌ی strategy با یک benchmark دلخواه.

    Body:
        {
          "benchmark_name": "DXY",
          "benchmark_returns": [0.001, -0.002, ...],   # per-period
          "symbol": "EURUSD" (اختیاری),
          "periods_per_year": 252 (اختیاری),
          "risk_free_rate": 0.04 (اختیاری)
        }
    """
    benchmark_name = body.get("benchmark_name", "BENCHMARK")
    benchmark_returns = body.get("benchmark_returns")
    if not isinstance(benchmark_returns, list) or len(benchmark_returns) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="benchmark_returns باید لیستی از حداقل ۱۰ عدد باشد.",
        )
    try:
        benchmark_returns = [float(x) for x in benchmark_returns]
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="benchmark_returns همگی باید عدد باشند.",
        )

    symbol = body.get("symbol")
    signals = await _fetch_closed_signals(db, symbol=symbol)
    _, _, r_multiples = _signals_to_series(signals)

    if len(r_multiples) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="strategy returns کافی نیست (< 10).",
        )

    comparison = compare_to_benchmark(
        strategy_returns=r_multiples,
        benchmark_returns=benchmark_returns,
        benchmark_name=benchmark_name,
        periods_per_year=int(body.get("periods_per_year", 252)),
        risk_free_rate=float(body.get("risk_free_rate", 0.0)),
    )
    return comparison.to_dict()
