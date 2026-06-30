"""
ماژول launch — آماده‌سازی نهایی برای production.

شامل:
    - paper_trading: حالت paper برای forward-test بدون انتشار به کاربر
    - divergence: مقایسه‌ی paper با backtest برای تشخیص degradation
    - preflight: چک‌لیست آمادگی pre-launch
    - health_checks: بررسی‌های سلامت گسترده‌تر
"""

from src.launch.paper_trading import (
    PaperTradingConfig,
    TradingMode,
    publish_signal,
    should_publish_to_users,
)
from src.launch.divergence import (
    DivergenceMetric,
    DivergenceReport,
    compare_paper_with_backtest,
)
from src.launch.preflight import (
    PreflightCheck,
    PreflightResult,
    run_preflight,
)

__all__ = [
    "PaperTradingConfig",
    "TradingMode",
    "publish_signal",
    "should_publish_to_users",
    "DivergenceMetric",
    "DivergenceReport",
    "compare_paper_with_backtest",
    "PreflightCheck",
    "PreflightResult",
    "run_preflight",
]
