"""
مسیرهای SEO — sitemap داینامیک و robots.

این روتر بدون prefix در سطحِ ریشهٔ API نصب می‌شود تا آدرس‌های استانداردِ
موتورهای جستجو را مستقیماً سرو کند:
  - /sitemap.xml            → sitemap index (به دو فرزند اشاره می‌کند)
  - /sitemap-pages.xml      → صفحاتِ ایستا
  - /sitemap-articles.xml   → همهٔ مقالاتِ منتشرشده (news/analysis/blog/edu) با lastmod
  - /robots.txt             → robots پویا

nginxِ وب‌سایت این آدرس‌ها را به API پراکسی می‌کند تا روی دامنهٔ اصلی در ریشه باشند.
خروجی برای کاهشِ فشارِ کراولر ۱۰ دقیقه در Redis کش می‌شود.
"""

import html as _html
import json
from datetime import datetime, timezone
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from src.api.deps import get_db
from src.core.config import settings
from src.core.database import Article
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)
router = APIRouter()

# ── دامنهٔ کانونیکال (همیشه https و حروفِ کوچک) ──
BASE = f"https://{settings.WEBSITE_DOMAIN}".lower().rstrip("/")

_CACHE_TTL = 600  # ۱۰ دقیقه

# صفحاتِ ایستا قابلِ ایندکس: (path, changefreq, priority)
_STATIC_PAGES: list[tuple[str, str, str]] = [
    ("/", "daily", "1.0"),
    ("/academy", "weekly", "0.95"),
    ("/signals", "hourly", "0.9"),
    ("/news", "daily", "0.9"),
    ("/performance", "daily", "0.8"),
    ("/live-prices", "always", "0.8"),
    ("/copy-trade", "weekly", "0.8"),
    ("/analysis", "daily", "0.8"),
    ("/broker", "monthly", "0.8"),
    ("/blog", "daily", "0.7"),
    ("/education", "weekly", "0.7"),
    ("/backtest", "weekly", "0.5"),
    ("/about", "monthly", "0.5"),
    ("/contact", "monthly", "0.5"),
]

# دستهٔ مقاله → (changefreq, priority)
_CAT_RULES: dict[str, tuple[str, str]] = {
    "news": ("daily", "0.6"),
    "analysis": ("weekly", "0.7"),
    "blog": ("weekly", "0.6"),
    "beginner": ("monthly", "0.7"),
    "intermediate": ("monthly", "0.7"),
    "advanced": ("monthly", "0.7"),
}
_DEFAULT_RULE = ("weekly", "0.5")


def _xml(body: str) -> Response:
    return Response(content=body, media_type="application/xml; charset=utf-8")


async def _cache_get(key: str) -> str | None:
    try:
        if redis_client.client is not None:
            return await redis_client.client.get(key)
    except Exception:  # noqa: BLE001 — کش اختیاری است
        pass
    return None


async def _cache_set(key: str, value: str) -> None:
    try:
        if redis_client.client is not None:
            await redis_client.client.set(key, value, ex=_CACHE_TTL)
    except Exception:  # noqa: BLE001
        pass


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")


@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap_index() -> Response:
    """ایندکسِ sitemap — به صفحات و مقالات اشاره می‌کند."""
    now = _now_iso()
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"  <sitemap><loc>{BASE}/sitemap-pages.xml</loc><lastmod>{now}</lastmod></sitemap>\n"
        f"  <sitemap><loc>{BASE}/sitemap-articles.xml</loc><lastmod>{now}</lastmod></sitemap>\n"
        "</sitemapindex>\n"
    )
    return _xml(body)


@router.get("/sitemap-pages.xml", include_in_schema=False)
async def sitemap_pages() -> Response:
    """صفحاتِ ایستا."""
    now = _now_iso()
    rows = []
    for path, freq, prio in _STATIC_PAGES:
        rows.append(
            f"  <url><loc>{BASE}{path}</loc>"
            f"<lastmod>{now}</lastmod>"
            f"<changefreq>{freq}</changefreq>"
            f"<priority>{prio}</priority></url>"
        )
    # صفحاتِ برچسبِ خوشه‌های موضوعی (topic clusters) — صفحاتِ شاخصِ باارزش
    try:
        from src.news.keywords import CLUSTERS
        import urllib.parse as _up
        seen = set()
        for _k, (_t, _tags, _kids) in CLUSTERS.items():
            for tg in _tags:
                if tg in seen:
                    continue
                seen.add(tg)
                rows.append(
                    f"  <url><loc>{BASE}/tag/{_up.quote(tg)}</loc>"
                    f"<lastmod>{now}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>"
                )
    except Exception:
        pass
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(rows)
        + "\n</urlset>\n"
    )
    return _xml(body)


