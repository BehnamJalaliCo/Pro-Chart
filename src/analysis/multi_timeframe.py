"""
تحلیل چند تایم‌فریمی — Multi-Timeframe Confluence.

اصلاحات نسخه‌ی فاز ۳ نسبت به نسخه‌ی قبل:
    1. confluence = net (bullish - bearish) به جای max(bullish, bearish)
       — بنابراین مغایرت میان تایم‌فریم‌ها نادیده گرفته نمی‌شود.
    2. اضافه شدن W1 و MN1 برای bias بلندمدت
    3. higher_timeframe_bias به‌صراحت در خروجی → engine می‌تواند سیگنال
       خلاف bias را با احتیاط بیشتر پذیرفته یا رد کند.
    4. conflict detection با threshold قابل تنظیم
"""

from __future__ import annotations

from typing import Any, Optional

import pandas as pd

from src.core.logger import get_logger

logger = get_logger(__name__)

# وزن هر تایم‌فریم — W1/MN وزن بالا (bias قوی) دارند
TF_WEIGHTS: dict[str, float] = {
    "MN1": 0.20,
    "W1":  0.20,
    "D1":  0.25,
    "H4":  0.20,
    "H1":  0.10,
    "M15": 0.05,
}

# تایم‌فریم‌های مرتب از بزرگ به کوچک
TF_ORDER: list[str] = ["MN1", "W1", "D1", "H4", "H1", "M15"]

# تایم‌فریم‌های "بلندمدت" که bias اصلی را تعیین می‌کنند
# نکته: TIMEFRAMES فعلی فقط ["M15","H1","H4","D1"] است و MN1/W1 هرگز fetch
# نمی‌شوند؛ پس فقط D1/H4 برای bias قابل‌اتکا هستند.
HIGHER_TF_FOR_BIAS: list[str] = ["D1", "H4"]


