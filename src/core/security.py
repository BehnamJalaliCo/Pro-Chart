"""امنیت — JWT + Password Hashing"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from jwt import InvalidTokenError
from passlib.context import CryptContext

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger(__name__)

# ── هش پسورد ─────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """هش کردن پسورد"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """تأیید پسورد"""
    return pwd_context.verify(plain_password, hashed_password)


# ── JWT ──────────────────────────────────────────────────
def create_access_token(data: dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """ساخت توکن دسترسی — شامل jti یکتا برای blacklist دقیق"""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": uuid.uuid4().hex,
        "type": "access",
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    """ساخت توکن نوسازی — شامل jti یکتا"""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": uuid.uuid4().hex,
        "type": "refresh",
    })
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """رمزگشایی توکن — اول RS256ِ مرکزی (SSO، اگر فعال باشد)، بعد HS256ِ فعلی (fallback)."""
    # ۱) توکنِ سرویسِ Auth مرکزی (M2) — فقط وقتی صریحاً فعال شده باشد
    if settings.CENTRAL_AUTH_ENABLED and settings.CENTRAL_JWT_PUBLIC_KEY:
        try:
            return jwt.decode(
                token, settings.CENTRAL_JWT_PUBLIC_KEY, algorithms=["RS256"],
                issuer=settings.CENTRAL_JWT_ISSUER,
                options={"verify_aud": False},
            )
        except InvalidTokenError:
            pass  # توکنِ مرکزی نبود → مسیرِ قدیمی
    # ۲) HS256 فعلی (بدونِ تغییر)
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except InvalidTokenError as e:
        logger.warning("jwt_decode_failed", error=str(e))
        return None


def verify_access_token(token: str) -> Optional[dict[str, Any]]:
    """تأیید توکن دسترسی"""
    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        return payload
    return None

def verify_refresh_token(token: str) -> Optional[dict[str, Any]]:
    """تأیید توکن نوسازی"""
    payload = decode_token(token)
    if payload and payload.get("type") == "refresh":
        return payload
    return None