@router.get("/sitemap-articles.xml", include_in_schema=False)
async def sitemap_articles(db: AsyncSession = Depends(get_db)) -> Response:
    """همهٔ مقالاتِ منتشرشده با آدرسِ تمیزِ /article/<slug>."""
    cache_key = "seo:sitemap:articles"
    cached = await _cache_get(cache_key)
    if cached:
        return _xml(cached)

    conditions = [Article.is_published.is_(True)] if hasattr(Article, "is_published") else []
    query = select(Article).order_by(Article.updated_at.desc())
    if conditions:
        query = query.where(*conditions)
    result = await db.execute(query)
    articles = result.scalars().all()

    rows = []
    for a in articles:
        slug = getattr(a, "slug", None)
        if not slug:
            continue
        cat = getattr(a, "category", None) or ""
        freq, prio = _CAT_RULES.get(cat, _DEFAULT_RULE)
        if getattr(a, "is_pillar", False):  # صفحهٔ مادرِ خوشه = اولویتِ بالاتر
            prio = "0.9"
        ts = getattr(a, "updated_at", None) or getattr(a, "created_at", None)
        lastmod = (
            ts.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
            if ts
            else _now_iso()
        )
        loc = f"{BASE}/article/{escape(str(slug))}"
        rows.append(
            f"  <url><loc>{loc}</loc>"
            f"<lastmod>{lastmod}</lastmod>"
            f"<changefreq>{freq}</changefreq>"
            f"<priority>{prio}</priority></url>"
        )

    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(rows)
        + "\n</urlset>\n"
    )
    await _cache_set(cache_key, body)
    logger.info("sitemap_articles_built", count=len(rows))
    return _xml(body)


@router.get("/indexnow-key.txt", include_in_schema=False)
async def indexnow_key_file() -> Response:
    """فایلِ تأییدِ مالکیتِ IndexNow (محتوا = کلید)."""
    key = getattr(settings, "INDEXNOW_KEY", "") or ""
    return Response(content=key, media_type="text/plain; charset=utf-8")


@router.get("/rss.xml", include_in_schema=False)
async def rss_feed(db: AsyncSession = Depends(get_db)) -> Response:
    """فیدِ RSS 2.0 از تازه‌ترین مقالات — برای فیدخوان‌ها، اگریگیتورها و سیندیکیشن (کشفِ بهتر + بک‌لینکِ طبیعی)."""
    cache_key = "seo:rss"
    cached = await _cache_get(cache_key)
    if cached:
        return Response(content=cached, media_type="application/rss+xml; charset=utf-8")
    rows = (await db.execute(
        select(Article).where(Article.is_published.is_(True))
        .order_by(Article.published_at.desc().nullslast()).limit(40))).scalars().all()
    items = []
    for a in rows:
        link = f"{BASE}/article/{escape(str(a.slug))}"
        desc = escape((getattr(a, "meta_description", None) or getattr(a, "summary", None) or a.title or "")[:300])
        pub = getattr(a, "published_at", None) or getattr(a, "created_at", None)
        pub_s = pub.strftime("%a, %d %b %Y %H:%M:%S +0000") if pub else ""
        items.append(
            f"<item><title>{escape(a.title)}</title><link>{link}</link>"
            f"<guid isPermaLink=\"true\">{link}</guid>"
            f"<description>{desc}</description>"
            f"{f'<pubDate>{pub_s}</pubDate>' if pub_s else ''}"
            f"{f'<category>{escape(a.category)}</category>' if getattr(a, 'category', None) else ''}</item>"
        )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0"><channel>'
        f'<title>کوین پرو FX — فارکس، طلا و تحلیل بازار</title>'
        f'<link>{BASE}/</link>'
        f'<description>تازه‌ترین مقالات، آموزش‌ها و تحلیل‌های فارکس و طلا</description>'
        f'<language>fa-IR</language><lastBuildDate>{_now_iso()}</lastBuildDate>'
        + "".join(items) + "</channel></rss>"
    )
    await _cache_set(cache_key, body)
    return Response(content=body, media_type="application/rss+xml; charset=utf-8")


