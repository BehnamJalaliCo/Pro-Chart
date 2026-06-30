"""راوی سیگنال — تولید تحلیل حرفه‌ای فارسی برای هر سیگنال با Claude.

degradation امن: اگر LLM غیرفعال/خطا، None برمی‌گرداند و publisher به قالب پیش‌فرض برمی‌گردد.
"""

from __future__ import annotations

import json

from src.core.config import settings
from src.core.logger import get_logger
from src.llm.client import llm_client

logger = get_logger("llm.narrator")

_SYSTEM = (
    "تو یک تحلیل‌گر ارشد و کارشناس بازارهای مالی در تیم سیگنال‌دهی CoinePro FX هستی. "
    "وظیفه‌ات نوشتن یک «تحلیل کارشناسی» جامع، حرفه‌ای و قابل‌اعتماد به زبان فارسی است که "
    "به‌صورت یک پست مستقل (ریپلای به سیگنال) در کانال VIP منتشر می‌شود. هدف: کاربر با خواندن "
    "آن دیدِ درست و جهت‌گیریِ ذهنیِ روشنی نسبت به ستاپ پیدا کند و بتواند تصمیمِ آگاهانه بگیرد.\n\n"
    "قوانین محتوایی:\n"
    "• فقط بر اساس داده‌های داده‌شده تحلیل کن؛ هیچ عدد، قیمت یا واقعیتی از خودت نساز.\n"
    "• سطوحِ حمایت/مقاومت و قوتشان دقیقاً از داده‌ها استفاده شود؛ قوت هر سطح را با برچسبِ «قوی/متوسط/ضعیف» بیان کن.\n"
    "• اعداد ورود/حد ضرر/اهداف را تکرار نکن (در خودِ سیگنال آمده)؛ ولی سطوحِ حمایت/مقاومتِ کلیدی را می‌توانی با قیمت ذکر کنی.\n"
    "• لحن: آرام، حرفه‌ای، بی‌طرف و صادقانه؛ بدون اغراق، بدون وعده‌ی سود، بدون هیجان‌زدگی.\n"
    "• هم نقاط قوت و هم ریسک‌ها/نقاط ضعف ستاپ را منصفانه بگو؛ اگر امتیاز یک بخش پایین است صادقانه اشاره کن.\n\n"
    "ساختار خروجی — دقیقاً این بخش‌ها را به همین ترتیب بنویس، هر بخش با عنوانِ پررنگ و یک خط خالی بین بخش‌ها. "
    "از تگ‌های HTML تلگرام فقط <b> و <i> استفاده کن (هرگز مارک‌داون مثل ** یا #):\n\n"
    "<b>📊 جمع‌بندی کارشناس</b>\n"
    "یک پاراگراف کوتاه (۲ تا ۳ جمله) که دیدِ کلی و جهت‌گیریِ نظرت را می‌دهد: این ستاپ چقدر قابل‌اتکاست و چرا.\n\n"
    "<b>🎯 منطق ستاپ</b>\n"
    "یک پاراگراف که توضیح می‌دهد چرا این جهت انتخاب شده — بر پایه‌ی روند، الگو، هم‌راستایی چند تایم‌فریم و بایاس اسمارت‌مانی.\n\n"
    "<b>📐 سطوح کلیدی</b>\n"
    "مهم‌ترین سطوحِ حمایت و مقاومتِ پیشِ‌رو را نام ببر و قوتِ هرکدام را مشخص کن (قوی/متوسط/ضعیف). "
    "بگو نزدیک‌ترین مانع در مسیرِ معامله کدام سطح است و آیا تا هدف مسیر نسبتاً باز است یا با سطحِ قوی برخورد می‌کند. "
    "اگر سطحِ کلیدی‌ای هست که شکستنش ستاپ را تقویت یا باطل می‌کند، آن را به‌عنوانِ «سطحِ تعیین‌کننده» معرفی کن.\n\n"
    "<b>⚖️ نقاط قوت و ریسک</b>\n"
    "یک پاراگراف متوازن: مهم‌ترین عاملِ پشتیبان و مهم‌ترین ریسک/ضعفِ ستاپ (مثلاً تأییدنشدنِ حجم، امتیازِ پایینِ ML یا نزدیکیِ یک مقاومتِ قوی).\n\n"
    "<b>🛡️ توصیه‌ی مدیریت ریسک</b>\n"
    "یک یا دو جمله‌ی عملی درباره‌ی حجمِ معامله، انضباط و پایبندی به حد ضرر — متناسب با کیفیتِ همین ستاپ.\n\n"
    "کل متن باید روان، خوش‌خوان و بدون تکرار باشد؛ مجموعاً حدود ۱۰ تا ۱۴ جمله."
)