class MultiTimeframeAnalyzer:
    """تحلیل همزمان چند تایم‌فریم — با اصلاحات net و bias."""

    def __init__(self, technical_analyzer: Any = None) -> None:
        self._tech = technical_analyzer

    def analyze(
        self,
        candles_by_tf: dict[str, pd.DataFrame],
        analyses_by_tf: Optional[dict[str, dict]] = None,
    ) -> dict[str, Any]:
        """
        تحلیل چند تایم‌فریمی.

        خروجی:
            confluence_count: net تعداد تایم‌فریم‌های هم‌جهت (bullish - bearish)
            weighted_score: امتیاز وزنی روی تایم‌فریم‌ها
            direction: جهت کلی
            higher_tf_bias: bias تایم‌فریم‌های بلندمدت (MN/W/D)
            conflict: آیا تضاد قابل توجهی هست؟
            timeframe_details: جزئیات هر تایم‌فریم
            aligned: همه‌چیز هم‌جهت
        """
        # اگر تحلیل‌ها از قبل آماده نبودند، از کندل‌ها محاسبه می‌کنیم
        if analyses_by_tf is None:
            if not candles_by_tf:
                return self._empty_result()
            analyses_by_tf = {}
            if self._tech:
                for tf, df in candles_by_tf.items():
                    try:
                        analyses_by_tf[tf] = self._tech.analyze(df)
                    except Exception as e:
                        logger.error("mtf_analysis_error", timeframe=tf, error=str(e))

        if not analyses_by_tf:
            return self._empty_result()

        tf_details: dict[str, dict] = {}
        bullish_count = 0
        bearish_count = 0
        weighted_score = 0.0
        total_weight = 0.0

        # bias بلندمدت
        higher_bullish = 0
        higher_bearish = 0

        present_count = 0
        for tf in TF_ORDER:
            analysis = analyses_by_tf.get(tf)
            if analysis is None:
                continue
            present_count += 1

            score = float(analysis.get("technical_score", 50))
            weight = TF_WEIGHTS.get(tf, 0.1)

            # آستانهٔ حساس‌تر (۵۵/۴۵ به‌جای ۶۰/۴۰): ~۷۹٪ امتیازها در باندِ ۴۱–۵۹ گیرند؛
            # با ۶۰/۴۰ تایم‌فریم‌ها تقریباً هرگز جهت‌دار نمی‌شدند و net همیشه ~۰ می‌ماند.
            if score >= 55:
                tf_direction = "bullish"
                bullish_count += 1
                if tf in HIGHER_TF_FOR_BIAS:
                    higher_bullish += 1
            elif score <= 45:
                tf_direction = "bearish"
                bearish_count += 1
                if tf in HIGHER_TF_FOR_BIAS:
                    higher_bearish += 1
            else:
                tf_direction = "neutral"

            tf_details[tf] = {
                "score": round(score, 2),
                "direction": tf_direction,
                "weight": weight,
                "confirmed": tf_direction != "neutral",
            }

            weighted_score += score * weight
            total_weight += weight

        if total_weight > 0:
            weighted_score /= total_weight

        # ── confluence به‌صورت NET (مغایرت را در نظر می‌گیرد) ──
        net_confluence = bullish_count - bearish_count

        # تعیین جهت کلی — آستانه‌ی ۲ (نه ۳): در جهان ۴-تایم‌فریمی، یک شکافِ خالصِ
        # ۲ (یا ۳:۱) یک ادجِ واقعیِ top-down است؛ آستانه‌ی ۳ تقریباً هرگز در رنج
        # محقق نمی‌شد و MTF را مزمناً به slightly_*/neutral می‌انداخت (رای را گرسنه می‌کرد).
        if abs(net_confluence) >= 2:
            direction = "bullish" if net_confluence > 0 else "bearish"
        elif net_confluence >= 1:
            direction = "slightly_bullish"
        elif net_confluence <= -1:
            direction = "slightly_bearish"
        else:
            direction = "neutral"

        # ── bias بلندمدت ──
        if higher_bullish > higher_bearish and higher_bullish >= 1:
            higher_bias = "bullish"
        elif higher_bearish > higher_bullish and higher_bearish >= 1:
            higher_bias = "bearish"
        elif higher_bullish > higher_bearish:
            higher_bias = "slightly_bullish"
        elif higher_bearish > higher_bullish:
            higher_bias = "slightly_bearish"
        else:
            higher_bias = "neutral"

        # ── تشخیص conflict ──
        # اگر هر دو bullish و bearish > 0 و فاصله‌ی net کم → conflict
        has_conflict = (
            bullish_count > 0 and bearish_count > 0
            and abs(net_confluence) <= 1
        )

        # aligned واقعی = net >= 2 و conflict نباشد (هماهنگ با آستانه‌ی جهت)
        aligned = abs(net_confluence) >= 2 and not has_conflict

        # گارد: با کمتر از ۲ تایم‌فریمِ حاضر، confluence قابل‌اتکا نیست → خنثی.
        # (هم‌ترازیِ H4+D1 به‌تنهایی یک تأییدِ معتبرِ cross-TF است.)
        if present_count < 2:
            direction = "neutral"
            higher_bias = "neutral"
            aligned = False
            # تمام شمارنده‌ها/confluence نیز خنثی شوند تا dict خروجی سازگار بماند
            net_confluence = 0
            bullish_count = 0
            bearish_count = 0
            has_conflict = False

        return {
            "confluence_count": abs(net_confluence),
            "net_confluence": net_confluence,
            "weighted_score": round(weighted_score, 2),
            "direction": direction,
            "higher_tf_bias": higher_bias,
            "conflict": has_conflict,
            "timeframe_details": tf_details,
            "aligned": aligned,
            "bullish_tfs": bullish_count,
            "bearish_tfs": bearish_count,
        }

    def _empty_result(self) -> dict[str, Any]:
        return {
            "confluence_count": 0,
            "net_confluence": 0,
            "weighted_score": 50,
            "direction": "neutral",
            "higher_tf_bias": "neutral",
            "conflict": False,
            "timeframe_details": {},
            "aligned": False,
            "bullish_tfs": 0,
            "bearish_tfs": 0,
        }

    @staticmethod
    def get_entry_timeframe(
        tf_details: dict[str, dict],
        direction: str,
    ) -> Optional[str]:
        """بهترین تایم‌فریم ورود — از پایین به بالا."""
        for tf in ["M15", "H1", "H4"]:
            detail = tf_details.get(tf)
            if detail and detail.get("direction") == direction:
                return tf
        return None

    @staticmethod
    def check_major_trend(tf_details: dict[str, dict]) -> str:
        """بررسی روند اصلی (W1 + D1 + H4)."""
        bullish = sum(
            1 for tf in ["W1", "D1", "H4"]
            if tf_details.get(tf, {}).get("direction") == "bullish"
        )
        bearish = sum(
            1 for tf in ["W1", "D1", "H4"]
            if tf_details.get(tf, {}).get("direction") == "bearish"
        )
        if bullish >= 2 and bearish == 0:
            return "strong_bullish"
        if bearish >= 2 and bullish == 0:
            return "strong_bearish"
        if bullish > bearish:
            return "bullish"
        if bearish > bullish:
            return "bearish"
        return "neutral"

    @staticmethod
    def is_signal_against_higher_bias(signal_direction: str, higher_bias: str) -> bool:
        """آیا سیگنال خلاف bias بلندمدت است؟"""
        if higher_bias in ("bullish", "slightly_bullish") and signal_direction == "short":
            return True
        if higher_bias in ("bearish", "slightly_bearish") and signal_direction == "long":
            return True
        return False
