"""
Domain exceptions — جایگزین `except Exception` ها.

منطق:
    `except Exception:` خطرناک است چون debugging و monitoring را خراب می‌کند.
    استفاده از custom exceptions اجازه می‌دهد:
        1. خطاهای پیش‌بینی‌شده را از باگ‌های واقعی تفکیک کنیم
        2. Exception handler ها reactive (دقیقاً چه کار کنند) باشند
        3. Sentry / structured logging context بهتری داشته باشند

سلسله‌مراتب:
    CoineProError (base)
    ├── DataFeedError
    │   ├── ConnectorUnavailableError
    │   ├── StaleDataError
    │   └── DataValidationError
    ├── AnalysisError
    │   ├── TechnicalAnalysisError
    │   ├── PatternAnalysisError
    │   └── MLPredictionError
    ├── SignalError
    │   ├── SignalCreationError
    │   ├── SignalNotFoundError
    │   ├── InvalidSignalStateError
    │   └── DuplicateSignalError
    ├── RiskError
    │   ├── RiskGuardError
    │   ├── InsufficientMarginError
    │   ├── DailyLossLimitExceededError
    │   └── PortfolioVaRBreachedError
    └── PersistenceError
        ├── DatabaseError
        └── CacheError
"""

from __future__ import annotations

from typing import Any, Optional


class CoineProError(Exception):
    """Base exception برای تمام خطاهای domain پروژه."""

    default_message: str = "خطای ناشناخته در CoinePro"

    def __init__(
        self,
        message: Optional[str] = None,
        *,
        context: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message or self.default_message)
        self.context = context or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.__class__.__name__,
            "message": str(self),
            "context": dict(self.context),
        }


# ── Data Feed Errors ─────────────────────────────────────


class DataFeedError(CoineProError):
    """خطا در data feed."""
    default_message = "خطا در منبع داده"


class ConnectorUnavailableError(DataFeedError):
    """Connector نمی‌تواند کار کند (rate limit، auth، ...)."""
    default_message = "اتصال به broker برقرار نشد"


class StaleDataError(DataFeedError):
    """داده‌ی stale است — timestamp قدیمی."""
    default_message = "داده‌ی منبع قدیمی است"


class DataValidationError(DataFeedError):
    """داده دریافتی نامعتبر است (NaN، negative price، ...)."""
    default_message = "داده‌ی منبع نامعتبر است"


# ── Analysis Errors ──────────────────────────────────────


class AnalysisError(CoineProError):
    """خطا در یک تحلیل‌گر."""
    default_message = "خطا در تحلیل"


class TechnicalAnalysisError(AnalysisError):
    """خطا در محاسبه‌ی اندیکاتورهای تکنیکال."""
    default_message = "خطا در تحلیل تکنیکال"


class PatternAnalysisError(AnalysisError):
    """خطا در تشخیص الگو."""
    default_message = "خطا در تشخیص الگو"


class MLPredictionError(AnalysisError):
    """خطا در پیش‌بینی ML."""
    default_message = "خطا در پیش‌بینی ML"


class InsufficientDataError(AnalysisError):
    """داده‌ی کافی برای تحلیل نیست."""
    default_message = "داده‌ی کافی نیست"


# ── Signal Errors ────────────────────────────────────────


class SignalError(CoineProError):
    """خطا در lifecycle سیگنال."""
    default_message = "خطا در سیگنال"


class SignalCreationError(SignalError):
    """خطا هنگام ساخت سیگنال جدید."""
    default_message = "خطا در ساخت سیگنال"


class SignalNotFoundError(SignalError):
    """سیگنال با ID مشخص یافت نشد."""
    default_message = "سیگنال یافت نشد"


class InvalidSignalStateError(SignalError):
    """انتقال state غیرمجاز در state machine."""
    default_message = "تغییر وضعیت سیگنال نامعتبر است"


class DuplicateSignalError(SignalError):
    """سیگنال duplicate — idempotency key مشابه."""
    default_message = "سیگنال تکراری"


# ── Risk Errors ──────────────────────────────────────────


class RiskError(CoineProError):
    """خطا در risk management."""
    default_message = "خطای ریسک"


class RiskGuardError(RiskError):
    """RiskGuard سیگنال را رد کرد."""
    default_message = "RiskGuard سیگنال را رد کرد"


class InsufficientMarginError(RiskError):
    """margin کافی نیست برای position جدید."""
    default_message = "margin کافی نیست"


class DailyLossLimitExceededError(RiskError):
    """daily loss limit hit شد."""
    default_message = "حد زیان روزانه رد شد"


class PortfolioVaRBreachedError(RiskError):
    """VaR portfolio بیش از حد."""
    default_message = "VaR portfolio بیش از حد مجاز"


class CorrelationRiskError(RiskError):
    """exposure بیش از حد به یک ارز."""
    default_message = "exposure به یک ارز بیش از حد"


# ── Persistence Errors ──────────────────────────────────


class PersistenceError(CoineProError):
    """خطا در ذخیره‌سازی (DB یا cache)."""
    default_message = "خطا در ذخیره‌سازی"


class DatabaseError(PersistenceError):
    """خطا در DB query یا transaction."""
    default_message = "خطا در دیتابیس"


class CacheError(PersistenceError):
    """خطا در Redis cache."""
    default_message = "خطا در cache"


class ConcurrencyConflictError(PersistenceError):
    """race condition — version mismatch."""
    default_message = "تداخل همزمانی"
