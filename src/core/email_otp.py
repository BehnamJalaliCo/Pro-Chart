"""ایمیلِ OTP پنلِ کاربری — ارسال با Resend + ذخیرهٔ کد در Redis.

جریان:
  request_otp(email) → کدِ ۶رقمی می‌سازد، در Redis با TTL ذخیره می‌کند و ایمیل می‌فرستد.
  verify_otp(email, code) → کد را بررسی و در صورت درستی مصرف می‌کند.

محدودیت: حداکثر یک درخواست هر ۶۰ ثانیه و حداکثر ۵ تلاشِ تأیید برای هر کد.
"""

from __future__ import annotations

import hashlib
import hmac

import httpx

from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger("email_otp")

_OTP_TTL = 600          # اعتبارِ کد: ۱۰ دقیقه
_RESEND_COOLDOWN = 60   # فاصلهٔ مجاز بین درخواست‌ها
_MAX_ATTEMPTS = 5


def _key(email: str) -> str:
    return "otp:" + hashlib.sha256(email.lower().strip().encode()).hexdigest()[:24]


def _gen_code() -> str:
    # کدِ ۶رقمیِ امن
    import secrets
    return f"{secrets.randbelow(1_000_000):06d}"


# برندهای ایمیل — هر مقصد متن/موضوعِ جدا دارد (پنلِ کاربری ≠ آکادمی VIP)
_BRANDS = {
    "panel": {
        "title": "CoinePro FX",
        "subject": "کد ورود به پنل کاربری CoinePro FX",
        "intro": "کدِ ورود به پنلِ کاربری شما:",
    },
    "academy": {
        "title": "🎓 آکادمی VIP — کوین‌پرو FX",
        "subject": "کد ورود به آکادمی VIP فارکس کوین‌پرو FX",
        "intro": "کدِ ورود به آکادمیِ VIP فارکس کوین‌پرو FX:",
    },
}


def _fa_digits(s: str) -> str:
    return s.translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))


# فوترِ مشروعیت‌بخش — برند + نشانیِ سایت؛ ایمیل‌های دارای فوتر/برندِ روشن کمتر اسپم می‌شوند.
_FOOTER = (
    '<hr style="border:none;border-top:1px solid #1f2937;margin:20px 0 12px">'
    '<p style="margin:0;color:#4b5563;font-size:11px;line-height:1.7">'
    'این یک ایمیلِ خودکارِ سیستمیِ <b style="color:#22c55e">CoinePro FX</b> است؛ لطفاً پاسخ ندهید.<br>'
    '<a href="https://fx.trade-future.ir" style="color:#6b7280">fx.trade-future.ir</a></p>'
)


async def _send_email(to: str, code: str, brand: str = "panel", ttl: int = _OTP_TTL) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning("resend_key_missing")
        return False
    b = _BRANDS.get(brand, _BRANDS["panel"])
    minutes = _fa_digits(str(max(1, round(ttl / 60))))
    html = (
        '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#0b0f17;'
        'padding:32px;color:#e5e7eb;border-radius:16px;max-width:480px;margin:auto">'
        f'<h2 style="color:#22c55e;margin:0 0 8px">{b["title"]}</h2>'
        f'<p style="margin:0 0 16px;color:#9ca3af">{b["intro"]}</p>'
        f'<div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#fff;'
        'background:#111827;border-radius:12px;padding:16px;text-align:center">'
        f'{code}</div>'
        '<p style="margin:16px 0 0;color:#6b7280;font-size:13px">'
        f'این کد تا {minutes} دقیقه معتبر است. اگر شما درخواست نکرده‌اید، نادیده بگیرید.</p>'
        + _FOOTER +
        '</div>'
    )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": [to],
                    "reply_to": settings.RESEND_FROM_EMAIL,
                    "subject": b["subject"],
                    "html": html,
                    # نسخهٔ متنیِ ساده — ایمیلِ فقط‑HTML بیشتر اسپم می‌شود؛ multipart اعتماد را بالا می‌برد.
                    "text": f"{b['title']}\n\nکدِ تأیید: {code}\nاین کد تا {minutes} دقیقه معتبر است.\n"
                            "اگر شما درخواست نکرده‌اید، این پیام را نادیده بگیرید.",
                },
            )
        if r.status_code == 429:
            # سقفِ روزانهٔ پلنِ رایگانِ Resend (۱۰۰/روز) — برای پایشِ صریح
            logger.warning("resend_rate_limited", body=r.text[:200])
            return False
        if r.status_code >= 300:
            logger.warning("resend_send_failed", status=r.status_code, body=r.text[:200])
            return False
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("resend_exception", error=str(exc))
        return False


async def request_otp(email: str, brand: str = "panel", ttl: int | None = None) -> dict:
    """ساخت + ارسالِ کد. brand مقصد را تعیین می‌کند (panel/academy)؛ ttl اعتبارِ کد بر حسبِ ثانیه.
    خروجی: {sent, cooldown?, ttl?, error?}"""
    email = email.strip().lower()
    code_ttl = int(ttl or _OTP_TTL)
    r = redis_client.client
    cd_key = _key(email) + ":cd"
    if await r.exists(cd_key):
        rem = await r.ttl(cd_key)
        return {"sent": False, "cooldown": max(int(rem or 0), 1)}

    code = _gen_code()
    # هشِ کد ذخیره می‌شود نه خودِ کد
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    await r.set(_key(email), f"{code_hash}:0", ex=code_ttl)
    await r.set(cd_key, "1", ex=_RESEND_COOLDOWN)

    ok = await _send_email(email, code, brand=brand, ttl=code_ttl)
    if not ok:
        return {"sent": False, "error": "ارسالِ ایمیل ناموفق بود. آدرس را بررسی کنید."}
    logger.info("otp_sent", brand=brand)
    return {"sent": True, "cooldown": _RESEND_COOLDOWN, "ttl": code_ttl}