@router.get("/robots.txt", include_in_schema=False)
async def robots() -> Response:
    body = (
        "# robots.txt — کوین پرو FX\n"
        "User-agent: *\n"
        "Allow: /\n"
        "\n"
        "# مسیرهای غیرضروری برای ایندکس\n"
        "Disallow: /api/\n"
        "Disallow: /live/\n"
        "Disallow: /*?a=\n"  # نسخهٔ مودالیِ مقاله؛ نسخهٔ کانونیکال /article/<slug> است
        "\n"
        f"Sitemap: {BASE}/sitemap.xml\n"
    )
    return Response(content=body, media_type="text/plain; charset=utf-8")


# ─────────────────────────── Dynamic rendering برای کراولرها ───────────────────────────
# nginx درخواستِ bot/شبکهٔ اجتماعی را به /seo/render پراکسی می‌کند؛ کاربرِ انسانی همان SPA را می‌گیرد.
# خروجی HTMLِ کاملِ با‌متا‌و‌محتوا + لینک‌های داخلی است؛ مقالهٔ نبوده ۴۰۴ واقعی می‌دهد (رفعِ soft-404).

SITE_NAME = "کوین پرو FX"
AUTHOR_NAME = "بهنام جلالی"
_SECTION = {
    "news": ("اخبار فارکس", "/news"), "analysis": ("تحلیل بازار", "/analysis"),
    "blog": ("بلاگ آموزشی", "/blog"), "beginner": ("آموزش فارکس", "/education"),
    "intermediate": ("آموزش فارکس", "/education"), "advanced": ("آموزش فارکس", "/education"),
}
_LIST_PAGES = {
    "news": ("اخبار فارکس و طلا", "آخرین اخبار لحظه‌ای فارکس، طلا، نفت و شاخص‌های جهانی"),
    "analysis": ("تحلیل بازار فارکس", "تحلیل تکنیکال و بنیادی روزانهٔ جفت‌ارزها، طلا و شاخص‌ها"),
    "blog": ("بلاگ آموزشی فارکس", "مقالات آموزشی فارکس، استراتژی معاملاتی و مدیریت سرمایه"),
    "education": ("آموزش فارکس از صفر", "دورهٔ کامل آموزش فارکس؛ مقدماتی تا حرفه‌ای"),
}
_NAV = [("/", "خانه"), ("/signals", "سیگنال‌ها"), ("/news", "اخبار"), ("/analysis", "تحلیل"),
        ("/blog", "بلاگ"), ("/education", "آموزش"), ("/academy", "آکادمی"), ("/performance", "عملکرد"),
        ("/broker", "بروکر"), ("/about", "دربارهٔ ما"), ("/contact", "تماس")]


def _e(s: object) -> str:
    return _html.escape(str(s if s is not None else ""), quote=True)


def _iso_dt(ts) -> str:
    try:
        return ts.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    except Exception:
        return ""


def _abs_img(cover: str | None) -> str:
    if not cover:
        return f"{BASE}/og-image.svg"
    if cover.startswith("http"):
        return cover
    return BASE + (cover if cover.startswith("/") else "/" + cover)


def _nav_html() -> str:
    links = " · ".join(f'<a href="{BASE}{p}">{_e(t)}</a>' for p, t in _NAV)
    return f'<footer><nav aria-label="ناوبری اصلی">{links}</nav><p>© {SITE_NAME}</p></footer>'


