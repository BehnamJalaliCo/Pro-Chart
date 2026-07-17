"""
پیکربندی CORS — env-specific.

قوانین:
    - production (DEBUG=False): فقط origin های صریح‌شده مجاز
      هرگز "*" حتی اگر CORS_ORIGINS خالی باشد → fallback به DEFAULT_ORIGINS
    - development (DEBUG=True): اگر CORS_ORIGINS خالی، اجازه‌ی localhost
      به‌عنوان sane default، نه "*" که credential را غیرفعال می‌کند.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger(__name__)

# دامنه‌های production پیش‌فرض
DEFAULT_PRODUCTION_ORIGINS = [
    f"https://{settings.WEBSITE_DOMAIN}",
    f"https://{settings.ADMIN_DOMAIN}",
    f"https://{settings.API_DOMAIN}",
    "https://coinepro.com",
    "https://www.coinepro.com",
    "https://panel.coinepro.com",
    # اپِ اندرویدِ مستقلِ فعلی (Capacitor) — androidScheme در config برابر
    # https است، پس تنها origin بومیِ لازم https://localhost است. اگر پلتفرم
    # iOS با scheme سفارشی اضافه شد، origin آن باید صریحاً از env وارد شود.
    "https://localhost",
]

# پیش‌فرض development — localhost با پورت‌های متداول
DEFAULT_DEV_ORIGINS = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]


def _parse_origins(raw: str) -> list[str]:
    """پارس کردن CORS_ORIGINS از string."""
    if not raw:
        return []
    return [o.strip() for o in raw.split(",") if o.strip()]


def setup_cors(app: FastAPI) -> None:
    """
    اعمال میان‌افزار CORS با امنیت بهتر.

    اولویت:
        1. CORS_ORIGINS از env (صریح)
        2. اگر خالی → دفالت متناسب با محیط (production vs dev)

    در production هرگز "*" استفاده نمی‌شود.
    در dev هم از "*" پرهیز می‌شود چون با allow_credentials=True ناسازگار است.
    """
    explicit = _parse_origins(getattr(settings, "CORS_ORIGINS", ""))

    if explicit:
        allowed_origins = explicit
        source = "explicit_env"
    elif settings.DEBUG:
        allowed_origins = DEFAULT_DEV_ORIGINS
        source = "dev_defaults"
    else:
        allowed_origins = DEFAULT_PRODUCTION_ORIGINS
        source = "production_defaults"

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With",
            "X-Request-ID",
        ],
        expose_headers=[
            "X-Request-ID",
            "X-Total-Count",
            "X-Page",
            "X-Per-Page",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
        ],
        max_age=600,
    )

    logger.info(
        "cors_configured",
        source=source,
        origins=allowed_origins,
        debug=settings.DEBUG,
    )
