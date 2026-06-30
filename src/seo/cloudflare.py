"""
Cloudflare — purge هوشمندِ کش (تازگیِ سئو).

وقتی مقاله‌ای منتشر/ویرایش/حذف می‌شود، یا داده‌کاوی صفحه‌ای را برای «افتِ رتبه /
CTR پایین» علامت می‌زند، کشِ همان URL را در Cloudflare پاک می‌کنیم تا رباتِ گوگل
در بازدیدِ بعدی تازه‌ترین نسخهٔ بک‌اند را ببیند.

سبک و ضدِخطا: اگر توکن/zone ست نباشد یا API خطا بدهد، فقط False برمی‌گرداند و
هرگز مسیرِ انتشار/داده‌کاوی را نمی‌شکند. توکن هرگز لاگ نمی‌شود.
"""

from __future__ import annotations

import httpx

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger(__name__)

_API = "https://api.cloudflare.com/client/v4"


def enabled() -> bool:
    return bool(settings.CLOUDFLARE_API_TOKEN and settings.CLOUDFLARE_ZONE_ID)


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}",
        "Content-Type": "application/json",
    }


def purge_urls(urls: list[str]) -> bool:
    """کشِ URLهای مشخص را پاک می‌کند (روشِ purge by URL، سقفِ ۳۰ تا در هر فراخوان)."""
    if not enabled():
        return False
    urls = [u for u in dict.fromkeys(urls) if u]  # یکتا، بدونِ خالی
    if not urls:
        return False
    ok = True
    zone = settings.CLOUDFLARE_ZONE_ID
    try:
        with httpx.Client(timeout=30) as c:
            for i in range(0, len(urls), 30):  # Cloudflare: ۳۰ URL در هر درخواست
                batch = urls[i : i + 30]
                r = c.post(
                    f"{_API}/zones/{zone}/purge_cache",
                    headers=_headers(),
                    json={"files": batch},
                )
                data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
                if r.status_code != 200 or not data.get("success"):
                    ok = False
                    logger.warning("cloudflare_purge_failed", status=r.status_code,
                                   errors=str(data.get("errors"))[:200], count=len(batch))
                else:
                    logger.info("cloudflare_purged", count=len(batch))
    except Exception as exc:  # noqa: BLE001 — purge هرگز نباید caller را بشکند
        logger.warning("cloudflare_purge_error", error=str(exc))
        return False
    return ok


def purge_url(url: str) -> bool:
    return purge_urls([url])
