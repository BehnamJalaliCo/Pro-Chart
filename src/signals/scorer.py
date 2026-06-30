"""
سیستم امتیازدهی سیگنال‌ها — ترکیب وزنی تحلیل تکنیکال، الگوها و هوش مصنوعی.

این ماژول نمرات مختلف تحلیلی را با اعمال وزن‌های مشخص ترکیب کرده
و با در نظر گرفتن بونوس‌ها و جریمه‌ها، امتیاز نهایی سیگنال را
در بازه صفر تا صد محاسبه می‌کند.

طبقه‌بندی سیگنال:
    - امتیاز >= ۸۵: سیگنال قوی (STRONG)
    - امتیاز >= ۶۵: سیگنال متوسط (MEDIUM)
    - امتیاز < ۶۵: بدون سیگنال (NO_SIGNAL)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# ثابت‌ها
# ---------------------------------------------------------------------------

# وزن‌ها: ML از ۰.۳۰ به ۰.۲۲ کاهش یافت چون مدلِ فعلی مهارتِ منفی نشان می‌دهد
# (نرخِ برد ~۲۷-۳۳٪) و با مقادیرِ افراطیِ پایین (ml<۲۰) ستاپ‌های مرزیِ سالم را له
# می‌کرد. وزن به تکنیکال/الگو (که قابل‌اتکاترند) منتقل شد.
TECHNICAL_WEIGHT: float = 0.43
PATTERN_WEIGHT: float = 0.35
ML_WEIGHT: float = 0.22

# ضریبِ اعتماد به ML: انحرافِ نمرهٔ ML از خنثی (۵۰) با این ضریب کوچک می‌شود تا یک
# پیش‌بینیِ نویزی/مطمئنِ اشتباه نتواند کلِ امتیاز را بکشد. ۱.۰ یعنی بدونِ کوچک‌سازی.
ML_TRUST: float = 0.55

# بونوس‌ها
MULTI_TF_CONFLUENCE_BONUS: float = 5.0
MULTI_TF_CONFLUENCE_MIN: int = 3
VOLUME_CONFIRMS_BONUS: float = 3.0

# هم‌جهتی با تایم‌فریمِ بالا — قوی‌ترین عاملِ win-rate طبق تحقیقِ جهانی (شکافِ ۲۶-۴۷٪
# نرخِ برد بینِ معاملاتِ هم‌جهت با HTF و معاملاتِ ضدِ HTF). ستاپِ هم‌جهت با bias قویِ
# روزانه/هفتگی پاداشِ بزرگ می‌گیرد تا مطمئن از آستانه عبور کند و ترکیبِ سیگنال‌ها به
# سمتِ معاملاتِ پربردِ هم‌جهت بچرخد.
HTF_ALIGNED_STRONG_BONUS: float = 8.0
HTF_ALIGNED_WEAK_BONUS: float = 4.0

# جریمه‌ها
AGAINST_MAJOR_TREND_PENALTY: float = -10.0
HIGH_IMPACT_NEWS_PENALTY: float = -15.0
# جریمهٔ reversionِ خلافِ HTF (trend از قبل با AGAINST_MAJOR_TREND_PENALTY پوشش دارد)
HTF_AGAINST_REVERSION_PENALTY: float = -6.0


class SignalStrength(str, Enum):
    """قدرت سیگنال تولیدشده"""

    STRONG = "STRONG"
    MEDIUM = "MEDIUM"
    NO_SIGNAL = "NO_SIGNAL"


@dataclass
class ScoreBreakdown:
    """جزئیات محاسبه امتیاز سیگنال.

    شامل نمرات پایه، بونوس‌ها، جریمه‌ها و نتیجه نهایی.
    """

    technical_score: float = 0.0
    pattern_score: float = 0.0
    ml_score: float = 0.0
    weighted_base: float = 0.0
    bonuses: Dict[str, float] = field(default_factory=dict)
    penalties: Dict[str, float] = field(default_factory=dict)
    total_bonus: float = 0.0
    total_penalty: float = 0.0
    final_score: float = 0.0
    signal_strength: SignalStrength = SignalStrength.NO_SIGNAL

    def to_dict(self) -> Dict[str, Any]:
        """تبدیل به دیکشنری برای ذخیره در دیتابیس و ارسال به کلاینت"""
        return {
            "technical_score": round(self.technical_score, 2),
            "pattern_score": round(self.pattern_score, 2),
            "ml_score": round(self.ml_score, 2),
            "weighted_base": round(self.weighted_base, 2),
            "bonuses": {k: round(v, 2) for k, v in self.bonuses.items()},
            "penalties": {k: round(v, 2) for k, v in self.penalties.items()},
            "total_bonus": round(self.total_bonus, 2),
            "total_penalty": round(self.total_penalty, 2),
            "final_score": round(self.final_score, 2),
            "signal_strength": self.signal_strength.value,
        }


@dataclass
class ScoringContext:
    """زمینه‌ای که برای محاسبه بونوس‌ها و جریمه‌ها لازم است.

    هر فیلد اختیاری است و در صورت عدم ارائه، بونوس/جریمه مربوطه
    اعمال نخواهد شد.
    """

    multi_tf_confluence_count: int = 0
    volume_confirms: bool = False
    against_major_trend: bool = False
    high_impact_news_within_1h: bool = False
    signal_direction: str = "neutral"
    major_trend_direction: str = "neutral"
    extra_bonuses: Dict[str, float] = field(default_factory=dict)
    extra_penalties: Dict[str, float] = field(default_factory=dict)


class SignalScorer:
    """
    موتور امتیازدهی سیگنال‌ها.

    سه نمره ورودی (تکنیکال، الگو، یادگیری ماشین) را با وزن‌های
    مشخص ترکیب کرده و بونوس و جریمه اعمال می‌کند.

    وزن‌ها:
        - تحلیل تکنیکال: ۴۰٪
        - الگوها (کندل‌استیک + نموداری): ۳۰٪
        - پیش‌بینی هوش مصنوعی: ۳۰٪

    بونوس‌ها:
        - هم‌جهتی چند تایم‌فریم (>= ۳): +۵
        - تایید حجم: +۳

    جریمه‌ها:
        - خلاف روند اصلی: -۱۰
        - اخبار پرتاثیر در یک ساعت آینده: -۱۵
    """

    def __init__(
        self,
        technical_weight: float = TECHNICAL_WEIGHT,
        pattern_weight: float = PATTERN_WEIGHT,
        ml_weight: float = ML_WEIGHT,
    ) -> None:
        """ساخت نمونه امتیازدهنده با وزن‌های سفارشی.

        پارامترها:
            technical_weight: وزن نمره تحلیل تکنیکال (پیش‌فرض ۰.۴۰)
            pattern_weight: وزن نمره الگوها (پیش‌فرض ۰.۳۰)
            ml_weight: وزن نمره هوش مصنوعی (پیش‌فرض ۰.۳۰)
        """
        total = technical_weight + pattern_weight + ml_weight
        if abs(total - 1.0) > 1e-6:
            logger.warning(
                "scorer_weights_not_normalized",
                total=total,
                normalizing=True,
            )
            technical_weight /= total
            pattern_weight /= total
            ml_weight /= total

        self._tech_w = technical_weight
        self._pattern_w = pattern_weight
        self._ml_w = ml_weight

    # ------------------------------------------------------------------
    # API اصلی
    # ------------------------------------------------------------------

    def score(
        self,
        technical_score: float,
        pattern_score: float,
        ml_score: float,
        context: Optional[ScoringContext] = None,
    ) -> ScoreBreakdown:
        """
        محاسبه امتیاز نهایی سیگنال.

        پارامترها:
            technical_score: نمره تحلیل تکنیکال (۰-۱۰۰)
            pattern_score: نمره الگوها (۰-۱۰۰)
            ml_score: نمره پیش‌بینی هوش مصنوعی (۰-۱۰۰)
            context: اطلاعات اضافی برای بونوس/جریمه

        خروجی:
            شیء ScoreBreakdown شامل نمرات جزئی، بونوس‌ها، جریمه‌ها
            و امتیاز نهایی.
        """
        ctx = context or ScoringContext()
        breakdown = ScoreBreakdown()

        # ذخیره نمرات خام
        breakdown.technical_score = self._clamp(technical_score)
        breakdown.pattern_score = self._clamp(pattern_score)
        breakdown.ml_score = self._clamp(ml_score)

        # نمرهٔ مؤثرِ ML: انحراف از خنثی (۵۰) را با ML_TRUST کوچک می‌کنیم تا یک
        # پیش‌بینیِ افراطیِ نویزی (مثلاً ml=۶) ستاپِ سالمِ تکنیکال/الگو را له نکند.
        ml_eff = 50.0 + (breakdown.ml_score - 50.0) * ML_TRUST

        # محاسبه میانگین وزنی
        weighted_base = (
            breakdown.technical_score * self._tech_w
            + breakdown.pattern_score * self._pattern_w
            + ml_eff * self._ml_w
        )
        breakdown.weighted_base = weighted_base

        # ---- بونوس‌ها ----
        bonuses: Dict[str, float] = {}

        # بونوس هم‌جهتی چند تایم‌فریم
        if ctx.multi_tf_confluence_count >= MULTI_TF_CONFLUENCE_MIN:
            bonuses["multi_tf_confluence"] = MULTI_TF_CONFLUENCE_BONUS

        # بونوس تایید حجم
        if ctx.volume_confirms:
            bonuses["volume_confirms"] = VOLUME_CONFIRMS_BONUS

        # بونوس‌های اضافی سفارشی — مقدار را همان‌طور که داده شده اعمال می‌کنیم؛
        # abs() حذف شد تا مقادیر منفی (جریمه) بی‌صدا به بونوس تبدیل نشوند.
        for key, val in ctx.extra_bonuses.items():
            if val < 0:
                logger.warning("scorer_negative_extra_bonus", key=key, value=val)
            bonuses[key] = val

        breakdown.bonuses = bonuses
        breakdown.total_bonus = sum(bonuses.values())

        # ---- جریمه‌ها ----
        penalties: Dict[str, float] = {}

        # جریمه خلاف روند اصلی — فقط بر اساس پرچم صریح ctx؛
        # بازبینی درون‌خطی حذف شد تا against_major_trend=False بتواند جریمه را خنثی کند.
        if ctx.against_major_trend:
            penalties["against_major_trend"] = AGAINST_MAJOR_TREND_PENALTY

        # جریمه اخبار پرتاثیر
        if ctx.high_impact_news_within_1h:
            penalties["high_impact_news"] = HIGH_IMPACT_NEWS_PENALTY

        # جریمه‌های اضافی سفارشی
        for key, val in ctx.extra_penalties.items():
            penalties[key] = -abs(val)

        breakdown.penalties = penalties
        breakdown.total_penalty = sum(penalties.values())

        # ---- محاسبه نمره نهایی ----
        raw_final = weighted_base + breakdown.total_bonus + breakdown.total_penalty
        breakdown.final_score = self._clamp(raw_final)

        # طبقه‌بندی قدرت سیگنال
        breakdown.signal_strength = self._classify(breakdown.final_score)

        logger.info(
            "signal_scored",
            tech=breakdown.technical_score,
            pattern=breakdown.pattern_score,
            ml=breakdown.ml_score,
            ml_eff=round(ml_eff, 2),
            base=round(weighted_base, 2),
            bonus=round(breakdown.total_bonus, 2),
            penalty=round(breakdown.total_penalty, 2),
            final=round(breakdown.final_score, 2),
            strength=breakdown.signal_strength.value,
        )

        return breakdown

    def score_from_analysis(
        self,
        technical_result: Dict[str, Any],
        candlestick_result: Dict[str, Any],
        chart_pattern_result: Dict[str, Any],
        ml_result: Dict[str, Any],
        mtf_result: Dict[str, Any],
        volume_result: Dict[str, Any],
        smc_result: Dict[str, Any],
        news_penalty: float = 0.0,
        signal_direction: str = "neutral",
        extra_bonus: float = 0.0,
        signal_strategy: str = "trend",
    ) -> ScoreBreakdown:
        """
        محاسبه امتیاز از خروجی مستقیم آنالیزرها.

        این متد نمرات خام را از نتایج تحلیلگرهای مختلف استخراج کرده
        و زمینه مناسب را برای بونوس‌ها و جریمه‌ها آماده می‌کند.

        پارامترها:
            technical_result: خروجی TechnicalAnalyzer.analyze()
            candlestick_result: خروجی CandlestickAnalyzer.analyze()
            chart_pattern_result: خروجی ChartPatternAnalyzer.analyze()
            ml_result: خروجی EnsemblePredictor.predict()
            mtf_result: خروجی MultiTimeframeAnalyzer.analyze()
            volume_result: خروجی VolumeAnalyzer.analyze()
            smc_result: خروجی SmartMoneyAnalyzer.analyze()
            news_penalty: جریمه اخبار (از NewsFilter)
            signal_direction: جهت سیگنال ('long' / 'short')

        خروجی:
            شیء ScoreBreakdown
        """
        # استخراج نمره تکنیکال
        tech_score = float(technical_result.get("technical_score", 50.0))

        # ترکیب نمرات الگوها: کندل‌استیک (۵۰٪) + نموداری (۳۰٪) + اسمارت مانی (۲۰٪)
        candle_score = float(candlestick_result.get("pattern_score", 50.0))
        chart_score = float(chart_pattern_result.get("pattern_score", 50.0))
        smc_score = float(smc_result.get("smc_score", 50.0))
        pattern_score = candle_score * 0.50 + chart_score * 0.30 + smc_score * 0.20

        # نمره هوش مصنوعی
        ml_score = float(ml_result.get("ml_score", 50.0))

        # ساخت زمینه
        mtf_confluence = int(mtf_result.get("confluence_count", 0))
        vol_confirms = bool(volume_result.get("volume_confirms_trend", False))
        major_trend = mtf_result.get("direction", "neutral")

        # بازگشت‌به‌میانگین ذاتاً خلافِ تمایلِ خفیفِ روند است؛ جریمه‌ی counter-trend
        # برای آن یک خطای دسته‌بندی است که ستاپ‌های مرزیِ reversion را زیر ۶۰ می‌اندازد.
        against_trend = (
            self._is_against_major_trend(signal_direction, major_trend)
            if signal_strategy != "reversion" else False
        )

        has_news = news_penalty < 0

        ctx = ScoringContext(
            multi_tf_confluence_count=mtf_confluence,
            volume_confirms=vol_confirms,
            against_major_trend=against_trend,
            # جریمهٔ ثابت -۱۵ را اعمال نمی‌کنیم؛ مقدار واقعیِ news_penalty را یک‌بار می‌گذاریم
            high_impact_news_within_1h=False,
            signal_direction=signal_direction,
            major_trend_direction=major_trend,
        )

        # جریمهٔ اخبار دقیقاً به‌اندازهٔ news_penalty (مقدار منفی، یک‌بار) —
        # قبلاً -۱۵ ثابت + یک extra غلط بود که جریمه را برای مقادیر دیگر دوبرابر می‌کرد.
        if has_news:
            ctx.extra_penalties["news"] = news_penalty

        # بونوس کیفیت (مثل reversion در رژیم رنج) — اجازه می‌دهد ستاپ‌های واقعیِ
        # لبه‌ی رنج به MEDIUM برسند بدون پایین‌آوردن آستانهٔ سراسری.
        if extra_bonus and extra_bonus > 0:
            ctx.extra_bonuses["reversion_quality"] = extra_bonus

        # ── هم‌جهتی با تایم‌فریمِ بالا (قوی‌ترین عاملِ win-rate) ──
        htf_bias = str(mtf_result.get("higher_tf_bias", "neutral") or "neutral").lower()
        _bull_bias = htf_bias in ("bullish", "slightly_bullish")
        _bear_bias = htf_bias in ("bearish", "slightly_bearish")
        _strong_bias = htf_bias in ("bullish", "bearish")
        if signal_direction in ("long", "short") and (_bull_bias or _bear_bias):
            aligned = (
                (signal_direction == "long" and _bull_bias)
                or (signal_direction == "short" and _bear_bias)
            )
            if aligned:
                ctx.extra_bonuses["htf_aligned"] = (
                    HTF_ALIGNED_STRONG_BONUS if _strong_bias else HTF_ALIGNED_WEAK_BONUS
                )
            elif signal_strategy == "reversion":
                # trend از قبل با against_major_trend جریمه شده؛ reversionِ خلافِ HTF
                # را اینجا جریمه می‌کنیم (ضدروند = سقوطِ نرخِ برد).
                ctx.extra_penalties["htf_against"] = HTF_AGAINST_REVERSION_PENALTY

        return self.score(tech_score, pattern_score, ml_score, ctx)

    # ------------------------------------------------------------------
    # کمکی‌ها
    # ------------------------------------------------------------------

    @staticmethod
    def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
        """محدود کردن مقدار در بازه مشخص"""
        # محافظت در برابر NaN/inf — در غیر این صورت max/min مقدار NaN را به سقف
        # تبدیل کرده و یک سیگنال «کامل» جعلی می‌سازد.
        if not math.isfinite(value):
            return (low + high) / 2
        return max(low, min(high, value))

    @staticmethod
    def _classify(score: float) -> SignalStrength:
        """طبقه‌بندی قدرت سیگنال بر اساس امتیاز نهایی"""
        if score >= settings.STRONG_SIGNAL_SCORE:
            return SignalStrength.STRONG
        elif score >= settings.MIN_SIGNAL_SCORE:
            return SignalStrength.MEDIUM
        return SignalStrength.NO_SIGNAL

    @staticmethod
    def _is_against_major_trend(
        signal_direction: str,
        major_trend: str,
    ) -> bool:
        """بررسی اینکه آیا سیگنال خلاف روند اصلی است.

        پارامترها:
            signal_direction: جهت سیگنال ('long' / 'short')
            major_trend: روند اصلی بازار ('bullish' / 'bearish' / ...)

        خروجی:
            True اگر سیگنال خلاف روند اصلی باشد
        """
        bullish_trends = {"bullish", "strong_bullish", "slightly_bullish"}
        bearish_trends = {"bearish", "strong_bearish", "slightly_bearish"}

        if signal_direction == "long" and major_trend in bearish_trends:
            return True
        if signal_direction == "short" and major_trend in bullish_trends:
            return True

        return False
