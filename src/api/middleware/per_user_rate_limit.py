"""
Rate limiter per-user — به‌جای per-IP.

منطق متخصص:
    Rate limiter per-IP در پشت یک reverse proxy (Cloudflare، LB) به این
    معنی است که هزاران user یک quota share می‌کنند → یک bad user تمام
    بقیه را trip می‌کند.

    Per-user limiter:
        - identify توسط JWT sub (user_id)
        - fallback به IP اگر anonymous
        - quotas مختلف per tier (free vs premium)
        - sliding window با Redis sorted set
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.core.security import verify_access_token

logger = get_logger(__name__)


@dataclass(frozen=True)
class RateLimitQuota:
    """quota برای یک tier کاربر."""

    requests_per_minute: int
    burst_capacity: int  # ظرفیت کوتاه‌مدت برای spike

    @property
    def window_seconds(self) -> int:
        return 60


# ── tier configurations ──
_QUOTAS: dict[str, RateLimitQuota] = {
    "anonymous": RateLimitQuota(requests_per_minute=20, burst_capacity=30),
    "free": RateLimitQuota(requests_per_minute=60, burst_capacity=100),
    "premium": RateLimitQuota(requests_per_minute=300, burst_capacity=500),
    "admin": RateLimitQuota(requests_per_minute=600, burst_capacity=1000),
}

# مسیرهایی که rate limit نمی‌شوند
_EXEMPT_PATHS: set[str] = {
    "/health",
    "/health/ready",
    "/health/live",
    "/metrics",
    "/docs",
    "/redoc",
    "/openapi.json",
}


def _extract_user_id_from_token(authorization: Optional[str]) -> Optional[str]:
    """استخراج sub از JWT — silent fail."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization[7:]
    try:
        payload = verify_access_token(token)
        if payload is None:
            return None
        return str(payload.get("sub")) if payload.get("sub") else None
    except Exception:
        return None


def _extract_tier_from_token(authorization: Optional[str]) -> str:
    """استخراج tier از JWT (role یا plan)."""
    if not authorization:
        return "anonymous"
    token = authorization[7:] if authorization.lower().startswith("bearer ") else authorization
    try:
        payload = verify_access_token(token)
        if payload is None:
            return "anonymous"
        role = payload.get("role", "").lower()
        if role in ("admin", "superadmin"):
            return "admin"
        plan = payload.get("plan", "").lower()
        if plan in ("premium", "pro", "vip"):
            return "premium"
        return "free"
    except Exception:
        return "anonymous"


def _client_ip(request: Request) -> str:
    """IP کلاینت با احترام به proxy headers.

    X-Real-IP (که nginx از $remote_addr می‌نویسد) اولویت دارد چون
    client نمی‌تواند آن را spoof کند. در fallback به X-Forwarded-For،
    آخرین entry (نزدیک‌ترین proxy مورد اعتماد) استفاده می‌شود — نه
    اولین که client-controlled است.
    """
    real = request.headers.get("X-Real-IP")
    if real:
        return real.strip()
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


class PerUserRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiter per-user (با fallback به per-IP).

    الگوریتم: sliding window log (Redis sorted set).
    storage: risk:ratelimit:{identity}

    در صورت قطعی Redis، silent allow (fail-open برای availability).
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in _EXEMPT_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        # تشخیص identity و tier
        auth_header = request.headers.get("Authorization")
        user_id = _extract_user_id_from_token(auth_header)
        tier = _extract_tier_from_token(auth_header)

        if user_id:
            identity = f"user:{user_id}"
        else:
            identity = f"ip:{_client_ip(request)}"

        quota = _QUOTAS.get(tier, _QUOTAS["anonymous"])

        try:
            client = redis_client.client
        except Exception:
            # Redis قطع است — fail-open
            return await call_next(request)

        key = f"ratelimit:{identity}"
        now = time.time()
        window_start = now - quota.window_seconds

        try:
            async with client.pipeline(transaction=False) as pipe:
                # حذف entries قدیمی
                pipe.zremrangebyscore(key, 0, window_start)
                # افزودن request فعلی
                pipe.zadd(key, {f"{now}:{id(request)}": now})
                # شمارش
                pipe.zcard(key)
                # تنظیم TTL
                pipe.expire(key, quota.window_seconds + 5)
                results = await pipe.execute()
            count = int(results[2])
        except Exception as exc:
            logger.warning("rate_limit_redis_error", error=str(exc))
            return await call_next(request)

        # بررسی burst
        if count > quota.burst_capacity:
            retry_after = quota.window_seconds
            logger.warning(
                "rate_limit_exceeded",
                identity=identity,
                tier=tier,
                count=count,
                limit=quota.burst_capacity,
                path=path,
            )
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "تعداد درخواست‌ها از حد مجاز عبور کرد.",
                    "retry_after": retry_after,
                    "limit": quota.burst_capacity,
                    "window_seconds": quota.window_seconds,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(quota.burst_capacity),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Tier": tier,
                },
            )

        response = await call_next(request)

        # اضافه‌کردن headers
        remaining = max(0, quota.burst_capacity - count)
        response.headers["X-RateLimit-Limit"] = str(quota.burst_capacity)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Tier"] = tier
        response.headers["X-RateLimit-Reset"] = str(int(now + quota.window_seconds))

        return response
