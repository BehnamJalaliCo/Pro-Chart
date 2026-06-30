"""
اتوماسیونِ سئوی روزانهٔ آکادمی (#۱/۲).

هر روز یک مقالهٔ اصیلِ کلیدواژه‌محور دربارهٔ یک «زاویهٔ آموزشیِ آکادمی» تولید و منتشر
می‌شود (بدونِ تکرار، بدونِ نشتِ محتوای دروس). هدف: دیده‌شدن در گوگل برای جست‌وجوهای
«آموزش فارکس / آکادمی فارکس / یادگیری فارکس از صفر …» + هدایتِ یادگیرنده به آکادمی.

مقاله به‌صورتِ Article (category=blog) ذخیره می‌شود تا واردِ خطِ موجودِ
sitemap/schema(FAQPage)/IndexNow/dynamic-render شود. متنِ هر مقاله با CTA به آکادمی و
یک بخشِ «سوالات متداول» (برای FAQ schema) تمام می‌شود.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from src.core.celery_app import celery_app
from src.core.config import settings
from src.core.database import AcademyLesson, Article, async_session_factory
from src.core.html_sanitizer import sanitize_article_html
from src.core.logger import get_logger
from src.llm.client import llm_client

logger = get_logger(__name__)

_REPEAT_BLOCK_DAYS = 30   # یک زاویه تا ۳۰ روز تکرار نشود
_MIN_WORDS = 350
_ACADEMY_URL = "https://fx.trade-future.ir/academy"

# زاویه‌های سئو (هر روز یکی) — کلیدواژه‌محور، بدونِ نشتِ محتوا.
# (prefix, عنوانِ موضوع, سطحِ مرتبط برای سرفصل‌ها, برچسب‌ها)
ANGLES: list[tuple[str, str, str | None, list[str]]] = [
    ("why-learn-forex", "چرا یادگیریِ اصولیِ فارکس مهم است و از کجا شروع کنیم؟", "beginner", ["آموزش فارکس", "یادگیری فارکس", "شروع فارکس"]),
    ("academy-vs-youtube", "آکادمیِ فارکس چیست و چه تفاوتی با ویدیوهای پراکندهٔ یوتیوب دارد؟", None, ["آکادمی فارکس", "آموزش فارکس", "دورهٔ فارکس"]),
    ("forex-roadmap", "مسیرِ یادگیریِ فارکس از صفر تا حرفه‌ای؛ نقشهٔ راهِ کامل", None, ["مسیر یادگیری فارکس", "آموزش فارکس از صفر", "حرفه‌ای شدن در فارکس"]),
    ("beginner-start", "سطحِ مقدماتیِ فارکس: تازه‌کارها دقیقاً باید چه چیزهایی یاد بگیرند؟", "beginner", ["فارکس برای مبتدیان", "آموزش مقدماتی فارکس"]),
    ("price-action", "پرایس‌اکشن چیست و چرا ستونِ تحلیلِ حرفه‌ای است؟", "intermediate", ["پرایس اکشن", "تحلیل تکنیکال", "آموزش فارکس"]),
    ("risk-management", "مدیریتِ سرمایه در فارکس؛ مهم‌ترین مهارتی که نادیده گرفته می‌شود", "intermediate", ["مدیریت سرمایه", "مدیریت ریسک فارکس"]),
    ("trading-psychology", "روان‌شناسیِ معامله‌گری؛ چرا ذهنِ تو سرنوشتِ حسابت را می‌سازد؟", "advanced", ["روانشناسی معامله", "روانشناسی فارکس"]),
    ("ai-mentor", "یادگیریِ فارکس با مربیِ هوشِ مصنوعی؛ آموزشِ شخصی‌سازی‌شده", "ai", ["هوش مصنوعی فارکس", "مربی فارکس", "آموزش فارکس با AI"]),
    ("demo-practice", "حسابِ مجازی و تمرین؛ چطور بدونِ ریسک حرفه‌ای شویم؟", None, ["حساب دمو", "تمرین فارکس", "حساب مجازی"]),
    ("backtest", "بک‌تست چیست و چرا استراتژیِ بدونِ بک‌تست خطرناک است؟", "advanced", ["بک تست", "آزمون استراتژی", "استراتژی فارکس"]),
    ("journal", "ژورنالِ معاملاتی؛ رازِ پیشرفتِ معامله‌گرانِ موفق", "advanced", ["ژورنال معاملاتی", "ثبت معاملات"]),
    ("funded", "حساب‌های فاندد و پراپ‌تریدینگ؛ چطور با سرمایهٔ دیگران ترید کنیم؟", None, ["فاندد", "پراپ تریدینگ", "حساب فاندد"]),
    ("indicators", "اندیکاتورها در فارکس؛ کدام‌ها واقعاً به‌درد می‌خورند؟", "intermediate", ["اندیکاتور فارکس", "تحلیل تکنیکال"]),
    ("technical-vs-fundamental", "تحلیلِ تکنیکال در برابرِ بنیادی؛ کدام را اول یاد بگیریم؟", "beginner", ["تحلیل تکنیکال", "تحلیل بنیادی", "آموزش فارکس"]),
    ("best-pairs", "بهترین جفت‌ارزها برای شروعِ معامله‌گری در فارکس", "beginner", ["جفت ارز", "بهترین جفت ارز فارکس"]),
    ("certificate", "گواهی‌نامهٔ آموزشِ فارکس؛ چرا و چگونه معتبر است؟", None, ["گواهینامه فارکس", "مدرک فارکس"]),
    ("bazaarnama", "بازارنما؛ چارتِ حرفه‌ایِ ایرانی برای یادگیری و تحلیل", None, ["چارت فارکس", "تحلیل چارت", "ابزار فارکس"]),
    ("common-mistakes", "۷ اشتباهِ مرگبارِ تازه‌کارها در فارکس و راهِ پرهیز", "beginner", ["اشتباهات فارکس", "آموزش فارکس مبتدی"]),
    ("namascript", "کدنویسیِ استراتژی در فارکس؛ اتوماسیونِ سیگنال برای همه", "ai", ["استراتژی فارکس", "اتوماسیون معاملات", "کدنویسی فارکس"]),
    ("candlesticks", "الگوهای کندل‌استیک؛ زبانِ پنهانِ نمودار", "beginner", ["کندل استیک", "الگوی کندلی", "تحلیل تکنیکال"]),
    ("support-resistance", "حمایت و مقاومت؛ ساده‌ترین و قوی‌ترین مفهومِ نمودار", "beginner", ["حمایت و مقاومت", "تحلیل تکنیکال"]),
    ("trend-trading", "معامله در جهتِ روند؛ چرا «روند دوستِ توست»؟", "intermediate", ["روند فارکس", "ترید روند"]),
    ("smart-money", "مفاهیمِ پولِ هوشمند (SMC)؛ نگاهِ حرفه‌ای به بازار", "advanced", ["پول هوشمند", "SMC", "ICT فارکس"]),
    ("leverage", "اهرم در فارکس؛ شمشیرِ دولبه‌ای که باید کنترلش کنی", "beginner", ["اهرم فارکس", "لوریج", "مدیریت ریسک"]),
    ("session-timing", "بهترین ساعاتِ معامله در فارکس؛ سشن‌های لندن و نیویورک", "intermediate", ["ساعت معامله فارکس", "سشن فارکس"]),
    ("bootcamp", "بوت‌کمپِ فارکس؛ یادگیریِ فشرده و هدف‌مند در زمانِ کوتاه", None, ["بوت کمپ فارکس", "دوره فشرده فارکس"]),
    ("community", "اهمیتِ انجمن و هم‌آموزی در مسیرِ یادگیریِ فارکس", None, ["انجمن فارکس", "جامعه فارکس"]),
    ("free-vs-paid", "آموزشِ رایگان در برابرِ دورهٔ ساختارمند؛ کدام شما را به نتیجه می‌رساند؟", None, ["دوره فارکس", "آموزش رایگان فارکس"]),
    ("strategy-build", "چطور یک استراتژیِ شخصیِ سودده بسازیم؟", "advanced", ["استراتژی فارکس", "ساخت استراتژی"]),
    ("gold-trading", "معاملهٔ طلا (XAUUSD)؛ آنچه باید پیش از شروع بدانی", "intermediate", ["معامله طلا", "XAUUSD", "آموزش طلا"]),
]


def _slug(prefix: str) -> str:
    return f"academy-{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d')}"


async def _pick_angle() -> tuple[str, str, str | None, list[str]] | None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=_REPEAT_BLOCK_DAYS)
    async with async_session_factory() as s:
        rows = (await s.execute(
            select(Article.slug).where(Article.slug.like("academy-%"), Article.created_at >= cutoff)
        )).scalars().all()
    used = {r.rsplit("-", 1)[0] for r in rows}     # academy-<prefix>
    for a in ANGLES:
        if f"academy-{a[0]}" not in used:
            return a
    return None


async def _lesson_titles(level: str | None, n: int = 5) -> list[str]:
    """چند عنوانِ درس (فقط عنوان، نه محتوا) برای فهرستِ «سرفصل‌ها»."""
    async with async_session_factory() as s:
        q = select(AcademyLesson.title_fa).where(AcademyLesson.is_published.is_(True))
        if level:
            q = q.where(AcademyLesson.level == level)
        q = q.order_by(AcademyLesson.order_in_level).limit(n)
        return [r for r in (await s.execute(q)).scalars().all() if r]


_SYSTEM = (
    "تو «بهنام جلالی»، بنیان‌گذار و مربیِ ارشدِ آکادمیِ فارکسِ «کوین پرو FX» هستی. "
    "یک مقالهٔ سئوی اصیل، مفید و کلیدواژه‌محور به فارسیِ روان بنویس که هم آموزشِ ارزشمند بدهد "
    "و هم خواننده را به ثبت‌نام در آکادمی ترغیب کند — اما تبلیغِ توخالی نباشد، با ارزشِ واقعی. "
    "۷۰۰ تا ۱۰۰۰ کلمه؛ ساختار: مقدمهٔ گیرا، ۴ تا ۶ بخش با تیترِ <h2>، فهرست با <ul><li>، تأکید با <b>. "
    "کلیدواژهٔ هدف را در عنوان و چند بارِ طبیعی در متن بیاور. محتوای دقیقِ دروس را فاش نکن؛ فقط دربارهٔ "
    "«چه چیزی و چرا یاد می‌گیری» و ارزشِ مسیر بنویس. در یک بخش، فهرستِ سرفصل‌ها را (که در پرامپت می‌آید) "
    "به‌عنوانِ نمونهٔ آنچه در آکادمی هست بیاور. "
    "نزدیکِ پایان یک فراخوانِ عمل (CTA) با لینک «<a href=\"" + _ACADEMY_URL + "\">آکادمیِ کوین پرو FX</a>» بگذار. "
    "در انتها یک بخشِ <h2>سوالات متداول</h2> با دقیقاً ۳ پرسش (هر کدام <h3>...؟</h3>) و پاسخِ کوتاه در <p> بیاور. "
    "خروجی فقط HTML سبک با تگ‌های مجاز: <h2>, <h3>, <p>, <b>, <br>, <ul>, <li>, <a>. هیچ توضیحِ متا نده."
)


async def generate_once() -> dict:
    if not settings.LLM_ENABLED:
        return {"saved": 0, "reason": "llm_disabled"}
    angle = await _pick_angle()
    if not angle:
        return {"saved": 0, "reason": "no_unused_angle"}
    prefix, topic, level, tags = angle
    slug = _slug(prefix)

    async with async_session_factory() as s:
        if (await s.execute(select(Article.id).where(Article.slug == slug))).first():
            return {"saved": 0, "reason": "already_today"}

    titles = await _lesson_titles(level)
    titles_txt = ("سرفصل‌های نمونه در آکادمی: " + "؛ ".join(titles)) if titles else ""
    prompt = (
        f"موضوع/کلیدواژهٔ هدف: «{topic}»\n{titles_txt}\n"
        "خطِ اول عنوانِ گیرا و سئوپسند با پیشوندِ «عنوان:» (کلیدواژهٔ هدف در عنوان باشد) و از خطِ بعد متنِ مقاله."
    )
    try:
        out = await llm_client.complete(prompt, system=_SYSTEM, cache_ttl=0)
    except Exception as exc:  # noqa: BLE001
        logger.warning("academy_seo_llm_failed", error=str(exc))
        return {"saved": 0, "reason": "llm_error"}
    if not out:
        return {"saved": 0, "reason": "empty"}

    m = re.search(r"عنوان\s*[:：]\s*(.+)", out)
    title = (m.group(1).strip() if m else topic)[:200]
    body = out.split("\n", 1)[1].strip() if "\n" in out else out
    body = re.sub(r"^\s*عنوان\s*[:：].*\n?", "", body).strip()
    body = sanitize_article_html(body)

    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body)).strip()
    word_count = len(text.split())
    if word_count < _MIN_WORDS:
        return {"saved": 0, "reason": "too_short", "words": word_count}
    summary = text[:280]
    meta_description = text[:300]
    content_hash = hashlib.md5(re.sub(r"\s+", "", text[:4000]).encode("utf-8"), usedforsecurity=False).hexdigest()

    now = datetime.now(timezone.utc)
    async with async_session_factory() as s:
        if (await s.execute(select(Article.id).where(Article.content_hash == content_hash))).first():
            return {"saved": 0, "reason": "duplicate"}
        art = Article(
            title=title, slug=slug, content=body, summary=summary, category="blog",
            cover_image=None, is_published=True, published_at=now, tags=tags,
            word_count=word_count, content_hash=content_hash, meta_description=meta_description,
        )
        s.add(art)
        await s.flush()
        aid = art.id
        await s.commit()
    logger.info("academy_seo_generated", id=aid, angle=prefix, title=title[:60], words=word_count)

    try:
        from src.core.seo_notify import notify_search_engines
        await notify_search_engines([slug])
    except Exception:  # noqa: BLE001
        pass
    try:
        from src.news.ingest import enqueue_channel_post
        await enqueue_channel_post(title, summary, None, slug, kind="blog")
    except Exception:  # noqa: BLE001
        pass
    return {"saved": 1, "id": aid, "angle": prefix, "title": title}


@celery_app.task(name="src.news.academy_seo.generate_academy_spotlight")
def generate_academy_spotlight() -> dict:
    """تولیدِ روزانهٔ یک مقالهٔ سئوی معرفیِ آکادمی."""
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(generate_once())
    finally:
        loop.close()
