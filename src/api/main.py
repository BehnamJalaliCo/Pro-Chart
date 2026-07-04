"""
ماژول اصلی FastAPI برای پلتفرم سیگنال فارکس.

این ماژول اپلیکیشن FastAPI را با تمام میان‌افزارها، مسیرها و رویدادهای
راه‌اندازی/خاموشی پیکربندی و ایجاد می‌کند.
"""

import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from src.api.deps import get_current_admin
from src.api.middleware.cors import setup_cors
from src.api.middleware.rate_limit import RateLimitMiddleware
from src.api.middleware.security_headers import SecurityHeadersMiddleware
from src.api.routes import (
    academy,
    bazaarnama,
    admin,
    admin_academy,
    admin_bn_core,
    admin_bn_dash,
    admin_bn_trading,
    bn_user_extra,
    bn_social,
    bn_r7,
    bn_r8,
    bn_bauth,
    admin_ig_users,
    analytics,
    articles,
    auth,
    broadcasts,
    ig_panel,
    live_prices,
    monitoring,
    panel,
    payments,
    public,
    seo,
    seo_admin,
    settings as settings_routes,
    subscriptions,
    user_panel,
    users,
)
from src.core.config import settings
from src.core.database import Admin, async_session_factory
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)

REQUEST_COUNT = Counter(
    "http_requests_total",
    "تعداد کل درخواست‌های HTTP",
    ["method", "endpoint", "status_code"],
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "مدت زمان پاسخ‌دهی درخواست‌های HTTP بر حسب ثانیه",
    ["method", "endpoint"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    مدیریت چرخه حیات اپلیکیشن.

    در زمان راه‌اندازی، اتصال به دیتابیس و ردیس برقرار می‌شود.
    در زمان خاموشی، اتصالات بسته می‌شوند.
    """
    logger.info("در حال راه‌اندازی اپلیکیشن...")

    try:
        await redis_client.connect()
        logger.info("اتصال به ردیس با موفقیت برقرار شد.")
    except Exception as exc:
        logger.error("خطا در اتصال به ردیس: %s", exc)
        raise

    try:
        async with async_session_factory() as session:
            from sqlalchemy import text
            await session.execute(text("SELECT 1"))
        logger.info("اتصال به دیتابیس با موفقیت برقرار شد.")
    except Exception as exc:
        logger.error("خطا در اتصال به دیتابیس: %s", exc)
        raise

    logger.info("اپلیکیشن با موفقیت راه‌اندازی شد.")
    yield

    logger.info("در حال خاموشی اپلیکیشن...")
    try:
        await redis_client.close()
        logger.info("اتصال ردیس بسته شد.")
    except Exception as exc:
        logger.warning("خطا در بستن اتصال ردیس: %s", exc)

    logger.info("اپلیکیشن با موفقیت خاموش شد.")


app = FastAPI(
    title="CoinePro Forex Signal API",
    description="ای‌پی‌آی پلتفرم سیگنال فارکس کوین‌پرو",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Security headers — HSTS, CSP, X-Frame-Options, …
app.add_middleware(SecurityHeadersMiddleware, enable_hsts=not settings.DEBUG)

# محدودکننده نرخ درخواست — جلوگیری از brute-force و سوءاستفاده
app.add_middleware(RateLimitMiddleware)

# CORS باید آخرین میان‌افزار ثبت‌شده باشد تا بیرونی‌ترین لایه باشد؛
# در غیر این صورت پاسخ ۴۲۹ از RateLimitMiddleware هدرهای CORS را ندارد
# و مرورگر خطای مبهم نشان می‌دهد.
setup_cors(app)


@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    """
    میان‌افزار Prometheus برای ثبت متریک‌های درخواست‌ها.

    تعداد درخواست‌ها و مدت زمان پاسخ‌دهی را اندازه‌گیری و ثبت می‌کند.
    """
    method = request.method
    _start = time.perf_counter()

    response = await call_next(request)

    _elapsed = time.perf_counter() - _start

    # استفاده از الگوی مسیر (route template) به‌جای مسیر خام تا از انفجار
    # cardinality متریک‌ها روی پارامترهای مسیر (مثل /signals/{id}) جلوگیری شود.
    # route فقط پس از dispatch (یعنی پس از call_next) در scope در دسترس است.
    route = request.scope.get("route")
    endpoint = getattr(route, "path", None) or request.url.path

    REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(_elapsed)
    REQUEST_COUNT.labels(
        method=method,
        endpoint=endpoint,
        status_code=response.status_code,
    ).inc()

    return response


@app.get("/health", tags=["سلامت"])
async def health_check():
    """
    بررسی سلامت سرویس.

    وضعیت اتصال به دیتابیس و ردیس را بررسی کرده و نتیجه را برمی‌گرداند.
    """
    db_ok = False
    redis_ok = False

    try:
        async with async_session_factory() as session:
            from sqlalchemy import text
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:
        logger.warning("بررسی سلامت دیتابیس ناموفق: %s", exc)

    try:
        await redis_client.client.ping()
        redis_ok = True
    except Exception as exc:
        logger.warning("بررسی سلامت ردیس ناموفق: %s", exc)

    status = "healthy" if (db_ok and redis_ok) else "degraded"
    status_code = 200 if status == "healthy" else 503

    return JSONResponse(
        status_code=status_code,
        content={
            "status": status,
            "database": "connected" if db_ok else "disconnected",
            "redis": "connected" if redis_ok else "disconnected",
        },
    )


@app.get("/metrics", include_in_schema=False)
async def metrics(admin: Admin = Depends(get_current_admin)):
    """
    ارائه متریک‌های Prometheus.

    متریک‌های جمع‌آوری‌شده را در فرمت استاندارد Prometheus برمی‌گرداند.
    دسترسی فقط برای ادمین احراز هویت‌شده.
    """
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


app.include_router(auth.router, prefix="/auth", tags=["احراز هویت"])
app.include_router(bn_bauth.router, tags=["B-AUTH (ایمیلی/KYC/رفرال)"])
app.include_router(users.router, prefix="/users", tags=["کاربران"])
app.include_router(admin.router, prefix="/admin", tags=["مدیریت"])
app.include_router(live_prices.router, prefix="/ws", tags=["قیمت زنده"])
app.include_router(articles.router, prefix="/articles", tags=["مقالات"])
app.include_router(seo.router, tags=["SEO (sitemap/robots)"])  # بدون prefix — ریشهٔ دامنه
app.include_router(public.router, prefix="/public", tags=["عمومی (وب‌سایت)"])
app.include_router(broadcasts.router, prefix="/broadcasts", tags=["پیام‌رسانی"])
app.include_router(monitoring.router, prefix="/monitoring", tags=["مانیتورینگ"])
app.include_router(settings_routes.router, prefix="/settings", tags=["تنظیمات"])
app.include_router(payments.router, prefix="/admin/payments", tags=["پرداخت‌ها"])
app.include_router(subscriptions.router, prefix="/admin/subscriptions", tags=["اشتراک‌ها"])
app.include_router(analytics.router, prefix="/admin/analytics", tags=["آنالیتیکس بازدید"])
app.include_router(seo_admin.router, prefix="/admin/seo", tags=["SEO داشبورد"])

# --- روتر پنل ادمین: فرانت همه‌چیز را با پیشوند /admin و شکل camelCase صدا می‌زند ---
# routerهای پایتون شکل/نام فیلد متفاوتی دارند؛ panel.py دادهٔ واقعی را با شکل دقیق فرانت برمی‌گرداند.
app.include_router(panel.router, prefix="/admin", tags=["پنل ادمین"])
app.include_router(user_panel.router, prefix="/user", tags=["پنل کاربری VIP"])
app.include_router(academy.router, prefix="/academy", tags=["آکادمی VIP"])
app.include_router(bn_r8.router, prefix="/academy/bn", tags=["کپی‌تریدِ فارکسِ زنده"])
app.include_router(bazaarnama.router, prefix="/academy/bn", tags=["بازارنما (TradingView ایرانی)"])
app.include_router(bn_user_extra.router, prefix="/academy/bn", tags=["بازارنما — پنل کاربر"])
app.include_router(bn_social.router, prefix="/academy/bn/social", tags=["سوشالِ سراسری"])
app.include_router(bn_r7.router, prefix="/academy/bn", tags=["مرکزِ حساب/اتاقِ کنترل"])
app.include_router(admin_academy.router, prefix="/admin/academy", tags=["مدیریت آکادمی VIP"])
app.include_router(admin_ig_users.router, prefix="/admin/ig-users", tags=["مدیریت کاربران IG"])
app.include_router(admin_bn_core.router, prefix="/admin/bn", tags=["بازارنما — هسته"])
app.include_router(admin_bn_trading.router, prefix="/admin/bn", tags=["بازارنما — معاملات"])
app.include_router(admin_bn_dash.router, prefix="/admin/bn", tags=["بازارنما — داشبورد/بازار"])
app.include_router(ig_panel.router, prefix="/ig", tags=["پنل مستقل اینستاگرام"])
