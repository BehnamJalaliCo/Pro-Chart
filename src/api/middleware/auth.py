"""
میان‌افزار احراز هویت JWT.

این ماژول میان‌افزاری را پیاده‌سازی می‌کند که توکن‌های JWT را در هدر
درخواست بررسی کرده و اطلاعات کاربر را به درخواست اضافه می‌کند.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from src.core.logger import get_logger
from src.core.security import verify_access_token

logger = get_logger(__name__)

EXCLUDED_PATHS = {
    "/health",
    "/metrics",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/auth/login",
    "/auth/refresh",
}

EXCLUDED_PREFIXES = (
    "/ws/",
    "/articles",
)


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    میان‌افزار احراز هویت JWT.

    این میان‌افزار تمام درخواست‌ها را بررسی کرده و در صورت وجود توکن معتبر،
    اطلاعات کاربر را به state درخواست اضافه می‌کند. مسیرهای عمومی از
    بررسی مستثنی هستند.
    """

    async def dispatch(self, request: Request, call_next):
        """
        پردازش هر درخواست ورودی.

        توکن JWT را از هدر Authorization استخراج و اعتبارسنجی می‌کند.
        در صورت معتبر بودن، اطلاعات پی‌لود را به request.state اضافه می‌کند.
        مسیرهای مستثنی بدون بررسی عبور داده می‌شوند.
        """
        path = request.url.path

        if path in EXCLUDED_PATHS:
            return await call_next(request)

        for prefix in EXCLUDED_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)

        if request.method == "OPTIONS":
            return await call_next(request)

        auth_header = request.headers.get("Authorization")

        if auth_header is None:
            request.state.admin_payload = None
            return await call_next(request)

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return JSONResponse(
                status_code=401,
                content={"detail": "فرمت هدر Authorization نامعتبر است."},
            )

        token = parts[1]
        payload = verify_access_token(token)

        if payload is None:
            return JSONResponse(
                status_code=401,
                content={"detail": "توکن نامعتبر یا منقضی شده است."},
            )

        request.state.admin_payload = payload
        return await call_next(request)