def _shell(*, title: str, desc: str, canonical: str, body: str, jsonld: str = "",
           og_image: str = "", og_type: str = "website", status: int = 200,
           robots: str = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
           published: str = "", modified: str = "") -> Response:
    og_img = og_image or f"{BASE}/og-image.svg"
    ams = ""
    if og_type == "article":
        if published:
            ams += f'<meta property="article:published_time" content="{_e(published)}"/>'
        if modified:
            ams += f'<meta property="article:modified_time" content="{_e(modified)}"/>'
    ld = f'<script type="application/ld+json">{jsonld}</script>' if jsonld else ""
    doc = (
        f'<!doctype html><html lang="fa" dir="rtl"><head>'
        f'<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>'
        f'<title>{_e(title)}</title>'
        f'<meta name="description" content="{_e(desc)}"/>'
        f'<meta name="robots" content="{_e(robots)}"/>'
        f'<link rel="canonical" href="{_e(canonical)}"/>'
        f'<meta property="og:site_name" content="{_e(SITE_NAME)}"/><meta property="og:locale" content="fa_IR"/>'
        f'<meta property="og:type" content="{_e(og_type)}"/><meta property="og:title" content="{_e(title)}"/>'
        f'<meta property="og:description" content="{_e(desc)}"/><meta property="og:url" content="{_e(canonical)}"/>'
        f'<meta property="og:image" content="{_e(og_img)}"/>{ams}'
        f'<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="{_e(title)}"/>'
        f'<meta name="twitter:description" content="{_e(desc)}"/><meta name="twitter:image" content="{_e(og_img)}"/>'
        f'{ld}</head><body>{body}{_nav_html()}</body></html>'
    )
    return Response(content=doc, media_type="text/html; charset=utf-8", status_code=status)


def _article_doc(a: Article, related: list[Article]) -> Response:
    cat = getattr(a, "category", "") or ""
    sec_t, sec_p = _SECTION.get(cat, ("مقالات", "/blog"))
    canonical = f"{BASE}/article/{_e(getattr(a, 'slug', ''))}"
    title = f"{a.title} | {SITE_NAME}"
    desc = (getattr(a, "meta_description", None) or getattr(a, "summary", None) or a.title or "")[:300]
    pub, mod = _iso_dt(getattr(a, "published_at", None) or getattr(a, "created_at", None)), _iso_dt(getattr(a, "updated_at", None) or getattr(a, "created_at", None))
    cover = _abs_img(getattr(a, "cover_image", None))
    # JSON-LD مرکزی (Article + Breadcrumb + Organization + FAQPage در صورتِ وجودِ بخشِ سوالات متداول)
    from src.seo.schema import article_jsonld
    jsonld = article_jsonld(
        a, base=BASE, site_name=SITE_NAME, author_name=AUTHOR_NAME,
        section_title=sec_t, section_path=sec_p, description=desc,
        cover=cover, published=pub, modified=mod,
    )
    rel_html = ""
    if related:
        items = "".join(f'<li><a href="{BASE}/article/{_e(r.slug)}">{_e(r.title)}</a></li>' for r in related)
        rel_html = f'<aside><h2>مقالات مرتبط</h2><ul>{items}</ul></aside>'
    cover_html = f'<img src="{_e(cover)}" alt="{_e(a.title)}" width="1200" height="630" loading="lazy"/>' if getattr(a, "cover_image", None) else ""
    summary_html = f"<p>{_e(a.summary)}</p>" if getattr(a, "summary", None) else ""
    tags = getattr(a, "tags", None) if isinstance(getattr(a, "tags", None), list) else []
    tags_html = ('<p>' + " ".join(f'<a href="{BASE}/tag/{_e(t)}">#{_e(t)}</a>' for t in tags) + '</p>') if tags else ""
    body = (
        f'<article>'
        f'<nav aria-label="breadcrumb"><a href="{BASE}/">خانه</a> › <a href="{BASE}{sec_p}">{_e(sec_t)}</a> › <span>{_e(a.title)}</span></nav>'
        f'<h1>{_e(a.title)}</h1>'
        f'<p>نویسنده: {_e(AUTHOR_NAME)}{f" — <time datetime=\"{pub}\">{pub[:10]}</time>" if pub else ""}</p>'
        f'{cover_html}{summary_html}'
        f'<div>{a.content}</div>'  # content از قبل در DB سنیتایز شده
        f'{tags_html}</article>{rel_html}'
    )
    return _shell(title=title, desc=desc, canonical=canonical, body=body, jsonld=jsonld,
                  og_image=cover, og_type="article", published=pub, modified=mod)


