"""
محدودکننده نرخ درخواست بر اساس ردیس.

این ماژول میان‌افزاری را پیاده‌سازی می‌کند که تعداد درخواست‌های هر IP را
در بازه‌های زمانی مشخص محدود می‌کند و از سوءاستفاده جلوگیری می‌کند.
"""

import time
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)

# سقفِ پیش‌فرض سخاوتمند: پنل/داشبورد polling دارند و SPA هنگامِ لود ده‌ها درخواست
# می‌فرستد. per-IP-per-path است؛ سوءاستفادهٔ واقعی با حدِ سختِ auth گرفته می‌شود.
DEFAULT_RATE_LIMIT = 240
DEFAULT_WINDOW_SECONDS = 60

ENDPOINT_LIMITS: dict[str, tuple[int, int]] = {
    # auth سخت‌گیرانه (ضدِ brute-force)
    "/auth/login": (5, 60),
    "/auth/refresh": (10, 60),
    "/signals/manual": (10, 60),
    "/broadcasts": (5, 60),
    # endpointهای polling/agent با سقفِ بالا (احراز‌شده‌اند)
    "/ea/": (600, 60),
    "/admin/panel-users": (300, 60),
    "/user/copy-status": (300, 60),
}


def _get_client_ip(request: Request) -> str:
    """
    استخراج آدرس IP واقعی کلاینت.

    ابتدا هدر X-Real-IP بررسی می‌شود (که توسط nginx از $remote_addr پر می‌شود
    و قابل جعل توسط کلاینت نیست). در صورت نبود، آخرین مقدار X-Forwarded-For
    (نزدیک‌ترین پراکسی) استفاده می‌شود؛ مقادیر ابتدایی توسط کلاینت قابل جعل‌اند.
    در صورت عدم وجود هدرها، آدرس IP مستقیم کلاینت استفاده می‌شود.
    """
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[-1].strip()

    if request.client:
        return request.client.host
    return "unknown"


def _get_limit_for_path(path: str) -> tuple[int, int]:
    """
    تعیین محدودیت نرخ برای مسیر درخواست.

    مسیرهای خاص محدودیت‌های سفارشی دارند. سایر مسیرها از مقدار پیش‌فرض
    استفاده می‌کنند.
    """
    for endpoint_path, limit_config in ENDPOINT_LIMITS.items():
        if path.startswith(endpoint_path):
            return limit_config

    global_limit = getattr(settings, "RATE_LIMIT_PER_MINUTE", DEFAULT_RATE_LIMIT)
    global_window = getattr(settings, "RATE_LIMIT_WINDOW_SECONDS", DEFAULT_WINDOW_SECONDS)
    return (global_limit, global_window)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    میان‌افزار محدودکننده نرخ درخواست.

    از الگوریتم پنجره لغزان (Sliding Window) با ذخیره‌سازی در ردیس
    استفاده می‌کند. هر IP در بازه زمانی مشخص تعداد محدودی درخواست
    می‌تواند ارسال کند.
    """

    EXCLUDED_PATHS = {"/health", "/metrics", "/docs", "/redoc", "/openapi.json"}

    async def dispatch(self, request: Request, call_next):
        """
        پردازش درخواست و اعمال محدودیت نرخ.

        تعداد درخواست‌های IP در پنجره زمانی فعلی را بررسی می‌کند.
        در صورت تجاوز از حد مجاز، پاسخ 429 برگردانده می‌شود.
        """
        path = request.url.path

        if path in self.EXCLUDED_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        client: Optional[object] = None
        try:
            client = redis_client.client
        except RuntimeError:
            logger.warning("ردیس در دسترس نیست. محدودکننده نرخ غیرفعال شد.")
            return await call_next(request)

        client_ip = _get_client_ip(request)
        max_requests, window_seconds = _get_limit_for_path(path)

        redis_key = f"rate_limit:{client_ip}:{path}"
        now = time.time()
        window_start = now - window_seconds

        try:
            pipe = client.pipeline()
            pipe.zremrangebyscore(redis_key, 0, window_start)
            pipe.zadd(redis_key, {str(now): now})
            pipe.zcard(redis_key)
            pipe.expire(redis_key, window_seconds + 1)
            results = await pipe.execute()

            request_count = results[2]
        except Exception as exc:
            logger.warning("خطا در محدودکننده نرخ: %s", exc)
            return await call_next(request)

        # بررسی تجاوز از حد مجاز پیش از اجرای هندلر (call_next) انجام می‌شود
        # تا درخواست‌های بیش از حد، منابع سنگین (bcrypt، JWT، DB) را مصرف نکنند.
        if request_count > max_requests:
            logger.warning(
                "محدودیت نرخ برای IP %s در مسیر %s. تعداد: %d/%d",
                client_ip,
                path,
                request_count,
                max_requests,
            )
            retry_after = int(window_seconds - (now - window_start))
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "تعداد درخواست‌ها بیش از حد مجاز است. لطفا کمی صبر کنید.",
                    "retry_after": max(1, retry_after),
                },
                headers={
                    "Retry-After": str(max(1, retry_after)),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(now + window_seconds)),
                },
            )

        response = await call_next(request)

        remaining = max(0, max_requests - request_count)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(now + window_seconds))

        return response
