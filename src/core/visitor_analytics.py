"""
تحلیلِ بازدید — ابزارهای سمتِ سرور برای غنی‌سازیِ رویدادِ بازدید:
  - hash_ip:        هشِ امنِ IP (حریمِ خصوصی؛ IP خام ذخیره نمی‌شود)
  - parse_ua:       استخراجِ دستگاه/مرورگر/سیستم‌عامل/ربات از User-Agent
  - classify_source: تشخیصِ منبعِ ورود (سرچ/اینستا/تلگرام/سوشال/مستقیم/ربات)
  - geo_lookup:     موقعیتِ تقریبی از IP (best-effort، با کشِ Redis)

همه‌چیز بدونِ وابستگیِ سنگین و خطاناپذیر طراحی شده — تحلیل نباید درخواست را بشکند.
"""

import hashlib
import re
from urllib.parse import urlparse

from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)

# ── هشِ IP ──
def hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    salt = (getattr(settings, "SECRET_KEY", "") or "coinepro")[:16]
    return hashlib.sha256(f"{salt}:{ip}".encode()).hexdigest()


# ── پارسِ User-Agent ──
_BOT_RE = re.compile(
    r"bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|"
    r"semrush|ahrefs|mj12|dotbot|petalbot|yandex(?:bot)?|googlebot|applebot|"
    r"headless|python-requests|curl|wget|axios|go-http|monitor|uptime|preview",
    re.I,
)
_TABLET_RE = re.compile(r"ipad|tablet|playbook|silk|(android(?!.*mobile))", re.I)
_MOBILE_RE = re.compile(r"mobile|iphone|ipod|android.*mobile|windows phone|blackberry", re.I)


def _browser(ua: str) -> str:
    u = ua.lower()
    # ترتیب مهم است (edge قبل از chrome، chrome قبل از safari)
    if "edg/" in u or "edga" in u:
        return "Edge"
    if "opr/" in u or "opera" in u:
        return "Opera"
    if "samsungbrowser" in u:
        return "Samsung"
    if "firefox" in u or "fxios" in u:
        return "Firefox"
    if "chrome" in u or "crios" in u:
        return "Chrome"
    if "safari" in u:
        return "Safari"
    if "telegram" in u:
        return "Telegram"
    if "instagram" in u:
        return "Instagram"
    return "سایر"


def _os(ua: str) -> str:
    u = ua.lower()
    if "windows" in u:
        return "Windows"
    if "android" in u:
        return "Android"
    if "iphone" in u or "ipad" in u or "ipod" in u or "ios" in u:
        return "iOS"
    if "mac os" in u or "macintosh" in u:
        return "macOS"
    if "linux" in u:
        return "Linux"
    return "سایر"


def parse_ua(ua: str | None) -> dict:
    ua = ua or ""
    is_bot = bool(_BOT_RE.search(ua))
    if _TABLET_RE.search(ua):
        device = "tablet"
    elif _MOBILE_RE.search(ua):
        device = "mobile"
    else:
        device = "desktop"
    return {
        "device": device,
        "browser": _browser(ua),
        "os": _os(ua),
        "is_bot": is_bot,
    }


# ── تشخیصِ منبعِ ورود ──
_SEARCH_HOSTS = {
    "google": "Google", "bing": "Bing", "yahoo": "Yahoo", "duckduckgo": "DuckDuckGo",
    "yandex": "Yandex", "baidu": "Baidu", "ecosia": "Ecosia", "brave": "Brave",
}
_SOCIAL_HOSTS = {
    "instagram": ("instagram", "Instagram"),
    "t.me": ("telegram", "Telegram"),
    "telegram": ("telegram", "Telegram"),
    "facebook": ("social", "Facebook"),
    "fb.com": ("social", "Facebook"),
    "twitter": ("social", "Twitter/X"),
    "x.com": ("social", "Twitter/X"),
    "linkedin": ("social", "LinkedIn"),
    "youtube": ("social", "YouTube"),
    "youtu.be": ("social", "YouTube"),
    "pinterest": ("social", "Pinterest"),
    "reddit": ("social", "Reddit"),
    "whatsapp": ("social", "WhatsApp"),
    "aparat": ("social", "آپارات"),
}


