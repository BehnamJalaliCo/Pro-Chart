"""ماژول تشخیص الگوهای کندل‌استیک برای پلتفرم سیگنال فارکس

این ماژول الگوهای تک‌کندلی، دو‌کندلی و سه‌کندلی را شناسایی کرده
و با تایید حجم معاملات، نتیجه تحلیل را ارائه می‌دهد.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np
import pandas as pd
import pandas_ta as ta

from src.core.logger import get_logger

logger = get_logger(__name__)

# ─────────────────────────── ثوابت ───────────────────────────

VOLUME_AVG_PERIOD: int = 20
DOJI_THRESHOLD: float = 0.05
LONG_LEGGED_DOJI_SHADOW_RATIO: float = 2.0
SPINNING_TOP_BODY_RATIO: float = 0.3
MARUBOZU_WICK_RATIO: float = 0.01
HAMMER_BODY_RATIO: float = 0.33
HAMMER_SHADOW_RATIO: float = 2.0
ENGULFING_MIN_RATIO: float = 1.0
PIERCING_MIN_RATIO: float = 0.5
STAR_GAP_RATIO: float = 0.001
STAR_BODY_RATIO: float = 0.1
ABANDONED_BABY_GAP_RATIO: float = 0.002


class PatternDirection(str, Enum):
    """جهت الگو"""

    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class PatternStrength(str, Enum):
    """قدرت الگو"""

    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"


@dataclass
class PatternResult:
    """نتیجه تشخیص یک الگو

    شامل نام الگو، جهت، قدرت، موقعیت و تایید حجم
    """

    name: str
    direction: PatternDirection
    strength: PatternStrength
    candle_count: int
    index: int
    timestamp: pd.Timestamp
    volume_confirmed: bool
    confidence: float
    description: str

    def to_dict(self) -> dict:
        """تبدیل نتیجه الگو به دیکشنری"""
        return {
            "name": self.name,
            "direction": self.direction.value,
            "strength": self.strength.value,
            "candle_count": self.candle_count,
            "index": self.index,
            "timestamp": str(self.timestamp),
            "volume_confirmed": self.volume_confirmed,
            "confidence": round(self.confidence, 2),
            "description": self.description,
        }


@dataclass
class AnalysisResult:
    """نتیجه کامل تحلیل الگوهای کندل‌استیک"""

    patterns_found: list[dict] = field(default_factory=list)
    pattern_score: int = 0
    bullish_count: int = 0
    bearish_count: int = 0

    def to_dict(self) -> dict:
        """تبدیل نتیجه تحلیل به دیکشنری"""
        return {
            "patterns_found": self.patterns_found,
            "pattern_score": self.pattern_score,
            "bullish_count": self.bullish_count,
            "bearish_count": self.bearish_count,
        }


# ──────────────────── توابع کمکی محاسباتی ────────────────────


def _body_size(open_price: float, close_price: float) -> float:
    """محاسبه اندازه بدنه کندل"""
    return abs(close_price - open_price)


def _upper_shadow(open_price: float, high: float, close_price: float) -> float:
    """محاسبه سایه بالایی کندل"""
    return high - max(open_price, close_price)


def _lower_shadow(open_price: float, low: float, close_price: float) -> float:
    """محاسبه سایه پایینی کندل"""
    return min(open_price, close_price) - low


def _candle_range(high: float, low: float) -> float:
    """محاسبه رنج کل کندل"""
    return high - low


def _is_bullish(open_price: float, close_price: float) -> bool:
    """بررسی صعودی بودن کندل"""
    return close_price > open_price


def _is_bearish(open_price: float, close_price: float) -> bool:
    """بررسی نزولی بودن کندل"""
    return close_price < open_price


def _body_midpoint(open_price: float, close_price: float) -> float:
    """محاسبه نقطه میانی بدنه کندل"""
    return (open_price + close_price) / 2.0


# ──────────────────── کلاس اصلی تحلیلگر ────────────────────


class CandlestickAnalyzer:
    """تحلیلگر الگوهای کندل‌استیک

    این کلاس الگوهای مختلف کندل‌استیک را در داده‌های قیمتی شناسایی کرده
    و با تایید حجم معاملات، امتیاز نهایی تحلیل را محاسبه می‌کند.

    ویژگی‌ها:
        - تشخیص الگوهای تک‌کندلی (دوجی، چکش، ستاره دنباله‌دار و غیره)
        - تشخیص الگوهای دو‌کندلی (پوشا، هارامی، انبرک و غیره)
        - تشخیص الگوهای سه‌کندلی (ستاره صبحگاهی، سه سرباز سفید و غیره)
        - تایید الگوها با حجم معاملات
        - محاسبه امتیاز کلی بازار بر اساس الگوهای شناسایی‌شده
    """

    # وزن‌دهی به الگوها بر اساس قدرت پیش‌بینی
    PATTERN_WEIGHTS: dict[str, float] = {
        # تک‌کندلی
        "doji_standard": 3.0,
        "doji_long_legged": 4.0,
        "doji_dragonfly": 5.0,
        "doji_gravestone": 5.0,
        "hammer": 6.0,
        "inverted_hammer": 5.0,
        "shooting_star": 6.0,
        "spinning_top": 2.0,
        "marubozu_bullish": 7.0,
        "marubozu_bearish": 7.0,
        "hanging_man": 6.0,
        # دو‌کندلی
        "bullish_engulfing": 8.0,
        "bearish_engulfing": 8.0,
        "tweezer_top": 6.0,
        "tweezer_bottom": 6.0,
        "bullish_harami": 5.0,
        "bearish_harami": 5.0,
        "piercing_line": 7.0,
        "dark_cloud_cover": 7.0,
        # سه‌کندلی
        "morning_star": 9.0,
        "evening_star": 9.0,
        "three_white_soldiers": 9.0,
        "three_black_crows": 9.0,
        "three_inside_up": 8.0,
        "three_inside_down": 8.0,
        "abandoned_baby_bullish": 10.0,
        "abandoned_baby_bearish": 10.0,
    }

    def __init__(
        self,
        volume_avg_period: int = VOLUME_AVG_PERIOD,
        doji_threshold: float = DOJI_THRESHOLD,
    ) -> None:
        """مقداردهی اولیه تحلیلگر

        پارامترها:
            volume_avg_period: دوره میانگین حجم برای تایید (پیش‌فرض ۲۰)
            doji_threshold: آستانه نسبت بدنه به رنج برای شناسایی دوجی (پیش‌فرض ۰.۰۵)
        """
        self._volume_avg_period: int = volume_avg_period
        self._doji_threshold: float = doji_threshold
        logger.info(
            "candlestick_analyzer_initialized",
            volume_avg_period=volume_avg_period,
            doji_threshold=doji_threshold,
        )

    def _validate_dataframe(self, df: pd.DataFrame) -> bool:
        """اعتبارسنجی ستون‌های ضروری دیتافریم ورودی

        بررسی می‌کند که ستون‌های مورد نیاز وجود داشته باشند
        و دیتافریم حداقل تعداد ردیف لازم را داشته باشد.

        پارامترها:
            df: دیتافریم ورودی

        خروجی:
            True اگر دیتافریم معتبر باشد، در غیر این صورت False
        """
        required_columns: set[str] = {"timestamp", "open", "high", "low", "close", "volume"}
        existing_columns: set[str] = set(df.columns)
        missing: set[str] = required_columns - existing_columns

        if missing:
            logger.error(
                "missing_required_columns",
                missing=list(missing),
                available=list(existing_columns),
            )
            return False

        if len(df) < 3:
            logger.warning(
                "insufficient_data",
                row_count=len(df),
                min_required=3,
            )
            return False

        return True

    def _compute_volume_avg(self, df: pd.DataFrame) -> pd.Series:
        """محاسبه میانگین متحرک حجم برای تایید الگو

        پارامترها:
            df: دیتافریم با ستون حجم

        خروجی:
            سری پانداس شامل میانگین متحرک حجم
        """
        return df["volume"].rolling(window=self._volume_avg_period, min_periods=1).mean()

    def _is_volume_confirmed(self, volume: float, avg_volume: float) -> bool:
        """بررسی تایید حجم معاملات

        حجم کندل الگو باید بیشتر از میانگین دوره باشد.

        پارامترها:
            volume: حجم کندل فعلی
            avg_volume: میانگین حجم دوره

        خروجی:
            True اگر حجم تایید شده باشد
        """
        if avg_volume <= 0:
            return False
        return volume > avg_volume

    # ═══════════════════ الگوهای تک‌کندلی ═══════════════════

    def _detect_doji(
        self,
        idx: int,
        o: float,
        h: float,
        l: float,
        c: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی دوجی (چهار نوع)

        دوجی زمانی شکل می‌گیرد که قیمت باز و بسته شدن تقریبا برابر باشند.
        چهار نوع دوجی:
        - استاندارد: سایه‌های متقارن
        - پابلند: سایه‌های بلند و متقارن
        - سنجاقک: سایه پایینی بلند، بدون سایه بالایی
        - سنگ‌قبر: سایه بالایی بلند، بدون سایه پایینی

        پارامترها:
            idx: ایندکس ردیف
            o: قیمت باز شدن
            h: بالاترین قیمت
            l: پایین‌ترین قیمت
            c: قیمت بسته شدن
            ts: زمان کندل
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        candle_range = _candle_range(h, l)
        if candle_range <= 0:
            return None

        body = _body_size(o, c)
        body_ratio = body / candle_range

        if body_ratio > self._doji_threshold:
            return None

        upper = _upper_shadow(o, h, c)
        lower = _lower_shadow(o, l, c)

        # سنگ‌قبر: سایه بالایی بلند، سایه پایینی ناچیز
        if upper > candle_range * 0.6 and lower < candle_range * 0.1:
            return PatternResult(
                name="doji_gravestone",
                direction=PatternDirection.BEARISH,
                strength=PatternStrength.MODERATE,
                candle_count=1,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.70 if vol_confirmed else 0.45,
                description="دوجی سنگ‌قبر - سیگنال بازگشت نزولی",
            )

        # سنجاقک: سایه پایینی بلند، سایه بالایی ناچیز
        if lower > candle_range * 0.6 and upper < candle_range * 0.1:
            return PatternResult(
                name="doji_dragonfly",
                direction=PatternDirection.BULLISH,
                strength=PatternStrength.MODERATE,
                candle_count=1,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.70 if vol_confirmed else 0.45,
                description="دوجی سنجاقک - سیگنال بازگشت صعودی",
            )

        # پابلند: هر دو سایه بلند
        if (
            upper > candle_range * LONG_LEGGED_DOJI_SHADOW_RATIO * body_ratio
            and lower > candle_range * LONG_LEGGED_DOJI_SHADOW_RATIO * body_ratio
            and upper > candle_range * 0.3
            and lower > candle_range * 0.3
        ):
            return PatternResult(
                name="doji_long_legged",
                direction=PatternDirection.NEUTRAL,
                strength=PatternStrength.MODERATE,
                candle_count=1,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.60 if vol_confirmed else 0.35,
                description="دوجی پابلند - بلاتکلیفی شدید بازار",
            )

        # استاندارد
        return PatternResult(
            name="doji_standard",
            direction=PatternDirection.NEUTRAL,
            strength=PatternStrength.WEAK,
            candle_count=1,
            index=idx,
            timestamp=ts,
            volume_confirmed=vol_confirmed,
            confidence=0.50 if vol_confirmed else 0.30,
            description="دوجی استاندارد - بلاتکلیفی بازار",
        )

    def _detect_hammer(
        self,
        idx: int,
        o: float,
        h: float,
        l: float,
        c: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی چکش

        چکش دارای بدنه کوچک در بالای کندل و سایه پایینی بلند است.
        معمولا در انتهای روند نزولی ظاهر شده و سیگنال بازگشت صعودی می‌دهد.

        پارامترها:
            idx: ایندکس ردیف
            o, h, l, c: قیمت‌های کندل
            ts: زمان کندل
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        candle_range = _candle_range(h, l)
        if candle_range <= 0:
            return None

        body = _body_size(o, c)
        upper = _upper_shadow(o, h, c)
        lower = _lower_shadow(o, l, c)

        body_ratio = body / candle_range

        if (
            body_ratio < HAMMER_BODY_RATIO
            and lower >= body * HAMMER_SHADOW_RATIO
            and upper <= body * 0.5
            and _is_bullish(o, c)
            and body > 0
        ):
            return PatternResult(
                name="hammer",
                direction=PatternDirection.BULLISH,
                strength=PatternStrength.MODERATE,
                candle_count=1,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.72 if vol_confirmed else 0.48,
                description="چکش - سیگنال بازگشت صعودی در انتهای روند نزولی",
            )
        return None

    def _detect_inverted_hammer(
        self,
        idx: int,
        o: float,
        h: float,
        l: float,
        c: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی چکش معکوس

        چکش معکوس دارای بدنه کوچک در پایین کندل و سایه بالایی بلند است.
        در انتهای روند نزولی ظاهر شده و سیگنال بازگشت صعودی احتمالی می‌دهد.

        پارامترها:
            idx: ایندکس ردیف
            o, h, l, c: قیمت‌های کندل
            ts: زمان کندل
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        candle_range = _candle_range(h, l)
        if candle_range <= 0:
            return None

        body = _body_size(o, c)
        upper = _upper_shadow(o, h, c)
        lower = _lower_shadow(o, l, c)

        if (
            body / candle_range < HAMMER_BODY_RATIO
            and upper >= body * HAMMER_SHADOW_RATIO
            and lower <= body * 0.5
            and _is_bullish(o, c)
            and body > 0
        ):
            return PatternResult(
                name="inverted_hammer",
                direction=PatternDirection.BULLISH,
                strength=PatternStrength.WEAK,
                candle_count=1,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.60 if vol_confirmed else 0.38,
                description="چکش معکوس - سیگنال احتمالی بازگشت صعودی",
            )
        return None

    def _detect_shooting_star(
        self,
        idx: int,
        o: float,
        h: float,
        l: float,
        c: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی ستاره دنباله‌دار

        ستاره دنباله‌دار شبیه چکش معکوس است اما در انتهای روند صعودی ظاهر شده
        و سیگنال بازگشت نزولی می‌دهد. بدنه کوچک در پایین و سایه بالایی بلند دارد.

        پارامترها:
            idx: ایندکس ردیف
            o, h, l, c: قیمت‌های کندل
            ts: زمان کندل
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        candle_range = _candle_range(h, l)
        if candle_range <= 0:
            return None

        body = _body_size(o, c)
        upper = _upper_shadow(o, h, c)
        lower = _lower_shadow(o, l, c)

        if (
            body / candle_range < HAMMER_BODY_RATIO
            and upper >= body * HAMMER_SHADOW_RATIO
            and lower <= body * 0.5
            and _is_bearish(o, c)
            and body > 0
        ):
            return PatternResult(
                name="shooting_star",
                direction=PatternDirection.BEARISH,
                strength=PatternStrength.MODERATE,
                candle_count=1,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.72 if vol_confirmed else 0.48,
                description="ستاره دنباله‌دار - سیگنال بازگشت نزولی در انتهای روند صعودی",
            )
        return None

    def _detect_spinning_top(
        self,
        idx: int,
        o: float,
        h: float,
        l: float,
        c: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی فرفره

        فرفره دارای بدنه کوچک و سایه‌های بالایی و پایینی نسبتا بلند است.
        نشان‌دهنده بلاتکلیفی بازار بوده و به‌تنهایی سیگنال قوی نمی‌دهد.

        پارامترها:
            idx: ایندکس ردیف
            o, h, l, c: قیمت‌های کندل
            ts: زمان کندل
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        candle_range = _candle_range(h, l)
        if candle_range <= 0:
            return None

        body = _body_size(o, c)
        body_ratio = body / candle_range
        upper = _upper_shadow(o, h, c)
        lower = _lower_shadow(o, l, c)

        # بدنه کوچک اما نه به اندازه دوجی، هر دو سایه وجود داشته باشند
        if (
            self._doji_threshold < body_ratio <= SPINNING_TOP_BODY_RATIO
            and upper > body * 0.5
            and lower > body * 0.5
        ):
            return PatternResult(
                name="spinning_top",
                direction=PatternDirection.NEUTRAL,
                strength=PatternStrength.WEAK,
                candle_count=1,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.40 if vol_confirmed else 0.25,
                description="فرفره - بلاتکلیفی بازار",
            )
        return None

    def _detect_marubozu(
        self,
        idx: int,
        o: float,
        h: float,
        l: float,
        c: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی ماروبوزو (صعودی و نزولی)

        ماروبوزو کندلی است که تقریبا بدون سایه بوده و بدنه بزرگی دارد.
        ماروبوزو صعودی نشان‌دهنده قدرت خریداران و نزولی نشان‌دهنده قدرت فروشندگان است.

        پارامترها:
            idx: ایندکس ردیف
            o, h, l, c: قیمت‌های کندل
            ts: زمان کندل
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        candle_range = _candle_range(h, l)
        if candle_range <= 0:
            return None

        body = _body_size(o, c)
        upper = _upper_shadow(o, h, c)
        lower = _lower_shadow(o, l, c)

        # سایه‌ها باید ناچیز باشند
        if upper > candle_range * MARUBOZU_WICK_RATIO * 10:
            return None
        if lower > candle_range * MARUBOZU_WICK_RATIO * 10:
            return None
        # بدنه باید بیشتر از ۹۰ درصد رنج باشد
        if body / candle_range < 0.90:
            return None

        if _is_bullish(o, c):
            return PatternResult(
                name="marubozu_bullish",
                direction=PatternDirection.BULLISH,
                strength=PatternStrength.STRONG,
                candle_count=1,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.80 if vol_confirmed else 0.55,
                description="ماروبوزو صعودی - قدرت بالای خریداران",
            )
        else:
            return PatternResult(
                name="marubozu_bearish",
                direction=PatternDirection.BEARISH,
                strength=PatternStrength.STRONG,
                candle_count=1,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.80 if vol_confirmed else 0.55,
                description="ماروبوزو نزولی - قدرت بالای فروشندگان",
            )

    def _detect_hanging_man(
        self,
        idx: int,
        o: float,
        h: float,
        l: float,
        c: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی مرد دارآویز

        مرد دارآویز از نظر شکل ظاهری شبیه چکش است اما در انتهای روند صعودی ظاهر شده
        و سیگنال بازگشت نزولی می‌دهد. بدنه کوچک در بالا و سایه پایینی بلند دارد.

        پارامترها:
            idx: ایندکس ردیف
            o, h, l, c: قیمت‌های کندل
            ts: زمان کندل
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        candle_range = _candle_range(h, l)
        if candle_range <= 0:
            return None

        body = _body_size(o, c)
        upper = _upper_shadow(o, h, c)
        lower = _lower_shadow(o, l, c)
        body_ratio = body / candle_range

        if (
            body_ratio < HAMMER_BODY_RATIO
            and lower >= body * HAMMER_SHADOW_RATIO
            and upper <= body * 0.5
            and _is_bearish(o, c)
            and body > 0
        ):
            return PatternResult(
                name="hanging_man",
                direction=PatternDirection.BEARISH,
                strength=PatternStrength.MODERATE,
                candle_count=1,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.68 if vol_confirmed else 0.44,
                description="مرد دارآویز - سیگنال بازگشت نزولی در انتهای روند صعودی",
            )
        return None

    # ═══════════════════ الگوهای دو‌کندلی ═══════════════════

    def _detect_bullish_engulfing(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی پوشای صعودی

        کندل دوم (صعودی) بدنه کندل اول (نزولی) را کاملا در بر می‌گیرد.
        سیگنال قوی بازگشت صعودی در انتهای روند نزولی است.

        پارامترها:
            idx: ایندکس ردیف کندل دوم
            o1, h1, l1, c1: قیمت‌های کندل اول
            o2, h2, l2, c2: قیمت‌های کندل دوم
            ts: زمان کندل دوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)
        body2 = _body_size(o2, c2)

        if body1 <= 0 or body2 <= 0:
            return None

        if (
            _is_bearish(o1, c1)
            and _is_bullish(o2, c2)
            and o2 <= c1
            and c2 >= o1
            and body2 >= body1 * ENGULFING_MIN_RATIO
        ):
            return PatternResult(
                name="bullish_engulfing",
                direction=PatternDirection.BULLISH,
                strength=PatternStrength.STRONG,
                candle_count=2,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.80 if vol_confirmed else 0.55,
                description="پوشای صعودی - سیگنال قوی بازگشت صعودی",
            )
        return None

    def _detect_bearish_engulfing(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی پوشای نزولی

        کندل دوم (نزولی) بدنه کندل اول (صعودی) را کاملا در بر می‌گیرد.
        سیگنال قوی بازگشت نزولی در انتهای روند صعودی است.

        پارامترها:
            idx: ایندکس ردیف کندل دوم
            o1, h1, l1, c1: قیمت‌های کندل اول
            o2, h2, l2, c2: قیمت‌های کندل دوم
            ts: زمان کندل دوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)
        body2 = _body_size(o2, c2)

        if body1 <= 0 or body2 <= 0:
            return None

        if (
            _is_bullish(o1, c1)
            and _is_bearish(o2, c2)
            and o2 >= c1
            and c2 <= o1
            and body2 >= body1 * ENGULFING_MIN_RATIO
        ):
            return PatternResult(
                name="bearish_engulfing",
                direction=PatternDirection.BEARISH,
                strength=PatternStrength.STRONG,
                candle_count=2,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.80 if vol_confirmed else 0.55,
                description="پوشای نزولی - سیگنال قوی بازگشت نزولی",
            )
        return None

    def _detect_tweezer_top(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی انبرک بالایی

        دو کندل متوالی با سقف‌های تقریبا برابر. کندل اول صعودی و دوم نزولی.
        سیگنال بازگشت نزولی در انتهای روند صعودی است.

        پارامترها:
            idx: ایندکس ردیف
            o1, h1, l1, c1: قیمت‌های کندل اول
            o2, h2, l2, c2: قیمت‌های کندل دوم
            ts: زمان کندل دوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        range1 = _candle_range(h1, l1)
        if range1 <= 0:
            return None

        high_diff = abs(h1 - h2) / range1

        if (
            high_diff < 0.05
            and _is_bullish(o1, c1)
            and _is_bearish(o2, c2)
        ):
            return PatternResult(
                name="tweezer_top",
                direction=PatternDirection.BEARISH,
                strength=PatternStrength.MODERATE,
                candle_count=2,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.65 if vol_confirmed else 0.42,
                description="انبرک بالایی - سیگنال بازگشت نزولی",
            )
        return None

    def _detect_tweezer_bottom(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی انبرک پایینی

        دو کندل متوالی با کف‌های تقریبا برابر. کندل اول نزولی و دوم صعودی.
        سیگنال بازگشت صعودی در انتهای روند نزولی است.

        پارامترها:
            idx: ایندکس ردیف
            o1, h1, l1, c1: قیمت‌های کندل اول
            o2, h2, l2, c2: قیمت‌های کندل دوم
            ts: زمان کندل دوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        range1 = _candle_range(h1, l1)
        if range1 <= 0:
            return None

        low_diff = abs(l1 - l2) / range1

        if (
            low_diff < 0.05
            and _is_bearish(o1, c1)
            and _is_bullish(o2, c2)
        ):
            return PatternResult(
                name="tweezer_bottom",
                direction=PatternDirection.BULLISH,
                strength=PatternStrength.MODERATE,
                candle_count=2,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.65 if vol_confirmed else 0.42,
                description="انبرک پایینی - سیگنال بازگشت صعودی",
            )
        return None

    def _detect_bullish_harami(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی هارامی صعودی

        کندل دوم (صعودی کوچک) کاملا درون بدنه کندل اول (نزولی بزرگ) قرار دارد.
        سیگنال بازگشت صعودی احتمالی است.

        پارامترها:
            idx: ایندکس ردیف
            o1, h1, l1, c1: قیمت‌های کندل اول
            o2, h2, l2, c2: قیمت‌های کندل دوم
            ts: زمان کندل دوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)
        body2 = _body_size(o2, c2)

        if body1 <= 0 or body2 <= 0:
            return None

        # کندل اول نزولی بزرگ، کندل دوم صعودی کوچک درون بدنه اول
        if (
            _is_bearish(o1, c1)
            and _is_bullish(o2, c2)
            and o2 >= c1
            and c2 <= o1
            and body2 < body1
        ):
            return PatternResult(
                name="bullish_harami",
                direction=PatternDirection.BULLISH,
                strength=PatternStrength.MODERATE,
                candle_count=2,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.62 if vol_confirmed else 0.40,
                description="هارامی صعودی - سیگنال احتمالی بازگشت صعودی",
            )
        return None

    def _detect_bearish_harami(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی هارامی نزولی

        کندل دوم (نزولی کوچک) کاملا درون بدنه کندل اول (صعودی بزرگ) قرار دارد.
        سیگنال بازگشت نزولی احتمالی است.

        پارامترها:
            idx: ایندکس ردیف
            o1, h1, l1, c1: قیمت‌های کندل اول
            o2, h2, l2, c2: قیمت‌های کندل دوم
            ts: زمان کندل دوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)
        body2 = _body_size(o2, c2)

        if body1 <= 0 or body2 <= 0:
            return None

        if (
            _is_bullish(o1, c1)
            and _is_bearish(o2, c2)
            and o2 <= c1
            and c2 >= o1
            and body2 < body1
        ):
            return PatternResult(
                name="bearish_harami",
                direction=PatternDirection.BEARISH,
                strength=PatternStrength.MODERATE,
                candle_count=2,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.62 if vol_confirmed else 0.40,
                description="هارامی نزولی - سیگنال احتمالی بازگشت نزولی",
            )
        return None

    def _detect_piercing_line(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی نفوذی

        کندل اول نزولی بزرگ و کندل دوم صعودی است که زیر کف کندل اول باز شده
        و تا بالاتر از نقطه میانی بدنه کندل اول بالا رفته است.
        سیگنال بازگشت صعودی است.

        پارامترها:
            idx: ایندکس ردیف
            o1, h1, l1, c1: قیمت‌های کندل اول
            o2, h2, l2, c2: قیمت‌های کندل دوم
            ts: زمان کندل دوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)

        if body1 <= 0:
            return None

        midpoint1 = _body_midpoint(o1, c1)

        if (
            _is_bearish(o1, c1)
            and _is_bullish(o2, c2)
            and o2 < c1
            and c2 > midpoint1
            and c2 < o1
        ):
            penetration = (c2 - c1) / body1
            if penetration >= PIERCING_MIN_RATIO:
                return PatternResult(
                    name="piercing_line",
                    direction=PatternDirection.BULLISH,
                    strength=PatternStrength.STRONG,
                    candle_count=2,
                    index=idx,
                    timestamp=ts,
                    volume_confirmed=vol_confirmed,
                    confidence=0.75 if vol_confirmed else 0.50,
                    description="خط نفوذی - سیگنال قوی بازگشت صعودی",
                )
        return None

    def _detect_dark_cloud_cover(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی ابر سیاه پوششی

        کندل اول صعودی بزرگ و کندل دوم نزولی است که بالاتر از سقف کندل اول باز شده
        و تا پایین‌تر از نقطه میانی بدنه کندل اول پایین آمده است.
        سیگنال بازگشت نزولی است.

        پارامترها:
            idx: ایندکس ردیف
            o1, h1, l1, c1: قیمت‌های کندل اول
            o2, h2, l2, c2: قیمت‌های کندل دوم
            ts: زمان کندل دوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)

        if body1 <= 0:
            return None

        midpoint1 = _body_midpoint(o1, c1)

        if (
            _is_bullish(o1, c1)
            and _is_bearish(o2, c2)
            and o2 > c1
            and c2 < midpoint1
            and c2 > o1
        ):
            penetration = (o2 - c2) / body1
            if penetration >= PIERCING_MIN_RATIO:
                return PatternResult(
                    name="dark_cloud_cover",
                    direction=PatternDirection.BEARISH,
                    strength=PatternStrength.STRONG,
                    candle_count=2,
                    index=idx,
                    timestamp=ts,
                    volume_confirmed=vol_confirmed,
                    confidence=0.75 if vol_confirmed else 0.50,
                    description="ابر سیاه پوششی - سیگنال قوی بازگشت نزولی",
                )
        return None

    # ═══════════════════ الگوهای سه‌کندلی ═══════════════════

    def _detect_morning_star(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        o3: float,
        h3: float,
        l3: float,
        c3: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی ستاره صبحگاهی

        سه کندل: اول نزولی بزرگ، دوم بدنه کوچک با گپ پایین،
        سوم صعودی بزرگ که بالاتر از نقطه میانی کندل اول بسته می‌شود.
        سیگنال قوی بازگشت صعودی است.

        پارامترها:
            idx: ایندکس ردیف کندل سوم
            o1..c3: قیمت‌های سه کندل
            ts: زمان کندل سوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)
        body2 = _body_size(o2, c2)
        body3 = _body_size(o3, c3)
        range1 = _candle_range(h1, l1)

        if range1 <= 0 or body1 <= 0:
            return None

        midpoint1 = _body_midpoint(o1, c1)
        star_gap = c1 * STAR_GAP_RATIO

        if (
            _is_bearish(o1, c1)
            and body2 / range1 < STAR_BODY_RATIO * 3
            and max(o2, c2) < c1 - star_gap
            and _is_bullish(o3, c3)
            and c3 > midpoint1
            and body3 > body1 * 0.5
        ):
            return PatternResult(
                name="morning_star",
                direction=PatternDirection.BULLISH,
                strength=PatternStrength.STRONG,
                candle_count=3,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.85 if vol_confirmed else 0.60,
                description="ستاره صبحگاهی - سیگنال قوی بازگشت صعودی",
            )
        return None

    def _detect_evening_star(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        o3: float,
        h3: float,
        l3: float,
        c3: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی ستاره شامگاهی

        سه کندل: اول صعودی بزرگ، دوم بدنه کوچک با گپ بالا،
        سوم نزولی بزرگ که پایین‌تر از نقطه میانی کندل اول بسته می‌شود.
        سیگنال قوی بازگشت نزولی است.

        پارامترها:
            idx: ایندکس ردیف کندل سوم
            o1..c3: قیمت‌های سه کندل
            ts: زمان کندل سوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)
        body2 = _body_size(o2, c2)
        body3 = _body_size(o3, c3)
        range1 = _candle_range(h1, l1)

        if range1 <= 0 or body1 <= 0:
            return None

        midpoint1 = _body_midpoint(o1, c1)
        star_gap = c1 * STAR_GAP_RATIO

        if (
            _is_bullish(o1, c1)
            and body2 / range1 < STAR_BODY_RATIO * 3
            and min(o2, c2) > c1 + star_gap
            and _is_bearish(o3, c3)
            and c3 < midpoint1
            and body3 > body1 * 0.5
        ):
            return PatternResult(
                name="evening_star",
                direction=PatternDirection.BEARISH,
                strength=PatternStrength.STRONG,
                candle_count=3,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.85 if vol_confirmed else 0.60,
                description="ستاره شامگاهی - سیگنال قوی بازگشت نزولی",
            )
        return None

    def _detect_three_white_soldiers(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        o3: float,
        h3: float,
        l3: float,
        c3: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی سه سرباز سفید

        سه کندل صعودی متوالی که هر کدام بالاتر از قبلی باز و بسته می‌شوند.
        بدنه‌ها باید بزرگ بوده و سایه بالایی کوچک داشته باشند.
        سیگنال قوی ادامه روند صعودی یا بازگشت از نزولی است.

        پارامترها:
            idx: ایندکس ردیف کندل سوم
            o1..c3: قیمت‌های سه کندل
            ts: زمان کندل سوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)
        body2 = _body_size(o2, c2)
        body3 = _body_size(o3, c3)
        range1 = _candle_range(h1, l1)
        range2 = _candle_range(h2, l2)
        range3 = _candle_range(h3, l3)

        if range1 <= 0 or range2 <= 0 or range3 <= 0:
            return None

        upper1 = _upper_shadow(o1, h1, c1)
        upper2 = _upper_shadow(o2, h2, c2)
        upper3 = _upper_shadow(o3, h3, c3)

        if (
            _is_bullish(o1, c1)
            and _is_bullish(o2, c2)
            and _is_bullish(o3, c3)
            and c2 > c1
            and c3 > c2
            and o2 >= o1
            and o3 >= o2
            and o2 <= c1
            and o3 <= c2
            and body1 / range1 > 0.5
            and body2 / range2 > 0.5
            and body3 / range3 > 0.5
            and upper1 < body1 * 0.3
            and upper2 < body2 * 0.3
            and upper3 < body3 * 0.3
        ):
            return PatternResult(
                name="three_white_soldiers",
                direction=PatternDirection.BULLISH,
                strength=PatternStrength.STRONG,
                candle_count=3,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.88 if vol_confirmed else 0.62,
                description="سه سرباز سفید - سیگنال بسیار قوی صعودی",
            )
        return None

    def _detect_three_black_crows(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        o3: float,
        h3: float,
        l3: float,
        c3: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی سه کلاغ سیاه

        سه کندل نزولی متوالی که هر کدام پایین‌تر از قبلی باز و بسته می‌شوند.
        بدنه‌ها باید بزرگ بوده و سایه پایینی کوچک داشته باشند.
        سیگنال قوی ادامه روند نزولی یا بازگشت از صعودی است.

        پارامترها:
            idx: ایندکس ردیف کندل سوم
            o1..c3: قیمت‌های سه کندل
            ts: زمان کندل سوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)
        body2 = _body_size(o2, c2)
        body3 = _body_size(o3, c3)
        range1 = _candle_range(h1, l1)
        range2 = _candle_range(h2, l2)
        range3 = _candle_range(h3, l3)

        if range1 <= 0 or range2 <= 0 or range3 <= 0:
            return None

        lower1 = _lower_shadow(o1, l1, c1)
        lower2 = _lower_shadow(o2, l2, c2)
        lower3 = _lower_shadow(o3, l3, c3)

        if (
            _is_bearish(o1, c1)
            and _is_bearish(o2, c2)
            and _is_bearish(o3, c3)
            and c2 < c1
            and c3 < c2
            and o2 <= o1
            and o3 <= o2
            and o2 >= c1
            and o3 >= c2
            and body1 / range1 > 0.5
            and body2 / range2 > 0.5
            and body3 / range3 > 0.5
            and lower1 < body1 * 0.3
            and lower2 < body2 * 0.3
            and lower3 < body3 * 0.3
        ):
            return PatternResult(
                name="three_black_crows",
                direction=PatternDirection.BEARISH,
                strength=PatternStrength.STRONG,
                candle_count=3,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.88 if vol_confirmed else 0.62,
                description="سه کلاغ سیاه - سیگنال بسیار قوی نزولی",
            )
        return None

    def _detect_three_inside_up(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        o3: float,
        h3: float,
        l3: float,
        c3: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی سه درون صعودی

        ترکیب هارامی صعودی با یک کندل تایید‌کننده.
        کندل اول نزولی بزرگ، دوم صعودی کوچک درون اول،
        سوم صعودی که بالاتر از سقف کندل اول بسته می‌شود.

        پارامترها:
            idx: ایندکس ردیف کندل سوم
            o1..c3: قیمت‌های سه کندل
            ts: زمان کندل سوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)
        body2 = _body_size(o2, c2)

        if body1 <= 0 or body2 <= 0:
            return None

        if (
            _is_bearish(o1, c1)
            and _is_bullish(o2, c2)
            and o2 >= c1
            and c2 <= o1
            and body2 < body1
            and _is_bullish(o3, c3)
            and c3 > o1
        ):
            return PatternResult(
                name="three_inside_up",
                direction=PatternDirection.BULLISH,
                strength=PatternStrength.STRONG,
                candle_count=3,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.82 if vol_confirmed else 0.58,
                description="سه درون صعودی - سیگنال قوی بازگشت صعودی",
            )
        return None

    def _detect_three_inside_down(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        o3: float,
        h3: float,
        l3: float,
        c3: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی سه درون نزولی

        ترکیب هارامی نزولی با یک کندل تایید‌کننده.
        کندل اول صعودی بزرگ، دوم نزولی کوچک درون اول،
        سوم نزولی که پایین‌تر از کف کندل اول بسته می‌شود.

        پارامترها:
            idx: ایندکس ردیف کندل سوم
            o1..c3: قیمت‌های سه کندل
            ts: زمان کندل سوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body1 = _body_size(o1, c1)
        body2 = _body_size(o2, c2)

        if body1 <= 0 or body2 <= 0:
            return None

        if (
            _is_bullish(o1, c1)
            and _is_bearish(o2, c2)
            and o2 <= c1
            and c2 >= o1
            and body2 < body1
            and _is_bearish(o3, c3)
            and c3 < o1
        ):
            return PatternResult(
                name="three_inside_down",
                direction=PatternDirection.BEARISH,
                strength=PatternStrength.STRONG,
                candle_count=3,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.82 if vol_confirmed else 0.58,
                description="سه درون نزولی - سیگنال قوی بازگشت نزولی",
            )
        return None

    def _detect_abandoned_baby_bullish(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        o3: float,
        h3: float,
        l3: float,
        c3: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی نوزاد رها شده صعودی

        الگوی نادر و بسیار قوی. شبیه ستاره صبحگاهی اما با گپ واقعی.
        کندل اول نزولی، کندل دوم دوجی با گپ پایین از اول و گپ بالا از سوم،
        کندل سوم صعودی بزرگ.

        پارامترها:
            idx: ایندکس ردیف کندل سوم
            o1..c3: قیمت‌های سه کندل
            ts: زمان کندل سوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body2 = _body_size(o2, c2)
        range2 = _candle_range(h2, l2)

        if range2 <= 0:
            return None

        body2_ratio = body2 / range2 if range2 > 0 else 1.0
        gap_threshold = l1 * ABANDONED_BABY_GAP_RATIO

        if (
            _is_bearish(o1, c1)
            and body2_ratio <= self._doji_threshold
            and h2 < l1 - gap_threshold
            and l3 > h2 + gap_threshold
            and _is_bullish(o3, c3)
        ):
            return PatternResult(
                name="abandoned_baby_bullish",
                direction=PatternDirection.BULLISH,
                strength=PatternStrength.STRONG,
                candle_count=3,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.92 if vol_confirmed else 0.68,
                description="نوزاد رها شده صعودی - سیگنال بسیار قوی بازگشت صعودی",
            )
        return None

    def _detect_abandoned_baby_bearish(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        o3: float,
        h3: float,
        l3: float,
        c3: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> Optional[PatternResult]:
        """شناسایی الگوی نوزاد رها شده نزولی

        الگوی نادر و بسیار قوی. شبیه ستاره شامگاهی اما با گپ واقعی.
        کندل اول صعودی، کندل دوم دوجی با گپ بالا از اول و گپ پایین از سوم،
        کندل سوم نزولی بزرگ.

        پارامترها:
            idx: ایندکس ردیف کندل سوم
            o1..c3: قیمت‌های سه کندل
            ts: زمان کندل سوم
            vol_confirmed: تایید حجم

        خروجی:
            نتیجه الگو یا None
        """
        body2 = _body_size(o2, c2)
        range2 = _candle_range(h2, l2)

        if range2 <= 0:
            return None

        body2_ratio = body2 / range2 if range2 > 0 else 1.0
        gap_threshold = h1 * ABANDONED_BABY_GAP_RATIO

        if (
            _is_bullish(o1, c1)
            and body2_ratio <= self._doji_threshold
            and l2 > h1 + gap_threshold
            and h3 < l2 - gap_threshold
            and _is_bearish(o3, c3)
        ):
            return PatternResult(
                name="abandoned_baby_bearish",
                direction=PatternDirection.BEARISH,
                strength=PatternStrength.STRONG,
                candle_count=3,
                index=idx,
                timestamp=ts,
                volume_confirmed=vol_confirmed,
                confidence=0.92 if vol_confirmed else 0.68,
                description="نوزاد رها شده نزولی - سیگنال بسیار قوی بازگشت نزولی",
            )
        return None

    # ═══════════════════ اسکن و تجمیع ═══════════════════

    def _scan_single_candle_patterns(
        self,
        idx: int,
        o: float,
        h: float,
        l: float,
        c: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> list[PatternResult]:
        """اسکن تمام الگوهای تک‌کندلی روی یک کندل

        هر کندل را برای تمامی الگوهای تک‌کندلی بررسی کرده
        و لیست الگوهای شناسایی‌شده را برمی‌گرداند.

        پارامترها:
            idx: ایندکس ردیف
            o, h, l, c: قیمت‌های کندل
            ts: زمان کندل
            vol_confirmed: تایید حجم

        خروجی:
            لیست الگوهای شناسایی‌شده
        """
        results: list[PatternResult] = []

        detectors = [
            self._detect_doji,
            self._detect_hammer,
            self._detect_inverted_hammer,
            self._detect_shooting_star,
            self._detect_spinning_top,
            self._detect_marubozu,
            self._detect_hanging_man,
        ]

        for detector in detectors:
            result = detector(idx, o, h, l, c, ts, vol_confirmed)
            if result is not None:
                results.append(result)

        return results

    def _scan_double_candle_patterns(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> list[PatternResult]:
        """اسکن تمام الگوهای دو‌کندلی

        دو کندل متوالی را برای تمامی الگوهای دو‌کندلی بررسی کرده
        و لیست الگوهای شناسایی‌شده را برمی‌گرداند.

        پارامترها:
            idx: ایندکس ردیف کندل دوم
            o1..c2: قیمت‌های دو کندل
            ts: زمان کندل دوم
            vol_confirmed: تایید حجم

        خروجی:
            لیست الگوهای شناسایی‌شده
        """
        results: list[PatternResult] = []

        detectors = [
            self._detect_bullish_engulfing,
            self._detect_bearish_engulfing,
            self._detect_tweezer_top,
            self._detect_tweezer_bottom,
            self._detect_bullish_harami,
            self._detect_bearish_harami,
            self._detect_piercing_line,
            self._detect_dark_cloud_cover,
        ]

        for detector in detectors:
            result = detector(
                idx, o1, h1, l1, c1, o2, h2, l2, c2, ts, vol_confirmed
            )
            if result is not None:
                results.append(result)

        return results

    def _scan_triple_candle_patterns(
        self,
        idx: int,
        o1: float,
        h1: float,
        l1: float,
        c1: float,
        o2: float,
        h2: float,
        l2: float,
        c2: float,
        o3: float,
        h3: float,
        l3: float,
        c3: float,
        ts: pd.Timestamp,
        vol_confirmed: bool,
    ) -> list[PatternResult]:
        """اسکن تمام الگوهای سه‌کندلی

        سه کندل متوالی را برای تمامی الگوهای سه‌کندلی بررسی کرده
        و لیست الگوهای شناسایی‌شده را برمی‌گرداند.

        پارامترها:
            idx: ایندکس ردیف کندل سوم
            o1..c3: قیمت‌های سه کندل
            ts: زمان کندل سوم
            vol_confirmed: تایید حجم

        خروجی:
            لیست الگوهای شناسایی‌شده
        """
        results: list[PatternResult] = []

        detectors = [
            self._detect_morning_star,
            self._detect_evening_star,
            self._detect_three_white_soldiers,
            self._detect_three_black_crows,
            self._detect_three_inside_up,
            self._detect_three_inside_down,
            self._detect_abandoned_baby_bullish,
            self._detect_abandoned_baby_bearish,
        ]

        for detector in detectors:
            result = detector(
                idx,
                o1, h1, l1, c1,
                o2, h2, l2, c2,
                o3, h3, l3, c3,
                ts, vol_confirmed,
            )
            if result is not None:
                results.append(result)

        return results

    def _calculate_pattern_score(
        self,
        patterns: list[PatternResult],
        bullish_count: int,
        bearish_count: int,
    ) -> int:
        """محاسبه امتیاز نهایی الگوها

        امتیاز بر اساس وزن الگوها، تعداد، جهت و تایید حجم محاسبه می‌شود.
        امتیاز ۵۰ یعنی خنثی، بالاتر صعودی و پایین‌تر نزولی.

        پارامترها:
            patterns: لیست الگوهای شناسایی‌شده
            bullish_count: تعداد الگوهای صعودی
            bearish_count: تعداد الگوهای نزولی

        خروجی:
            امتیاز ۰ تا ۱۰۰
        """
        if not patterns:
            return 50  # خنثی

        bullish_score: float = 0.0
        bearish_score: float = 0.0
        total_weight: float = 0.0

        for pattern in patterns:
            weight = self.PATTERN_WEIGHTS.get(pattern.name, 5.0)

            # ضریب تایید حجم
            volume_multiplier = 1.5 if pattern.volume_confirmed else 0.8

            weighted_value = weight * volume_multiplier * pattern.confidence

            if pattern.direction == PatternDirection.BULLISH:
                bullish_score += weighted_value
            elif pattern.direction == PatternDirection.BEARISH:
                bearish_score += weighted_value

            total_weight += weight

        if total_weight <= 0:
            return 50

        # محاسبه امتیاز نرمال‌شده
        net_score = bullish_score - bearish_score
        max_possible = total_weight * 1.5 * 1.0  # حداکثر ممکن

        if max_possible <= 0:
            return 50

        # تبدیل به بازه ۰ تا ۱۰۰ با مرکز ۵۰
        normalized = (net_score / max_possible) * 50.0
        score = int(np.clip(50 + normalized, 0, 100))

        return score

    def analyze(self, df: pd.DataFrame) -> dict:
        """تحلیل کامل الگوهای کندل‌استیک

        دیتافریم ورودی را بررسی کرده و تمام الگوهای تک‌کندلی، دو‌کندلی
        و سه‌کندلی را شناسایی می‌کند. هر الگو با حجم معاملات تایید شده
        و امتیاز نهایی محاسبه می‌شود.

        پارامترها:
            df: دیتافریم پانداس با ستون‌های
                [timestamp, open, high, low, close, volume]

        خروجی:
            دیکشنری شامل:
                - patterns_found: لیست الگوهای شناسایی‌شده با جزئیات
                - pattern_score: امتیاز ۰ تا ۱۰۰ (بالاتر از ۵۰ صعودی، پایین‌تر نزولی)
                - bullish_count: تعداد الگوهای صعودی
                - bearish_count: تعداد الگوهای نزولی
        """
        result = AnalysisResult()

        if not self._validate_dataframe(df):
            logger.warning("analysis_skipped_invalid_dataframe")
            return result.to_dict()

        # کپی برای جلوگیری از تغییرات ناخواسته
        df_work = df.copy().reset_index(drop=True)
        total_rows = len(df_work)

        # محاسبه میانگین حجم
        volume_avg = self._compute_volume_avg(df_work)

        # استخراج آرایه‌های numpy برای سرعت بالاتر
        opens: np.ndarray = df_work["open"].to_numpy(dtype=np.float64)
        highs: np.ndarray = df_work["high"].to_numpy(dtype=np.float64)
        lows: np.ndarray = df_work["low"].to_numpy(dtype=np.float64)
        closes: np.ndarray = df_work["close"].to_numpy(dtype=np.float64)
        volumes: np.ndarray = df_work["volume"].to_numpy(dtype=np.float64)
        timestamps: np.ndarray = df_work["timestamp"].values
        vol_avgs: np.ndarray = volume_avg.to_numpy(dtype=np.float64)

        all_patterns: list[PatternResult] = []

        logger.debug(
            "starting_pattern_scan",
            total_candles=total_rows,
        )

        for i in range(total_rows):
            o_i = float(opens[i])
            h_i = float(highs[i])
            l_i = float(lows[i])
            c_i = float(closes[i])
            ts_i = pd.Timestamp(timestamps[i])
            vol_conf_i = self._is_volume_confirmed(
                float(volumes[i]), float(vol_avgs[i])
            )

            # ── الگوهای تک‌کندلی ──
            single_patterns = self._scan_single_candle_patterns(
                i, o_i, h_i, l_i, c_i, ts_i, vol_conf_i
            )
            all_patterns.extend(single_patterns)

            # ── الگوهای دو‌کندلی ──
            if i >= 1:
                o_prev = float(opens[i - 1])
                h_prev = float(highs[i - 1])
                l_prev = float(lows[i - 1])
                c_prev = float(closes[i - 1])

                double_patterns = self._scan_double_candle_patterns(
                    i,
                    o_prev, h_prev, l_prev, c_prev,
                    o_i, h_i, l_i, c_i,
                    ts_i, vol_conf_i,
                )
                all_patterns.extend(double_patterns)

            # ── الگوهای سه‌کندلی ──
            if i >= 2:
                o_pp = float(opens[i - 2])
                h_pp = float(highs[i - 2])
                l_pp = float(lows[i - 2])
                c_pp = float(closes[i - 2])
                o_prev = float(opens[i - 1])
                h_prev = float(highs[i - 1])
                l_prev = float(lows[i - 1])
                c_prev = float(closes[i - 1])

                triple_patterns = self._scan_triple_candle_patterns(
                    i,
                    o_pp, h_pp, l_pp, c_pp,
                    o_prev, h_prev, l_prev, c_prev,
                    o_i, h_i, l_i, c_i,
                    ts_i, vol_conf_i,
                )
                all_patterns.extend(triple_patterns)

        # شمارش جهت الگوها
        bullish_count = sum(
            1 for p in all_patterns if p.direction == PatternDirection.BULLISH
        )
        bearish_count = sum(
            1 for p in all_patterns if p.direction == PatternDirection.BEARISH
        )

        # محاسبه امتیاز
        pattern_score = self._calculate_pattern_score(
            all_patterns, bullish_count, bearish_count
        )

        result.patterns_found = [p.to_dict() for p in all_patterns]
        result.pattern_score = pattern_score
        result.bullish_count = bullish_count
        result.bearish_count = bearish_count

        logger.info(
            "candlestick_analysis_complete",
            total_patterns=len(all_patterns),
            bullish=bullish_count,
            bearish=bearish_count,
            neutral=len(all_patterns) - bullish_count - bearish_count,
            score=pattern_score,
        )

        return result.to_dict()
