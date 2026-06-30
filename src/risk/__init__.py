"""
ماژول مدیریت ریسک حرفه‌ای — لایه‌ی محافظ قبل از صدور سیگنال.

شامل:
    - symbol_config: تنظیمات ATR/RR per نماد
    - daily_loss_limit: قطع‌کننده‌ی روزانه پس از زیان مشخص
    - correlation: کنترل هم‌جهتی معاملات باز روی ارزهای مرتبط
    - session_filter: محدودکردن سیگنال به session مناسب نماد
    - weekend_filter: جلوگیری از گپ آخر هفته
    - regime_detector: تشخیص رژیم بازار (trending/ranging)
    - guard: API یکپارچه که همه‌ی فیلترها را اعمال می‌کند
"""

from src.risk.symbol_config import SymbolRiskConfig, get_symbol_config
from src.risk.daily_loss_limit import DailyLossLimit
from src.risk.correlation import CorrelationGuard, decompose_currency_legs
from src.risk.session_filter import (
    Session,
    SymbolSessionPolicy,
    current_sessions,
    is_session_allowed,
)
from src.risk.weekend_filter import is_weekend_blackout
from src.risk.regime_detector import MarketRegime, detect_regime
from src.risk.guard import RiskGuard, GuardResult, RejectionReason

__all__ = [
    "SymbolRiskConfig",
    "get_symbol_config",
    "DailyLossLimit",
    "CorrelationGuard",
    "decompose_currency_legs",
    "Session",
    "SymbolSessionPolicy",
    "current_sessions",
    "is_session_allowed",
    "is_weekend_blackout",
    "MarketRegime",
    "detect_regime",
    "RiskGuard",
    "GuardResult",
    "RejectionReason",
]
