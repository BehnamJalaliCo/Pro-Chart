"""
Observability — Sentry integration + correlation_id propagation + OpenTelemetry hooks.

منطق:
    در production، debugging یک signal که اشتباه صادر شد، نیاز به trace
    کامل از API → engine → analyzer → ML → tracker → bot دارد. این
    ماژول سه ابزار را در یک facade سبک ارائه می‌دهد:

        1. Sentry: error tracking با context کامل
        2. correlation_id: ID مشترک در تمام services برای trace
        3. OpenTelemetry-ready: span helpers که می‌توانند به Jaeger
           export شوند (اگر OTEL exporter نصب باشد)

    در dev mode تمام این‌ها no-op هستند تا dependencies بار نشوند.
"""

from __future__ import annotations

import contextvars
import functools
import logging
import time
import uuid
from contextlib import contextmanager
from typing import Any, Callable, Optional, TypeVar

T = TypeVar("T")

# ── Context variable — correlation_id برای هر request/task ──
correlation_id_ctx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "correlation_id", default=None,
)

# ── Sentry هنوز init شده یا نه؟ ──
_sentry_initialized: bool = False


# ===========================================================================
# Correlation ID
# ===========================================================================


def new_correlation_id() -> str:
    """تولید یک ID جدید (UUID v4 ساده‌شده)."""
    return uuid.uuid4().hex[:16]


def get_correlation_id() -> Optional[str]:
    """دریافت ID فعلی (یا None اگر context ندارد)."""
    return correlation_id_ctx.get()


def set_correlation_id(cid: Optional[str]) -> contextvars.Token:
    """تنظیم ID برای context فعلی — token برای reset برمی‌گرداند."""
    return correlation_id_ctx.set(cid)


@contextmanager
def correlation_context(cid: Optional[str] = None):
    """
    Context manager برای correlation ID.

    استفاده:
        with correlation_context() as cid:
            logger.info("processing", correlation_id=cid)
            # cid در تمام nested logs دسترس است
    """
    if cid is None:
        cid = new_correlation_id()
    token = set_correlation_id(cid)
    try:
        yield cid
    finally:
        correlation_id_ctx.reset(token)


def correlation_processor(_logger, _method_name, event_dict: dict) -> dict:
    """structlog processor — افزودن correlation_id به هر log."""
    cid = get_correlation_id()
    if cid and "correlation_id" not in event_dict:
        event_dict["correlation_id"] = cid
    return event_dict


# ===========================================================================
# Sentry Integration
# ===========================================================================


def setup_sentry(
    dsn: Optional[str] = None,
    environment: str = "production",
    release: Optional[str] = None,
    traces_sample_rate: float = 0.1,
    profiles_sample_rate: float = 0.0,
    enabled: bool = True,
) -> bool:
    """
    Sentry initialization.

    پارامترها:
        dsn: Sentry DSN (None = disabled)
        environment: "production" | "staging" | "dev"
        release: version tag
        traces_sample_rate: درصد requests که trace کامل می‌شوند (هزینه دارد)
        profiles_sample_rate: درصد requests که profile می‌شوند
        enabled: master switch — اگر False، init نمی‌شود

    خروجی: True اگر Sentry فعال شد، False اگر skip شد.
    """
    global _sentry_initialized
    if not enabled or not dsn:
        return False
    if _sentry_initialized:
        return True

    try:
        import sentry_sdk
        from sentry_sdk.integrations.asyncio import AsyncioIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=dsn,
            environment=environment,
            release=release,
            traces_sample_rate=traces_sample_rate,
            profiles_sample_rate=profiles_sample_rate,
            attach_stacktrace=True,
            send_default_pii=False,
            integrations=[
                AsyncioIntegration(),
                LoggingIntegration(
                    level=logging.INFO,
                    event_level=logging.ERROR,
                ),
                SqlalchemyIntegration(),
            ],
            before_send=_sentry_before_send,
        )
        _sentry_initialized = True
        return True
    except ImportError:
        # sentry_sdk نصب نیست → silent skip
        return False
    except Exception as exc:
        logging.warning("sentry_init_failed: %s", exc)
        return False


