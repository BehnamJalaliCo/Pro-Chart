"""سیستم لاگینگ حرفه‌ای با structlog — مع filter for secrets."""

from __future__ import annotations

import logging
import re
import sys
from typing import Any, Mapping

import structlog


# ── الگوهای کلیدواژه‌های حساس ──────────────────────────────
# کلیدهایی که اگر در dict event یا EventDict باشند، مقدارشان حذف می‌شود
_SECRET_KEY_PATTERNS: list[re.Pattern] = [
    re.compile(p, re.IGNORECASE) for p in [
        r"^password$",
        r"^pass$",
        r".*_password$",
        r".*_secret$",
        r"^secret$",
        r"^token$",
        r".*_token$",
        r"^api[_-]?key$",
        r"^jwt$",
        r"^authorization$",
        r"^bearer$",
        r"^refresh_token$",
        r"^access_token$",
        r"^session$",
        r"^cookie$",
        r"^private[_-]?key$",
    ]
]

# الگوهایی که در رشته‌ها (مقدار) جستجو می‌شوند و sanitize می‌شوند
_SECRET_VALUE_PATTERNS: list[tuple[re.Pattern, str]] = [
    # JWT token (eyJ...)
    (re.compile(r"\beyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\b"), "[JWT_REDACTED]"),
    # Bearer token
    (re.compile(r"(?i)Bearer\s+[A-Za-z0-9._\-]{20,}"), "Bearer [REDACTED]"),
    # API key الگو (مثل abc_123_long_random)
    (re.compile(r"\b(sk|pk|api)_[A-Za-z0-9]{20,}\b"), "[API_KEY_REDACTED]"),
]


REDACTED = "[REDACTED]"


def _is_secret_key(key: str) -> bool:
    """آیا این کلید نام حساسی دارد؟"""
    for pat in _SECRET_KEY_PATTERNS:
        if pat.match(key):
            return True
    return False


def _sanitize_string(value: str) -> str:
    """پاک‌سازی الگوهای حساس از یک string."""
    out = value
    for pat, repl in _SECRET_VALUE_PATTERNS:
        out = pat.sub(repl, out)
    return out


def _sanitize_value(value: Any) -> Any:
    """sanitize یک مقدار به‌صورت بازگشتی."""
    if isinstance(value, str):
        return _sanitize_string(value)
    if isinstance(value, Mapping):
        return {k: (REDACTED if _is_secret_key(str(k)) else _sanitize_value(v))
                for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return type(value)(_sanitize_value(v) for v in value)
    return value


def secret_redactor(_logger, _method_name, event_dict: dict) -> dict:
    """
    structlog processor — حذف secrets از event dict.

    این processor قبل از render نهایی اجرا می‌شود و:
        - فیلدهایی با نام حساس را redact می‌کند
        - JWT/Bearer token در رشته‌ها را redact می‌کند
        - به‌صورت بازگشتی روی dict های تو‌در‌تو کار می‌کند
    """
    clean: dict = {}
    for key, value in event_dict.items():
        if _is_secret_key(str(key)):
            clean[key] = REDACTED
        else:
            clean[key] = _sanitize_value(value)
    return clean


def setup_logging(log_level: str = "INFO") -> None:
    """راه‌اندازی لاگینگ ساختاریافته با redaction امنیتی."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            secret_redactor,
            structlog.processors.JSONRenderer(ensure_ascii=False),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level.upper(), logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    # تنظیم لاگینگ استاندارد پایتون
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper(), logging.INFO),
    )

    # کاهش نویز لاگ‌های کتابخانه‌های خارجی
    for name in ("httpx", "httpcore", "asyncio", "aiogram", "sqlalchemy.engine"):
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """دریافت لاگر با نام مشخص."""
    return structlog.get_logger(name)
