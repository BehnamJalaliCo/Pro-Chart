"""
میان‌افزار Security Headers — اضافه‌کردن هدرهای امنیتی استاندارد.

هدرها:
    - Strict-Transport-Security (HSTS): فقط HTTPS قابل قبول
    - X-Frame-Options: جلوگیری از clickjacking
    - X-Content-Type-Options: جلوگیری از MIME sniffing
    - Referrer-Policy: کنترل افشای referrer
    - Permissions-Policy: غیرفعال‌کردن APIهای حساس مرورگر
    - Content-Security-Policy: کنترل منابع قابل بارگذاری
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """افزودن security headers به هر response."""

    def __init__(
        self,
        app,
        enable_hsts: bool = True,
        hsts_max_age: int = 31536000,  # ۱ سال
        csp_policy: str | None = None,
    ) -> None:
        super().__init__(app)
        self._enable_hsts = enable_hsts
        self._hsts_max_age = hsts_max_age
        # CSP محافظه‌کارانه برای API (نه frontend HTML)
        self._csp = csp_policy or (
            "default-src 'none'; "
            "object-src 'none'; "
            "frame-ancestors 'none'; "
            "base-uri 'none'; "
            "form-action 'none'"
        )

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # HSTS — فقط HTTPS
        if self._enable_hsts:
            response.headers["Strict-Transport-Security"] = (
                f"max-age={self._hsts_max_age}; includeSubDomains"
            )

        # جلوگیری از clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # جلوگیری از MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # فیلتر قدیمی XSS در مرورگرهای legacy می‌تواند رفتار ناامن ایجاد کند؛
        # CSP مرز اصلی است و مقدار 0 صریحاً آن فیلتر منسوخ را خاموش می‌کند.
        response.headers["X-XSS-Protection"] = "0"

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy — APIهای حساس مرورگر غیرفعال
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), "
            "payment=(), usb=(), magnetometer=(), gyroscope=()"
        )

        # CSP
        response.headers["Content-Security-Policy"] = self._csp

        return response
