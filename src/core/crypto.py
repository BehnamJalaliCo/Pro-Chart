"""رمزنگاریِ متقارنِ کردنشالِ حساسِ کاربر (رمزِ معاملاتیِ MT5) با Fernet.

کلید از settings.USER_CREDS_ENC_KEY (env) خوانده می‌شود. اگر تنظیم نشده باشد،
به‌صورت اضطراری از JWT_SECRET_KEY کلید مشتق می‌شود (در production باید env ست شود).
رمزِ خام هرگز در دیتابیس ذخیره نمی‌شود — فقط نسخهٔ رمزنگاری‌شده.
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger("crypto")


def _fernet() -> Fernet:
    key = (settings.USER_CREDS_ENC_KEY or "").strip()
    if not key:
        # اضطراری: مشتقِ کلید از JWT secret (۳۲ بایت → base64) تا برنامه نشکند
        digest = hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
        logger.warning("creds_enc_key_missing_using_derived")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(plaintext: str) -> str:
    """رمزنگاریِ یک رشتهٔ حساس → توکنِ متنیِ قابل‌ذخیره."""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(token: str) -> str | None:
    """رمزگشاییِ توکن → متنِ خام؛ در صورت نامعتبربودن None."""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, Exception):  # noqa: BLE001
        logger.warning("creds_decrypt_failed")
        return None
