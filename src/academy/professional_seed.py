"""تولیدِ سطحِ «حرفه‌ای» آکادمی با کلودِ داخلِ سرور (claude-llm).

۴۰ سرفصلِ حرفه‌ای/نهادی. هر جلسه با یک فراخوانیِ LLM تولید و در academy_lessons
(level="ai" با برچسبِ «حرفه‌ای») upsert می‌شود. اجرا:
    python -m src.academy.professional_seed 5      # فقط ۵ جلسهٔ اول (نمونه)
    python -m src.academy.professional_seed 40      # کلِ سطح
ایدمپوتنت: جلساتی که قبلاً محتوا دارند رد می‌شوند (مگر FORCE=1).
"""

from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import select

from src.core.database import AcademyLesson, async_session_factory
from src.llm.client import llm_client
from src.core.logger import get_logger

logger = get_logger(__name__)

# سرفصل‌های حرفه‌ای/نهادی — از سادهٔ حرفه‌ای تا کوانت و الگو
TOPICS = [
    "ساختارِ خردِ بازار و نحوهٔ شکل‌گیریِ قیمت",
    "جریانِ سفارش‌ها (Order Flow) و خواندنِ نوارِ معاملات",
    "نقدینگی، استخرهای نقدینگی و شکارِ استاپ",
    "ردِ پایِ پولِ هوشمند و رفتارِ بازیگرانِ نهادی",
    "عمقِ بازار (DOM) و تفسیرِ دفترِ سفارش",
    "اسپرد، اسلیپیج و هزینه‌های پنهانِ اجرا",
    "مدل‌سازیِ ریسک: انحرافِ معیار، VaR و افتِ سرمایه",
    "اندازه‌گیریِ موقعیت بر پایهٔ نوسان (ATR و کِلی)",
    "همبستگیِ دارایی‌ها و ریسکِ سبدِ معاملاتی",
    "ساختِ یک سیستمِ معاملاتیِ مبتنی بر قاعده",
    "بک‌تستِ علمی: داده، بایاسِ نگاه‌به‌آینده و overfitting",
    "اعتبارسنجیِ پیش‌رونده (Walk-forward) و Out-of-sample",
    "متریک‌های حرفه‌ای: شارپ، سورتینو، فاکتورِ سود",
    "روان‌شناسیِ حرفه‌ای و انضباطِ اجرای سیستم",
    "ژورنال‌نویسی و تحلیلِ آماریِ معاملاتِ خود",
    "مدیریتِ معامله: تریلینگ، اسکیل‌این و خروجِ جزئی",
    "سشن‌های بازار و رفتارِ نقدینگیِ لندن/نیویورک/توکیو",
    "هم‌گراییِ چندتایم‌فریم در تصمیمِ حرفه‌ای",
    "معاملهٔ اخبارِ کلان و مدیریتِ ریسکِ رویداد",
    "نرخِ بهره، تفاوتِ بازده و کریِ تِرید",
    "تحلیلِ بین‌بازاری: دلار، اوراق، کالا و سهام",
    "رژیم‌های بازار: روندی، رِنج و پرنوسان",
    "ساختِ اندیکاتورِ سفارشی و منطقِ پشتِ آن",
    "مقدمهٔ کوانت: از ایده تا فرضیهٔ قابلِ آزمون",
    "مهندسیِ ویژگی برای مدل‌های بازار",
    "یادگیریِ ماشین در معامله: کاربرد و دام‌ها",
    "کالیبراسیونِ احتمال و اعتماد به خروجیِ مدل",
    "تشخیصِ دریفت و فرسایشِ مدل در طولِ زمان",
    "اجرای الگوریتمی و انواعِ سفارشِ هوشمند",
    "زیرساختِ معامله: API، لتنسی و قابلیتِ اطمینان",
    "بهینه‌سازیِ پارامتر بدونِ بیش‌برازش",
    "مدیریتِ سرمایه در سطحِ پرتفوی و تخصیصِ ریسک",
    "پوشش‌ریسک (Hedging) و خنثی‌سازیِ مواجهه",
    "آربیتراژ و ناکاراییِ کوتاه‌مدتِ بازار",
    "متدولوژیِ پراپ‌فرم‌ها و عبور از چالش‌ها",
    "ساختِ پلنِ کسب‌وکارِ معاملاتیِ شخصی",
    "اتوماسیونِ کاملِ یک استراتژی از سیگنال تا اجرا",
    "پایشِ زندهٔ عملکرد و هشدارهای ریسک",
    "اشتباهاتِ مهلکِ حرفه‌ای‌ها و نحوهٔ اجتناب",
    "نقشهٔ راهِ تبدیل‌شدن به معامله‌گرِ مداوم‌سودده",
]

