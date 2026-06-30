"""
ماژول تشخیص الگوهای نموداری برای پلتفرم سیگنال فارکس.

این ماژول الگوهای بازگشتی و ادامه‌دهنده را با استفاده از
تحلیل هندسی قله‌ها و دره‌ها شناسایی می‌کند.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np
import pandas as pd
from scipy.signal import argrelextrema

from src.core.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# ثوابت و تنظیمات
# ---------------------------------------------------------------------------

# تعداد کندل‌های اطراف برای تشخیص قله/دره محلی
DEFAULT_EXTREMA_ORDER: int = 5

# حداقل تعداد کندل مورد نیاز برای تحلیل
MIN_CANDLES_REQUIRED: int = 50

# آستانه تقریب قیمتی (درصد) - دو سطح قیمتی زیر این درصد «تقریبا برابر» تلقی می‌شوند
PRICE_TOLERANCE_PCT: float = 0.3

# حداقل فاصله بین نقاط الگو (تعداد کندل)
MIN_PATTERN_SPACING: int = 5

# حداکثر فاصله بین نقاط الگو (تعداد کندل)
MAX_PATTERN_SPACING: int = 200


class PatternType(str, Enum):
    """انواع الگوهای نموداری"""

    HEAD_AND_SHOULDERS = "head_and_shoulders"
    INVERSE_HEAD_AND_SHOULDERS = "inverse_head_and_shoulders"
    DOUBLE_TOP = "double_top"
    DOUBLE_BOTTOM = "double_bottom"
    TRIPLE_TOP = "triple_top"
    TRIPLE_BOTTOM = "triple_bottom"
    ROUNDING_TOP = "rounding_top"
    ROUNDING_BOTTOM = "rounding_bottom"
    ASCENDING_TRIANGLE = "ascending_triangle"
    DESCENDING_TRIANGLE = "descending_triangle"
    SYMMETRICAL_TRIANGLE = "symmetrical_triangle"
    BULL_FLAG = "bull_flag"
    BEAR_FLAG = "bear_flag"
    PENNANT = "pennant"
    RECTANGLE = "rectangle"
    RISING_WEDGE = "rising_wedge"
    FALLING_WEDGE = "falling_wedge"


class Direction(str, Enum):
    """جهت‌گیری الگو"""

    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


# نگاشت هر الگو به جهت ذاتی آن
_PATTERN_DIRECTION: dict[PatternType, Direction] = {
    PatternType.HEAD_AND_SHOULDERS: Direction.BEARISH,
    PatternType.INVERSE_HEAD_AND_SHOULDERS: Direction.BULLISH,
    PatternType.DOUBLE_TOP: Direction.BEARISH,
    PatternType.DOUBLE_BOTTOM: Direction.BULLISH,
    PatternType.TRIPLE_TOP: Direction.BEARISH,
    PatternType.TRIPLE_BOTTOM: Direction.BULLISH,
    PatternType.ROUNDING_TOP: Direction.BEARISH,
    PatternType.ROUNDING_BOTTOM: Direction.BULLISH,
    PatternType.ASCENDING_TRIANGLE: Direction.BULLISH,
    PatternType.DESCENDING_TRIANGLE: Direction.BEARISH,
    PatternType.SYMMETRICAL_TRIANGLE: Direction.NEUTRAL,
    PatternType.BULL_FLAG: Direction.BULLISH,
    PatternType.BEAR_FLAG: Direction.BEARISH,
    PatternType.PENNANT: Direction.NEUTRAL,
    PatternType.RECTANGLE: Direction.NEUTRAL,
    PatternType.RISING_WEDGE: Direction.BEARISH,
    PatternType.FALLING_WEDGE: Direction.BULLISH,
}


@dataclass
class DetectedPattern:
    """ساختار داده برای یک الگوی شناسایی‌شده"""

    pattern_type: PatternType
    direction: Direction
    start_index: int
    end_index: int
    breakout_price: float
    target_price: float
    confidence: float
    key_levels: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        """تبدیل الگو به دیکشنری"""
        return {
            "pattern_type": self.pattern_type.value,
            "direction": self.direction.value,
            "start_index": self.start_index,
            "end_index": self.end_index,
            "breakout_price": round(self.breakout_price, 5),
            "target_price": round(self.target_price, 5),
            "confidence": round(self.confidence, 1),
            "key_levels": {k: round(v, 5) for k, v in self.key_levels.items()},
        }


# ---------------------------------------------------------------------------
# توابع کمکی
# ---------------------------------------------------------------------------


def _prices_approx_equal(a: float, b: float, tol_pct: float = PRICE_TOLERANCE_PCT) -> bool:
    """بررسی تقریبا برابر بودن دو قیمت بر اساس درصد تلرانس"""
    if a == 0 and b == 0:
        return True
    ref = max(abs(a), abs(b))
    if ref == 0:
        return True
    return abs(a - b) / ref * 100 <= tol_pct


def _slope(y1: float, y2: float, x_span: int) -> float:
    """محاسبه شیب بین دو نقطه (واحد: تغییر قیمت بر کندل)"""
    if x_span == 0:
        return 0.0
    return (y2 - y1) / x_span


def _linear_regression_slope(prices: np.ndarray) -> float:
    """محاسبه شیب رگرسیون خطی روی آرایه قیمت"""
    if len(prices) < 2:
        return 0.0
    x = np.arange(len(prices), dtype=np.float64)
    coeffs = np.polyfit(x, prices.astype(np.float64), 1)
    return float(coeffs[0])


def _fit_line(indices: np.ndarray, values: np.ndarray) -> tuple[float, float]:
    """
    برازش خط روی مجموعه نقاط.

    خروجی: (شیب, عرض از مبدا)
    """
    if len(indices) < 2:
        return 0.0, float(values[0]) if len(values) else 0.0
    coeffs = np.polyfit(indices.astype(np.float64), values.astype(np.float64), 1)
    return float(coeffs[0]), float(coeffs[1])


def _r_squared(indices: np.ndarray, values: np.ndarray, slope: float, intercept: float) -> float:
    """محاسبه ضریب تعیین (R-squared) برای خط برازش‌شده"""
    if len(values) < 2:
        return 0.0
    predicted = slope * indices.astype(np.float64) + intercept
    ss_res = np.sum((values.astype(np.float64) - predicted) ** 2)
    ss_tot = np.sum((values.astype(np.float64) - np.mean(values.astype(np.float64))) ** 2)
    if ss_tot == 0:
        return 1.0
    return float(1.0 - ss_res / ss_tot)


# ---------------------------------------------------------------------------
# کلاس اصلی تحلیلگر
# ---------------------------------------------------------------------------


class ChartPatternAnalyzer:
    """
    تحلیلگر الگوهای نموداری.

    این کلاس با استفاده از تشخیص قله و دره (scipy) و قوانین هندسی،
    الگوهای بازگشتی و ادامه‌دهنده را در داده‌های کندل‌استیک شناسایی می‌کند.
    """

    def __init__(
        self,
        extrema_order: int = DEFAULT_EXTREMA_ORDER,
        price_tolerance_pct: float = PRICE_TOLERANCE_PCT,
        min_pattern_spacing: int = MIN_PATTERN_SPACING,
        max_pattern_spacing: int = MAX_PATTERN_SPACING,
    ) -> None:
        """
        مقداردهی اولیه تحلیلگر الگوها.

        پارامترها:
            extrema_order: تعداد کندل‌های اطراف برای تشخیص قله/دره
            price_tolerance_pct: آستانه تقریب قیمتی (درصد)
            min_pattern_spacing: حداقل فاصله بین نقاط الگو
            max_pattern_spacing: حداکثر فاصله بین نقاط الگو
        """
        self.extrema_order = extrema_order
        self.price_tolerance_pct = price_tolerance_pct
        self.min_pattern_spacing = min_pattern_spacing
        self.max_pattern_spacing = max_pattern_spacing

    # ------------------------------------------------------------------
    # تشخیص قله‌ها و دره‌ها
    # ------------------------------------------------------------------

    def _find_peaks_and_valleys(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        یافتن اندیس قله‌ها و دره‌های محلی.

        از scipy.signal.argrelextrema با مرتبه‌های مختلف استفاده می‌شود
        تا هم الگوهای کوچک و هم بزرگ شناسایی شوند.

        خروجی:
            (آرایه اندیس قله‌ها, آرایه اندیس دره‌ها)
        """
        peak_indices_set: set[int] = set()
        valley_indices_set: set[int] = set()

        for order in range(max(2, self.extrema_order - 2), self.extrema_order + 3):
            if order < 1:
                continue
            peaks = argrelextrema(highs, np.greater, order=order)[0]
            valleys = argrelextrema(lows, np.less, order=order)[0]
            peak_indices_set.update(peaks.tolist())
            valley_indices_set.update(valleys.tolist())

        peak_indices = np.array(sorted(peak_indices_set), dtype=np.int64)
        valley_indices = np.array(sorted(valley_indices_set), dtype=np.int64)

        logger.debug(
            "extrema_detected",
            peaks_count=len(peak_indices),
            valleys_count=len(valley_indices),
        )
        return peak_indices, valley_indices

    # ------------------------------------------------------------------
    # اعتبارسنجی ورودی
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_dataframe(df: pd.DataFrame) -> bool:
        """
        اعتبارسنجی ستون‌های لازم در دیتافریم.

        اگر ستون‌های مورد نیاز وجود نداشته باشند False برمی‌گرداند.
        """
        required = {"timestamp", "open", "high", "low", "close", "volume"}
        missing = required - set(df.columns)
        if missing:
            logger.error("missing_columns", missing=list(missing))
            return False
        return True

    # ------------------------------------------------------------------
    # کمک‌توابع فاصله و تلرانس
    # ------------------------------------------------------------------

    def _valid_spacing(self, idx_a: int, idx_b: int) -> bool:
        """بررسی فاصله مجاز بین دو نقطه الگو"""
        gap = abs(idx_b - idx_a)
        return self.min_pattern_spacing <= gap <= self.max_pattern_spacing

    def _approx_equal(self, a: float, b: float) -> bool:
        """بررسی تقریبا برابر بودن دو قیمت"""
        return _prices_approx_equal(a, b, self.price_tolerance_pct)

    # ------------------------------------------------------------------
    # الگوهای بازگشتی — سر و شانه
    # ------------------------------------------------------------------

    def _detect_head_and_shoulders(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوی سر و شانه (نزولی).

        شرایط:
        - سه قله متوالی: شانه چپ، سر (بالاتر)، شانه راست
        - بین قله‌ها دو دره (خط گردن)
        - شانه چپ و راست تقریبا هم‌سطح
        - شکست خط گردن به سمت پایین

        هدف: فاصله سر تا خط گردن از نقطه شکست کم می‌شود
        """
        patterns: list[DetectedPattern] = []

        if len(peak_indices) < 3 or len(valley_indices) < 2:
            return patterns

        for i in range(len(peak_indices) - 2):
            left_shoulder_idx = peak_indices[i]
            head_idx = peak_indices[i + 1]
            right_shoulder_idx = peak_indices[i + 2]

            left_shoulder_price = float(highs[left_shoulder_idx])
            head_price = float(highs[head_idx])
            right_shoulder_price = float(highs[right_shoulder_idx])

            # سر باید بالاتر از هر دو شانه باشد
            if head_price <= left_shoulder_price or head_price <= right_shoulder_price:
                continue

            # شانه‌ها تقریبا هم‌سطح
            if not self._approx_equal(left_shoulder_price, right_shoulder_price):
                # تلرانس بیشتر برای شانه‌ها — تا ۲ برابر
                if not _prices_approx_equal(
                    left_shoulder_price, right_shoulder_price, self.price_tolerance_pct * 2
                ):
                    continue

            # فاصله‌ها مجاز
            if not self._valid_spacing(left_shoulder_idx, head_idx):
                continue
            if not self._valid_spacing(head_idx, right_shoulder_idx):
                continue

            # دره‌های بین قله‌ها (خط گردن)
            neckline_valleys_left = valley_indices[
                (valley_indices > left_shoulder_idx) & (valley_indices < head_idx)
            ]
            neckline_valleys_right = valley_indices[
                (valley_indices > head_idx) & (valley_indices < right_shoulder_idx)
            ]

            if len(neckline_valleys_left) == 0 or len(neckline_valleys_right) == 0:
                continue

            nl_left_idx = int(neckline_valleys_left[np.argmin(lows[neckline_valleys_left])])
            nl_right_idx = int(neckline_valleys_right[np.argmin(lows[neckline_valleys_right])])

            nl_left_price = float(lows[nl_left_idx])
            nl_right_price = float(lows[nl_right_idx])

            # محاسبه خط گردن در نقطه شکست (اندیس شانه راست)
            nl_slope = _slope(nl_left_price, nl_right_price, nl_right_idx - nl_left_idx)
            neckline_at_breakout = nl_right_price + nl_slope * (
                right_shoulder_idx - nl_right_idx
            )

            # ارتفاع الگو
            pattern_height = head_price - min(nl_left_price, nl_right_price)

            # هدف قیمتی
            target_price = neckline_at_breakout - pattern_height

            # سطح اطمینان
            confidence = self._hs_confidence(
                left_shoulder_price,
                head_price,
                right_shoulder_price,
                nl_left_price,
                nl_right_price,
                closes,
                right_shoulder_idx,
                neckline_at_breakout,
            )

            patterns.append(
                DetectedPattern(
                    pattern_type=PatternType.HEAD_AND_SHOULDERS,
                    direction=Direction.BEARISH,
                    start_index=int(left_shoulder_idx),
                    end_index=int(right_shoulder_idx),
                    breakout_price=round(neckline_at_breakout, 5),
                    target_price=round(target_price, 5),
                    confidence=confidence,
                    key_levels={
                        "left_shoulder": left_shoulder_price,
                        "head": head_price,
                        "right_shoulder": right_shoulder_price,
                        "neckline_left": nl_left_price,
                        "neckline_right": nl_right_price,
                    },
                )
            )

        return patterns

    def _detect_inverse_head_and_shoulders(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوی سر و شانه معکوس (صعودی).

        شرایط:
        - سه دره متوالی: شانه چپ، سر (پایین‌تر)، شانه راست
        - بین دره‌ها دو قله (خط گردن)
        - شکست خط گردن به سمت بالا

        هدف: فاصله سر تا خط گردن از نقطه شکست اضافه می‌شود
        """
        patterns: list[DetectedPattern] = []

        if len(valley_indices) < 3 or len(peak_indices) < 2:
            return patterns

        for i in range(len(valley_indices) - 2):
            left_shoulder_idx = valley_indices[i]
            head_idx = valley_indices[i + 1]
            right_shoulder_idx = valley_indices[i + 2]

            left_shoulder_price = float(lows[left_shoulder_idx])
            head_price = float(lows[head_idx])
            right_shoulder_price = float(lows[right_shoulder_idx])

            # سر باید پایین‌تر از هر دو شانه باشد
            if head_price >= left_shoulder_price or head_price >= right_shoulder_price:
                continue

            # شانه‌ها تقریبا هم‌سطح
            if not _prices_approx_equal(
                left_shoulder_price, right_shoulder_price, self.price_tolerance_pct * 2
            ):
                continue

            if not self._valid_spacing(left_shoulder_idx, head_idx):
                continue
            if not self._valid_spacing(head_idx, right_shoulder_idx):
                continue

            # قله‌های بین دره‌ها (خط گردن)
            nl_peaks_left = peak_indices[
                (peak_indices > left_shoulder_idx) & (peak_indices < head_idx)
            ]
            nl_peaks_right = peak_indices[
                (peak_indices > head_idx) & (peak_indices < right_shoulder_idx)
            ]

            if len(nl_peaks_left) == 0 or len(nl_peaks_right) == 0:
                continue

            nl_left_idx = int(nl_peaks_left[np.argmax(highs[nl_peaks_left])])
            nl_right_idx = int(nl_peaks_right[np.argmax(highs[nl_peaks_right])])

            nl_left_price = float(highs[nl_left_idx])
            nl_right_price = float(highs[nl_right_idx])

            nl_slope = _slope(nl_left_price, nl_right_price, nl_right_idx - nl_left_idx)
            neckline_at_breakout = nl_right_price + nl_slope * (
                right_shoulder_idx - nl_right_idx
            )

            pattern_height = max(nl_left_price, nl_right_price) - head_price
            target_price = neckline_at_breakout + pattern_height

            confidence = self._hs_confidence(
                left_shoulder_price,
                head_price,
                right_shoulder_price,
                nl_left_price,
                nl_right_price,
                closes,
                right_shoulder_idx,
                neckline_at_breakout,
                inverse=True,
            )

            patterns.append(
                DetectedPattern(
                    pattern_type=PatternType.INVERSE_HEAD_AND_SHOULDERS,
                    direction=Direction.BULLISH,
                    start_index=int(left_shoulder_idx),
                    end_index=int(right_shoulder_idx),
                    breakout_price=round(neckline_at_breakout, 5),
                    target_price=round(target_price, 5),
                    confidence=confidence,
                    key_levels={
                        "left_shoulder": left_shoulder_price,
                        "head": head_price,
                        "right_shoulder": right_shoulder_price,
                        "neckline_left": nl_left_price,
                        "neckline_right": nl_right_price,
                    },
                )
            )

        return patterns

    def _hs_confidence(
        self,
        left_shoulder: float,
        head: float,
        right_shoulder: float,
        nl_left: float,
        nl_right: float,
        closes: np.ndarray,
        end_idx: int,
        neckline_at_breakout: float,
        inverse: bool = False,
    ) -> float:
        """
        محاسبه سطح اطمینان الگوی سر و شانه.

        معیارها:
        - تقارن شانه‌ها (۲۵ امتیاز)
        - افقی بودن خط گردن (۲۰ امتیاز)
        - نسبت ارتفاع سر به شانه (۲۰ امتیاز)
        - حجم تاییدی (اگر موجود) (۱۵ امتیاز)
        - نزدیکی قیمت فعلی به خط شکست (۲۰ امتیاز)
        """
        score = 0.0

        # تقارن شانه‌ها
        ref = max(abs(left_shoulder), abs(right_shoulder), 1e-10)
        symmetry = 1.0 - abs(left_shoulder - right_shoulder) / ref
        score += symmetry * 25.0

        # افقی بودن خط گردن
        nl_ref = max(abs(nl_left), abs(nl_right), 1e-10)
        nl_flatness = 1.0 - abs(nl_left - nl_right) / nl_ref
        score += nl_flatness * 20.0

        # نسبت ارتفاع
        shoulder_avg = (left_shoulder + right_shoulder) / 2.0
        if not inverse:
            head_ratio = (head - shoulder_avg) / max(shoulder_avg, 1e-10)
        else:
            head_ratio = (shoulder_avg - head) / max(abs(head), 1e-10)
        # ایده‌آل: نسبت بین ۰.۰۲ تا ۰.۱
        if 0.02 <= head_ratio <= 0.1:
            score += 20.0
        elif head_ratio > 0:
            score += max(0.0, 20.0 - abs(head_ratio - 0.06) * 200)

        # نزدیکی قیمت فعلی به نقطه شکست
        if end_idx < len(closes):
            current = float(closes[min(end_idx, len(closes) - 1)])
            dist = abs(current - neckline_at_breakout) / max(neckline_at_breakout, 1e-10)
            proximity = max(0.0, 1.0 - dist * 20)
            score += proximity * 20.0

        # امتیاز پایه ساختاری
        score += 15.0

        return min(100.0, max(0.0, score))

    # ------------------------------------------------------------------
    # الگوهای بازگشتی — سقف/کف دوقلو
    # ------------------------------------------------------------------

    def _detect_double_top(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوی سقف دوقلو (نزولی).

        شرایط:
        - دو قله تقریبا هم‌سطح با یک دره بین آن‌ها
        - شکست دره (حمایت) به سمت پایین
        - هدف: فاصله قله تا دره از نقطه شکست کم می‌شود
        """
        patterns: list[DetectedPattern] = []

        if len(peak_indices) < 2:
            return patterns

        for i in range(len(peak_indices) - 1):
            p1_idx = peak_indices[i]
            p2_idx = peak_indices[i + 1]

            p1_price = float(highs[p1_idx])
            p2_price = float(highs[p2_idx])

            if not self._approx_equal(p1_price, p2_price):
                continue

            if not self._valid_spacing(p1_idx, p2_idx):
                continue

            # دره بین دو قله
            between_valleys = valley_indices[
                (valley_indices > p1_idx) & (valley_indices < p2_idx)
            ]
            if len(between_valleys) == 0:
                continue

            trough_idx = int(between_valleys[np.argmin(lows[between_valleys])])
            trough_price = float(lows[trough_idx])

            pattern_height = max(p1_price, p2_price) - trough_price
            if pattern_height <= 0:
                continue

            target_price = trough_price - pattern_height

            # اطمینان
            symmetry = 1.0 - abs(p1_price - p2_price) / max(p1_price, 1e-10)
            current_price = float(closes[min(int(p2_idx), len(closes) - 1)])
            dist = abs(current_price - trough_price) / max(trough_price, 1e-10)
            proximity = max(0.0, 1.0 - dist * 15)
            confidence = min(100.0, symmetry * 40 + proximity * 30 + 30)

            patterns.append(
                DetectedPattern(
                    pattern_type=PatternType.DOUBLE_TOP,
                    direction=Direction.BEARISH,
                    start_index=int(p1_idx),
                    end_index=int(p2_idx),
                    breakout_price=round(trough_price, 5),
                    target_price=round(target_price, 5),
                    confidence=confidence,
                    key_levels={
                        "top_1": p1_price,
                        "top_2": p2_price,
                        "support": trough_price,
                    },
                )
            )

        return patterns

    def _detect_double_bottom(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوی کف دوقلو (صعودی).

        شرایط:
        - دو دره تقریبا هم‌سطح با یک قله بین آن‌ها
        - شکست قله (مقاومت) به سمت بالا
        - هدف: فاصله دره تا قله از نقطه شکست اضافه می‌شود
        """
        patterns: list[DetectedPattern] = []

        if len(valley_indices) < 2:
            return patterns

        for i in range(len(valley_indices) - 1):
            v1_idx = valley_indices[i]
            v2_idx = valley_indices[i + 1]

            v1_price = float(lows[v1_idx])
            v2_price = float(lows[v2_idx])

            if not self._approx_equal(v1_price, v2_price):
                continue

            if not self._valid_spacing(v1_idx, v2_idx):
                continue

            between_peaks = peak_indices[
                (peak_indices > v1_idx) & (peak_indices < v2_idx)
            ]
            if len(between_peaks) == 0:
                continue

            crest_idx = int(between_peaks[np.argmax(highs[between_peaks])])
            crest_price = float(highs[crest_idx])

            pattern_height = crest_price - min(v1_price, v2_price)
            if pattern_height <= 0:
                continue

            target_price = crest_price + pattern_height

            symmetry = 1.0 - abs(v1_price - v2_price) / max(abs(v1_price), 1e-10)
            current_price = float(closes[min(int(v2_idx), len(closes) - 1)])
            dist = abs(current_price - crest_price) / max(crest_price, 1e-10)
            proximity = max(0.0, 1.0 - dist * 15)
            confidence = min(100.0, symmetry * 40 + proximity * 30 + 30)

            patterns.append(
                DetectedPattern(
                    pattern_type=PatternType.DOUBLE_BOTTOM,
                    direction=Direction.BULLISH,
                    start_index=int(v1_idx),
                    end_index=int(v2_idx),
                    breakout_price=round(crest_price, 5),
                    target_price=round(target_price, 5),
                    confidence=confidence,
                    key_levels={
                        "bottom_1": v1_price,
                        "bottom_2": v2_price,
                        "resistance": crest_price,
                    },
                )
            )

        return patterns

    # ------------------------------------------------------------------
    # الگوهای بازگشتی — سقف/کف سه‌قلو
    # ------------------------------------------------------------------

    def _detect_triple_top(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوی سقف سه‌قلو (نزولی).

        شرایط:
        - سه قله تقریبا هم‌سطح
        - دو دره بین آن‌ها به عنوان حمایت
        - شکست حمایت به سمت پایین

        هدف: فاصله قله تا حمایت از نقطه شکست کم می‌شود
        """
        patterns: list[DetectedPattern] = []

        if len(peak_indices) < 3:
            return patterns

        for i in range(len(peak_indices) - 2):
            p1_idx, p2_idx, p3_idx = peak_indices[i], peak_indices[i + 1], peak_indices[i + 2]
            p1, p2, p3 = float(highs[p1_idx]), float(highs[p2_idx]), float(highs[p3_idx])

            # سه قله تقریبا هم‌سطح
            avg_top = (p1 + p2 + p3) / 3.0
            tol = avg_top * self.price_tolerance_pct / 100.0
            if abs(p1 - avg_top) > tol or abs(p2 - avg_top) > tol or abs(p3 - avg_top) > tol:
                continue

            if not self._valid_spacing(p1_idx, p2_idx) or not self._valid_spacing(p2_idx, p3_idx):
                continue

            # دره‌های بین قله‌ها
            v_between_12 = valley_indices[(valley_indices > p1_idx) & (valley_indices < p2_idx)]
            v_between_23 = valley_indices[(valley_indices > p2_idx) & (valley_indices < p3_idx)]

            if len(v_between_12) == 0 or len(v_between_23) == 0:
                continue

            t1_idx = int(v_between_12[np.argmin(lows[v_between_12])])
            t2_idx = int(v_between_23[np.argmin(lows[v_between_23])])
            support = min(float(lows[t1_idx]), float(lows[t2_idx]))

            pattern_height = avg_top - support
            if pattern_height <= 0:
                continue

            target_price = support - pattern_height

            spread = max(abs(p1 - avg_top), abs(p2 - avg_top), abs(p3 - avg_top))
            uniformity = 1.0 - spread / max(avg_top, 1e-10)
            confidence = min(100.0, uniformity * 50 + 50)

            patterns.append(
                DetectedPattern(
                    pattern_type=PatternType.TRIPLE_TOP,
                    direction=Direction.BEARISH,
                    start_index=int(p1_idx),
                    end_index=int(p3_idx),
                    breakout_price=round(support, 5),
                    target_price=round(target_price, 5),
                    confidence=confidence,
                    key_levels={
                        "top_1": p1,
                        "top_2": p2,
                        "top_3": p3,
                        "support": support,
                    },
                )
            )

        return patterns

    def _detect_triple_bottom(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوی کف سه‌قلو (صعودی).

        شرایط:
        - سه دره تقریبا هم‌سطح
        - دو قله بین آن‌ها به عنوان مقاومت
        - شکست مقاومت به سمت بالا

        هدف: فاصله دره تا مقاومت از نقطه شکست اضافه می‌شود
        """
        patterns: list[DetectedPattern] = []

        if len(valley_indices) < 3:
            return patterns

        for i in range(len(valley_indices) - 2):
            v1_idx, v2_idx, v3_idx = (
                valley_indices[i],
                valley_indices[i + 1],
                valley_indices[i + 2],
            )
            v1, v2, v3 = float(lows[v1_idx]), float(lows[v2_idx]), float(lows[v3_idx])

            avg_bottom = (v1 + v2 + v3) / 3.0
            tol = avg_bottom * self.price_tolerance_pct / 100.0
            if abs(v1 - avg_bottom) > tol or abs(v2 - avg_bottom) > tol or abs(v3 - avg_bottom) > tol:
                continue

            if not self._valid_spacing(v1_idx, v2_idx) or not self._valid_spacing(v2_idx, v3_idx):
                continue

            p_between_12 = peak_indices[(peak_indices > v1_idx) & (peak_indices < v2_idx)]
            p_between_23 = peak_indices[(peak_indices > v2_idx) & (peak_indices < v3_idx)]

            if len(p_between_12) == 0 or len(p_between_23) == 0:
                continue

            c1_idx = int(p_between_12[np.argmax(highs[p_between_12])])
            c2_idx = int(p_between_23[np.argmax(highs[p_between_23])])
            resistance = max(float(highs[c1_idx]), float(highs[c2_idx]))

            pattern_height = resistance - avg_bottom
            if pattern_height <= 0:
                continue

            target_price = resistance + pattern_height

            spread = max(abs(v1 - avg_bottom), abs(v2 - avg_bottom), abs(v3 - avg_bottom))
            uniformity = 1.0 - spread / max(abs(avg_bottom), 1e-10)
            confidence = min(100.0, uniformity * 50 + 50)

            patterns.append(
                DetectedPattern(
                    pattern_type=PatternType.TRIPLE_BOTTOM,
                    direction=Direction.BULLISH,
                    start_index=int(v1_idx),
                    end_index=int(v3_idx),
                    breakout_price=round(resistance, 5),
                    target_price=round(target_price, 5),
                    confidence=confidence,
                    key_levels={
                        "bottom_1": v1,
                        "bottom_2": v2,
                        "bottom_3": v3,
                        "resistance": resistance,
                    },
                )
            )

        return patterns

    # ------------------------------------------------------------------
    # الگوهای بازگشتی — گرد (Rounding)
    # ------------------------------------------------------------------

    def _detect_rounding_top(
        self,
        highs: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوی سقف گرد (نزولی).

        از برازش سهمی (درجه ۲) روی قله‌ها استفاده می‌شود.
        ضریب درجه دوم باید منفی باشد (شکل گنبدی).

        هدف: عمق الگو از نقطه شکست کم می‌شود
        """
        patterns: list[DetectedPattern] = []

        if len(peak_indices) < 5:
            return patterns

        window_sizes = [5, 7, 9]

        for ws in window_sizes:
            if len(peak_indices) < ws:
                continue

            for start in range(len(peak_indices) - ws + 1):
                subset_idx = peak_indices[start: start + ws]
                subset_prices = highs[subset_idx].astype(np.float64)

                # برازش سهمی
                x = np.arange(ws, dtype=np.float64)
                try:
                    coeffs = np.polyfit(x, subset_prices, 2)
                except (np.linalg.LinAlgError, ValueError):
                    continue

                a, b, c = coeffs

                # ضریب a باید منفی باشد (شکل گنبدی)
                if a >= 0:
                    continue

                # بررسی کیفیت برازش
                predicted = np.polyval(coeffs, x)
                ss_res = np.sum((subset_prices - predicted) ** 2)
                ss_tot = np.sum((subset_prices - np.mean(subset_prices)) ** 2)
                if ss_tot == 0:
                    continue
                r_sq = 1.0 - ss_res / ss_tot
                if r_sq < 0.7:
                    continue

                peak_of_arc = float(np.max(subset_prices))
                support_level = float(min(subset_prices[0], subset_prices[-1]))
                pattern_height = peak_of_arc - support_level
                if pattern_height <= 0:
                    continue

                target_price = support_level - pattern_height

                confidence = min(100.0, r_sq * 70 + 30)

                patterns.append(
                    DetectedPattern(
                        pattern_type=PatternType.ROUNDING_TOP,
                        direction=Direction.BEARISH,
                        start_index=int(subset_idx[0]),
                        end_index=int(subset_idx[-1]),
                        breakout_price=round(support_level, 5),
                        target_price=round(target_price, 5),
                        confidence=confidence,
                        key_levels={
                            "arc_peak": peak_of_arc,
                            "support": support_level,
                            "r_squared": round(r_sq, 4),
                        },
                    )
                )

        return patterns

    def _detect_rounding_bottom(
        self,
        lows: np.ndarray,
        closes: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوی کف گرد (صعودی).

        از برازش سهمی (درجه ۲) روی دره‌ها استفاده می‌شود.
        ضریب درجه دوم باید مثبت باشد (شکل کاسه‌ای).

        هدف: عمق الگو از نقطه شکست اضافه می‌شود
        """
        patterns: list[DetectedPattern] = []

        if len(valley_indices) < 5:
            return patterns

        window_sizes = [5, 7, 9]

        for ws in window_sizes:
            if len(valley_indices) < ws:
                continue

            for start in range(len(valley_indices) - ws + 1):
                subset_idx = valley_indices[start: start + ws]
                subset_prices = lows[subset_idx].astype(np.float64)

                x = np.arange(ws, dtype=np.float64)
                try:
                    coeffs = np.polyfit(x, subset_prices, 2)
                except (np.linalg.LinAlgError, ValueError):
                    continue

                a, b, c = coeffs

                # ضریب a باید مثبت باشد (شکل کاسه‌ای)
                if a <= 0:
                    continue

                predicted = np.polyval(coeffs, x)
                ss_res = np.sum((subset_prices - predicted) ** 2)
                ss_tot = np.sum((subset_prices - np.mean(subset_prices)) ** 2)
                if ss_tot == 0:
                    continue
                r_sq = 1.0 - ss_res / ss_tot
                if r_sq < 0.7:
                    continue

                trough = float(np.min(subset_prices))
                resistance_level = float(max(subset_prices[0], subset_prices[-1]))
                pattern_height = resistance_level - trough
                if pattern_height <= 0:
                    continue

                target_price = resistance_level + pattern_height

                confidence = min(100.0, r_sq * 70 + 30)

                patterns.append(
                    DetectedPattern(
                        pattern_type=PatternType.ROUNDING_BOTTOM,
                        direction=Direction.BULLISH,
                        start_index=int(subset_idx[0]),
                        end_index=int(subset_idx[-1]),
                        breakout_price=round(resistance_level, 5),
                        target_price=round(target_price, 5),
                        confidence=confidence,
                        key_levels={
                            "arc_trough": trough,
                            "resistance": resistance_level,
                            "r_squared": round(r_sq, 4),
                        },
                    )
                )

        return patterns

    # ------------------------------------------------------------------
    # الگوهای ادامه‌دهنده — مثلث‌ها
    # ------------------------------------------------------------------

    def _detect_triangles(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوهای مثلث (صعودی، نزولی، متقارن).

        صعودی: خط مقاومت افقی + خط حمایت صعودی
        نزولی: خط حمایت افقی + خط مقاومت نزولی
        متقارن: هم مقاومت نزولی و هم حمایت صعودی (همگرا)

        هدف: ارتفاع مثلث در عریض‌ترین نقطه از محل شکست
        """
        patterns: list[DetectedPattern] = []

        if len(peak_indices) < 3 or len(valley_indices) < 3:
            return patterns

        # پنجره‌های مختلف برای بررسی
        for n_points in range(3, min(8, len(peak_indices) + 1)):
            if n_points > len(valley_indices):
                break

            for start_p in range(len(peak_indices) - n_points + 1):
                p_subset = peak_indices[start_p: start_p + n_points]

                # دره‌های متناظر (در همان بازه زمانی)
                v_in_range = valley_indices[
                    (valley_indices >= p_subset[0]) & (valley_indices <= p_subset[-1])
                ]
                if len(v_in_range) < 2:
                    continue

                p_prices = highs[p_subset].astype(np.float64)
                v_prices = lows[v_in_range].astype(np.float64)

                # شیب خط مقاومت (قله‌ها)
                res_slope, res_intercept = _fit_line(p_subset.astype(np.float64), p_prices)
                res_r2 = _r_squared(p_subset.astype(np.float64), p_prices, res_slope, res_intercept)

                # شیب خط حمایت (دره‌ها)
                sup_slope, sup_intercept = _fit_line(v_in_range.astype(np.float64), v_prices)
                sup_r2 = _r_squared(v_in_range.astype(np.float64), v_prices, sup_slope, sup_intercept)

                # کیفیت خطوط
                if res_r2 < 0.6 or sup_r2 < 0.6:
                    continue

                # خطوط باید همگرا باشند
                if res_slope >= sup_slope:
                    continue

                # ارتفاع مثلث در شروع
                start_idx = min(int(p_subset[0]), int(v_in_range[0]))
                end_idx = max(int(p_subset[-1]), int(v_in_range[-1]))
                height_at_start = (res_slope * start_idx + res_intercept) - (
                    sup_slope * start_idx + sup_intercept
                )
                if height_at_start <= 0:
                    continue

                # نرمال‌سازی شیب بر اساس ارتفاع
                norm_res_slope = res_slope / max(abs(res_intercept), 1e-10) * 1000
                norm_sup_slope = sup_slope / max(abs(sup_intercept), 1e-10) * 1000

                flat_threshold = 0.05  # آستانه «افقی»

                if abs(norm_res_slope) < flat_threshold and norm_sup_slope > flat_threshold:
                    # مقاومت افقی + حمایت صعودی = مثلث صعودی
                    pattern_type = PatternType.ASCENDING_TRIANGLE
                    direction = Direction.BULLISH
                    breakout_price = float(res_slope * end_idx + res_intercept)
                    target_price = breakout_price + height_at_start
                elif abs(norm_sup_slope) < flat_threshold and norm_res_slope < -flat_threshold:
                    # حمایت افقی + مقاومت نزولی = مثلث نزولی
                    pattern_type = PatternType.DESCENDING_TRIANGLE
                    direction = Direction.BEARISH
                    breakout_price = float(sup_slope * end_idx + sup_intercept)
                    target_price = breakout_price - height_at_start
                elif norm_res_slope < -flat_threshold and norm_sup_slope > flat_threshold:
                    # هر دو همگرا = مثلث متقارن
                    pattern_type = PatternType.SYMMETRICAL_TRIANGLE
                    direction = Direction.NEUTRAL
                    mid_price = (
                        (res_slope * end_idx + res_intercept)
                        + (sup_slope * end_idx + sup_intercept)
                    ) / 2
                    breakout_price = mid_price
                    # جهت شکست بر اساس روند قبلی
                    pre_trend = _linear_regression_slope(
                        closes[max(0, start_idx - 20): start_idx]
                    )
                    if pre_trend > 0:
                        target_price = mid_price + height_at_start
                    else:
                        target_price = mid_price - height_at_start
                else:
                    continue

                avg_r2 = (res_r2 + sup_r2) / 2
                confidence = min(100.0, avg_r2 * 60 + n_points * 5 + 10)

                patterns.append(
                    DetectedPattern(
                        pattern_type=pattern_type,
                        direction=direction,
                        start_index=start_idx,
                        end_index=end_idx,
                        breakout_price=round(breakout_price, 5),
                        target_price=round(target_price, 5),
                        confidence=confidence,
                        key_levels={
                            "resistance_slope": round(res_slope, 8),
                            "support_slope": round(sup_slope, 8),
                            "pattern_height": round(height_at_start, 5),
                        },
                    )
                )

        return patterns

    # ------------------------------------------------------------------
    # الگوهای ادامه‌دهنده — پرچم (Flag)
    # ------------------------------------------------------------------

    def _detect_flags(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوهای پرچم صعودی و نزولی.

        پرچم صعودی: حرکت تند صعودی (میله) + اصلاح نزولی ملایم (پرچم)
        پرچم نزولی: حرکت تند نزولی (میله) + اصلاح صعودی ملایم (پرچم)

        هدف: طول میله پرچم از نقطه شکست
        """
        patterns: list[DetectedPattern] = []
        n = len(closes)

        if n < 30:
            return patterns

        # بررسی پنجره‌های مختلف
        for flag_len in range(10, min(40, n // 2)):
            found = False
            for end in range(flag_len + 10, n):
                flag_start = end - flag_len
                pole_start = max(0, flag_start - flag_len * 2)

                pole_closes = closes[pole_start:flag_start].astype(np.float64)
                flag_closes = closes[flag_start:end].astype(np.float64)

                if len(pole_closes) < 5 or len(flag_closes) < 5:
                    continue

                pole_move = float(pole_closes[-1] - pole_closes[0])
                flag_slope = _linear_regression_slope(flag_closes)

                # نرمال‌سازی
                ref_price = max(abs(float(pole_closes[0])), 1e-10)
                pole_pct = abs(pole_move) / ref_price * 100
                flag_pct = abs(flag_slope * len(flag_closes)) / ref_price * 100

                # میله باید حرکت قابل‌توجه داشته باشد
                if pole_pct < 1.0:
                    continue

                # اصلاح نباید بیش از ۵۰٪ میله باشد
                flag_retracement = flag_pct / max(pole_pct, 1e-10)
                if flag_retracement > 0.5:
                    continue

                # رنج پرچم باید کوچکتر از میله باشد
                flag_range = float(np.max(flag_closes) - np.min(flag_closes))
                if flag_range > abs(pole_move) * 0.6:
                    continue

                if pole_move > 0 and flag_slope < 0:
                    # پرچم صعودی
                    pattern_type = PatternType.BULL_FLAG
                    direction = Direction.BULLISH
                    breakout_price = float(np.max(flag_closes))
                    target_price = breakout_price + abs(pole_move)
                elif pole_move < 0 and flag_slope > 0:
                    # پرچم نزولی
                    pattern_type = PatternType.BEAR_FLAG
                    direction = Direction.BEARISH
                    breakout_price = float(np.min(flag_closes))
                    target_price = breakout_price - abs(pole_move)
                else:
                    continue

                # اطمینان بر اساس وضوح میله و کوچکی پرچم
                conf_pole = min(1.0, pole_pct / 3.0)
                conf_retr = 1.0 - flag_retracement
                confidence = min(100.0, (conf_pole * 0.5 + conf_retr * 0.5) * 80 + 20)

                patterns.append(
                    DetectedPattern(
                        pattern_type=pattern_type,
                        direction=direction,
                        start_index=pole_start,
                        end_index=end,
                        breakout_price=round(breakout_price, 5),
                        target_price=round(target_price, 5),
                        confidence=confidence,
                        key_levels={
                            "pole_start_price": float(pole_closes[0]),
                            "pole_end_price": float(pole_closes[-1]),
                            "flag_slope": round(flag_slope, 8),
                        },
                    )
                )

                # فقط یک الگو در هر بازه
                found = True
                break

            if found:
                break

        return patterns

    # ------------------------------------------------------------------
    # الگوهای ادامه‌دهنده — پرچم سه‌گوش (Pennant)
    # ------------------------------------------------------------------

    def _detect_pennant(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوی پرچم سه‌گوش (Pennant).

        شبیه مثلث متقارن ولی بعد از یک حرکت تند (میله).
        قله‌ها نزولی و دره‌ها صعودی (همگرا) هستند.

        هدف: طول میله از نقطه شکست
        """
        patterns: list[DetectedPattern] = []
        n = len(closes)

        if n < 30 or len(peak_indices) < 2 or len(valley_indices) < 2:
            return patterns

        # جستجو برای ساختارهای همگرا بعد از حرکت تند
        for pennant_len in range(8, min(30, n // 3)):
            found = False
            for end in range(pennant_len + 15, n):
                p_start = end - pennant_len
                pole_start = max(0, p_start - pennant_len * 2)

                pole_closes = closes[pole_start:p_start].astype(np.float64)
                if len(pole_closes) < 5:
                    continue

                pole_move = float(pole_closes[-1] - pole_closes[0])
                ref_price = max(abs(float(pole_closes[0])), 1e-10)
                pole_pct = abs(pole_move) / ref_price * 100

                if pole_pct < 1.0:
                    continue

                # قله‌ها و دره‌ها در بازه پرچم سه‌گوش
                p_in_range = peak_indices[(peak_indices >= p_start) & (peak_indices < end)]
                v_in_range = valley_indices[(valley_indices >= p_start) & (valley_indices < end)]

                if len(p_in_range) < 2 or len(v_in_range) < 2:
                    continue

                p_prices = highs[p_in_range].astype(np.float64)
                v_prices = lows[v_in_range].astype(np.float64)

                res_slope, _ = _fit_line(p_in_range.astype(np.float64), p_prices)
                sup_slope, _ = _fit_line(v_in_range.astype(np.float64), v_prices)

                # همگرایی: مقاومت نزولی و حمایت صعودی
                if res_slope >= 0 or sup_slope <= 0:
                    continue

                # عرض پرچم‌سه‌گوش باید کوچک باشد نسبت به میله
                pennant_width = float(np.max(p_prices) - np.min(v_prices))
                if pennant_width > abs(pole_move) * 0.5:
                    continue

                if pole_move > 0:
                    direction = Direction.BULLISH
                    breakout_price = float(np.max(p_prices))
                    target_price = breakout_price + abs(pole_move)
                else:
                    direction = Direction.BEARISH
                    breakout_price = float(np.min(v_prices))
                    target_price = breakout_price - abs(pole_move)

                compactness = 1.0 - pennant_width / max(abs(pole_move), 1e-10)
                confidence = min(100.0, compactness * 50 + min(pole_pct / 3, 1.0) * 30 + 20)

                patterns.append(
                    DetectedPattern(
                        pattern_type=PatternType.PENNANT,
                        direction=direction,
                        start_index=pole_start,
                        end_index=end,
                        breakout_price=round(breakout_price, 5),
                        target_price=round(target_price, 5),
                        confidence=confidence,
                        key_levels={
                            "pole_move": round(pole_move, 5),
                            "pennant_width": round(pennant_width, 5),
                        },
                    )
                )
                found = True
                break

            if found:
                break

        return patterns

    # ------------------------------------------------------------------
    # الگوهای ادامه‌دهنده — مستطیل (Rectangle)
    # ------------------------------------------------------------------

    def _detect_rectangle(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوی مستطیل (کانال افقی).

        شرایط:
        - حداقل ۲ قله و ۲ دره تقریبا هم‌سطح
        - خطوط مقاومت و حمایت تقریبا افقی
        - جهت شکست بر اساس روند قبلی تعیین می‌شود

        هدف: ارتفاع مستطیل از نقطه شکست
        """
        patterns: list[DetectedPattern] = []

        if len(peak_indices) < 2 or len(valley_indices) < 2:
            return patterns

        # بررسی پنجره‌هایی از قله‌ها و دره‌ها
        for n_p in range(2, min(6, len(peak_indices) + 1)):
            for start_p in range(len(peak_indices) - n_p + 1):
                p_subset = peak_indices[start_p: start_p + n_p]
                p_prices = highs[p_subset].astype(np.float64)

                # بررسی افقی بودن قله‌ها
                if np.ptp(p_prices) / np.mean(p_prices) * 100 > self.price_tolerance_pct * 2:
                    continue

                # دره‌های متناظر
                v_in_range = valley_indices[
                    (valley_indices >= p_subset[0]) & (valley_indices <= p_subset[-1])
                ]
                if len(v_in_range) < 2:
                    continue

                v_prices = lows[v_in_range].astype(np.float64)

                # بررسی افقی بودن دره‌ها
                if np.ptp(v_prices) / np.mean(v_prices) * 100 > self.price_tolerance_pct * 2:
                    continue

                resistance = float(np.mean(p_prices))
                support = float(np.mean(v_prices))
                rect_height = resistance - support

                if rect_height <= 0:
                    continue

                start_idx = min(int(p_subset[0]), int(v_in_range[0]))
                end_idx = max(int(p_subset[-1]), int(v_in_range[-1]))

                # جهت بر اساس روند قبلی
                pre_trend = _linear_regression_slope(
                    closes[max(0, start_idx - 20): start_idx]
                )

                if pre_trend > 0:
                    direction = Direction.BULLISH
                    breakout_price = resistance
                    target_price = resistance + rect_height
                elif pre_trend < 0:
                    direction = Direction.BEARISH
                    breakout_price = support
                    target_price = support - rect_height
                else:
                    direction = Direction.NEUTRAL
                    breakout_price = resistance
                    target_price = resistance + rect_height

                # اطمینان
                res_flatness = 1.0 - np.ptp(p_prices) / max(resistance, 1e-10)
                sup_flatness = 1.0 - np.ptp(v_prices) / max(abs(support), 1e-10)
                touch_count = n_p + len(v_in_range)
                confidence = min(
                    100.0,
                    res_flatness * 25 + sup_flatness * 25 + min(touch_count * 5, 30) + 20,
                )

                patterns.append(
                    DetectedPattern(
                        pattern_type=PatternType.RECTANGLE,
                        direction=direction,
                        start_index=start_idx,
                        end_index=end_idx,
                        breakout_price=round(breakout_price, 5),
                        target_price=round(target_price, 5),
                        confidence=confidence,
                        key_levels={
                            "resistance": round(resistance, 5),
                            "support": round(support, 5),
                            "height": round(rect_height, 5),
                        },
                    )
                )

        return patterns

    # ------------------------------------------------------------------
    # الگوهای ادامه‌دهنده — کنج (Wedge)
    # ------------------------------------------------------------------

    def _detect_wedges(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        peak_indices: np.ndarray,
        valley_indices: np.ndarray,
    ) -> list[DetectedPattern]:
        """
        شناسایی الگوهای کنج صعودی و نزولی.

        کنج صعودی (نزولی): هم مقاومت و هم حمایت صعودی، ولی مقاومت کندتر (همگرا)
        کنج نزولی (صعودی): هم مقاومت و هم حمایت نزولی، ولی حمایت کندتر (همگرا)

        هدف: ارتفاع کنج در عریض‌ترین نقطه از محل شکست
        """
        patterns: list[DetectedPattern] = []

        if len(peak_indices) < 3 or len(valley_indices) < 3:
            return patterns

        for n_points in range(3, min(8, len(peak_indices) + 1)):
            if n_points > len(valley_indices):
                break

            for start_p in range(len(peak_indices) - n_points + 1):
                p_subset = peak_indices[start_p: start_p + n_points]
                v_in_range = valley_indices[
                    (valley_indices >= p_subset[0]) & (valley_indices <= p_subset[-1])
                ]
                if len(v_in_range) < 3:
                    continue

                p_prices = highs[p_subset].astype(np.float64)
                v_prices = lows[v_in_range].astype(np.float64)

                res_slope, res_intercept = _fit_line(p_subset.astype(np.float64), p_prices)
                sup_slope, sup_intercept = _fit_line(v_in_range.astype(np.float64), v_prices)

                res_r2 = _r_squared(p_subset.astype(np.float64), p_prices, res_slope, res_intercept)
                sup_r2 = _r_squared(v_in_range.astype(np.float64), v_prices, sup_slope, sup_intercept)

                if res_r2 < 0.6 or sup_r2 < 0.6:
                    continue

                # همگرایی: خطوط به هم نزدیک می‌شوند
                start_idx = min(int(p_subset[0]), int(v_in_range[0]))
                end_idx = max(int(p_subset[-1]), int(v_in_range[-1]))
                width_start = (res_slope * start_idx + res_intercept) - (
                    sup_slope * start_idx + sup_intercept
                )
                width_end = (res_slope * end_idx + res_intercept) - (
                    sup_slope * end_idx + sup_intercept
                )

                if width_start <= 0 or width_end <= 0:
                    continue
                if width_end >= width_start:
                    # واگرایی — نه کنج
                    continue

                if res_slope > 0 and sup_slope > 0:
                    # هر دو صعودی = کنج صعودی (نزولی)
                    if res_slope >= sup_slope:
                        continue
                    pattern_type = PatternType.RISING_WEDGE
                    direction = Direction.BEARISH
                    breakout_price = float(sup_slope * end_idx + sup_intercept)
                    target_price = breakout_price - width_start
                elif res_slope < 0 and sup_slope < 0:
                    # هر دو نزولی = کنج نزولی (صعودی)
                    if sup_slope <= res_slope:
                        continue
                    pattern_type = PatternType.FALLING_WEDGE
                    direction = Direction.BULLISH
                    breakout_price = float(res_slope * end_idx + res_intercept)
                    target_price = breakout_price + width_start
                else:
                    continue

                avg_r2 = (res_r2 + sup_r2) / 2
                convergence_ratio = width_end / max(width_start, 1e-10)
                conf_convergence = (1.0 - convergence_ratio) * 40
                confidence = min(100.0, avg_r2 * 40 + conf_convergence + 20)

                patterns.append(
                    DetectedPattern(
                        pattern_type=pattern_type,
                        direction=direction,
                        start_index=start_idx,
                        end_index=end_idx,
                        breakout_price=round(breakout_price, 5),
                        target_price=round(target_price, 5),
                        confidence=confidence,
                        key_levels={
                            "resistance_slope": round(res_slope, 8),
                            "support_slope": round(sup_slope, 8),
                            "width_start": round(width_start, 5),
                            "width_end": round(width_end, 5),
                        },
                    )
                )

        return patterns

    # ------------------------------------------------------------------
    # حذف الگوهای تکراری
    # ------------------------------------------------------------------

    @staticmethod
    def _deduplicate_patterns(patterns: list[DetectedPattern]) -> list[DetectedPattern]:
        """
        حذف الگوهای تکراری بر اساس همپوشانی زمانی و نوع الگو.

        اگر دو الگو از یک نوع با همپوشانی زمانی بالا وجود داشته باشند،
        الگوی با اطمینان بالاتر نگه داشته می‌شود.
        """
        if not patterns:
            return patterns

        # مرتب‌سازی بر اساس اطمینان (نزولی)
        sorted_patterns = sorted(patterns, key=lambda p: p.confidence, reverse=True)
        kept: list[DetectedPattern] = []

        for candidate in sorted_patterns:
            is_dup = False
            for existing in kept:
                if candidate.pattern_type != existing.pattern_type:
                    continue

                # محاسبه همپوشانی
                overlap_start = max(candidate.start_index, existing.start_index)
                overlap_end = min(candidate.end_index, existing.end_index)
                if overlap_end <= overlap_start:
                    continue

                overlap_len = overlap_end - overlap_start
                candidate_len = candidate.end_index - candidate.start_index
                if candidate_len <= 0:
                    is_dup = True
                    break

                overlap_ratio = overlap_len / candidate_len
                if overlap_ratio > 0.5:
                    is_dup = True
                    break

            if not is_dup:
                kept.append(candidate)

        return kept

    # ------------------------------------------------------------------
    # محاسبه امتیاز کلی و جهت غالب
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_pattern_score(patterns: list[DetectedPattern]) -> float:
        """
        محاسبه امتیاز کلی الگوها (۰ تا ۱۰۰).

        معیارها:
        - تعداد الگوهای یافت‌شده
        - میانگین اطمینان
        - هماهنگی جهت‌ها
        """
        if not patterns:
            return 50.0  # «الگویی نیست» = خنثی، نه شواهدِ نزولی (وگرنه امتیاز کل را می‌کشد)

        avg_conf = sum(p.confidence for p in patterns) / len(patterns)

        # هماهنگی جهت‌ها
        directions = [p.direction for p in patterns if p.direction != Direction.NEUTRAL]
        if directions:
            most_common = max(set(directions), key=directions.count)
            agreement = directions.count(most_common) / len(directions)
        else:
            agreement = 0.5

        count_factor = min(1.0, len(patterns) / 5.0)

        score = avg_conf * 0.5 + agreement * 100 * 0.3 + count_factor * 100 * 0.2

        return min(100.0, max(0.0, score))

    @staticmethod
    def _compute_dominant_direction(patterns: list[DetectedPattern]) -> str:
        """
        تعیین جهت غالب بر اساس الگوهای یافت‌شده.

        هر الگو بر اساس اطمینان وزن‌دهی می‌شود.
        """
        if not patterns:
            return Direction.NEUTRAL.value

        bullish_weight = 0.0
        bearish_weight = 0.0

        for p in patterns:
            if p.direction == Direction.BULLISH:
                bullish_weight += p.confidence
            elif p.direction == Direction.BEARISH:
                bearish_weight += p.confidence

        total = bullish_weight + bearish_weight
        if total == 0:
            return Direction.NEUTRAL.value

        if bullish_weight / total > 0.6:
            return Direction.BULLISH.value
        if bearish_weight / total > 0.6:
            return Direction.BEARISH.value

        return Direction.NEUTRAL.value

    # ------------------------------------------------------------------
    # رابط اصلی
    # ------------------------------------------------------------------

    def analyze(self, df: pd.DataFrame) -> dict:
        """
        تحلیل کامل الگوهای نموداری روی دیتافریم.

        ورودی:
            df: دیتافریم با ستون‌های [timestamp, open, high, low, close, volume]

        خروجی:
            دیکشنری شامل:
            - patterns_found: لیست الگوهای شناسایی‌شده با قیمت هدف
            - pattern_score: امتیاز کلی (۰ تا ۱۰۰)
            - dominant_direction: جهت غالب ('bullish' | 'bearish' | 'neutral')
        """
        result: dict = {
            "patterns_found": [],
            "pattern_score": 50.0,  # خنثی پیش‌فرض (نه ۰ که امتیاز را به نزولی می‌کشد)
            "dominant_direction": Direction.NEUTRAL.value,
        }

        if not self._validate_dataframe(df):
            logger.warning("invalid_dataframe_for_pattern_analysis")
            return result

        if len(df) < MIN_CANDLES_REQUIRED:
            logger.info(
                "insufficient_data_for_patterns",
                candles=len(df),
                required=MIN_CANDLES_REQUIRED,
            )
            return result

        highs = df["high"].values.astype(np.float64)
        lows = df["low"].values.astype(np.float64)
        closes = df["close"].values.astype(np.float64)

        # تشخیص قله‌ها و دره‌ها
        peak_indices, valley_indices = self._find_peaks_and_valleys(highs, lows)

        if len(peak_indices) < 2 or len(valley_indices) < 2:
            logger.info(
                "not_enough_extrema",
                peaks=len(peak_indices),
                valleys=len(valley_indices),
            )
            return result

        all_patterns: list[DetectedPattern] = []

        # --- الگوهای بازگشتی ---
        try:
            all_patterns.extend(
                self._detect_head_and_shoulders(
                    highs, lows, closes, peak_indices, valley_indices
                )
            )
        except Exception:
            logger.exception("error_detecting_head_and_shoulders")

        try:
            all_patterns.extend(
                self._detect_inverse_head_and_shoulders(
                    highs, lows, closes, peak_indices, valley_indices
                )
            )
        except Exception:
            logger.exception("error_detecting_inverse_head_and_shoulders")

        try:
            all_patterns.extend(
                self._detect_double_top(
                    highs, lows, closes, peak_indices, valley_indices
                )
            )
        except Exception:
            logger.exception("error_detecting_double_top")

        try:
            all_patterns.extend(
                self._detect_double_bottom(
                    highs, lows, closes, peak_indices, valley_indices
                )
            )
        except Exception:
            logger.exception("error_detecting_double_bottom")

        try:
            all_patterns.extend(
                self._detect_triple_top(
                    highs, lows, closes, peak_indices, valley_indices
                )
            )
        except Exception:
            logger.exception("error_detecting_triple_top")

        try:
            all_patterns.extend(
                self._detect_triple_bottom(
                    highs, lows, closes, peak_indices, valley_indices
                )
            )
        except Exception:
            logger.exception("error_detecting_triple_bottom")

        try:
            all_patterns.extend(
                self._detect_rounding_top(highs, closes, peak_indices)
            )
        except Exception:
            logger.exception("error_detecting_rounding_top")

        try:
            all_patterns.extend(
                self._detect_rounding_bottom(lows, closes, valley_indices)
            )
        except Exception:
            logger.exception("error_detecting_rounding_bottom")

        # --- الگوهای ادامه‌دهنده ---
        try:
            all_patterns.extend(
                self._detect_triangles(
                    highs, lows, closes, peak_indices, valley_indices
                )
            )
        except Exception:
            logger.exception("error_detecting_triangles")

        try:
            all_patterns.extend(
                self._detect_flags(
                    highs, lows, closes, peak_indices, valley_indices
                )
            )
        except Exception:
            logger.exception("error_detecting_flags")

        try:
            all_patterns.extend(
                self._detect_pennant(
                    highs, lows, closes, peak_indices, valley_indices
                )
            )
        except Exception:
            logger.exception("error_detecting_pennant")

        try:
            all_patterns.extend(
                self._detect_rectangle(
                    highs, lows, closes, peak_indices, valley_indices
                )
            )
        except Exception:
            logger.exception("error_detecting_rectangle")

        try:
            all_patterns.extend(
                self._detect_wedges(
                    highs, lows, closes, peak_indices, valley_indices
                )
            )
        except Exception:
            logger.exception("error_detecting_wedges")

        # حذف تکراری‌ها
        all_patterns = self._deduplicate_patterns(all_patterns)

        # مرتب‌سازی بر اساس اطمینان
        all_patterns.sort(key=lambda p: p.confidence, reverse=True)

        result["patterns_found"] = [p.to_dict() for p in all_patterns]
        result["pattern_score"] = round(self._compute_pattern_score(all_patterns), 1)
        result["dominant_direction"] = self._compute_dominant_direction(all_patterns)

        logger.info(
            "pattern_analysis_complete",
            patterns_count=len(all_patterns),
            score=result["pattern_score"],
            direction=result["dominant_direction"],
        )

        return result
