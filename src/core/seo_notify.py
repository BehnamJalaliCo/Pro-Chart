"""
اطلاع‌رسانیِ SEO — باطل‌کردنِ کشِ sitemap و ping به موتورهای جستجو.

این ماژول عمداً سبک است (فقط config + redis + httpx) تا هم API و هم خطِ تولیدِ
اخبار/بلاگ بدونِ وابستگی به FastAPI بتوانند هنگامِ انتشارِ مقاله صدایش بزنند.
هیچ تابعی استثنا throw نمی‌کند — اطلاع‌رسانیِ SEO نباید مسیرِ انتشار را بشکند.
"""

from xml.sax.saxutils import escape

from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)

_SITEMAP_CACHE_KEY = "seo:sitemap:articles"


def _base() -> str:
    return f"https://{settings.WEBSITE_DOMAIN}".lower().rstrip("/")


async def invalidate_sitemap_cache() -> None:
    """کشِ sitemapِ مقالات را پاک می‌کند تا محتوای جدید فوری دیده شود."""
    try:
        if redis_client.client is not None:
            await redis_client.client.delete(_SITEMAP_CACHE_KEY)
    except Exception:  # noqa: BLE001 — کش اختیاری است
        pass


async def notify_search_engines(slugs: list[str]) -> None:
    """
    هنگامِ انتشارِ مقالهٔ جدید:
      ۱) کشِ sitemap باطل می‌شود (مقالهٔ جدید بلافاصله در sitemap می‌آید).
      ۲) اگر INDEXNOW_KEY تنظیم شده باشد، آدرس‌های تازه به IndexNow (Bing/Yandex)
         ارسال می‌شوند (ایندکسِ آنی). گوگل sitemap را مکرراً بازخزش می‌کند.
    """
    await invalidate_sitemap_cache()

    key = getattr(settings, "INDEXNOW_KEY", "") or ""
    base = _base()
    urls = [f"{base}/article/{escape(str(s))}" for s in slugs if s]

    # purgeِ کشِ Cloudflare برای آدرس‌های تغییریافته → رباتِ گوگل تازه‌ترین نسخه را می‌بیند.
    # (در thread جدا تا event-loopِ انتشار بلاک نشود؛ ضدِخطا، بدونِ CF هم no-op است.)
    if urls:
        try:
            import asyncio

            from src.seo import cloudflare
            if cloudflare.enabled():
                await asyncio.to_thread(cloudflare.purge_urls, urls + [base + "/", base + "/blog"])
        except Exception as exc:  # noqa: BLE001 — purge هرگز نباید انتشار را بشکند
            logger.warning("cloudflare_purge_on_publish_failed", error=str(exc))

    if not key or not urls:
        return
    try:
        import httpx

        payload = {
            "host": settings.WEBSITE_DOMAIN.lower(),
            "key": key,
            "keyLocation": f"{base}/indexnow-key.txt",
            "urlList": urls[:100],
        }
        async with httpx.AsyncClient(timeout=8.0) as cx:
            await cx.post("https://api.indexnow.org/indexnow", json=payload)
        logger.info("indexnow_pinged", count=len(urls))
    except Exception as exc:  # noqa: BLE001
        logger.warning("indexnow_failed", error=str(exc))


async def submit_all_to_indexnow(batch: int = 1000) -> dict:
    """بک‌فیلِ یک‌باره: همهٔ آدرس‌های منتشرشده + صفحاتِ اصلی/برچسب را به IndexNow می‌فرستد.
    (کلِ آرشیوِ موجود به Bing/Yandex معرفی می‌شود؛ محتوای جدید خودکار از طریقِ
    notify_search_engines ارسال می‌شود.)"""
    key = getattr(settings, "INDEXNOW_KEY", "") or ""
    if not key:
        return {"submitted": 0, "reason": "no_key"}
    base = _base()
    static = ["/", "/signals", "/news", "/analysis", "/blog", "/education", "/academy",
              "/performance", "/broker", "/about", "/contact", "/live-prices", "/copy-trade", "/backtest"]
    urls = [base + p for p in static]
    try:
        from sqlalchemy import select

        from src.core.database import Article, async_session_factory
        async with async_session_factory() as s:
            slugs = (await s.execute(
                select(Article.slug).where(Article.is_published.is_(True))
            )).scalars().all()
        urls += [f"{base}/article/{escape(str(sl))}" for sl in slugs if sl]
    except Exception as exc:  # noqa: BLE001
        logger.warning("indexnow_backfill_db_failed", error=str(exc))
    try:
        import urllib.parse as _up

        from src.news.keywords import CLUSTERS
        seen: set[str] = set()
        for _k, (_t, tags, _kids) in CLUSTERS.items():
            for tg in tags:
                if tg not in seen:
                    seen.add(tg)
                    urls.append(f"{base}/tag/{_up.quote(tg)}")
    except Exception:  # noqa: BLE001
        pass

    import httpx
    sent = 0
    batches_ok = 0
    async with httpx.AsyncClient(timeout=20.0) as cx:
        for i in range(0, len(urls), batch):
            chunk = urls[i:i + batch]
            payload = {
                "host": settings.WEBSITE_DOMAIN.lower(), "key": key,
                "keyLocation": f"{base}/indexnow-key.txt", "urlList": chunk,
            }
            try:
                r = await cx.post("https://api.indexnow.org/indexnow", json=payload)
                sent += len(chunk)
                batches_ok += 1 if r.status_code in (200, 202) else 0
            except Exception as exc:  # noqa: BLE001
                logger.warning("indexnow_backfill_batch_failed", error=str(exc))
    logger.info("indexnow_backfill_done", submitted=sent, total=len(urls))
    return {"submitted": sent, "total": len(urls), "batches_ok": batches_ok}
