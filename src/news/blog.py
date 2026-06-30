"""تولیدِ مقالاتِ اصیلِ بلاگ (فارسی) با Claude — محتوای SEO بدونِ مسئلهٔ کپی‌رایت.

هر اجرا یک موضوعِ «استفاده‌نشدهٔ اخیر» انتخاب و یک مقالهٔ حرفه‌ای می‌نویسد. تا سقفِ
روزانه (۶ پست) و بدونِ تکرارِ موضوع در ۱۴ روزِ اخیر.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from src.core.config import settings
from src.core.database import Article, async_session_factory
from src.core.logger import get_logger
from src.llm.client import llm_client

logger = get_logger("news.blog")

BLOG_DAILY_MAX = 10
_REPEAT_BLOCK_DAYS = 7

# مخزنِ بزرگِ موضوعات تا تکرار در روزهای نزدیک رخ ندهد
TOPICS = [
    "تحلیل تکنیکال چیست و چرا برای معامله‌گر فارکس حیاتی است",
    "مدیریت سرمایه و ریسک در فارکس؛ قانون درصد ریسک و محاسبهٔ حجم معامله",
    "روان‌شناسی معامله‌گری؛ کنترل ترس و طمع در بازار",
    "نسبت ریسک به ریوارد و چرا مهم‌تر از نرخ برد است",
    "الگوهای کندل‌استیک پرکاربرد و نحوهٔ معامله با آن‌ها",
    "سطوح حمایت و مقاومت؛ شناسایی و معامله",
    "اندیکاتور RSI و واگرایی‌ها در عمل",
    "میانگین‌های متحرک و استراتژی تقاطع طلایی و مرگ",
    "تحلیل چند تایم‌فریمی و هم‌جهتی با روند بزرگ‌تر",
    "سشن‌های معاملاتی فارکس و بهترین زمان برای ترید",
    "اخبار اقتصادی مهم (NFP، CPI، نرخ بهره) و تأثیرشان بر بازار",
    "پرایس اکشن؛ خواندن بازار بدون اندیکاتور",
    "اسمارت مانی و رفتار بازیگران بزرگ بازار",
    "طلا (XAUUSD)؛ عوامل مؤثر و نکات معاملاتی",
    "تریلینگ استاپ و مدیریت پویای حد ضرر",
    "اشتباهات رایج معامله‌گران تازه‌کار و راه‌حل آن‌ها",
    "اندیکاتور MACD و کاربردهای آن",
    "باندهای بولینگر و معامله در نوسان بازار",
    "فیبوناچی اصلاحی و گسترشی در معاملات",
    "الگوهای کلاسیک نموداری: سر و شانه، مثلث، پرچم",
    "مفهوم نقدینگی و اسپرد در فارکس",
    "همبستگی جفت‌ارزها و مدیریت ریسک سبد",
    "تأثیر بانک‌های مرکزی و سیاست پولی بر نرخ ارز",
    "شاخص دلار (DXY) و رابطهٔ آن با جفت‌ارزها",
    "نفت و بازار انرژی؛ عوامل بنیادی مؤثر بر قیمت",
    "تورم و نرخ بهره؛ موتور حرکت بازارهای مالی",
    "استراتژی شکست (Breakout) و دام‌های آن",
    "استراتژی بازگشت به میانگین در بازار رنج",
    "اندیکاتور استوکاستیک و اشباع خرید/فروش",
    "ایچیموکو؛ سیستم کاملِ تحلیل در یک نگاه",
    "حجم معاملات و تأیید حرکت قیمت",
    "ساختار بازار: سقف و کف‌های متوالی",
    "ژورنال معاملاتی؛ کلید پیشرفت معامله‌گر",
    "بک‌تست و فوروارد تست استراتژی",
    "مدیریت هیجان پس از ضرر یا سود بزرگ",
    "پلن معاملاتی شخصی چگونه نوشته می‌شود",
    "تفاوت تحلیل تکنیکال و بنیادی و ترکیب آن‌ها",
    "گپ قیمتی (Gap) و انواع آن",
    "واگرایی مخفی و معمولی در اندیکاتورها",
    "نواحی عرضه و تقاضا (Supply & Demand)",
    "اوردر بلاک و مفاهیم ICT",
    "پوزیشن سایزینگ پیشرفته و کِلی",
    "اهمیت دیسیپلین و پایبندی به سیستم",
    "تحلیل سنتیمنت و گزارش COT",
    "نقش لوریج در سود و زیان و خطرهای آن",
    "الگوهای هارمونیک: گارتلی، خفاش و پروانه",
    "معامله در زمان انتشار اخبار پرنوسان",
    "مدیریت چند پوزیشن هم‌زمان",
    "روندها: شناسایی، تأیید و معامله در جهت روند",
    "خروج حرفه‌ای از معامله؛ پله‌ای و بر اساس هدف",
    "اندیکاتور ADX و سنجش قدرت روند",
    "پارابولیک سار (SAR) و تریل کردن روند",
    "الگوی دوقله و دودره و معامله با آن",
    "الگوی کنج (Wedge) صعودی و نزولی",
    "گپ‌های قیمتی در بازار سهام و فارکس",
    "نقش نقدینگی جهانی در جهت بازارها",
    "طلا در برابر دلار؛ رابطهٔ معکوس و استثناها",
    "بیت‌کوین و همبستگی آن با بازارهای ریسک",
    "نفت برنت و WTI؛ تفاوت‌ها و محرک‌ها",
    "شاخص ترس و طمع (Fear & Greed) چگونه کار می‌کند",
    "سویینگ تریدینگ در مقابل اسکالپینگ",
    "پوزیشن تریدینگ و سرمایه‌گذاری بلندمدت",
    "اهمیت اسپرد و کارمزد در سودآوری نهایی",
    "حد ضرر ذهنی در برابر حد ضرر واقعی",
    "مارجین کال و استاپ‌اوت؛ چگونه جلویش را بگیریم",
    "تحلیل بین‌بازاری (Intermarket Analysis)",
    "نقش بانک مرکزی اروپا و ین ژاپن در فارکس",
    "کری‌ترید (Carry Trade) و سود از تفاوت نرخ بهره",
    "الگوهای ادامه‌دهنده در مقابل بازگشتی",
    "تحلیل حجم در پلتفرم و تشخیص ورود پول هوشمند",
    "مدیریت معامله پس از ورود؛ افزودن یا کاهش حجم",
    "خطای رایج: انتقام‌گیری از بازار (Revenge Trading)",
    "اهمیت بک‌تست دستی روی چارت تاریخی",
    "ساخت واچ‌لیست و اسکن روزانهٔ بازار",
    "روانشناسی صبر؛ انتظار برای ستاپ باکیفیت",
    "تأثیر تعطیلات و نقدینگی پایین بر بازار",
    "اخبار ژئوپلیتیک و موج‌های ریسک‌گریزی",
    "چگونه از اوورتریدینگ دوری کنیم",
]

_SYSTEM = (
    "تو «بهنام جلالی»، تحلیلگر و مربیِ ارشدِ بازار فارکس با سال‌ها تجربهٔ معاملهٔ واقعی هستی و "
    "نویسندهٔ محتوای آموزشیِ سطح‌بالا. یک مقالهٔ اصیل، دقیق، عمیق و کاربردی به فارسیِ روان بنویس "
    "(حداقل ۶۰۰ و ترجیحاً ۸۰۰ تا ۱۱۰۰ کلمه). "
    "ساختار اجباری: یک مقدمهٔ گیرا که مسئله را روشن کند؛ سپس ۴ تا ۷ بخش که هر کدام تیترِ "
    "<h2>...</h2> دارد؛ از <ul><li> برای فهرست‌ها و <b> برای تأکید استفاده کن؛ هرجا مناسب بود "
    "یک مثالِ عددیِ ملموس (با اعداد) بیاور؛ و در پایان یک جمع‌بندیِ عملیِ گام‌به‌گام. "
    "نکات را با استدلال و تجربه توضیح بده (E-E-A-T)، نه شعاری. لحن حرفه‌ای و آموزشی، نه تبلیغاتی. "
    "چون موضوع مالی است، در صورتِ لزوم یک جملهٔ کوتاهِ هشدارِ ریسک بیاور. "
    "در پایانِ مقاله یک بخشِ «سوالات متداول» اضافه کن: یک <h2>سوالات متداول</h2> و سپس "
    "دقیقاً ۳ پرسشِ واقعی و پرتکرارِ کاربران دربارهٔ همین موضوع؛ هر پرسش در <h3>...؟</h3> "
    "(حتماً با علامتِ ؟) و پاسخش بلافاصله در یک <p>...</p>ِ کوتاه و دقیق. "
    "خروجی فقط HTML سبک با تگ‌های مجاز: <h2>, <h3>, <p>, <b>, <br>, <ul>, <li>. "
    "هیچ توضیحِ متا، مقدمه‌ی غیرمرتبط یا انگلیسیِ اضافه نده."
)


def _slugify_fa(text: str) -> str:
    """اسلاگِ سئوپسندِ فارسی از متنِ موضوع (کلیدواژه‌محور، نه هش)."""
    t = (text or "").strip().lower()
    t = re.sub(r"[^\w\s-]", "", t, flags=re.UNICODE)   # \w شاملِ حروفِ فارسی است؛ نشانه‌ها (؟،؛«»!) حذف
    t = re.sub(r"[\s_]+", "-", t).strip("-")
    t = re.sub(r"-{2,}", "-", t)
    return t[:70].strip("-") or "post"


def _topic_prefix(topic: str) -> str:
    # کلیدواژه‌محور و قطعی per-topic؛ dedup با rsplit("-",1) سالم می‌ماند چون day آخرین سگمنت است
    return "blog-" + _slugify_fa(topic)


async def _today_count() -> int:
    from sqlalchemy import func as _f
    from src.news.ingest import day_start_utc
    start = day_start_utc()  # ریستِ روزانه = ۷ صبحِ تهران
    async with async_session_factory() as s:
        return int((await s.execute(
            select(_f.count(Article.id)).where(
                Article.category == "blog", Article.created_at >= start
            )
        )).scalar() or 0)


async def _pick_unused_topic() -> str | None:
    """موضوعی که در ۱۴ روزِ اخیر استفاده نشده؛ از روزِ سال شروع می‌کنیم (چرخش)."""
    since = datetime.now(timezone.utc) - timedelta(days=_REPEAT_BLOCK_DAYS)
    async with async_session_factory() as s:
        rows = (await s.execute(
            select(Article.slug).where(
                Article.category == "blog", Article.created_at >= since
            )
        )).scalars().all()
    used_prefixes = {r.rsplit("-", 1)[0] for r in rows if r}  # blog-<tophash>
    doy = datetime.now(timezone.utc).timetuple().tm_yday
    n = len(TOPICS)
    for i in range(n):
        topic = TOPICS[(doy + i) % n]
        if _topic_prefix(topic) not in used_prefixes:
            return topic
    return None


MIN_WORDS = 300  # گیتِ کیفیت — کوتاه‌تر از این ذخیره نشود (ضدِ thin-content)


async def _pick_target() -> dict | None:
    """هدفِ بعدیِ محتوا از بانکِ کلیدواژه: ابتدا صفحاتِ مادرِ نساخته، سپس اقماری‌های استفاده‌نشده."""
    from src.news.keywords import pick_targets
    targets = pick_targets()
    since = datetime.now(timezone.utc) - timedelta(days=_REPEAT_BLOCK_DAYS)
    async with async_session_factory() as s:
        rows = (await s.execute(
            select(Article.slug).where(Article.category == "blog", Article.created_at >= since)
        )).scalars().all()
    used = {r.rsplit("-", 1)[0] for r in rows if r}
    pillars = [t for t in targets if t["is_pillar"] and t["prefix"] not in used]
    if pillars:
        return pillars[0]
    children = [t for t in targets if not t["is_pillar"] and t["prefix"] not in used]
    if not children:
        return None
    doy = datetime.now(timezone.utc).timetuple().tm_yday
    return children[doy % len(children)]


async def generate_once() -> dict:
    if not settings.LLM_ENABLED:
        return {"saved": 0, "reason": "llm_disabled"}
    if await _today_count() >= BLOG_DAILY_MAX:
        return {"saved": 0, "reason": "daily_max_reached"}
    target = await _pick_target()
    if not target:
        return {"saved": 0, "reason": "no_unused_topic"}
    topic = target["title"]

    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    slug = f"{target['prefix']}-{day}"
    async with async_session_factory() as s:
        if (await s.execute(select(Article.id).where(Article.slug == slug))).first():
            return {"saved": 0, "reason": "already_today", "topic": topic}

    guide = (
        "این یک «راهنمای جامع و مرجع» است؛ کامل‌ترین و عمیق‌ترین مقالهٔ ممکن دربارهٔ این موضوع را بنویس (۹۰۰ تا ۱۳۰۰ کلمه، ۶ تا ۸ بخش)."
        if target["is_pillar"] else
        "یک مقالهٔ تخصصیِ متمرکز و دقیق دقیقاً حولِ همین پرسش بنویس (۷۰۰ تا ۱۰۰۰ کلمه)."
    )
    prompt = (
        f"موضوع/کلیدواژهٔ هدف: «{topic}»\n{guide}\n"
        "خطِ اول عنوانِ گیرا و سئوپسند با پیشوندِ «عنوان:» (کلیدواژهٔ هدف در عنوان بیاید) و از خطِ بعد متنِ مقاله."
    )
    try:
        out = await llm_client.complete(prompt, system=_SYSTEM, cache_ttl=0)
    except Exception as exc:  # noqa: BLE001
        logger.warning("blog_generate_failed", error=str(exc))
        return {"saved": 0, "reason": "llm_error"}
    if not out:
        return {"saved": 0, "reason": "empty"}

    m = re.search(r"عنوان\s*[:：]\s*(.+)", out)
    title = (m.group(1).strip() if m else topic)[:200]
    body = out.split("\n", 1)[1].strip() if "\n" in out else out
    body = re.sub(r"^\s*عنوان\s*[:：].*\n?", "", body).strip()
    from src.core.html_sanitizer import sanitize_article_html
    body = sanitize_article_html(body)  # فقط تگ‌های امن

    text = re.sub(r"<[^>]+>", " ", body)
    text = re.sub(r"\s+", " ", text).strip()
    word_count = len(text.split())
    if word_count < MIN_WORDS:  # گیتِ کیفیت
        logger.info("blog_skipped_short", topic=topic, words=word_count)
        return {"saved": 0, "reason": "too_short", "words": word_count}
    summary = text[:280]
    meta_description = text[:300]
    content_hash = hashlib.md5(re.sub(r"\s+", "", text[:4000]).encode("utf-8"), usedforsecurity=False).hexdigest()

    # دفاعی: اگر به هر دلیل محتوای تبلیغِ بروکر بود، ذخیره نشود
    from src.news.adfilter import is_broker_ad
    if is_broker_ad(title, summary):
        logger.info("blog_skipped_broker_ad", topic=topic)
        return {"saved": 0, "reason": "broker_ad"}

    now = datetime.now(timezone.utc)
    async with async_session_factory() as s:
        # ضدِ تکرار: محتوای تقریباً یکسان دوباره ذخیره نشود
        if (await s.execute(select(Article.id).where(Article.content_hash == content_hash))).first():
            return {"saved": 0, "reason": "duplicate"}
        # لینکِ داخلی از مقالهٔ اقماری به صفحهٔ مادر (topic cluster)
        if not target["is_pillar"]:
            pillar = (await s.execute(
                select(Article).where(
                    Article.pillar_slug == target["pillar_slug"],
                    Article.is_pillar.is_(True), Article.is_published.is_(True),
                ).limit(1))).scalar_one_or_none()
            if pillar:
                body += f'<p>📚 راهنمای کامل: <a href="/article/{pillar.slug}">{pillar.title}</a></p>'
        art = Article(
            title=title, slug=slug, content=body, summary=summary,
            category="blog", cover_image=None, is_published=True, published_at=now,
            tags=target["tags"], pillar_slug=target["pillar_slug"], is_pillar=target["is_pillar"],
            word_count=word_count, content_hash=content_hash, meta_description=meta_description,
        )
        s.add(art)
        await s.flush()
        aid = art.id
        await s.commit()
    logger.info("blog_generated", id=aid, topic=topic, title=title[:60], words=word_count, pillar=target["is_pillar"])

    # اطلاع‌رسانیِ SEO: بلاگِ جدید فوری وارد sitemap و ping شود
    try:
        from src.core.seo_notify import notify_search_engines
        await notify_search_engines([slug])
    except Exception:  # noqa: BLE001
        pass

    # پستِ بلاگ در کانال (هشتگِ #بلاگ، بدونِ عکس)
    try:
        from src.news.ingest import enqueue_channel_post
        await enqueue_channel_post(title, summary, None, slug, kind="blog")
    except Exception as exc:  # noqa: BLE001
        logger.warning("blog_channel_enqueue_failed", error=str(exc))

    return {"saved": 1, "id": aid, "topic": topic}


from src.core.celery_app import celery_app  # noqa: E402


@celery_app.task(name="src.news.blog.generate_blog_post")
def generate_blog_post() -> dict:
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(generate_once())
    finally:
        loop.close()


@celery_app.task(name="src.news.blog.indexnow_backfill")
def indexnow_backfill() -> dict:
    """کلِ آرشیوِ منتشرشده را به IndexNow (Bing/Yandex) می‌فرستد — قابلِ اجرای دستی هر زمان."""
    import asyncio
    from src.core.seo_notify import submit_all_to_indexnow
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(submit_all_to_indexnow())
    finally:
        loop.close()
