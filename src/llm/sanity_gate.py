"""گیت نظر دوم — بازبینی کیفی ستاپ توسط Claude قبل از انتشار روی کانال.

خروجی ساختاریافته {approve, confidence, reason}. degradation امن: در صورت
غیرفعال/خطا/ابهام، approve=True برمی‌گرداند (هرگز جلوی سیگنال معتبر را به‌خاطر
خطای LLM نمی‌گیرد — fail-open برای جلوگیری از بلاک ناخواسته).
"""

from __future__ import annotations

import json
import re

from src.core.config import settings
from src.core.logger import get_logger
from src.llm.client import llm_client

logger = get_logger("llm.sanity_gate")

_SYSTEM = (
    "تو یک ریسک‌منیجر ارشد بازار فارکس هستی که نقش «نظر دوم» را قبل از انتشار سیگنال "
    "ایفا می‌کنی. هدف: کاهشِ سیگنال‌های ضررده با ردِ ستاپ‌های کم‌کیفیت. "
    "قواعدِ ردِ سخت‌گیرانه (هر کدام محقق شد، رد کن):\n"
    "• سیگنالِ trend که mtf_conflict=true باشد یا higher_tf_bias مخالفِ جهتِ سیگنال باشد.\n"
    "• اگر رژیم RANGING یا TRANSITIONAL است و امتیاز < ۵۸ → استانداردِ سخت‌گیرانه؛ "
    "فقط در صورتِ حداقل یکی از تأییدها (RSI اکستریم یا برخورد به S/R یا حجم) تأیید کن. "
    "(در رنج، fade کردنِ لبه‌ها ذاتاً معتبر است؛ بیش‌ازحد سخت نگیر.)\n"
    "• نکتهٔ مهمِ ساختارِ TP: TP1 عمداً نزدیک است (rr_tp1 حدودِ ۱.۰۵) تا سودِ سریع قفل "
    "شود و SL به نقطهٔ ورود برود؛ این «ضعف» نیست و به‌هیچ‌وجه دلیلِ رد نیست. R/R را فقط "
    "با هدفِ نهایی بسنج: اگر rr_tp3 < ۱.۸ بود یا SL/TP آشکارا معکوس/نامتناسب بود رد کن.\n"
    "• سیگنالِ trend بدونِ تأییدِ حجم (volume_confirms_trend=false) در امتیازِ مرزی.\n"
    "در غیرِ این موارد پیش‌فرض بر تأیید است. "
    "فقط با یک JSON پاسخ بده، بدون توضیح اضافه:\n"
    '{"approve": true|false, "confidence": 0-100, "reason": "یک جمله فارسی"}'
)


def _payload(signal: dict, summary: dict) -> str:
    return json.dumps({
        "symbol": signal.get("symbol"),
        "direction": signal.get("direction"),
        "timeframe": signal.get("timeframe"),
        "score": signal.get("signal_score"),
        "regime": signal.get("regime"),
        "adx": signal.get("adx"),
        "strategy": signal.get("signal_strategy"),
        "entry_zone": [signal.get("entry_zone_low"), signal.get("entry_zone_high")],
        "sl": signal.get("sl"),
        "tps": [signal.get("tp1"), signal.get("tp2"), signal.get("tp3")],
        "rr": [signal.get("rr_tp1"), signal.get("rr_tp2"), signal.get("rr_tp3")],
        "analysis": {
            "tech": summary.get("tech_score"), "pattern": summary.get("pattern_score"),
            "ml": summary.get("ml_score"), "mtf_dir": summary.get("mtf_direction"),
            "mtf_confluence": summary.get("mtf_confluence"),
            "mtf_conflict": summary.get("mtf_conflict"),
            "higher_tf_bias": summary.get("higher_tf_bias"),
            "smc": summary.get("smc_bias"),
            "volume_confirms_trend": summary.get("volume_confirms_trend"),
        },
    }, ensure_ascii=False)


def _parse(text: str) -> dict | None:
    # غیرحریصانه (non-greedy) تا به آخرین } نچسبد و یک veto را به approve تبدیل نکند
    m = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
        return {
            "approve": bool(d.get("approve", True)),
            "confidence": int(d.get("confidence", 50) or 50),
            "reason": str(d.get("reason", ""))[:200],
        }
    except (ValueError, TypeError):
        return None


async def review_signal(signal: dict, summary: dict) -> dict:
    """بازبینی ستاپ. همیشه dict برمی‌گرداند؛ fail-open (approve=True) در ابهام."""
    if not (settings.LLM_ENABLED and settings.LLM_SANITY_GATE_ENABLED):
        return {"approve": True, "confidence": 100, "reason": "gate disabled"}
    try:
        text = await llm_client.complete(
            "این ستاپ را بررسی کن:\n\n" + _payload(signal, summary),
            system=_SYSTEM, cache_ttl=600,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("sanity_failed", error=str(exc))
        return {"approve": True, "confidence": 0, "reason": "llm error → fail-open"}
    parsed = _parse(text or "")
    if parsed is None:
        return {"approve": True, "confidence": 0, "reason": "unparsable → fail-open"}
    return parsed
