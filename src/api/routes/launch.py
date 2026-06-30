"""
مسیرهای API launch — preflight check و divergence report.

این endpoint ها برای صفحه‌ی launch readiness در admin panel استفاده می‌شوند.
همگی admin-only.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from src.api.deps import get_current_admin
from src.core.database import Admin
from src.core.logger import get_logger
from src.launch.paper_trading import PaperTradingConfig, TradingMode
from src.launch.preflight import run_preflight

logger = get_logger(__name__)
router = APIRouter()


@router.get("/preflight")
async def get_preflight(admin: Admin = Depends(get_current_admin)):
    """
    اجرای تمام چک‌های pre-launch.

    خروجی شامل لیست check ها با status هر یک، و فلگ کلی is_ready_for_launch.
    این endpoint سنگین است (DB + Redis connect)، عمداً cache نمی‌شود.
    """
    result = await run_preflight()
    return result.to_dict()


@router.get("/trading-mode")
async def get_trading_mode(admin: Admin = Depends(get_current_admin)):
    """دریافت trading mode فعلی."""
    from src.core.config import settings

    config = PaperTradingConfig.from_settings(settings)
    return {
        "mode": config.mode.value,
        "is_live": config.mode == TradingMode.LIVE,
        "is_paper": config.mode == TradingMode.PAPER,
        "is_disabled": config.mode == TradingMode.DISABLED,
        "beta_channel_id": config.beta_channel_id,
    }


@router.get("/divergence")
async def get_divergence_report(
    paper_run_id: int,
    backtest_run_id: int,
    admin: Admin = Depends(get_current_admin),
):
    """
    گزارش واگرایی بین یک paper trading run و یک backtest run.

    پارامترها:
        paper_run_id: ID از یک BacktestRun که از سیگنال‌های paper ساخته شده
        backtest_run_id: ID از یک BacktestRun طبیعی (روی همان دوره)

    خروجی: DivergenceReport
    """
    from src.backtest.metrics import PerformanceMetrics
    from src.core.database import BacktestRun, async_session_factory
    from src.launch.divergence import compare_paper_with_backtest

    async with async_session_factory() as session:
        paper_run = await session.get(BacktestRun, paper_run_id)
        bt_run = await session.get(BacktestRun, backtest_run_id)

    if paper_run is None or bt_run is None:
        raise HTTPException(status_code=404, detail="یکی از run ها یافت نشد.")
    if paper_run.status != "completed" or bt_run.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="هر دو run باید completed باشند.",
        )

    # ⚠️ Whitelist — جلوگیری از ست شدن فیلدهای خصوصی (_private، dunder)
    _ALLOWED_METRIC_FIELDS = frozenset({
        "total_trades", "winning_trades", "losing_trades", "breakeven_trades",
        "win_rate", "total_net_pips", "total_net_dollar",
        "avg_net_pips", "avg_win_pips", "avg_loss_pips",
        "payoff_ratio", "profit_factor", "expectancy_dollar", "expectancy_r",
        "max_drawdown_r", "max_drawdown_dollar", "max_drawdown_pct",
        "longest_losing_streak", "longest_winning_streak",
        "calmar_ratio", "sharpe_ratio", "sortino_ratio",
        "total_commission_dollar", "total_swap_dollar", "total_spread_cost_pips",
        "avg_duration_minutes",
    })

    def _to_metrics(m_dict: dict) -> PerformanceMetrics:
        m = PerformanceMetrics()
        for key, value in (m_dict or {}).items():
            if (
                key in _ALLOWED_METRIC_FIELDS
                and isinstance(value, (int, float))
                and not isinstance(value, bool)
            ):
                setattr(m, key, value)
        return m

    paper_metrics = _to_metrics(paper_run.metrics_full or {})
    bt_metrics = _to_metrics(bt_run.metrics_full or {})

    period_days = 0
    if paper_run.start_time and paper_run.end_time:
        period_days = (paper_run.end_time - paper_run.start_time).days

    report = compare_paper_with_backtest(
        paper_metrics, bt_metrics, paper_period_days=period_days,
    )
    return report.to_dict()
