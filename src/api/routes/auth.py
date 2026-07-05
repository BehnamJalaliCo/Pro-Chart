"""
مسیرهای احراز هویت.

شامل ورود ادمین، بازنوسازی توکن و خروج از حساب.
توکن‌های JWT برای دسترسی و بازنوسازی صادر می‌شوند.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.api.deps import get_current_admin, get_db, get_redis
from src.core.config import settings
from src.core.database import Admin
from src.core.logger import get_logger
from src.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_access_token,
    verify_password,
    verify_refresh_token,
)

logger = get_logger(__name__)
router = APIRouter()


class LoginRequest(BaseModel):
    """مدل درخواست ورود ادمین."""

    username: str = Field(..., min_length=3, max_length=50, description="نام کاربری")
    password: str = Field(..., min_length=6, description="رمز عبور")


class TokenResponse(BaseModel):
    """مدل پاسخ توکن‌های احراز هویت."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    """مدل درخواست بازنوسازی توکن."""

    refresh_token: str = Field(..., description="توکن بازنوسازی")


class LogoutRequest(BaseModel):
    """مدل اختیاری درخواست خروج برای ابطال توکن بازنوسازی همراه."""

    refresh_token: str | None = Field(
        default=None, description="توکن بازنوسازی همراه برای ابطال (اختیاری)"
    )


@router.post("/login")
async def login(request: Request, db: AsyncSession = Depends(get_db)):
    _raw = await request.json()
    if _raw.get("email"):
        from src.api.routes.bn_bauth import do_email_login
        return await do_email_login(_raw, db)
    try:
        body = LoginRequest(**_raw)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=422, detail="ورودی نامعتبر است.")
    """
    ورود ادمین به سیستم.

    نام کاربری و رمز عبور را اعتبارسنجی کرده و در صورت صحت،
    توکن‌های دسترسی و بازنوسازی صادر می‌کند. زمان آخرین ورود نیز
    به‌روزرسانی می‌شود.
    """
    result = await db.execute(
        select(Admin).where(Admin.username == body.username)
    )
    admin = result.scalar_one_or_none()

    # رفع status-code oracle: برای اعتبار نامعتبر و حساب غیرفعال هر دو
    # پاسخ یکسان 401 برمی‌گردانیم تا مهاجم نتواند وجود/فعال بودن حساب را تشخیص دهد.
    if (
        admin is None
        or not verify_password(body.password, admin.password_hash)
        or not admin.is_active
    ):
        logger.warning("تلاش ناموفق ورود برای کاربر: %s", body.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="نام کاربری یا رمز عبور اشتباه است.",
        )

    access_token = create_access_token(data={"sub": str(admin.id), "role": "admin"})
    refresh_token = create_refresh_token(data={"sub": str(admin.id), "role": "admin"})

    admin.last_login = datetime.now(timezone.utc)
    await db.flush()

    expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60

    logger.info("ادمین '%s' وارد شد.", admin.username)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """
    بازنوسازی توکن دسترسی.

    اصلاحات امنیتی فاز ۸:
        - استفاده از verify_refresh_token (نه verify_access_token) — type confusion
        - بررسی blacklist روی jti توکن قبلی (جلوگیری از replay)
        - rotation کامل: توکن قبلی blacklist می‌شود قبل از صدور جدید
    """
    # ← باگ S-1 رفع: استفاده از verify_refresh_token برای type check درست
    payload = verify_refresh_token(body.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="توکن بازنوسازی نامعتبر یا منقضی شده است.",
        )

    admin_id = payload.get("sub")
    if admin_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="توکن فاقد اطلاعات هویتی است.",
        )

    # ── بررسی blacklist (مانع replay refresh token) ──
    # توکن بدون jti قابل ابطال نیست؛ اجازه‌ی بازنوسازی نامحدود را نمی‌دهیم.
    old_jti = payload.get("jti")
    if not old_jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="توکن بازنوسازی فاقد شناسه (jti) است و قابل استفاده نیست.",
        )

    try:
        if await redis.exists(f"token_blacklist:{old_jti}"):
            logger.warning(
                "refresh_token_replay_attempt",
                admin_id=admin_id,
                jti=old_jti[:8],
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="توکن بازنوسازی باطل شده است.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        # fail-secure: اگر Redis قطع باشد، رد کنیم تا attacker از down شدن
        # Redis سوءاستفاده نکند.
        logger.error("blacklist_check_failed_refresh", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="سرویس احراز هویت در دسترس نیست.",
        )

    # ── ابطال توکن قبلی قبل از بررسی is_active ──
    # حتی اگر حساب غیرفعال شده باشد، توکن قبلی باید blacklist شود تا
    # دیگر قابل replay نباشد. TTL = زمان باقی‌مانده تا انقضای توکن.
    # fail-secure: اگر setex شکست بخورد، توکن قدیمی پس از بازیابی Redis
    # دوباره معتبر می‌شود؛ پس مانند سمت خواندن، 503 برمی‌گردانیم.
    old_exp = payload.get("exp")
    now_ts = int(datetime.now(timezone.utc).timestamp())
    if old_exp:
        ttl = max(1, int(old_exp) - now_ts)
    else:
        ttl = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
    try:
        await redis.setex(f"token_blacklist:{old_jti}", ttl, "rotated")
    except Exception as exc:
        logger.error("refresh_blacklist_set_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="سرویس احراز هویت در دسترس نیست.",
        )

    result = await db.execute(select(Admin).where(Admin.id == int(admin_id)))
    admin = result.scalar_one_or_none()

    if admin is None or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="حساب کاربری معتبر نیست.",
        )

    # ── صدور توکن‌های جدید با role صحیح از DB ──
    role = getattr(admin, "role", None) or "admin"
    new_access = create_access_token(data={"sub": str(admin.id), "role": role})
    new_refresh = create_refresh_token(data={"sub": str(admin.id), "role": role})

    expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60

    logger.info("admin_refresh_token_rotated", username=admin.username)

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=expires_in,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    authorization: str = Header(..., alias="Authorization"),
    body: LogoutRequest | None = None,
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """
    خروج ادمین از سیستم.

    توکن دسترسی فعلی (بر اساس jti) را در لیست سیاه قرار می‌دهد و در صورت
    ارسال refresh_token همراه، آن را نیز باطل می‌کند تا تا ۷ روز معتبر
    نماند. سایر session‌های فعال کاربر در دستگاه‌های دیگر دست‌نخورده
    باقی می‌مانند. TTL لیست سیاه دقیقاً برابر زمان باقی‌مانده توکن است
    تا حافظه Redis هدر نرود.
    """
    try:
        now_ts = int(datetime.now(timezone.utc).timestamp())

        # استخراج توکن خام از header
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="فرمت Authorization نامعتبر است.",
            )

        payload = decode_token(token)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="توکن نامعتبر است.",
            )

        jti = payload.get("jti")
        exp = payload.get("exp")
        if not jti or not exp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="توکن قدیمی است و قابل خروج امن نیست.",
            )

        # TTL = زمان باقی‌مانده تا انقضای توکن
        ttl = max(1, int(exp) - now_ts)

        blacklist_key = f"token_blacklist:{jti}"
        await redis.setex(blacklist_key, ttl, "1")
        logger.info("ادمین '%s' خارج شد. (jti=%s)", admin.username, jti[:8])

        # ── ابطال توکن بازنوسازی همراه (در صورت ارسال) ──
        # توکن دسترسی تنها چند دقیقه معتبر است؛ بدون ابطال refresh token،
        # مهاجم می‌تواند تا ۷ روز توکن دسترسی جدید بسازد.
        if body is not None and body.refresh_token:
            refresh_payload = verify_refresh_token(body.refresh_token)
            if refresh_payload is not None:
                r_jti = refresh_payload.get("jti")
                r_exp = refresh_payload.get("exp")
                if r_jti and r_exp:
                    r_ttl = max(1, int(r_exp) - now_ts)
                    await redis.setex(
                        f"token_blacklist:{r_jti}", r_ttl, "logout"
                    )
                    logger.info(
                        "refresh_token_revoked_on_logout",
                        username=admin.username,
                        jti=r_jti[:8],
                    )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("خطا در ثبت خروج: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="خطا در عملیات خروج.",
        )


@router.get("/me")
async def me(admin: Admin = Depends(get_current_admin)):
    """اطلاعات ادمین جاری (برای بازیابی session در فرانت‌اند پنل)."""
    return {
        "id": admin.id,
        "username": admin.username,
        "name": admin.username,
        "email": admin.email or "",
        "role": admin.role or "admin",
        "isActive": bool(admin.is_active),
        "lastLogin": admin.last_login.isoformat() if admin.last_login else None,
    }