def _tag_doc(tag: str, articles: list[Article]) -> Response:
    canonical = f"{BASE}/tag/{_e(tag)}"
    title = f"مطالب با برچسب «{tag}» | {SITE_NAME}"
    desc = f"جدیدترین مقالات، تحلیل‌ها و آموزش‌های فارکس با موضوع {tag}."
    items, ld = "", []
    for i, a in enumerate(articles, 1):
        items += f'<li><a href="{BASE}/article/{_e(a.slug)}"><h2>{_e(a.title)}</h2></a></li>'
        ld.append({"@type": "ListItem", "position": i, "url": f"{BASE}/article/{_e(a.slug)}", "name": a.title})
    jsonld = json.dumps({"@context": "https://schema.org", "@type": "ItemList", "name": f"#{tag}", "itemListElement": ld}, ensure_ascii=False)
    body = f'<main><nav><a href="{BASE}/">خانه</a> › <span>برچسب</span></nav><h1>#{_e(tag)}</h1><p>{_e(desc)}</p><ul>{items}</ul></main>'
    return _shell(title=title, desc=desc, canonical=canonical, body=body, jsonld=jsonld)


def _list_doc(seg: str, articles: list[Article]) -> Response:
    t, d = _LIST_PAGES[seg]
    canonical = f"{BASE}/{seg}"
    title = f"{t} | {SITE_NAME}"
    items, ld_items = "", []
    for i, a in enumerate(articles, 1):
        s = getattr(a, "summary", None) or ""
        items += f'<li><a href="{BASE}/article/{_e(a.slug)}"><h2>{_e(a.title)}</h2></a><p>{_e(s[:160])}</p></li>'
        ld_items.append({"@type": "ListItem", "position": i, "url": f"{BASE}/article/{_e(a.slug)}", "name": a.title})
    jsonld = json.dumps({"@context": "https://schema.org", "@type": "ItemList", "name": t, "itemListElement": ld_items}, ensure_ascii=False)
    body = f'<main><h1>{_e(t)}</h1><p>{_e(d)}</p><ul>{items}</ul></main>'
    return _shell(title=title, desc=d, canonical=canonical, body=body, jsonld=jsonld)


_HOME_FAQ = [
    ("سیگنال‌های کوین پرو FX چگونه تولید می‌شوند؟", "با ترکیب الگوریتم‌های تحلیل تکنیکال پیشرفته، پرایس اکشن، اندیکاتورها و هوش مصنوعی؛ هر سیگنال پیش از ارسال با اعتبارسنجی چندلایه بررسی می‌شود."),
    ("آیا استفاده از سیگنال‌ها رایگان است؟", "بخشی از سیگنال‌ها در کانال عمومی تلگرام رایگان است؛ برای دسترسی کامل با جزئیات و تحلیل اختصاصی، اشتراک ویژه تهیه می‌شود."),
    ("نرخ موفقیت سیگنال‌ها چقدر است؟", "تمام آمار عملکرد (نرخ برد، سود/زیان خالص پیپ و جزئیات هر سیگنال) کاملاً واقعی و لحظه‌ای از دیتابیس خوانده و در صفحهٔ عملکرد نمایش داده می‌شود."),
    ("سیگنال‌ها برای چه جفت‌ارزهایی ارسال می‌شود؟", "جفت‌ارزهای اصلی و فرعی، طلا (XAU/USD)، نقره و شاخص‌های مهم مانند US30 و NAS100."),
    ("حد ضرر و حد سود هر سیگنال مشخص است؟", "بله؛ هر سیگنال نقطهٔ ورود دقیق، حداقل یک حد سود و حد ضرر مشخص، درجهٔ قدرت و تحلیل مختصر دارد."),
]