def classify_source(referrer: str | None, utm_source: str | None,
                    utm_medium: str | None, own_host: str) -> dict:
    ref = (referrer or "").strip()
    host = ""
    if ref:
        try:
            host = (urlparse(ref).hostname or "").lower().lstrip("www.")
        except Exception:  # noqa: BLE001
            host = ""

    # ۱) UTM صریح بالاترین اولویت
    us = (utm_source or "").lower()
    um = (utm_medium or "").lower()
    if us:
        if um in ("cpc", "ppc", "paid"):
            return {"source": "paid", "source_detail": utm_source, "referrer_host": host}
        if "insta" in us:
            return {"source": "instagram", "source_detail": "Instagram", "referrer_host": host}
        if "telegram" in us or us in ("tg", "bot"):
            return {"source": "telegram", "source_detail": "Telegram", "referrer_host": host}
        if um in ("social", "social-media"):
            return {"source": "social", "source_detail": utm_source, "referrer_host": host}
        return {"source": "campaign", "source_detail": utm_source, "referrer_host": host}

    # ۲) بدونِ referrer → مستقیم (تایپ آدرس، بوکمارک، اپ)
    if not host:
        return {"source": "direct", "source_detail": "مستقیم", "referrer_host": ""}

    # ۳) از خودِ سایت آمده (ناوبریِ داخلی) — منبع را عوض نمی‌کنیم
    if own_host and own_host.lstrip("www.") in host:
        return {"source": "internal", "source_detail": "داخلی", "referrer_host": host}

    # ۴) موتورِ جستجو
    for key, name in _SEARCH_HOSTS.items():
        if key in host:
            return {"source": "search", "source_detail": name, "referrer_host": host}

    # ۵) شبکه‌های اجتماعی / تلگرام / اینستاگرام
    for key, (src, name) in _SOCIAL_HOSTS.items():
        if key in host:
            return {"source": src, "source_detail": name, "referrer_host": host}

    # ۶) ارجاعِ سایتِ دیگر
    return {"source": "referral", "source_detail": host, "referrer_host": host}


# ── جئو از IP (best-effort، کشِ ۳۰ روزه) ──
async def geo_lookup(ip: str | None) -> dict:
    empty = {"country": None, "country_code": None, "city": None}
    if not ip or ip in ("127.0.0.1", "::1") or ip.startswith(("10.", "192.168.", "172.")):
        return empty
    cache_key = f"geo:ip:{hashlib.md5(ip.encode(), usedforsecurity=False).hexdigest()}"  # noqa: S324 — کلیدِ کش، نه امنیتی
    try:
        if redis_client.client is not None:
            cached = await redis_client.client.get(cache_key)
            if cached:
                parts = cached.split("|")
                return {"country": parts[0] or None, "country_code": parts[1] or None,
                        "city": parts[2] if len(parts) > 2 else None}
    except Exception:  # noqa: BLE001
        pass

    try:
        import httpx

        async with httpx.AsyncClient(timeout=2.5) as cx:
            r = await cx.get(f"http://ip-api.com/json/{ip}",
                             params={"fields": "status,country,countryCode,city", "lang": "fa"})
            data = r.json()
        if data.get("status") == "success":
            out = {"country": data.get("country"), "country_code": data.get("countryCode"),
                   "city": data.get("city")}
            try:
                if redis_client.client is not None:
                    await redis_client.client.set(
                        cache_key,
                        f"{out['country'] or ''}|{out['country_code'] or ''}|{out['city'] or ''}",
                        ex=2592000,  # ۳۰ روز
                    )
            except Exception:  # noqa: BLE001
                pass
            return out
    except Exception as exc:  # noqa: BLE001
        logger.debug("geo_lookup_failed", error=str(exc))
    return empty