_RESET_TTL = 1800  # اعتبارِ لینکِ بازیابیِ رمز: ۳۰ دقیقه


def _reset_key(token: str) -> str:
    return "pwreset:" + hashlib.sha256(token.encode()).hexdigest()


async def _send_reset_email(to: str, link: str, ttl: int = _RESET_TTL) -> bool:
    """ایمیلِ بازیابیِ رمز با دکمهٔ لینک (multipart HTML+text برای ضدِ اسپم)."""
    if not settings.RESEND_API_KEY:
        logger.warning("resend_key_missing")
        return False
    minutes = _fa_digits(str(max(1, round(ttl / 60))))
    html = (
        '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#0b0f17;'
        'padding:32px;color:#e5e7eb;border-radius:16px;max-width:480px;margin:auto">'
        '<h2 style="color:#22c55e;margin:0 0 8px">🎓 آکادمی VIP — کوین‌پرو FX</h2>'
        '<p style="margin:0 0 16px;color:#9ca3af">درخواستِ بازیابیِ رمزِ عبور دریافت شد. '
        'برای تنظیمِ رمزِ جدید روی دکمهٔ زیر بزنید:</p>'
        f'<a href="{link}" style="display:block;text-align:center;background:#22c55e;color:#06210f;'
        'font-weight:800;text-decoration:none;border-radius:12px;padding:14px;font-size:16px">'
        'تنظیمِ رمزِ جدید</a>'
        '<p style="margin:16px 0 0;color:#6b7280;font-size:12px;word-break:break-all">'
        f'اگر دکمه کار نکرد، این نشانی را در مرورگر باز کنید:<br>{link}</p>'
        '<p style="margin:12px 0 0;color:#6b7280;font-size:13px">'
        f'این لینک تا {minutes} دقیقه معتبر است. اگر شما درخواست نکرده‌اید، این ایمیل را نادیده بگیرید.</p>'
        + _FOOTER +
        '</div>'
    )
    text = (
        "بازیابیِ رمزِ آکادمی VIP فارکس کوین‌پرو FX\n\n"
        f"برای تنظیمِ رمزِ جدید این نشانی را باز کنید:\n{link}\n\n"
        f"این لینک تا {minutes} دقیقه معتبر است. اگر شما درخواست نکرده‌اید، نادیده بگیرید."
    )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": [to],
                    "reply_to": settings.RESEND_FROM_EMAIL,
                    "subject": "بازیابیِ رمزِ آکادمی VIP فارکس کوین‌پرو FX",
                    "html": html,
                    "text": text,
                },
            )
        if r.status_code >= 300:
            logger.warning("resend_reset_failed", status=r.status_code, body=r.text[:200])
            return False
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("resend_reset_exception", error=str(exc))
        return False


async def send_password_reset(email: str, student_id: int, app_url: str) -> dict:
    """توکنِ یک‌بارمصرفِ بازیابی می‌سازد، در Redis ذخیره و لینک را ایمیل می‌کند.
    خروجی: {sent, cooldown?, error?}"""
    import secrets

    email = email.strip().lower()
    r = redis_client.client
    cd_key = "pwreset:cd:" + hashlib.sha256(email.encode()).hexdigest()[:24]
    if await r.exists(cd_key):
        rem = await r.ttl(cd_key)
        return {"sent": False, "cooldown": max(int(rem or 0), 1)}
    token = secrets.token_urlsafe(32)
    await r.set(_reset_key(token), str(student_id), ex=_RESET_TTL)
    await r.set(cd_key, "1", ex=_RESEND_COOLDOWN)
    link = f"{app_url.rstrip('/')}/reset-password?token={token}"
    ok = await _send_reset_email(email, link, _RESET_TTL)
    if not ok:
        return {"sent": False, "error": "ارسالِ ایمیل ناموفق بود."}
    logger.info("pwreset_sent")
    return {"sent": True, "cooldown": _RESEND_COOLDOWN}


async def consume_reset_token(token: str) -> int | None:
    """توکن را اعتبارسنجی و یک‌بارمصرف می‌کند؛ student_id را برمی‌گرداند یا None."""
    if not token:
        return None
    r = redis_client.client
    k = _reset_key(token.strip())
    sid = await r.get(k)
    if not sid:
        return None
    await r.delete(k)  # یک‌بارمصرف
    sid = sid.decode() if isinstance(sid, bytes) else sid
    try:
        return int(sid)
    except (ValueError, TypeError):
        return None


async def verify_otp(email: str, code: str) -> bool:
    """بررسیِ کد. در صورت درستی، کد مصرف (حذف) می‌شود."""
    email = email.strip().lower()
    r = redis_client.client
    raw = await r.get(_key(email))
    if not raw:
        return False
    raw = raw.decode() if isinstance(raw, bytes) else raw
    try:
        stored_hash, attempts = raw.split(":")
        attempts = int(attempts)
    except ValueError:
        await r.delete(_key(email))
        return False
    if attempts >= _MAX_ATTEMPTS:
        await r.delete(_key(email))
        return False
    code_hash = hashlib.sha256(code.strip().encode()).hexdigest()
    if hmac.compare_digest(code_hash, stored_hash):
        await r.delete(_key(email))
        return True
    # افزایشِ تلاشِ ناموفق با حفظِ TTL
    ttl = await r.ttl(_key(email))
    await r.set(_key(email), f"{stored_hash}:{attempts + 1}", ex=max(int(ttl or 1), 1))
    return False
