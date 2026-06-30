"""
وابستگی‌های مشترک FastAPI.

این ماژول شامل وابستگی‌های تزریقی برای سشن دیتابیس، احراز هویت ادمین
و اتصال ردیس است.
"""

from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.core.config import settings
from src.core.database import Admin, async_session_factory
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.core.security import verify_access_token

logger = get_logger(__name__)

bearer_scheme = HTTPBearer()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    ایجاد و ارائه یک سشن دیتابیس غیرهمزمان.

    Commit فقط در صورت وجود تراکنش فعال انجام می‌شود — این از
    خطا در حالتی جلوگیری می‌کند که handler خودش قبلاً commit کرده
    یا تراکنش بسته شده باشد. در صورت exception، rollback خودکار.

    قرارداد: handler‌ها نباید خودشان commit کنند — این کار را
    dependency در پایان درخواست انجام می‌دهد.
    """
    async with async_session_factory() as session:
        try:
            yield session
            if session.in_transaction():
                await session.commit()
        except Exception:
            if session.in_transaction():
                await session.rollback()
            raise
        finally:
            await session.close()


async def get_redis() -> aioredis.Redis:
    """
    ارائه اتصال ردیس.

    کلاینت ردیس فعلی را برمی‌گرداند. در صورت عدم اتصال، خطا پرتاب می‌شود.
    """
    try:
        client = redis_client.client
    except RuntimeError:
        logger.error("کلاینت ردیس در دسترس نیست.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="سرویس ردیس در دسترس نیست.",
        )
    return client


# ── role hierarchy — سطح بالاتر دسترسی به سطح پایین‌تر را دارد ──
_ROLE_HIERARCHY: dict[str, int] = {
    "viewer": 1,
    "analyst": 2,
    "admin": 3,
    "superadmin": 4,
}


def _role_satisfies(actual: str, required: str) -> bool:
    """آیا role موجود به اندازه‌ی required بالا هست؟"""
    return _ROLE_HIERARCHY.get(actual, 0) >= _ROLE_HIERARCHY.get(required, 3)


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Admin:
    """
    احراز هویت ادمین فعلی با RBAC و blacklist fail-secure.

    اصلاحات فاز ۸:
        - blacklist check اکنون fail-secure: اگر Redis down، 503 (نه قبول)
        - role check موجود است (در helper require_role استفاده می‌شود)
    """
    token = credentials.credentials

    payload = verify_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="توکن نامعتبر یا منقضی شده است.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    admin_id = payload.get("sub")
    if admin_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="توکن فاقد اطلاعات هویتی است.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── بررسی blacklist — fail-secure ──
    jti = payload.get("jti")
    if jti:
        try:
            if await redis_client.exists(f"token_blacklist:{jti}"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="توکن باطل شده است. لطفاً مجدداً وارد شوید.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except HTTPException:
            raise
        except Exception as exc:
            # ⚠️ FAIL-SECURE: اگر Redis قطع، توکن قبول نمی‌شود
            # این جلوی attacker می‌گیرد که از Redis down شدن سوءاستفاده کند
            logger.error("blacklist_check_failed", error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="سرویس احراز هویت موقتاً در دسترس نیست.",
            )

    result = await db.execute(select(Admin).where(Admin.id == int(admin_id)))
    admin = result.scalar_one_or_none()

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ادمین یافت نشد.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="حساب کاربری غیرفعال شده است.",
        )

    return admin


def require_role(required: str = "admin"):
    """
    Factory برای RBAC dependencies.

    استفاده:
        @router.post("/admin/dangerous")
        async def x(admin: Admin = Depends(require_role("superadmin"))):
            ...

    role hierarchy: viewer < analyst < admin < superadmin.
    اگر کاربر `superadmin` باشد، هر endpoint admin/analyst/viewer قابل دسترس است.
    """
    async def _dep(admin: Admin = Depends(get_current_admin)) -> Admin:
        actual = (getattr(admin, "role", None) or "admin").lower()
        if not _role_satisfies(actual, required):
            logger.warning(
                "rbac_denied",
                admin_id=admin.id,
                actual_role=actual,
                required_role=required,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"دسترسی فقط برای نقش {required} و بالاتر مجاز است.",
            )
        return admin

    return _dep