def _sentry_before_send(event: dict, hint: dict) -> Optional[dict]:
    """
    pre-send filter — حذف PII + اضافه‌کردن correlation_id.
    """
    # افزودن correlation_id
    cid = get_correlation_id()
    if cid:
        event.setdefault("tags", {})["correlation_id"] = cid

    # حذف headers حساس
    if "request" in event:
        headers = event["request"].get("headers", {})
        for sensitive in ("authorization", "cookie", "x-api-key"):
            for key in list(headers.keys()):
                if key.lower() == sensitive:
                    headers[key] = "[REDACTED]"

    return event


def capture_exception(exc: BaseException, context: Optional[dict] = None) -> None:
    """
    گزارش manual یک exception به Sentry — با extra context.

    اگر Sentry init نشده باشد، silent no-op.
    """
    if not _sentry_initialized:
        return
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            if context:
                for key, value in context.items():
                    scope.set_extra(key, value)
            cid = get_correlation_id()
            if cid:
                scope.set_tag("correlation_id", cid)
            sentry_sdk.capture_exception(exc)
    except Exception:
        pass


def capture_message(message: str, level: str = "info", context: Optional[dict] = None) -> None:
    """گزارش یک پیام بدون exception."""
    if not _sentry_initialized:
        return
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            if context:
                for key, value in context.items():
                    scope.set_extra(key, value)
            sentry_sdk.capture_message(message, level=level)
    except Exception:
        pass


# ===========================================================================
# Tracing / Spans (OpenTelemetry-compatible facade)
# ===========================================================================


@contextmanager
def trace_span(
    name: str,
    attributes: Optional[dict[str, Any]] = None,
):
    """
    Span helper — اگر OpenTelemetry نصب باشد span می‌سازد، در غیر آن صورت
    یک timer ساده‌ی structured-logging.

    استفاده:
        with trace_span("analyze_symbol", attributes={"symbol": "EURUSD"}):
            await engine.analyze(...)
    """
    start = time.monotonic()
    try:
        from opentelemetry import trace as otel_trace
        tracer = otel_trace.get_tracer("coinepro-fx")
        with tracer.start_as_current_span(name, attributes=attributes or {}):
            yield
        return
    except ImportError:
        pass

    # fallback: timer
    try:
        yield
    finally:
        duration_ms = (time.monotonic() - start) * 1000
        # log به structlog
        try:
            from src.core.logger import get_logger
            get_logger("trace").debug(
                "span_completed",
                span=name,
                duration_ms=round(duration_ms, 2),
                attributes=attributes or {},
            )
        except Exception:
            pass


def traced(name: Optional[str] = None) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator که تابع را در یک span می‌گذارد.

    @traced("ml_predict")
    async def predict(symbol): ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        span_name = name or f"{func.__module__}.{func.__name__}"

        if _is_async_func(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                with trace_span(span_name):
                    return await func(*args, **kwargs)
            return async_wrapper  # type: ignore
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                with trace_span(span_name):
                    return func(*args, **kwargs)
            return sync_wrapper  # type: ignore

    return decorator


def _is_async_func(func: Callable) -> bool:
    import asyncio
    return asyncio.iscoroutinefunction(func)


# ===========================================================================
# FastAPI middleware integration
# ===========================================================================


class CorrelationIdMiddleware:
    """
    Starlette middleware که correlation_id را روی هر request set می‌کند.

    استفاده:
        app.add_middleware(CorrelationIdMiddleware)

    رفتار:
        - header X-Correlation-ID از client → استفاده
        - اگر نبود، یک ID جدید می‌سازد
        - در context var برای دسترسی از everywhere
        - در response header X-Correlation-ID echo می‌کند
    """

    def __init__(self, app, header_name: str = "X-Correlation-ID") -> None:
        self.app = app
        self.header_name = header_name
        self._header_bytes = header_name.lower().encode()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # دریافت یا تولید correlation_id
        headers = dict(scope.get("headers", []))
        cid_bytes = headers.get(self._header_bytes)
        cid = cid_bytes.decode() if cid_bytes else new_correlation_id()
        token = set_correlation_id(cid)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                # اضافه‌کردن header به response
                response_headers = list(message.get("headers", []))
                response_headers.append(
                    (self._header_bytes, cid.encode())
                )
                message["headers"] = response_headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            correlation_id_ctx.reset(token)
