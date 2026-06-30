"""
مسیرهای API بک‌تست.

نمایش run‌های بک‌تست ثبت‌شده، جزئیات یک run، و راه‌اندازی run جدید.
راه‌اندازی به‌صورت async است: run در پس‌زمینه اجرا می‌شود (Celery یا
BackgroundTask) و کلاینت ID را برای polling دریافت می‌کند.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_admin, get_db
from src.core.database import Admin, BacktestRun, BacktestTrade
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


# ── مدل‌های Pydantic ──────────────────────────────────


class BacktestRunSummary(BaseModel):
    """خلاصه‌ی یک run بک‌تست برای نمایش در لیست."""

    id: int
    name: str
    kind: str
    status: str
    symbol: Optional[str] = None
    timeframe: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    initial_balance: Optional[float] = None
    final_balance: Optional[float] = None
    total_signals: Optional[int] = None
    trades_executed: Optional[int] = None
    win_rate: Optional[float] = None
    profit_factor: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    max_drawdown_pct: Optional[float] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BacktestTradeOut(BaseModel):
    """یک معامله‌ی بک‌تست."""

    id: int
    symbol: str
    direction: str
    entry_time: datetime
    entry_price: float
    exit_time: datetime
    exit_price: float
    exit_reason: str
    lot_size: float
    net_pips: Optional[float] = None
    net_pnl_dollar: Optional[float] = None
    r_multiple: Optional[float] = None
    duration_minutes: Optional[int] = None
    tags: Optional[dict] = None

    class Config:
        from_attributes = True


class BacktestRunDetail(BacktestRunSummary):
    """جزئیات کامل یک run شامل متریک، attribution و چند معامله نمونه."""

    metrics_full: Optional[dict] = None
    attribution: Optional[dict] = None
    config: Optional[dict] = None
    error_message: Optional[str] = None
    sample_trades: List[BacktestTradeOut] = Field(default_factory=list)


class TriggerBacktestRequest(BaseModel):
    """درخواست راه‌اندازی یک bock‌تست جدید."""

    name: str = Field(..., min_length=3, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    kind: str = Field("replay", pattern="^(replay|walk_forward)$")
    symbol: Optional[str] = Field(None, max_length=10)
    timeframe: Optional[str] = Field("H1", max_length=5)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    initial_balance: float = Field(10_000.0, ge=100.0)
    risk_per_trade_pct: float = Field(1.0, ge=0.1, le=10.0)


# ── Endpoint ها ───────────────────────────────────────


@router.get("/runs", response_model=List[BacktestRunSummary])
async def list_runs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    symbol: Optional[str] = Query(None, max_length=10),
    status_filter: Optional[str] = Query(None, alias="status", max_length=20),
    db: AsyncSession = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """
    لیست run‌های بک‌تست به‌ترتیب جدید به قدیم.

    قابلیت فیلتر بر اساس نماد یا وضعیت.
    """
    stmt = select(BacktestRun).order_by(desc(BacktestRun.created_at))
    if symbol:
        stmt = stmt.where(BacktestRun.symbol == symbol)
    if status_filter:
        stmt = stmt.where(BacktestRun.status == status_filter)
    stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [BacktestRunSummary.model_validate(r) for r in rows]


@router.get("/runs/{run_id}", response_model=BacktestRunDetail)
async def get_run(
    run_id: int,
    sample_size: int = Query(20, ge=0, le=200, description="تعداد معامله‌ی نمونه برای نمایش"),
    db: AsyncSession = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """
    جزئیات یک run شامل متریک کامل، attribution و چند معامله نمونه.
    """
    row = await db.get(BacktestRun, run_id)
    if row is None:
        raise HTTPException(status_code=404, detail="run یافت نشد.")

    detail = BacktestRunDetail.model_validate(row)
    if sample_size > 0 and row.trades_executed:
        trades_stmt = (
            select(BacktestTrade)
            .where(BacktestTrade.run_id == run_id)
            .order_by(BacktestTrade.entry_time)
            .limit(sample_size)
        )
        trades_result = await db.execute(trades_stmt)
        detail.sample_trades = [
            BacktestTradeOut.model_validate(t) for t in trades_result.scalars().all()
        ]
    return detail


@router.get("/runs/{run_id}/trades", response_model=List[BacktestTradeOut])
async def get_run_trades(
    run_id: int,
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    symbol: Optional[str] = Query(None, max_length=10),
    db: AsyncSession = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """لیست کامل معاملات یک run با pagination."""
    if (await db.get(BacktestRun, run_id)) is None:
        raise HTTPException(status_code=404, detail="run یافت نشد.")
    stmt = (
        select(BacktestTrade)
        .where(BacktestTrade.run_id == run_id)
        .order_by(BacktestTrade.entry_time)
    )
    if symbol:
        stmt = stmt.where(BacktestTrade.symbol == symbol)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return [BacktestTradeOut.model_validate(t) for t in result.scalars().all()]


@router.post("/runs", response_model=BacktestRunSummary, status_code=status.HTTP_202_ACCEPTED)
async def trigger_backtest(
    body: TriggerBacktestRequest,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """
    راه‌اندازی یک run بک‌تست جدید.

    رفتار async:
        - رکورد BacktestRun با status='pending' ساخته می‌شود
        - یک background task اجرا (در نسخه‌ی production: Celery task)
        - ID به کلاینت برمی‌گردد تا با /runs/{id} وضعیت را polling کند
    """
    run = BacktestRun(
        name=body.name,
        description=body.description,
        kind=body.kind,
        status="pending",
        symbol=body.symbol,
        timeframe=body.timeframe,
        start_time=body.start_time,
        end_time=body.end_time,
        initial_balance=body.initial_balance,
        config={
            "risk_per_trade_pct": body.risk_per_trade_pct,
            "requested_by": admin.username,
            "requested_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    db.add(run)
    await db.flush()
    run_id = run.id

    # task پس‌زمینه — در production این به Celery منتقل می‌شود
    background.add_task(_execute_backtest_in_background, run_id, body.model_dump())

    logger.info(
        "backtest_run_queued",
        run_id=run_id,
        symbol=body.symbol,
        kind=body.kind,
        admin=admin.username,
    )
    return BacktestRunSummary.model_validate(run)


@router.delete("/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """حذف یک run و تمام معاملات مرتبط (CASCADE)."""
    row = await db.get(BacktestRun, run_id)
    if row is None:
        raise HTTPException(status_code=404, detail="run یافت نشد.")
    await db.delete(row)
    logger.info("backtest_run_deleted", run_id=run_id, admin=admin.username)


# ── منطق اجرا (در نسخه‌ی فعلی stub، در فاز بعد به Celery تبدیل می‌شود) ──


async def _execute_backtest_in_background(run_id: int, params: dict) -> None:
    """
    اجرای واقعی backtest در پس‌زمینه.

    مراحل:
        1) status = running
        2) load سیگنال‌های تاریخی از signals table (با فیلتر symbol/timeframe/تاریخ)
        3) load کندل‌های آینده از candles table per (symbol, timeframe)
        4) ساخت BacktestSignal از Signal ORM
        5) فراخوانی BacktestEngine.run
        6) persist BacktestTrade ها در DB
        7) ذخیره‌ی metrics و attribution در BacktestRun.metrics_full
        8) status = completed
    """
    from sqlalchemy import select, and_

    from src.backtest.engine import BacktestEngine, BacktestSignal
    from src.core.database import (
        BacktestRun, BacktestTrade, Signal, async_session_factory,
    )
    from src.data.candle_builder import CandleBuilder

    async with async_session_factory() as session:
        run = await session.get(BacktestRun, run_id)
        if run is None:
            logger.error("backtest_run_missing", run_id=run_id)
            return
        try:
            run.status = "running"
            await session.commit()

            # ── ۱) سیگنال‌های تاریخی ──
            stmt = select(Signal).where(Signal.status.in_(["CLOSED", "tp_hit", "sl_hit", "closed"]))
            if params.get("symbol"):
                stmt = stmt.where(Signal.symbol == params["symbol"])
            if params.get("start_time"):
                stmt = stmt.where(Signal.created_at >= params["start_time"])
            if params.get("end_time"):
                stmt = stmt.where(Signal.created_at <= params["end_time"])
            stmt = stmt.order_by(Signal.created_at)

            result = await session.execute(stmt)
            historical_signals = result.scalars().all()

            if not historical_signals:
                run.status = "failed"
                run.error_message = "هیچ سیگنال تاریخی برای این پارامترها یافت نشد."
                run.completed_at = datetime.now(timezone.utc)
                await session.commit()
                return

            timeframe = params.get("timeframe", "H1")

            # ── ۲) ساخت BacktestSignal از Signal ORM ──
            bt_signals: list[BacktestSignal] = []
            symbols_needed: set[str] = set()
            for sig in historical_signals:
                if sig.sl is None or sig.tp1 is None or sig.entry_price is None:
                    continue
                try:
                    bt_signals.append(BacktestSignal(
                        symbol=sig.symbol,
                        direction=sig.direction,
                        entry_time=sig.created_at,
                        entry_price=float(sig.entry_price),
                        sl=float(sig.sl),
                        tp1=float(sig.tp1),
                        tp2=float(sig.tp2) if sig.tp2 is not None else None,
                        tp3=float(sig.tp3) if sig.tp3 is not None else None,
                        technical_score=float(sig.technical_score or 50.0),
                        pattern_score=float(sig.pattern_score or 50.0),
                        ml_score=float(sig.ml_score or 50.0),
                        signal_score=float(sig.signal_score or 50.0),
                        metadata={"signal_id": sig.id},
                    ))
                    symbols_needed.add(sig.symbol)
                except Exception as parse_err:
                    logger.warning("bt_signal_parse_failed", id=sig.id, error=str(parse_err))

            if not bt_signals:
                run.status = "failed"
                run.error_message = "هیچ سیگنال معتبر برای backtest وجود ندارد."
                run.completed_at = datetime.now(timezone.utc)
                await session.commit()
                return

            # ── ۳) لود کندل‌های future per (symbol, timeframe) ──
            candles_map: dict[tuple[str, str], Any] = {}
            for symbol in symbols_needed:
                try:
                    df = await CandleBuilder.get_candles(
                        session, symbol, timeframe, count=10_000,
                    )
                    if df is not None and not df.empty:
                        candles_map[(symbol, timeframe)] = df
                except Exception as fetch_err:
                    logger.warning("bt_candles_fetch_failed", symbol=symbol, error=str(fetch_err))

            if not candles_map:
                run.status = "failed"
                run.error_message = "هیچ کندل تاریخی برای backtest یافت نشد."
                run.completed_at = datetime.now(timezone.utc)
                await session.commit()
                return

            # ── ۴) اجرای engine ──
            engine = BacktestEngine(
                initial_balance=float(run.initial_balance or 10_000.0),
            )
            bt_result = engine.run(
                name=run.name,
                signals=bt_signals,
                candles_by_symbol_tf=candles_map,
                primary_timeframe=timeframe,
                risk_per_trade_pct=float(
                    (run.config or {}).get("risk_per_trade_pct", 1.0)
                ),
            )

            # ── ۵) persist trades ──
            for trade in bt_result.trades:
                session.add(BacktestTrade(
                    run_id=run_id,
                    symbol=trade.symbol,
                    direction=trade.direction,
                    entry_time=trade.entry_time,
                    entry_price=trade.entry_price,
                    exit_time=trade.exit_time,
                    exit_price=trade.exit_price,
                    exit_reason=trade.exit_reason.value,
                    lot_size=trade.lot_size,
                    gross_pips=trade.gross_pips,
                    net_pips=trade.net_pips,
                    gross_pnl_dollar=trade.gross_pnl_dollar,
                    commission_dollar=trade.commission_dollar,
                    swap_dollar=trade.swap_dollar,
                    net_pnl_dollar=trade.net_pnl_dollar,
                    r_multiple=trade.r_multiple,
                    duration_minutes=trade.duration_minutes,
                    tags=trade.tags,
                ))

            # ── ۶) ذخیره‌ی نتیجه ──
            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            run.total_signals = bt_result.total_signals
            run.trades_executed = len(bt_result.trades)
            run.final_balance = bt_result.final_balance
            run.win_rate = bt_result.metrics.win_rate
            run.profit_factor = min(bt_result.metrics.profit_factor, 999.999)
            run.sharpe_ratio = bt_result.metrics.sharpe_ratio
            run.max_drawdown_pct = bt_result.metrics.max_drawdown_pct
            run.metrics_full = bt_result.metrics.to_dict()
            run.attribution = {
                k: v.to_dict() for k, v in bt_result.attribution_by_component.items()
            }

            await session.commit()
            logger.info(
                "backtest_run_completed",
                run_id=run_id,
                trades=len(bt_result.trades),
                win_rate=bt_result.metrics.win_rate,
            )
        except Exception as exc:
            run.status = "failed"
            run.error_message = str(exc)[:1000]
            run.completed_at = datetime.now(timezone.utc)
            try:
                await session.commit()
            except Exception:
                await session.rollback()
            logger.error("backtest_run_failed", run_id=run_id, error=str(exc))