def _home_doc(latest: list[Article]) -> Response:
    title = f"{SITE_NAME} | سیگنال فارکس هوشمند با هوش مصنوعی"
    desc = "سیگنال‌های واقعی فارکس، طلا و شاخص‌ها با هوش مصنوعی؛ آموزش فارکس، تحلیل بازار و کپی‌ترید."
    items = "".join(f'<li><a href="{BASE}/article/{_e(a.slug)}">{_e(a.title)}</a></li>' for a in latest)
    jsonld = json.dumps({"@context": "https://schema.org", "@graph": [
        {"@type": "WebSite", "name": SITE_NAME, "url": BASE + "/", "inLanguage": "fa-IR",
         "potentialAction": {"@type": "SearchAction", "target": f"{BASE}/education?q={{search_term_string}}", "query-input": "required name=search_term_string"}},
        {"@type": "Organization", "name": SITE_NAME, "url": BASE + "/", "logo": f"{BASE}/favicon.svg"},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in _HOME_FAQ]},
    ]}, ensure_ascii=False)
    faq_html = "".join(f'<section><h3>{_e(q)}</h3><p>{_e(a)}</p></section>' for q, a in _HOME_FAQ)
    body = (
        f'<main><h1>{_e(SITE_NAME)} — سیگنال فارکس هوشمند با هوش مصنوعی</h1>'
        f'<p>{_e(desc)}</p>'
        f'<h2>تازه‌ترین مقالات و تحلیل‌ها</h2><ul>{items}</ul>'
        f'<h2>سوالات متداول</h2>{faq_html}</main>'
    )
    return _shell(title=title, desc=desc, canonical=BASE + "/", body=body, jsonld=jsonld)


async def _render(full_path: str, db: AsyncSession) -> Response:
    fp = (full_path or "").strip("/")
    # مقاله
    if fp.startswith("article/"):
        slug = fp[len("article/"):].split("?")[0].split("/")[0]
        a = (await db.execute(select(Article).where(Article.slug == slug, Article.is_published.is_(True)))).scalar_one_or_none()
        if not a:
            return _shell(title=f"یافت نشد | {SITE_NAME}", desc="صفحهٔ موردنظر یافت نشد.",
                          canonical=f"{BASE}/article/{_e(slug)}", body="<main><h1>۴۰۴ — صفحه یافت نشد</h1></main>",
                          status=404, robots="noindex,follow")
        rel = (await db.execute(
            select(Article).where(Article.is_published.is_(True), Article.category == (a.category or ""), Article.id != a.id)
            .order_by(Article.published_at.desc().nullslast()).limit(6))).scalars().all()
        return _article_doc(a, list(rel))
    # صفحهٔ برچسب
    if fp.startswith("tag/"):
        import urllib.parse as _up
        tag = _up.unquote(fp[len("tag/"):].split("?")[0].split("/")[0])
        arts = []
        if tag:
            try:
                from sqlalchemy import cast as _cast, String as _S
                from sqlalchemy.dialects.postgresql import ARRAY as _AR
                arts = (await db.execute(
                    select(Article).where(
                        Article.is_published.is_(True), Article.tags.op("?")(tag),
                    ).order_by(Article.published_at.desc().nullslast()).limit(40))).scalars().all()
            except Exception:
                arts = []
        return _tag_doc(tag, list(arts))
    # صفحاتِ فهرست
    seg = fp.split("/")[0].split("?")[0]
    if seg in _LIST_PAGES:
        cats = {"education": ["beginner", "intermediate", "advanced"]}.get(seg, [seg])
        arts = (await db.execute(
            select(Article).where(Article.is_published.is_(True), Article.category.in_(cats))
            .order_by(Article.published_at.desc().nullslast()).limit(40))).scalars().all()
        return _list_doc(seg, list(arts))
    # خانه و سایرِ صفحاتِ ایستا
    latest = (await db.execute(
        select(Article).where(Article.is_published.is_(True))
        .order_by(Article.published_at.desc().nullslast()).limit(20))).scalars().all()
    return _home_doc(list(latest))


@router.get("/seo/render", include_in_schema=False)
@router.get("/seo/render/{full_path:path}", include_in_schema=False)
async def seo_render(full_path: str = "", db: AsyncSession = Depends(get_db)) -> Response:
    try:
        resp = await _render(full_path, db)
        resp.headers["Cache-Control"] = "public, max-age=600"
        resp.headers["X-Robots-Tag"] = "index, follow"
        return resp
    except Exception as e:  # هرگز برای کراولر ۵۰۰ نده → fallback به خانه
        logger.warning("seo_render_failed", path=full_path, error=str(e)[:200])
        return _home_doc([])