_SYS = (
    "تو یک مدرسِ حرفه‌ایِ بازارهای مالی و معامله‌گریِ نهادی هستی که به فارسیِ روان و دقیق "
    "درس می‌نویسی. لحن: حرفه‌ای، عملی، بدونِ کلی‌گویی و بدونِ هیجان. "
    "هرگز سیگنالِ خرید/فروش یا توصیهٔ مالیِ شخصی نده؛ فقط آموزش بده. "
    "از مثال‌های ملموس و قاعده‌های عملی استفاده کن."
)


def _prompt(title: str) -> str:
    return (
        f"یک جلسهٔ آموزشیِ «سطحِ حرفه‌ای» با موضوعِ زیر بنویس:\n«{title}»\n\n"
        "خروجی دقیقاً در این قالب (بدونِ هیچ متنِ اضافه):\n"
        "SUMMARY: <یک جملهٔ کوتاه که چکیدهٔ درس است>\n"
        "CONTENT:\n<متنِ درس: ۴ تا ۶ پاراگرافِ کوتاه یا بولت، حدودِ ۷۰۰ تا ۱۰۰۰ کاراکتر، "
        "با عمقِ عملی، نکتهٔ کاربردی و یک «اشتباهِ رایج» در پایان. از مارک‌داونِ ساده "
        "(عنوان با ** و بولت با -) استفاده کن.>"
    )


def _parse(raw: str) -> tuple[str, str]:
    summary, content = "", raw.strip()
    if "SUMMARY:" in raw:
        after = raw.split("SUMMARY:", 1)[1]
        if "CONTENT:" in after:
            s, c = after.split("CONTENT:", 1)
            summary, content = s.strip(), c.strip()
        else:
            summary = after.strip()
    return summary[:500], content


async def generate(n: int) -> None:
    force = os.environ.get("FORCE") == "1"
    done = 0
    async with async_session_factory() as db:
        for i, title in enumerate(TOPICS[:n], start=1):
            slug = f"edu-pro-{i:03d}"
            existing = (await db.execute(
                select(AcademyLesson).where(AcademyLesson.slug == slug))).scalar_one_or_none()
            if existing and existing.content_fa and not force:
                logger.info("pro_lesson_skip", slug=slug)
                continue
            raw = await llm_client.complete(_prompt(title), system=_SYS, system_replace=True, timeout=120)
            if not raw:
                logger.warning("pro_lesson_llm_empty", slug=slug, title=title)
                print(f"[{i}/{n}] LLM empty for {title} — skipped", flush=True)
                continue
            summary, content = _parse(raw)
            min_tier = "free" if i <= 5 else "premium"  # ۵ جلسهٔ اولِ هر دوره رایگان
            full_title = f"جلسهٔ {i} — {title}"
            if existing:
                existing.title_fa = full_title
                existing.summary_fa = summary
                existing.content_fa = content
                existing.min_tier = min_tier
                existing.is_published = True
            else:
                db.add(AcademyLesson(
                    slug=slug, level="ai", order_in_level=i, title_fa=full_title,
                    summary_fa=summary, content_fa=content, min_tier=min_tier, is_published=True))
            await db.commit()
            done += 1
            print(f"[{i}/{n}] ✓ {full_title}  ({len(content)} chars, tier={min_tier})", flush=True)
    print(f"\nDONE — generated/updated {done} professional lessons.", flush=True)


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    asyncio.new_event_loop().run_until_complete(generate(count))
