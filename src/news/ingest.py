"""خبرخوانِ RSS → ترجمهٔ Claude → ذخیره به‌عنوان Article → پستِ خودکارِ کانال.

جریان:
  ۱) فید هر منبع را می‌گیرد و آیتم‌های تازه را parse می‌کند (عکس + متن).
  ۲) آیتمِ تکراری (بر اساسِ لینک) را رد می‌کند.
  ۳) عنوان و متن را با Claude به فارسیِ روان ترجمه می‌کند.
  ۴) به‌عنوانِ Article(category=news/analysis) ذخیره می‌کند (عکسِ منبع به‌عنوان cover).
  ۵) رویدادِ پستِ کانال را در صفِ telegram:events می‌گذارد (عکس + تیتر + دکمهٔ «متن کامل»).
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timedelta, timezone

import feedparser
import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select

from src.core.config import settings
from src.core.database import Article, async_session_factory
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.news.adfilter import is_broker_ad
from src.news.sources import (
    MIN_BODY_CHARS,
    PER_RUN_INTL,
    PER_RUN_IRAN,
    PER_RUN_MAX,
    REQUIRE_IMAGE_FOR_CHANNEL,
    RSS_SOURCES,
)
from src.news.translate import translate_news

logger = get_logger("news.ingest")

_UA = {"User-Agent": "Mozilla/5.0 (compatible; CoineProFXBot/1.0; +https://fx.trade-future.ir)"}
_SITE = "https://fx.trade-future.ir"

# مرزِ ریستِ روزانه = ۷ صبح به وقتِ تهران (نه نیمه‌شبِ UTC). یعنی سقفِ روزانه هر روز
# رأسِ ۷ صبحِ تهران صفر می‌شود و چرخهٔ تازهٔ انتشار آغاز می‌گردد.
_TEHRAN = timezone(timedelta(hours=3, minutes=30))
_RESET_HOUR_TEHRAN = 7


def day_start_utc() -> datetime:
    """شروعِ «روزِ جاری» بر اساسِ ۷ صبحِ تهران، به‌صورتِ UTC."""
    now_t = datetime.now(_TEHRAN)
    start_t = now_t.replace(hour=_RESET_HOUR_TEHRAN, minute=0, second=0, microsecond=0)
    if now_t < start_t:
        start_t -= timedelta(days=1)
    return start_t.astimezone(timezone.utc)


_IMG_RE = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.IGNORECASE)

# فیلترِ موضوعی برای منابعِ ایرانیِ عمومی: فقط خبرهای بازار (طلا/ارز/نفت/...).
# تطبیقِ «سرِ کلمه» (نه زیررشته) تا «ین» داخلِ «زمین» یا «ارز» داخلِ «ارزش» را نگیرد.
_KW_WORDS = (
    "طلا", "دلار", "سکه", "یورو", "اونس", "مثقال", "نفت", "بورس", "رمزارز",
    "کریپتو", "تتر", "تورم", "پوند", "فارکس",
)
_KW_PHRASES = (
    "نرخ ارز", "نرخ بهره", "بازار ارز", "بازار جهانی", "قیمت ارز", "قیمت دلار",
    "قیمت طلا", "اقتصاد جهان", "بازار طلا", "فلزات گرانبها", "بیت کوین", "بیت‌کوین",
)
_WORD_SPLIT = re.compile(r"[\s،.,/\\()\[\]«»\"'؛:؟!\-—_|]+")

# موضوعاتِ غیرمالی که هرگز نباید منتشر شوند (کانال فقط بازارِ مالی است). حتی اگر
# کلمهٔ مالی (مثلِ «یورو») در خبر باشد، این‌ها خبر را رد می‌کنند.
# نکتهٔ مهم: تطبیق بر اساسِ «توکنِ کامل» است نه زیررشته — وگرنه مثلاً «مسی» (Messi)
# داخلِ «مسیر» (مسیرِ بازار) می‌افتاد و خبرِ مالیِ سالم را رد می‌کرد.
_NON_MARKET_TOKENS = frozenset((
    # ورزش
    "فوتبال", "فوتسال", "والیبال", "بسکتبال", "کشتی", "هندبال", "تنیس", "وزنه‌برداری",
    "باشگاه", "بازیکن", "بازیکنان", "مربی", "سرمربی", "گلزن", "هتریک", "پنالتی",
    "نیمکت", "مصدومیت", "پرسپولیس", "استقلال", "رئال", "بارسلونا", "بایرن",
    "لیورپول", "چلسی", "یوونتوس", "منچستر", "آرسنال", "رونالدو", "آلوارس", "فیفا",
    "المپیک", "هافبک", "مهاجم", "دروازه", "دروازه‌بان",
    "fifa", "uefa", "afc", "messi", "ronaldo", "striker", "midfielder", "goalkeeper",
    # سرگرمی/سلبریتی
    "سینما", "بازیگر", "بازیگران", "سریال", "کنسرت", "خواننده", "جشنواره",
    "آلبوم", "هنرمند", "گیشه", "اکران", "کارگردان",
    # سلامتی/لاغری/سبکِ‌زندگی (کلیک‌بیتِ غیرمالی) — تکِ‌کلمه‌های بی‌ابهام
    "لاغری", "چاقی", "چربی", "دیابت", "بیماری", "بیماری‌ها", "درمان", "سلامتی",
    "پزشکی", "پزشک", "دارو", "داروی", "ویتامین", "پوست", "زیبایی", "آرایش",
    "بارداری", "تغذیه", "معجزه", "طالع", "فال", "آشپزی", "دستورِ‌پخت",
))
# عباراتِ چندکلمه‌ای (زیررشته — به‌قدرِ کافی خاص هستند)
_NON_MARKET_PHRASES = (
    "تیم ملی", "تیمِ ملی", "لیگ برتر", "لالیگا", "جام جهانی", "جام‌جهانی",
    "نقل و انتقال", "نقل‌وانتقال", "لیگ قهرمانان",
    # کلیک‌بیتِ سلامتی/سبکِ‌زندگی (عبارتِ دقیق — خبرِ مالی را رد نمی‌کند)
    "چربی شکم", "کاهش وزن", "عادت ساده", "عادتِ ساده", "عادت روزانه",
    "راهکار طلایی", "راهکارهای طلایی", "راهکار‌های طلایی", "از دست ندهید",
    "فقط با این", "این عادت", "ترفند ساده", "باورنکردنی", "شگفت‌انگیز",
    "خواص شگفت", "رژیم غذایی", "گیاهان دارویی", "طب سنتی",
)


def _is_non_market(*texts: str) -> bool:
    blob = " ".join(t for t in texts if t)
    if any(ph in blob for ph in _NON_MARKET_PHRASES):
        return True
    for w in _WORD_SPLIT.split(blob.lower()):
        if w in _NON_MARKET_TOKENS:
            return True
    return False


def _iran_is_market(title: str, summary: str = "") -> bool:
    t = title or ""
    # رد قطعیِ موضوعاتِ غیرمالی (ورزش/سرگرمی) حتی با وجودِ کلمهٔ مالی
    if _is_non_market(title, summary):
        return False
    if any(ph in t for ph in _KW_PHRASES):
        return True
    for w in _WORD_SPLIT.split(t):
        if w and any(w.startswith(kw) for kw in _KW_WORDS):
            return True
    return False


def _entry_image(entry: dict) -> str | None:
    """استخراجِ بهترین عکسِ آیتم از فیلدهای رایجِ RSS/Atom."""
    for mc in entry.get("media_content", []) or []:
        if mc.get("url"):
            return mc["url"]
    for mt in entry.get("media_thumbnail", []) or []:
        if mt.get("url"):
            return mt["url"]
    for enc in entry.get("enclosures", []) or []:
        if "image" in (enc.get("type", "") or "") and (enc.get("href") or enc.get("url")):
            return enc.get("href") or enc.get("url")
    for lk in entry.get("links", []) or []:
        if lk.get("rel") == "enclosure" and "image" in (lk.get("type", "") or ""):
            return lk.get("href")
    html = entry.get("summary", "") or ""
    for c in entry.get("content", []) or []:
        html += c.get("value", "") or ""
    m = _IMG_RE.search(html)
    return m.group(1) if m else None


def _entry_text(entry: dict) -> str:
    """متنِ خامِ آیتم (HTML → متنِ ساده، محدود)."""
    html = ""
    for c in entry.get("content", []) or []:
        html += c.get("value", "") or ""
    if not html:
        html = entry.get("summary", "") or entry.get("description", "") or ""
    try:
        text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
    except Exception:  # noqa: BLE001
        text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text).strip()


def _slug_for(link: str, prefix: str = "news") -> str:
    h = hashlib.md5((link or "").encode("utf-8"), usedforsecurity=False).hexdigest()[:12]
    return f"{prefix}-{h}"


# محفظه‌های رایجِ بدنهٔ خبر (شاملِ سایت‌های ایرانی مثل اقتصاد آنلاین/مهر)
_BODY_SELECTORS = (
    "div[itemprop=articleBody]", "div.article-body", "div.articleBody",
    "div.body", "div.news-text", "div.item-text", "div.item-body",
    "div.entry-content", "div.post-content", "div.article-content",
    "div.content-text", "section.article-body", "article", "main",
)


async def _enrich_from_page(link: str) -> tuple[str | None, str]:
    """واکشیِ best-effortِ صفحهٔ خبر برای og:image و متنِ کامل (وقتی RSS نازک است).

    به‌جای تکیه بر یک تگِ ثابت، غنی‌ترین محفظهٔ متنی را میانِ سلکتورهای رایجِ بدنهٔ
    خبر (و article/main) انتخاب می‌کند تا متنِ کامل را بگیرد (مشکلِ متنِ کوتاهِ منابعِ
    ایرانی که بدنه‌شان در <article> نیست بلکه در div.body است).
    """
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=_UA) as c:
            r = await c.get(link)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
    except Exception:  # noqa: BLE001
        return None, ""

    img = None
    og = soup.find("meta", attrs={"property": "og:image"}) or soup.find("meta", attrs={"name": "og:image"})
    if og and og.get("content"):
        img = og["content"]

    # تگ‌های مزاحم را حذف کن تا در متن نیایند
    for bad in soup.select("script, style, nav, header, footer, aside, .ads, .advert, .related"):
        bad.decompose()

    # غنی‌ترین محفظه را بر اساسِ طولِ متن انتخاب کن
    best_el, best_len = None, 0
    for sel in _BODY_SELECTORS:
        for el in soup.select(sel):
            t = el.get_text(" ", strip=True)
            if len(t) > best_len:
                best_el, best_len = el, len(t)
    container = best_el or soup

    # ابتدا پاراگراف‌ها؛ اگر کم بود، کلِ متنِ محفظه
    paras = [p.get_text(" ", strip=True) for p in container.find_all("p")]
    text = " ".join(p for p in paras if len(p) >= 40)
    if len(text) < 200:
        text = container.get_text(" ", strip=True)
    return img, re.sub(r"\s+", " ", text).strip()[:2500]


async def _fetch_feed(url: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=_UA) as c:
            r = await c.get(url)
            r.raise_for_status()
            parsed = feedparser.parse(r.content)
            return list(parsed.entries or [])
    except Exception as exc:  # noqa: BLE001
        logger.warning("feed_fetch_failed", url=url, error=str(exc))
        return []


async def _exists(slug: str) -> bool:
    async with async_session_factory() as s:
        row = (await s.execute(select(Article.id).where(Article.slug == slug))).first()
        return row is not None


async def _today_count(category: str) -> int:
    """تعدادِ مقالاتِ همین دسته که امروز (UTC) ساخته شده‌اند."""
    from sqlalchemy import func as _f
    start = day_start_utc()
    async with async_session_factory() as s:
        n = (await s.execute(
            select(_f.count(Article.id)).where(
                Article.category == category, Article.created_at >= start
            )
        )).scalar() or 0
    return int(n)


async def _today_count_iran() -> int:
    """تعدادِ خبرهای ایرانیِ امروز (slug با پیشوندِ irnews-)."""
    from sqlalchemy import func as _f
    start = day_start_utc()
    async with async_session_factory() as s:
        n = (await s.execute(
            select(_f.count(Article.id)).where(
                Article.slug.like("irnews-%"), Article.created_at >= start
            )
        )).scalar() or 0
    return int(n)


def _norm_title(title: str) -> str:
    """کلیدِ نرمال‌شدهٔ تیتر برای کشفِ تکراریِ بین‌منبعی (همان خبر از چند منبع)."""
    t = (title or "").lower()
    t = re.sub(r"[^a-z0-9آ-ی ]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:120]


async def _is_dup_title(norm_key: str) -> bool:
    """ضدتکراری بر اساسِ تیتر (Redis SETNX با انقضای ۳ روز). True یعنی قبلاً دیده شده."""
    if not norm_key:
        return False
    try:
        # set اگر وجود نداشت → جدید (False)؛ اگر بود → تکراری (True)
        added = await redis_client.client.set(
            f"news:seen:{hashlib.md5(norm_key.encode(), usedforsecurity=False).hexdigest()}",
            "1", nx=True, ex=259200,
        )
        return not bool(added)
    except Exception:  # noqa: BLE001
        return False


async def _save_article(
    slug: str, title_fa: str, body_fa: str, image: str | None,
    category: str, source_name: str, source_url: str,
) -> int | None:
    # پاک‌سازیِ XSS روی محتوای واکشی‌شده از فید (منبعِ بیرونی = نامطمئن)
    from html import escape as _html_escape
    from src.core.html_sanitizer import sanitize_article_html, validate_url
    content = sanitize_article_html(body_fa.strip())
    # انتسابِ منبع — لینک فقط اگر URL معتبر و امن باشد؛ نام و URL هم escape می‌شوند
    _src_name = _html_escape(source_name or "")
    if source_url and validate_url(source_url):
        content += (
            f"\n\n— منبع: {_src_name}"
            f' · <a href="{_html_escape(source_url)}" target="_blank" rel="noopener noreferrer">مشاهدهٔ خبرِ اصلی</a>'
        )
    elif _src_name:
        content += f"\n\n— منبع: {_src_name}"
    summary = body_fa.strip().split("\n")[0][:280]
    # کیفیت/سئو: تعدادِ کلمات، اثرانگشتِ ضدِ تکرار، برچسب از دسته
    import hashlib as _hl
    import re as _re
    _text = _re.sub(r"\s+", " ", _re.sub(r"<[^>]+>", " ", body_fa)).strip()
    word_count = len(_text.split())
    if word_count < 40:  # خبرِ بیش‌ازحد کوتاه/خالی ذخیره نشود
        return None
    content_hash = _hl.md5(_re.sub(r"\s+", "", _text[:4000]).encode("utf-8"), usedforsecurity=False).hexdigest()
    _tags = {"news": ["اخبار فارکس"], "analysis": ["تحلیل بازار"]}.get(category, [category])
    now = datetime.now(timezone.utc)
    async with async_session_factory() as s:
        # ضدِ تکرار: ترجمه/خبرِ تقریباً یکسان دوباره ذخیره نشود
        if (await s.execute(select(Article.id).where(Article.content_hash == content_hash))).first():
            return None
        art = Article(
            title=title_fa[:240],
            slug=slug,
            content=content,
            summary=summary,
            category=category,
            cover_image=(image or None),
            is_published=True,
            published_at=now,
            tags=_tags,
            word_count=word_count,
            content_hash=content_hash,
            meta_description=_text[:300],
        )
        s.add(art)
        await s.flush()
        aid = art.id
        await s.commit()
    # اطلاع‌رسانیِ SEO: خبر/تحلیلِ جدید فوری وارد sitemap و ping شود
    try:
        from src.core.seo_notify import notify_search_engines
        await notify_search_engines([slug])
    except Exception:  # noqa: BLE001 — اطلاع‌رسانی نباید ingest را بشکند
        pass
    return aid


# صفِ بافرِ خبر برای انتشارِ تدریجی (drip). به‌جای پاشیدنِ دسته‌ایِ خبرها به کانال،
# اینجا انباشته می‌شوند و تسکِ drip_news یکی‌یکی با فاصله منتشرشان می‌کند → جریانِ
# یکنواخت در طولِ روز (نه خوشه‌ایِ دورِ دقایقِ اجرای ingest).
_DRIP_QUEUE = "news:drip_queue"
_DRIP_MAX = 240  # سقفِ بافر؛ از تازه‌ترین‌ها نگه می‌داریم (جلوگیری از انباشتِ بی‌نهایت)


async def enqueue_channel_post(
    title_fa: str, summary: str, image: str | None, slug: str, kind: str = "news",
) -> None:
    """خبر را در بافرِ drip می‌گذارد (نه مستقیم به کانال). kind: news/analysis/blog."""
    section = {"news": "news", "analysis": "analysis", "blog": "blog"}.get(kind, "news")
    try:
        await redis_client.client.rpush(
            _DRIP_QUEUE,
            json.dumps({
                "action": "news_post",
                "kind": kind,
                "title": title_fa,
                "summary": summary,
                "image": image,
                "url": f"{_SITE}/{section}?a={slug}",
            }, ensure_ascii=False),
        )
        # نگه‌داشتنِ تازه‌ترین _DRIP_MAX مورد (اگر بافر بیش از حد رشد کرد)
        await redis_client.client.ltrim(_DRIP_QUEUE, -_DRIP_MAX, -1)
    except Exception as exc:  # noqa: BLE001
        logger.warning("news_enqueue_failed", error=str(exc))


async def drip_once(batch: int = 1) -> int:
    """تا `batch` خبر از بافر بردار و به صفِ تلگرام بفرست (consumer منتشر می‌کند)."""
    try:
        await redis_client.connect()  # تسکِ Celery loop جدا دارد → اتصالِ تازه
    except Exception:  # noqa: BLE001
        pass
    sent = 0
    try:
        for _ in range(max(1, batch)):
            raw = await redis_client.client.lpop(_DRIP_QUEUE)
            if not raw:
                break
            await redis_client.client.rpush("telegram:events", raw)
            sent += 1
    except Exception as exc:  # noqa: BLE001
        logger.warning("news_drip_failed", error=str(exc))
    if sent:
        try:
            remaining = await redis_client.client.llen(_DRIP_QUEUE)
        except Exception:  # noqa: BLE001
            remaining = -1
        logger.info("news_drip", sent=sent, remaining=remaining)
    return sent


# ── پاک‌سازیِ اخبارِ فارسی (حذفِ چرومِ سایت‌های خبری ایرانی) ──
_FA_TAGS_RE = re.compile(r"برچسب\s*[‌‌\s]*ها\s*[:：].*", re.S)
_FA_DATE_RE = re.compile(
    r"[\d۰-۹]{1,2}\s*/\s*[^\s/]{2,14}\s*/\s*[\d۰-۹]{4}"
    r"(?:\s*[-،]?\s*[\d۰-۹]{1,2}\s*[:：]\s*[\d۰-۹]{2})?"
)
_FA_JUNK = [
    r"کد\s*خبر\s*[:：]?\s*[\d۰-۹]+",
    r"لینک\s*کپی\s*شد\s*!?",
    r"ارسال\s*نظر(?:ات)?",
    r"نظرات\s*کاربران",
    r"بیشتر\s*بخوانید\s*[:：]?",
    r"انتهای\s*پیام\s*/?",
    r"چاپ\s*خبر",
    r"اشتراک\s*گذاری",
]


def _clean_fa_news(title: str, body: str) -> tuple[str, str]:
    """نگارشِ تمیزِ اخبارِ فارسی: حذفِ بِرِدکرامب، تاریخ، «کد خبر»، «برچسب‌ها»،
    «لینک کپی شد»، «ارسال نظرات» و تکرارِ عنوان در ابتدای بدنه."""
    t = re.sub(r"\s+", " ", title or "").strip()
    b = _FA_TAGS_RE.sub(" ", body or "")        # برچسب‌ها تا انتها
    b = _FA_DATE_RE.sub(" ", b)                  # تاریخ‌ها
    for p in _FA_JUNK:
        b = re.sub(p, " ", b, flags=re.I)
    b = re.sub(r"\s+", " ", b).strip()
    # حذفِ بِرِدکرامبِ ابتدایی: اگر عنوان نزدیکِ ابتدای بدنه آمده، هرچه قبلش را بینداز
    if t and len(t) > 8:
        idx = b.find(t)
        if 0 < idx <= 140:
            b = b[idx:].strip()
        if b.startswith(t):                      # حذفِ تکرارِ عنوان
            b = b[len(t):].strip(" .،:-—")
    b = re.sub(r"\s+", " ", b).strip()
    return t[:240], b[:2500]


async def ingest_once(post_to_channel: bool = True) -> dict:
    """خبرخوانِ «جدیدترین‌ها هرچی آمد» — بدونِ سقفِ روزانه.

    هر اجرا (هر ۲۰ دقیقه) فقط چند آیتمِ جدیدترین را برمی‌دارد (throttle) تا محتوا
    خودش در ۲۴ ساعت پخش شود (نه burst). فیلترها: ضدتکراری (لینک+تیتر)، ضدتبلیغ،
    و گیتِ کیفیت (متنِ کافی + برای کانال، داشتنِ عکس).
    """
    if not settings.LLM_ENABLED:
        logger.info("news_ingest_skipped_llm_disabled")
        return {"saved": 0, "reason": "llm_disabled"}

    saved = 0
    by_cat: dict[str, int] = {}
    for category in ("news", "analysis"):
        # بودجهٔ هر-اجرا به‌تفکیکِ استریم (در اخبار: بین‌المللی + ایرانی)
        if category == "news":
            run_cap = {"intl": PER_RUN_INTL, "iran": PER_RUN_IRAN}
        else:
            run_cap = {"intl": PER_RUN_MAX, "iran": 0}
        added = {"intl": 0, "iran": 0}

        srcs = [s for s in RSS_SOURCES if s["category"] == category]
        for src in srcs:
            is_iran = src.get("origin") == "iran"
            is_fa = src.get("lang") == "fa"
            stream = "iran" if is_iran else "intl"
            if added[stream] >= run_cap[stream]:
                continue
            entries = await _fetch_feed(src["url"])  # RSS معمولاً جدید→قدیم
            for entry in entries:
                if added[stream] >= run_cap[stream]:
                    break
                link = entry.get("link") or entry.get("id") or ""
                if not link:
                    continue
                slug = _slug_for(link, prefix="irnews" if is_iran else "news")
                if await _exists(slug):
                    continue
                title_raw = entry.get("title", "") or ""
                _summary_raw = entry.get("summary", "") or ""
                if is_iran and not _iran_is_market(title_raw, _summary_raw):
                    continue
                # گاردِ عمومی برای همهٔ منابع: موضوعاتِ غیرمالی (ورزش/سرگرمی) هرگز نه
                if _is_non_market(title_raw, _summary_raw):
                    logger.info("news_skipped_non_market", source=src["name"], title=title_raw[:60])
                    continue
                if await _is_dup_title(_norm_title(title_raw)):
                    continue  # همان خبر از منبعِ دیگر
                body_raw = _entry_text(entry)
                image = _entry_image(entry)
                if len(body_raw) < MIN_BODY_CHARS or not image:
                    page_img, page_text = await _enrich_from_page(link)
                    if not image and page_img:
                        image = page_img
                    if len(page_text) > len(body_raw):
                        body_raw = page_text

                # گیتِ کیفیت: خبرِ نازک پست نشود
                if len(body_raw) < MIN_BODY_CHARS:
                    continue
                # برای کانال، عکس لازم است (بدونِ عکس فقط در سایت می‌ماند)
                to_channel = post_to_channel and category in ("news", "analysis")
                if REQUIRE_IMAGE_FOR_CHANNEL and not image:
                    to_channel = False

                # فیلترِ تبلیغاتِ بروکر — به‌هیچ‌عنوان منتشر نشود
                if is_broker_ad(title_raw, body_raw):
                    logger.info("news_skipped_broker_ad", source=src["name"], title=title_raw[:60])
                    continue

                if is_fa:
                    title_fa, body_fa = _clean_fa_news(title_raw, body_raw)
                    if not title_fa:
                        continue
                else:
                    tr = await translate_news(title_raw, body_raw)
                    if not tr:
                        continue
                    title_fa, body_fa = tr

                # ضدتبلیغ روی متنِ نهایی (فارسی) هم
                if is_broker_ad(title_fa, body_fa):
                    logger.info("news_skipped_broker_ad_fa", source=src["name"], title=title_fa[:60])
                    continue

                aid = await _save_article(
                    slug, title_fa, body_fa, image, category, src["name"], link,
                )
                if aid:
                    saved += 1
                    added[stream] += 1
                    logger.info("news_saved", id=aid, category=category, origin=stream, source=src["name"], title=title_fa[:60])
                    if to_channel:
                        _sum = re.sub(r"\s+", " ", " ".join(body_fa.split("\n")[:3]))[:600]
                        await enqueue_channel_post(title_fa, _sum, image, slug, kind=category)
        by_cat[category] = added["intl"] + added["iran"]
    logger.info("news_ingest_done", saved=saved, by_cat=by_cat)
    return {"saved": saved, "by_cat": by_cat}


# ── Celery task ──
from src.core.celery_app import celery_app  # noqa: E402


@celery_app.task(name="src.news.ingest.ingest_news")
def ingest_news() -> dict:
    """تسکِ Celery — خبرخوانِ دوره‌ای."""
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(ingest_once(post_to_channel=True))
    finally:
        loop.close()


@celery_app.task(name="src.news.ingest.drip_news")
def drip_news() -> dict:
    """تسکِ Celery — انتشارِ تدریجیِ یک خبر از بافر به کانال (هر اجرا یکی)."""
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        sent = loop.run_until_complete(drip_once(batch=1))
        return {"posted": sent}
    finally:
        loop.close()