def _strength_label(n) -> str:
    try:
        v = int(n)
    except (TypeError, ValueError):
        return "نامشخص"
    if v >= 60:
        return "قوی"
    if v >= 35:
        return "متوسط"
    return "ضعیف"


def _levels_fa(levels) -> list:
    out = []
    for lv in (levels or []):
        p = lv.get("price")
        if p is None:
            continue
        out.append({"قیمت": p, "قوت": _strength_label(lv.get("strength"))})
    return out


def _context(signal: dict, summary: dict) -> str:
    name_fa = settings.symbol_names_fa.get(signal.get("symbol", ""), "")
    ctx = {
        "نماد": f"{signal.get('symbol')} {name_fa}".strip(),
        "جهت": signal.get("direction"),
        "تایم‌فریم": signal.get("timeframe"),
        "امتیاز کل": signal.get("signal_score"),
        "تحلیل": {
            "تکنیکال": summary.get("tech_score"),
            "الگو": summary.get("pattern_score"),
            "هوش مصنوعی": summary.get("ml_score"),
            "تأیید چند تایم‌فریم": summary.get("mtf_confluence"),
            "جهت چند تایم‌فریم": summary.get("mtf_direction"),
            "بایاس اسمارت‌مانی": summary.get("smc_bias"),
            "تأیید حجم": summary.get("volume_confirms"),
            "قدرت سیگنال": summary.get("signal_strength"),
        },
        "سطوح کلیدی": {
            "قیمت فعلی": summary.get("current_price"),
            "نزدیک‌ترین حمایت": summary.get("nearest_support"),
            "نزدیک‌ترین مقاومت": summary.get("nearest_resistance"),
            "حمایت‌ها (با قوت)": _levels_fa(summary.get("support_levels")),
            "مقاومت‌ها (با قوت)": _levels_fa(summary.get("resistance_levels")),
            "نقطه پیوت": summary.get("pivot"),
        },
    }
    return json.dumps(ctx, ensure_ascii=False)


async def narrate_signal(signal: dict, summary: dict) -> str | None:
    """تحلیل فارسی برای یک سیگنال؛ None در صورت غیرفعال/خطا."""
    if not (settings.LLM_ENABLED and settings.LLM_NARRATOR_ENABLED):
        return None
    prompt = (
        "بر اساس این داده‌های ساختاریافته‌ی سیگنال، «تحلیل کارشناسی» جامع و بخش‌بندی‌شده "
        "طبق ساختار خواسته‌شده بنویس (به‌ویژه بخشِ «سطوح کلیدی» را با ذکرِ قوتِ سطوح کامل کن):\n\n"
        + _context(signal, summary)
    )
    try:
        text = await llm_client.complete(
            prompt, system=_SYSTEM, cache_ttl=3600
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("narrate_failed", error=str(exc))
        return None
    if text:
        # سقف امن برای یک پیام تلگرام (۴۰۹۶)؛ پست تحلیل مستقل است و می‌تواند بلندتر باشد.
        return text.strip()[:3500]
    return None
