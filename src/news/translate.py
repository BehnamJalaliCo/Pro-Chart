"""ترجمهٔ خبر به فارسیِ روان با Claude (سرویسِ claude-llm داخلِ پروژه)."""

from __future__ import annotations

import re

from src.core.logger import get_logger
from src.llm.client import llm_client

logger = get_logger("news.translate")

_SYSTEM = (
    "تو یک مترجم و ویراستارِ ارشدِ حوزهٔ مالی و فارکس هستی. متنِ خبریِ انگلیسی را به "
    "فارسیِ روان، دقیق، خبری و حرفه‌ای برگردان. اصطلاحاتِ تخصصیِ بازار (مثل نرخ بهره، "
    "تورم، CPI، NFP، فدرال‌رزرو، جفت‌ارز، اونس طلا) را درست و رایج ترجمه کن. لحن خبری و "
    "بی‌طرف باشد، نه تبلیغاتی. خروجی فقط فارسی، بدون توضیحِ اضافه و بدونِ تکرارِ انگلیسی. "
    "اگر متنِ بدنه کوتاه یا خالی بود، فقط بر اساسِ عنوان یک خلاصهٔ خبریِ روانِ ۲ تا ۳ "
    "جمله‌ای بنویس. هرگز سؤال نپرس و هرگز ننویس «متن ارسال نشده» — همیشه خروجیِ نهایی بده."
)


async def translate_news(title_en: str, body_en: str) -> tuple[str, str] | None:
    """ترجمهٔ عنوان و متن. خروجی (عنوان_فارسی، متن_فارسی) یا None در صورتِ خطا."""
    body_en = (body_en or "").strip()[:2000]
    title_en = (title_en or "").strip()[:300]
    if not title_en:
        return None
    prompt = (
        "عنوان و متنِ خبرِ زیر را به فارسیِ روان ترجمه کن و دقیقاً در این قالب پاسخ بده:\n"
        "عنوان: <عنوان فارسی، کوتاه و گویا>\n"
        "متن: <متن فارسی، ۲ تا ۴ پاراگراف، روان و خبری>\n\n"
        f"TITLE: {title_en}\n\nBODY: {body_en}"
    )
    try:
        out = await llm_client.complete(prompt, system=_SYSTEM, cache_ttl=86400)
    except Exception as exc:  # noqa: BLE001
        logger.warning("translate_failed", error=str(exc))
        return None
    if not out:
        return None

    # استخراجِ «عنوان:» و «متن:» (مقاوم به فاصله/خط جدید)
    t_match = re.search(r"عنوان\s*[:：]\s*(.+?)(?:\n|متن\s*[:：])", out, re.DOTALL)
    b_match = re.search(r"متن\s*[:：]\s*(.+)$", out, re.DOTALL)
    title_fa = (t_match.group(1).strip() if t_match else "").strip()
    body_fa = (b_match.group(1).strip() if b_match else "").strip()
    if not title_fa:
        # fallback: خطِ اول عنوان، باقی متن
        lines = [ln.strip() for ln in out.splitlines() if ln.strip()]
        if lines:
            title_fa = lines[0][:200]
            body_fa = "\n".join(lines[1:]) or title_fa
    if not title_fa or not body_fa:
        return None
    return title_fa[:240], body_fa
