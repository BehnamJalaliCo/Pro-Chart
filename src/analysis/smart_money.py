"""تحلیل مفاهیم اسمارت مانی (Smart Money Concepts) برای شناسایی رفتار نهادی بازار"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np
import pandas as pd

from src.core.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# ثابت‌ها و تنظیمات پیش‌فرض
# ---------------------------------------------------------------------------

DEFAULT_IMPULSIVE_MULTIPLIER: float = 2.0
DEFAULT_SWING_LOOKBACK: int = 3
DEFAULT_FVG_MIN_GAP_RATIO: float = 0.0
DEFAULT_ZONE_MERGE_TOLERANCE: float = 0.001
DEFAULT_MAX_ZONE_TESTS: int = 3
DEFAULT_LIQUIDITY_SWEEP_THRESHOLD: float = 0.0002


# ---------------------------------------------------------------------------
# انواع داده
# ---------------------------------------------------------------------------

class Bias(str, Enum):
    """جهت‌گیری بازار"""
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class StructureType(str, Enum):
    """نوع ساختار بازار"""
    BOS = "BOS"
    CHOCH = "CHoCH"


class ZoneType(str, Enum):
    """نوع ناحیه عرضه و تقاضا"""
    SUPPLY = "supply"
    DEMAND = "demand"


class PremiumDiscount(str, Enum):
    """طبقه‌بندی ناحیه قیمتی"""
    PREMIUM = "premium"
    DISCOUNT = "discount"
    EQUILIBRIUM = "equilibrium"


@dataclass
class OrderBlock:
    """بلاک سفارش نهادی"""
    index: int
    timestamp: object
    type: str  # 'bullish' | 'bearish'
    open: float
    high: float
    low: float
    close: float
    zone_high: float
    zone_low: float
    strength: float
    mitigated: bool = False
    mitigated_index: Optional[int] = None


@dataclass
class FairValueGap:
    """شکاف ارزش منصفانه"""
    index: int
    timestamp: object
    type: str  # 'bullish' | 'bearish'
    high: float
    low: float
    size: float
    filled: bool = False
    fill_percentage: float = 0.0


@dataclass
class StructureBreak:
    """شکست ساختار بازار"""
    index: int
    timestamp: object
    type: str  # 'BOS' | 'CHoCH'
    direction: str  # 'bullish' | 'bearish'
    level: float
    swing_index: int


@dataclass
class SupplyDemandZone:
    """ناحیه عرضه یا تقاضا"""
    index: int
    timestamp: object
    type: str  # 'supply' | 'demand'
    high: float
    low: float
    strength: float
    fresh: bool = True
    test_count: int = 0


@dataclass
class LiquiditySweep:
    """جارو کردن نقدینگی"""
    index: int
    timestamp: object
    type: str  # 'bullish' | 'bearish'
    swept_level: float
    wick_high: float
    wick_low: float
    reclaimed: bool


@dataclass
class PremiumDiscountZone:
    """ناحیه پریمیوم و دیسکانت"""
    range_high: float
    range_low: float
    equilibrium: float
    current_price: float
    zone: str  # 'premium' | 'discount' | 'equilibrium'
    premium_level: float
    discount_level: float


@dataclass
class SwingPoint:
    """نقطه سوئینگ (قله یا دره)"""
    index: int
    price: float
    type: str  # 'high' | 'low'


# ---------------------------------------------------------------------------
# تحلیل‌گر اسمارت مانی
# ---------------------------------------------------------------------------

class SmartMoneyAnalyzer:
    """
    تحلیل‌گر مفاهیم اسمارت مانی (SMC).

    این کلاس تمام مفاهیم کلیدی اسمارت مانی را شناسایی و تحلیل می‌کند:
    اوردر بلاک، شکاف ارزش منصفانه، شکست ساختار، تغییر کاراکتر،
    نواحی عرضه و تقاضا، جاروی نقدینگی و نواحی پریمیوم/دیسکانت.
    """

    def __init__(
        self,
        impulsive_multiplier: float = DEFAULT_IMPULSIVE_MULTIPLIER,
        swing_lookback: int = DEFAULT_SWING_LOOKBACK,
        fvg_min_gap_ratio: float = DEFAULT_FVG_MIN_GAP_RATIO,
        zone_merge_tolerance: float = DEFAULT_ZONE_MERGE_TOLERANCE,
        max_zone_tests: int = DEFAULT_MAX_ZONE_TESTS,
        liquidity_sweep_threshold: float = DEFAULT_LIQUIDITY_SWEEP_THRESHOLD,
    ) -> None:
        """
        مقداردهی اولیه تحلیل‌گر اسمارت مانی.

        پارامترها:
            impulsive_multiplier: ضریب تشخیص حرکت انفجاری نسبت به میانگین ATR
            swing_lookback: تعداد کندل‌های اطراف برای شناسایی سوئینگ
            fvg_min_gap_ratio: حداقل نسبت اندازه شکاف به ATR برای ثبت FVG
            zone_merge_tolerance: تلرانس ادغام نواحی نزدیک (درصد)
            max_zone_tests: حداکثر تعداد تست قبل از باطل شدن ناحیه
            liquidity_sweep_threshold: حداقل نفوذ قیمت برای شناسایی جاروی نقدینگی
        """
        self._impulsive_multiplier = impulsive_multiplier
        self._swing_lookback = swing_lookback
        self._fvg_min_gap_ratio = fvg_min_gap_ratio
        self._zone_merge_tolerance = zone_merge_tolerance
        self._max_zone_tests = max_zone_tests
        self._liquidity_sweep_threshold = liquidity_sweep_threshold

    # ------------------------------------------------------------------
    # متد اصلی تحلیل
    # ------------------------------------------------------------------

    def analyze(self, df: pd.DataFrame) -> dict:
        """
        تحلیل کامل مفاهیم اسمارت مانی روی دیتافریم کندل‌ها.

        پارامترها:
            df: دیتافریم با ستون‌های [timestamp, open, high, low, close, volume]

        خروجی:
            دیکشنری شامل:
                - order_blocks: لیست اوردر بلاک‌ها
                - fair_value_gaps: لیست شکاف‌های ارزش منصفانه
                - structure: اطلاعات شکست ساختار و تغییر کاراکتر
                - supply_demand_zones: لیست نواحی عرضه و تقاضا
                - liquidity_sweeps: لیست جاروهای نقدینگی
                - premium_discount: طبقه‌بندی ناحیه قیمتی فعلی
                - smc_score: امتیاز کلی تحلیل (۰ تا ۱۰۰)
                - smc_bias: جهت‌گیری بازار (bullish / bearish / neutral)
        """
        df = self._validate_and_prepare(df)
        if df is None or len(df) < self._swing_lookback * 2 + 1:
            logger.warning(
                "smc_insufficient_data",
                rows=0 if df is None else len(df),
                min_required=self._swing_lookback * 2 + 1,
            )
            return self._empty_result()

        opens: np.ndarray = df["open"].values.astype(np.float64)
        highs: np.ndarray = df["high"].values.astype(np.float64)
        lows: np.ndarray = df["low"].values.astype(np.float64)
        closes: np.ndarray = df["close"].values.astype(np.float64)
        timestamps = df["timestamp"].values

        atr = self._compute_atr(highs, lows, closes, period=14)

        # شناسایی نقاط سوئینگ
        swing_highs, swing_lows = self._detect_swing_points(
            highs, lows, self._swing_lookback,
        )

        # شناسایی ساختار بازار (BOS / CHoCH)
        structure_breaks = self._detect_structure(
            swing_highs, swing_lows, highs, lows, closes, timestamps,
        )

        # شناسایی اوردر بلاک‌ها
        order_blocks = self._detect_order_blocks(
            opens, highs, lows, closes, timestamps, atr,
        )

        # بررسی میتیگیشن اوردر بلاک‌ها
        order_blocks = self._check_ob_mitigation(order_blocks, highs, lows, closes)

        # شناسایی شکاف ارزش منصفانه
        fair_value_gaps = self._detect_fvg(highs, lows, timestamps, atr)

        # بررسی پر شدن FVG‌ها
        fair_value_gaps = self._check_fvg_fill(fair_value_gaps, highs, lows)

        # شناسایی نواحی عرضه و تقاضا
        supply_demand_zones = self._detect_supply_demand_zones(
            opens, highs, lows, closes, timestamps, atr,
        )

        # بررسی تعداد تست نواحی
        supply_demand_zones = self._update_zone_tests(
            supply_demand_zones, highs, lows,
        )

        # شناسایی جاروی نقدینگی
        liquidity_sweeps = self._detect_liquidity_sweeps(
            swing_highs, swing_lows, opens, highs, lows, closes, timestamps,
        )

        # محاسبه ناحیه پریمیوم/دیسکانت
        premium_discount = self._compute_premium_discount(
            highs, lows, closes, swing_highs, swing_lows,
        )

        # محاسبه امتیاز و جهت‌گیری
        smc_score, smc_bias = self._compute_smc_score(
            order_blocks,
            fair_value_gaps,
            structure_breaks,
            supply_demand_zones,
            liquidity_sweeps,
            premium_discount,
            closes,
        )

        logger.info(
            "smc_analysis_complete",
            order_blocks=len(order_blocks),
            fvgs=len(fair_value_gaps),
            structure_breaks=len(structure_breaks),
            zones=len(supply_demand_zones),
            sweeps=len(liquidity_sweeps),
            score=smc_score,
            bias=smc_bias,
        )

        return {
            "order_blocks": [self._ob_to_dict(ob) for ob in order_blocks],
            "fair_value_gaps": [self._fvg_to_dict(fvg) for fvg in fair_value_gaps],
            "structure": [self._structure_to_dict(s) for s in structure_breaks],
            "supply_demand_zones": [self._zone_to_dict(z) for z in supply_demand_zones],
            "liquidity_sweeps": [self._sweep_to_dict(s) for s in liquidity_sweeps],
            "premium_discount": self._pd_to_dict(premium_discount),
            "smc_score": smc_score,
            "smc_bias": smc_bias,
        }

    # ------------------------------------------------------------------
    # اعتبارسنجی ورودی
    # ------------------------------------------------------------------

    def _validate_and_prepare(self, df: pd.DataFrame) -> Optional[pd.DataFrame]:
        """
        اعتبارسنجی و آماده‌سازی دیتافریم ورودی.

        بررسی وجود ستون‌های لازم، حذف ردیف‌های خالی و مرتب‌سازی بر اساس زمان.
        """
        required_columns = {"timestamp", "open", "high", "low", "close", "volume"}
        if not required_columns.issubset(set(df.columns)):
            missing = required_columns - set(df.columns)
            logger.error("smc_missing_columns", missing=list(missing))
            return None

        df = df.copy()
        df = df.dropna(subset=["open", "high", "low", "close"])

        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        df = df.dropna(subset=["open", "high", "low", "close"])
        df = df.sort_values("timestamp").reset_index(drop=True)

        if df.empty:
            return None

        return df

    # ------------------------------------------------------------------
    # ابزارهای کمکی
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_atr(
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        period: int = 14,
    ) -> np.ndarray:
        """
        محاسبه میانگین دامنه واقعی (ATR).

        از ATR برای تعیین آستانه حرکت‌های انفجاری و اندازه‌گیری نواحی استفاده می‌شود.
        """
        n = len(highs)
        tr = np.empty(n, dtype=np.float64)
        tr[0] = highs[0] - lows[0]

        for i in range(1, n):
            hl = highs[i] - lows[i]
            hc = abs(highs[i] - closes[i - 1])
            lc = abs(lows[i] - closes[i - 1])
            tr[i] = max(hl, hc, lc)

        atr = np.empty(n, dtype=np.float64)
        atr[:period] = np.nan

        if n >= period:
            atr[period - 1] = np.mean(tr[:period])
            for i in range(period, n):
                atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period

        # پر کردن مقادیر NaN ابتدایی با اولین مقدار معتبر
        first_valid = atr[period - 1] if n >= period else tr[0]
        atr[:period] = first_valid

        return atr

    def _detect_swing_points(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        lookback: int,
    ) -> tuple[list[SwingPoint], list[SwingPoint]]:
        """
        شناسایی نقاط سوئینگ (قله‌ها و دره‌ها).

        یک نقطه سوئینگ بالا زمانی تشکیل می‌شود که بالاترین قیمت آن کندل
        از تمام کندل‌های اطراف (به تعداد lookback) بیشتر باشد.
        """
        n = len(highs)
        swing_highs: list[SwingPoint] = []
        swing_lows: list[SwingPoint] = []

        for i in range(lookback, n - lookback):
            # بررسی سوئینگ بالا
            is_swing_high = True
            for j in range(1, lookback + 1):
                if highs[i] <= highs[i - j] or highs[i] <= highs[i + j]:
                    is_swing_high = False
                    break
            if is_swing_high:
                swing_highs.append(SwingPoint(index=i, price=highs[i], type="high"))

            # بررسی سوئینگ پایین
            is_swing_low = True
            for j in range(1, lookback + 1):
                if lows[i] >= lows[i - j] or lows[i] >= lows[i + j]:
                    is_swing_low = False
                    break
            if is_swing_low:
                swing_lows.append(SwingPoint(index=i, price=lows[i], type="low"))

        return swing_highs, swing_lows

    # ------------------------------------------------------------------
    # اوردر بلاک
    # ------------------------------------------------------------------

    def _detect_order_blocks(
        self,
        opens: np.ndarray,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        timestamps: np.ndarray,
        atr: np.ndarray,
    ) -> list[OrderBlock]:
        """
        شناسایی اوردر بلاک‌ها.

        اوردر بلاک صعودی: آخرین کندل نزولی قبل از یک حرکت انفجاری صعودی.
        اوردر بلاک نزولی: آخرین کندل صعودی قبل از یک حرکت انفجاری نزولی.
        """
        n = len(opens)
        order_blocks: list[OrderBlock] = []

        for i in range(1, n - 1):
            body_current = abs(closes[i] - opens[i])
            body_prev = abs(closes[i - 1] - opens[i - 1])

            # حرکت انفجاری صعودی: کندل فعلی صعودی و بزرگ
            if (
                closes[i] > opens[i]
                and body_current > atr[i] * self._impulsive_multiplier
            ):
                # آخرین کندل نزولی قبل از حرکت انفجاری
                if closes[i - 1] < opens[i - 1]:
                    strength = self._calculate_ob_strength(
                        body_current, body_prev, atr[i],
                    )
                    order_blocks.append(OrderBlock(
                        index=i - 1,
                        timestamp=timestamps[i - 1],
                        type=Bias.BULLISH.value,
                        open=opens[i - 1],
                        high=highs[i - 1],
                        low=lows[i - 1],
                        close=closes[i - 1],
                        zone_high=highs[i - 1],
                        zone_low=lows[i - 1],
                        strength=strength,
                    ))
                else:
                    # جستجوی عقب‌تر برای یافتن آخرین کندل نزولی
                    for k in range(i - 1, max(i - 6, 0), -1):
                        if closes[k] < opens[k]:
                            strength = self._calculate_ob_strength(
                                body_current,
                                abs(closes[k] - opens[k]),
                                atr[i],
                            )
                            order_blocks.append(OrderBlock(
                                index=k,
                                timestamp=timestamps[k],
                                type=Bias.BULLISH.value,
                                open=opens[k],
                                high=highs[k],
                                low=lows[k],
                                close=closes[k],
                                zone_high=highs[k],
                                zone_low=lows[k],
                                strength=strength,
                            ))
                            break

            # حرکت انفجاری نزولی: کندل فعلی نزولی و بزرگ
            if (
                closes[i] < opens[i]
                and body_current > atr[i] * self._impulsive_multiplier
            ):
                # آخرین کندل صعودی قبل از حرکت انفجاری
                if closes[i - 1] > opens[i - 1]:
                    strength = self._calculate_ob_strength(
                        body_current, body_prev, atr[i],
                    )
                    order_blocks.append(OrderBlock(
                        index=i - 1,
                        timestamp=timestamps[i - 1],
                        type=Bias.BEARISH.value,
                        open=opens[i - 1],
                        high=highs[i - 1],
                        low=lows[i - 1],
                        close=closes[i - 1],
                        zone_high=highs[i - 1],
                        zone_low=lows[i - 1],
                        strength=strength,
                    ))
                else:
                    for k in range(i - 1, max(i - 6, 0), -1):
                        if closes[k] > opens[k]:
                            strength = self._calculate_ob_strength(
                                body_current,
                                abs(closes[k] - opens[k]),
                                atr[i],
                            )
                            order_blocks.append(OrderBlock(
                                index=k,
                                timestamp=timestamps[k],
                                type=Bias.BEARISH.value,
                                open=opens[k],
                                high=highs[k],
                                low=lows[k],
                                close=closes[k],
                                zone_high=highs[k],
                                zone_low=lows[k],
                                strength=strength,
                            ))
                            break

        # حذف اوردر بلاک‌های تکراری (جستجوی fallback ممکن است ایندکس یکسان
        # را چند بار اضافه کند). نگه‌داشتن اولین مورد بر اساس (index, type).
        deduped: list[OrderBlock] = []
        seen: set[tuple[int, str]] = set()
        for ob in order_blocks:
            key = (ob.index, ob.type)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(ob)

        return deduped

    @staticmethod
    def _calculate_ob_strength(
        impulsive_body: float,
        ob_body: float,
        atr_value: float,
    ) -> float:
        """
        محاسبه قدرت اوردر بلاک.

        بر اساس نسبت اندازه حرکت انفجاری به ATR و اندازه بدنه اوردر بلاک.
        """
        if atr_value <= 0:
            return 0.0

        impulse_ratio = min(impulsive_body / atr_value, 5.0) / 5.0
        ob_ratio = 1.0 - min(ob_body / atr_value, 3.0) / 3.0
        return round(np.clip(impulse_ratio * 0.6 + ob_ratio * 0.4, 0.0, 1.0), 4)

    @staticmethod
    def _check_ob_mitigation(
        order_blocks: list[OrderBlock],
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
    ) -> list[OrderBlock]:
        """
        بررسی میتیگیشن (باطل شدن) اوردر بلاک‌ها.

        اوردر بلاک صعودی زمانی میتیگیت می‌شود که قیمت با بسته‌شدن به ناحیه آن نفوذ کند.
        اوردر بلاک نزولی زمانی میتیگیت می‌شود که قیمت با بسته‌شدن به ناحیه آن نفوذ کند.
        استفاده از close (نه فتیله) از باطل‌شدن زودهنگام در لحظهٔ بهترین ورود جلوگیری می‌کند.
        """
        for ob in order_blocks:
            start_idx = ob.index + 1
            if ob.type == Bias.BULLISH.value:
                for j in range(start_idx, len(closes)):
                    if closes[j] <= ob.zone_low:
                        ob.mitigated = True
                        ob.mitigated_index = j
                        break
            elif ob.type == Bias.BEARISH.value:
                for j in range(start_idx, len(closes)):
                    if closes[j] >= ob.zone_high:
                        ob.mitigated = True
                        ob.mitigated_index = j
                        break
        return order_blocks

    # ------------------------------------------------------------------
    # شکاف ارزش منصفانه (FVG)
    # ------------------------------------------------------------------

    def _detect_fvg(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        timestamps: np.ndarray,
        atr: np.ndarray,
    ) -> list[FairValueGap]:
        """
        شناسایی شکاف‌های ارزش منصفانه (FVG).

        FVG صعودی: بالای کندل ۱ کمتر از پایین کندل ۳ — شکاف بین آن‌ها.
        FVG نزولی: پایین کندل ۱ بیشتر از بالای کندل ۳ — شکاف بین آن‌ها.
        """
        n = len(highs)
        fvgs: list[FairValueGap] = []

        for i in range(2, n):
            # FVG صعودی: high کندل اول < low کندل سوم
            if highs[i - 2] < lows[i]:
                gap_size = lows[i] - highs[i - 2]
                if atr[i] > 0 and gap_size / atr[i] >= self._fvg_min_gap_ratio:
                    fvgs.append(FairValueGap(
                        index=i - 1,
                        timestamp=timestamps[i - 1],
                        type=Bias.BULLISH.value,
                        high=lows[i],
                        low=highs[i - 2],
                        size=gap_size,
                    ))

            # FVG نزولی: low کندل اول > high کندل سوم
            if lows[i - 2] > highs[i]:
                gap_size = lows[i - 2] - highs[i]
                if atr[i] > 0 and gap_size / atr[i] >= self._fvg_min_gap_ratio:
                    fvgs.append(FairValueGap(
                        index=i - 1,
                        timestamp=timestamps[i - 1],
                        type=Bias.BEARISH.value,
                        high=lows[i - 2],
                        low=highs[i],
                        size=gap_size,
                    ))

        return fvgs

    @staticmethod
    def _check_fvg_fill(
        fvgs: list[FairValueGap],
        highs: np.ndarray,
        lows: np.ndarray,
    ) -> list[FairValueGap]:
        """
        بررسی پر شدن شکاف‌های ارزش منصفانه.

        اگر قیمت بعد از تشکیل FVG به داخل شکاف نفوذ کند، درصد پر شدن محاسبه می‌شود.
        """
        for fvg in fvgs:
            start_idx = fvg.index + 2  # بعد از سه کندل تشکیل‌دهنده
            gap_range = fvg.high - fvg.low

            if gap_range <= 0:
                continue

            max_fill = 0.0

            for j in range(start_idx, len(highs)):
                if fvg.type == Bias.BULLISH.value:
                    # قیمت از بالا به پایین FVG نفوذ می‌کند
                    if lows[j] <= fvg.high:
                        penetration = fvg.high - max(lows[j], fvg.low)
                        fill = penetration / gap_range
                        max_fill = max(max_fill, fill)
                elif fvg.type == Bias.BEARISH.value:
                    # قیمت از پایین به بالا FVG نفوذ می‌کند
                    if highs[j] >= fvg.low:
                        penetration = min(highs[j], fvg.high) - fvg.low
                        fill = penetration / gap_range
                        max_fill = max(max_fill, fill)

            fvg.fill_percentage = round(min(max_fill, 1.0), 4)
            fvg.filled = fvg.fill_percentage >= 1.0

        return fvgs

    # ------------------------------------------------------------------
    # ساختار بازار (BOS / CHoCH)
    # ------------------------------------------------------------------

    def _detect_structure(
        self,
        swing_highs: list[SwingPoint],
        swing_lows: list[SwingPoint],
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        timestamps: np.ndarray,
    ) -> list[StructureBreak]:
        """
        شناسایی شکست ساختار (BOS) و تغییر کاراکتر (CHoCH).

        BOS صعودی: شکست سوئینگ بالای قبلی در روند صعودی.
        BOS نزولی: شکست سوئینگ پایین قبلی در روند نزولی.
        CHoCH: تغییر جهت ساختار — از صعودی به نزولی یا بالعکس.
        """
        structure_breaks: list[StructureBreak] = []
        n = len(highs)

        if len(swing_highs) < 2 or len(swing_lows) < 2:
            return structure_breaks

        # ادغام و مرتب‌سازی سوئینگ‌ها بر اساس ایندکس
        all_swings: list[SwingPoint] = sorted(
            swing_highs + swing_lows, key=lambda s: s.index,
        )

        # ردیابی آخرین سوئینگ‌های مهم
        last_hh: Optional[float] = None  # آخرین higher high
        last_ll: Optional[float] = None  # آخرین lower low
        last_hl: Optional[float] = None  # آخرین higher low
        last_lh: Optional[float] = None  # آخرین lower high
        prev_trend: Optional[str] = None  # روند قبلی: 'bullish' | 'bearish'

        # بافر برای نگه‌داشتن آخرین سوئینگ‌ها
        recent_sh: list[SwingPoint] = []
        recent_sl: list[SwingPoint] = []

        for swing in all_swings:
            if swing.type == "high":
                recent_sh.append(swing)
                if len(recent_sh) < 2:
                    continue

                prev_sh = recent_sh[-2]
                curr_sh = recent_sh[-1]

                # Higher High — ادامه روند صعودی
                # نیازمند تأیید با بسته‌شدن کندل بالای سطح قبلی (نه فقط فتیله)
                # تا از چرخش کاذب بایاس در اثر استاپ‌هانت جلوگیری شود
                confirmed_high_break = any(
                    closes[k] > prev_sh.price
                    for k in range(prev_sh.index + 1, curr_sh.index + 1)
                )
                if curr_sh.price > prev_sh.price and confirmed_high_break:
                    current_trend = Bias.BULLISH.value
                    if prev_trend == Bias.BEARISH.value:
                        # تغییر کاراکتر: از نزولی به صعودی
                        structure_breaks.append(StructureBreak(
                            index=curr_sh.index,
                            timestamp=timestamps[curr_sh.index],
                            type=StructureType.CHOCH.value,
                            direction=Bias.BULLISH.value,
                            level=prev_sh.price,
                            swing_index=prev_sh.index,
                        ))
                    elif prev_trend == Bias.BULLISH.value:
                        # شکست ساختار صعودی (BOS)
                        structure_breaks.append(StructureBreak(
                            index=curr_sh.index,
                            timestamp=timestamps[curr_sh.index],
                            type=StructureType.BOS.value,
                            direction=Bias.BULLISH.value,
                            level=prev_sh.price,
                            swing_index=prev_sh.index,
                        ))
                    last_hh = curr_sh.price
                    prev_trend = current_trend

                # Lower High — نشانه ضعف صعودی
                else:
                    last_lh = curr_sh.price

            elif swing.type == "low":
                recent_sl.append(swing)
                if len(recent_sl) < 2:
                    continue

                prev_sl = recent_sl[-2]
                curr_sl = recent_sl[-1]

                # Lower Low — ادامه روند نزولی
                # نیازمند تأیید با بسته‌شدن کندل پایین سطح قبلی (نه فقط فتیله)
                confirmed_low_break = any(
                    closes[k] < prev_sl.price
                    for k in range(prev_sl.index + 1, curr_sl.index + 1)
                )
                if curr_sl.price < prev_sl.price and confirmed_low_break:
                    current_trend = Bias.BEARISH.value
                    if prev_trend == Bias.BULLISH.value:
                        # تغییر کاراکتر: از صعودی به نزولی
                        structure_breaks.append(StructureBreak(
                            index=curr_sl.index,
                            timestamp=timestamps[curr_sl.index],
                            type=StructureType.CHOCH.value,
                            direction=Bias.BEARISH.value,
                            level=prev_sl.price,
                            swing_index=prev_sl.index,
                        ))
                    elif prev_trend == Bias.BEARISH.value:
                        # شکست ساختار نزولی (BOS)
                        structure_breaks.append(StructureBreak(
                            index=curr_sl.index,
                            timestamp=timestamps[curr_sl.index],
                            type=StructureType.BOS.value,
                            direction=Bias.BEARISH.value,
                            level=prev_sl.price,
                            swing_index=prev_sl.index,
                        ))
                    last_ll = curr_sl.price
                    prev_trend = current_trend

                # Higher Low — نشانه قدرت صعودی
                else:
                    last_hl = curr_sl.price

        return structure_breaks

    # ------------------------------------------------------------------
    # نواحی عرضه و تقاضا
    # ------------------------------------------------------------------

    def _detect_supply_demand_zones(
        self,
        opens: np.ndarray,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        timestamps: np.ndarray,
        atr: np.ndarray,
    ) -> list[SupplyDemandZone]:
        """
        شناسایی نواحی عرضه و تقاضا.

        ناحیه تقاضا: محل تجمع سفارش‌های خرید نهادی — کندل‌های با حرکت قوی صعودی.
        ناحیه عرضه: محل تجمع سفارش‌های فروش نهادی — کندل‌های با حرکت قوی نزولی.
        قدرت ناحیه بر اساس شدت حرکت و حجم تعیین می‌شود.
        """
        n = len(opens)
        zones: list[SupplyDemandZone] = []

        for i in range(1, n - 1):
            body = closes[i] - opens[i]
            abs_body = abs(body)
            candle_range = highs[i] - lows[i]

            if candle_range <= 0 or atr[i] <= 0:
                continue

            # بررسی حرکت انفجاری بعد از این کندل
            if i + 1 >= n:
                continue

            next_body = abs(closes[i + 1] - opens[i + 1])

            # ناحیه تقاضا: کندل تعادل/نزولی کوچک + حرکت قوی صعودی
            if (
                abs_body <= atr[i] * 0.5
                and closes[i + 1] > opens[i + 1]
                and next_body > atr[i + 1] * self._impulsive_multiplier * 0.8
            ):
                strength = min(next_body / atr[i + 1], 5.0) / 5.0
                zone = SupplyDemandZone(
                    index=i,
                    timestamp=timestamps[i],
                    type=ZoneType.DEMAND.value,
                    high=max(opens[i], closes[i]),
                    low=lows[i],
                    strength=round(strength, 4),
                )
                zones.append(zone)

            # ناحیه عرضه: کندل تعادل/صعودی کوچک + حرکت قوی نزولی
            if (
                abs_body <= atr[i] * 0.5
                and closes[i + 1] < opens[i + 1]
                and next_body > atr[i + 1] * self._impulsive_multiplier * 0.8
            ):
                strength = min(next_body / atr[i + 1], 5.0) / 5.0
                zone = SupplyDemandZone(
                    index=i,
                    timestamp=timestamps[i],
                    type=ZoneType.SUPPLY.value,
                    high=highs[i],
                    low=min(opens[i], closes[i]),
                    strength=round(strength, 4),
                )
                zones.append(zone)

        # ادغام نواحی نزدیک
        zones = self._merge_overlapping_zones(zones)

        return zones

    def _merge_overlapping_zones(
        self,
        zones: list[SupplyDemandZone],
    ) -> list[SupplyDemandZone]:
        """
        ادغام نواحی هم‌پوشان یا بسیار نزدیک.

        نواحی هم‌نوع که فاصله بین آن‌ها کمتر از تلرانس تعریف‌شده باشد
        در یک ناحیه بزرگ‌تر ادغام می‌شوند.
        """
        if not zones:
            return zones

        merged: list[SupplyDemandZone] = []

        # گروه‌بندی بر اساس نوع
        demand_zones = sorted(
            [z for z in zones if z.type == ZoneType.DEMAND.value],
            key=lambda z: z.low,
        )
        supply_zones = sorted(
            [z for z in zones if z.type == ZoneType.SUPPLY.value],
            key=lambda z: z.low,
        )

        for group in (demand_zones, supply_zones):
            if not group:
                continue

            current = group[0]
            for i in range(1, len(group)):
                next_zone = group[i]
                mid_current = (current.high + current.low) / 2.0
                overlap_or_close = (
                    next_zone.low <= current.high
                    or (
                        mid_current > 0
                        and (next_zone.low - current.high) / mid_current
                        < self._zone_merge_tolerance
                    )
                )

                if overlap_or_close:
                    # ادغام: بازه بزرگ‌تر، قدرت بیشتر
                    current = SupplyDemandZone(
                        index=current.index,
                        timestamp=current.timestamp,
                        type=current.type,
                        high=max(current.high, next_zone.high),
                        low=min(current.low, next_zone.low),
                        strength=round(
                            max(current.strength, next_zone.strength), 4,
                        ),
                        fresh=current.fresh and next_zone.fresh,
                        test_count=current.test_count + next_zone.test_count,
                    )
                else:
                    merged.append(current)
                    current = next_zone
            merged.append(current)

        return merged

    def _update_zone_tests(
        self,
        zones: list[SupplyDemandZone],
        highs: np.ndarray,
        lows: np.ndarray,
    ) -> list[SupplyDemandZone]:
        """
        بروزرسانی تعداد تست هر ناحیه و وضعیت تازگی آن.

        هر بار که قیمت به ناحیه نزدیک شود و از آن بازگردد، یک تست
        شمارش می‌شود. بعد از حداکثر تعداد تست، ناحیه غیرتازه می‌شود.
        """
        for zone in zones:
            test_count = 0
            start_idx = zone.index + 2

            i = start_idx
            while i < len(highs):
                touched = False

                if zone.type == ZoneType.DEMAND.value:
                    # قیمت به ناحیه تقاضا رسیده
                    if lows[i] <= zone.high and lows[i] >= zone.low:
                        touched = True
                    elif lows[i] < zone.low:
                        # شکست ناحیه — دیگر معتبر نیست
                        zone.fresh = False
                        test_count += 1
                        break

                elif zone.type == ZoneType.SUPPLY.value:
                    if highs[i] >= zone.low and highs[i] <= zone.high:
                        touched = True
                    elif highs[i] > zone.high:
                        zone.fresh = False
                        test_count += 1
                        break

                if touched:
                    test_count += 1
                    # بعد از تماس، چند کندل صبر کن تا تست جدید حساب شود
                    i += 3
                    continue

                i += 1

            zone.test_count = test_count
            if test_count >= self._max_zone_tests:
                zone.fresh = False

        return zones

    # ------------------------------------------------------------------
    # جاروی نقدینگی
    # ------------------------------------------------------------------

    def _detect_liquidity_sweeps(
        self,
        swing_highs: list[SwingPoint],
        swing_lows: list[SwingPoint],
        opens: np.ndarray,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        timestamps: np.ndarray,
    ) -> list[LiquiditySweep]:
        """
        شناسایی جاروی نقدینگی.

        جاروی نقدینگی صعودی: قیمت از سطح سوئینگ پایین عبور می‌کند
        اما بسته شدن بالای آن سطح برمی‌گردد (نشان‌دهنده جمع‌آوری نقدینگی).

        جاروی نقدینگی نزولی: قیمت از سطح سوئینگ بالا عبور می‌کند
        اما بسته شدن پایین آن سطح برمی‌گردد.
        """
        n = len(opens)
        sweeps: list[LiquiditySweep] = []

        # جاروی نقدینگی پایین (زیر سوئینگ لو)
        for sl in swing_lows:
            level = sl.price
            for i in range(sl.index + 1, n):
                # فتیله از سطح عبور کرده ولی بسته شدن بالای سطح
                if lows[i] < level and closes[i] > level:
                    penetration = level - lows[i]
                    if level > 0 and penetration / level >= self._liquidity_sweep_threshold:
                        sweeps.append(LiquiditySweep(
                            index=i,
                            timestamp=timestamps[i],
                            type=Bias.BULLISH.value,
                            swept_level=level,
                            wick_high=highs[i],
                            wick_low=lows[i],
                            reclaimed=closes[i] > level,
                        ))
                    break  # فقط اولین جاروی هر سطح

        # جاروی نقدینگی بالا (بالای سوئینگ های)
        for sh in swing_highs:
            level = sh.price
            for i in range(sh.index + 1, n):
                # فتیله از سطح عبور کرده ولی بسته شدن پایین سطح
                if highs[i] > level and closes[i] < level:
                    penetration = highs[i] - level
                    if level > 0 and penetration / level >= self._liquidity_sweep_threshold:
                        sweeps.append(LiquiditySweep(
                            index=i,
                            timestamp=timestamps[i],
                            type=Bias.BEARISH.value,
                            swept_level=level,
                            wick_high=highs[i],
                            wick_low=lows[i],
                            reclaimed=closes[i] < level,
                        ))
                    break

        return sweeps

    # ------------------------------------------------------------------
    # پریمیوم / دیسکانت
    # ------------------------------------------------------------------

    def _compute_premium_discount(
        self,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        swing_highs: list[SwingPoint],
        swing_lows: list[SwingPoint],
    ) -> PremiumDiscountZone:
        """
        محاسبه ناحیه پریمیوم و دیسکانت.

        بر اساس آخرین رنج معنادار (آخرین سوئینگ‌های بالا و پایین):
        - بالای تعادل (۵۰٪): ناحیه پریمیوم (گران)
        - پایین تعادل: ناحیه دیسکانت (ارزان)
        - نزدیک تعادل: ناحیه تعادل
        """
        current_price = closes[-1]

        # تعیین رنج بر اساس آخرین سوئینگ‌ها
        if swing_highs and swing_lows:
            # آخرین سوئینگ‌های اخیر (حداکثر ۵ تای آخر)
            recent_sh = swing_highs[-5:]
            recent_sl = swing_lows[-5:]
            range_high = max(s.price for s in recent_sh)
            range_low = min(s.price for s in recent_sl)
        else:
            # اگر سوئینگ کافی نداریم، از بالاترین و پایین‌ترین استفاده کن
            lookback = min(len(highs), 50)
            range_high = float(np.max(highs[-lookback:]))
            range_low = float(np.min(lows[-lookback:]))

        if range_high <= range_low:
            range_high = float(np.max(highs[-20:]))
            range_low = float(np.min(lows[-20:]))

        total_range = range_high - range_low
        equilibrium = range_low + total_range * 0.5
        premium_level = range_low + total_range * 0.75
        discount_level = range_low + total_range * 0.25

        # تعیین ناحیه فعلی
        if total_range <= 0:
            zone = PremiumDiscount.EQUILIBRIUM.value
        elif current_price >= premium_level:
            zone = PremiumDiscount.PREMIUM.value
        elif current_price <= discount_level:
            zone = PremiumDiscount.DISCOUNT.value
        else:
            zone = PremiumDiscount.EQUILIBRIUM.value

        return PremiumDiscountZone(
            range_high=round(range_high, 5),
            range_low=round(range_low, 5),
            equilibrium=round(equilibrium, 5),
            current_price=round(current_price, 5),
            zone=zone,
            premium_level=round(premium_level, 5),
            discount_level=round(discount_level, 5),
        )

    # ------------------------------------------------------------------
    # امتیازدهی SMC
    # ------------------------------------------------------------------

    def _compute_smc_score(
        self,
        order_blocks: list[OrderBlock],
        fvgs: list[FairValueGap],
        structure_breaks: list[StructureBreak],
        zones: list[SupplyDemandZone],
        sweeps: list[LiquiditySweep],
        premium_discount: PremiumDiscountZone,
        closes: np.ndarray,
    ) -> tuple[int, str]:
        """
        محاسبه امتیاز کلی SMC و تعیین جهت‌گیری بازار.

        امتیاز بر اساس ترکیب تمام عوامل SMC محاسبه می‌شود:
        - اوردر بلاک‌های فعال (تازه)
        - شکاف‌های پر نشده
        - آخرین ساختار بازار
        - نواحی عرضه و تقاضای تازه
        - جاروهای نقدینگی اخیر
        - موقعیت در ناحیه پریمیوم/دیسکانت

        خروجی:
            (امتیاز ۰-۱۰۰, جهت‌گیری)
        """
        bullish_score: float = 0.0
        bearish_score: float = 0.0
        max_possible: float = 0.0

        # --- اوردر بلاک‌ها (وزن: ۲۵) ---
        ob_weight = 25.0
        max_possible += ob_weight
        fresh_bullish_obs = [
            ob for ob in order_blocks
            if ob.type == Bias.BULLISH.value and not ob.mitigated
        ]
        fresh_bearish_obs = [
            ob for ob in order_blocks
            if ob.type == Bias.BEARISH.value and not ob.mitigated
        ]

        if fresh_bullish_obs:
            avg_strength = np.mean([ob.strength for ob in fresh_bullish_obs])
            bullish_score += ob_weight * avg_strength
        if fresh_bearish_obs:
            avg_strength = np.mean([ob.strength for ob in fresh_bearish_obs])
            bearish_score += ob_weight * avg_strength

        # --- شکاف‌های ارزش منصفانه (وزن: ۱۵) ---
        fvg_weight = 15.0
        max_possible += fvg_weight
        unfilled_bullish_fvg = [
            f for f in fvgs
            if f.type == Bias.BULLISH.value and not f.filled
        ]
        unfilled_bearish_fvg = [
            f for f in fvgs
            if f.type == Bias.BEARISH.value and not f.filled
        ]

        if unfilled_bullish_fvg:
            count_factor = min(len(unfilled_bullish_fvg) / 3.0, 1.0)
            bullish_score += fvg_weight * count_factor
        if unfilled_bearish_fvg:
            count_factor = min(len(unfilled_bearish_fvg) / 3.0, 1.0)
            bearish_score += fvg_weight * count_factor

        # --- ساختار بازار (وزن: ۲۵) ---
        structure_weight = 25.0
        max_possible += structure_weight
        if structure_breaks:
            last_structure = structure_breaks[-1]
            if last_structure.direction == Bias.BULLISH.value:
                # CHoCH وزن بیشتری دارد
                multiplier = 1.0 if last_structure.type == StructureType.CHOCH.value else 0.7
                bullish_score += structure_weight * multiplier
            else:
                multiplier = 1.0 if last_structure.type == StructureType.CHOCH.value else 0.7
                bearish_score += structure_weight * multiplier

        # --- نواحی عرضه و تقاضا (وزن: ۱۵) ---
        zone_weight = 15.0
        max_possible += zone_weight
        fresh_demand = [z for z in zones if z.type == ZoneType.DEMAND.value and z.fresh]
        fresh_supply = [z for z in zones if z.type == ZoneType.SUPPLY.value and z.fresh]

        current_price = closes[-1]

        # بررسی نزدیکی قیمت به نواحی
        for z in fresh_demand:
            if z.low <= current_price <= z.high * 1.005:
                bullish_score += zone_weight * z.strength
                break
        for z in fresh_supply:
            if z.low * 0.995 <= current_price <= z.high:
                bearish_score += zone_weight * z.strength
                break

        # --- جاروی نقدینگی (وزن: ۱۰) ---
        sweep_weight = 10.0
        max_possible += sweep_weight

        # فقط جاروهای اخیر (۲۰ کندل آخر)
        recent_threshold = len(closes) - 20
        # نکته: reclaimed در زمان تشخیص همیشه True است (سویپ فقط با بازپس‌گیری
        # close ثبت می‌شود)، پس گارد `and s.reclaimed` حشو بود و حذف شد.
        recent_bull_sweeps = [
            s for s in sweeps
            if s.type == Bias.BULLISH.value
            and s.index >= recent_threshold
        ]
        recent_bear_sweeps = [
            s for s in sweeps
            if s.type == Bias.BEARISH.value
            and s.index >= recent_threshold
        ]

        if recent_bull_sweeps:
            bullish_score += sweep_weight * min(len(recent_bull_sweeps) / 2.0, 1.0)
        if recent_bear_sweeps:
            bearish_score += sweep_weight * min(len(recent_bear_sweeps) / 2.0, 1.0)

        # --- پریمیوم/دیسکانت (وزن: ۱۰) ---
        pd_weight = 10.0
        max_possible += pd_weight

        if premium_discount.zone == PremiumDiscount.DISCOUNT.value:
            bullish_score += pd_weight * 0.8
        elif premium_discount.zone == PremiumDiscount.PREMIUM.value:
            bearish_score += pd_weight * 0.8
        else:
            bullish_score += pd_weight * 0.1
            bearish_score += pd_weight * 0.1

        # --- محاسبه نهایی ---
        total_score = bullish_score + bearish_score
        max_possible = max(max_possible, 1.0)

        # امتیاز بر مبنای قدرت هم‌راستایی
        if total_score == 0:
            return 0, Bias.NEUTRAL.value

        dominant = max(bullish_score, bearish_score)
        alignment = dominant / max_possible
        confidence = abs(bullish_score - bearish_score) / max(total_score, 1.0)

        smc_score = int(np.clip(round(alignment * 60 + confidence * 40), 0, 100))

        # تعیین جهت‌گیری
        score_diff = bullish_score - bearish_score
        threshold = max_possible * 0.05  # آستانه ۵٪ برای تعیین جهت

        if score_diff > threshold:
            smc_bias = Bias.BULLISH.value
        elif score_diff < -threshold:
            smc_bias = Bias.BEARISH.value
        else:
            smc_bias = Bias.NEUTRAL.value

        return smc_score, smc_bias

    # ------------------------------------------------------------------
    # تبدیل به دیکشنری
    # ------------------------------------------------------------------

    @staticmethod
    def _ob_to_dict(ob: OrderBlock) -> dict:
        """تبدیل اوردر بلاک به دیکشنری"""
        return {
            "index": ob.index,
            "timestamp": str(ob.timestamp),
            "type": ob.type,
            "open": ob.open,
            "high": ob.high,
            "low": ob.low,
            "close": ob.close,
            "zone_high": ob.zone_high,
            "zone_low": ob.zone_low,
            "strength": ob.strength,
            "mitigated": ob.mitigated,
            "mitigated_index": ob.mitigated_index,
        }

    @staticmethod
    def _fvg_to_dict(fvg: FairValueGap) -> dict:
        """تبدیل شکاف ارزش منصفانه به دیکشنری"""
        return {
            "index": fvg.index,
            "timestamp": str(fvg.timestamp),
            "type": fvg.type,
            "high": fvg.high,
            "low": fvg.low,
            "size": fvg.size,
            "filled": fvg.filled,
            "fill_percentage": fvg.fill_percentage,
        }

    @staticmethod
    def _structure_to_dict(s: StructureBreak) -> dict:
        """تبدیل شکست ساختار به دیکشنری"""
        return {
            "index": s.index,
            "timestamp": str(s.timestamp),
            "type": s.type,
            "direction": s.direction,
            "level": s.level,
            "swing_index": s.swing_index,
        }

    @staticmethod
    def _zone_to_dict(z: SupplyDemandZone) -> dict:
        """تبدیل ناحیه عرضه/تقاضا به دیکشنری"""
        return {
            "index": z.index,
            "timestamp": str(z.timestamp),
            "type": z.type,
            "high": z.high,
            "low": z.low,
            "strength": z.strength,
            "fresh": z.fresh,
            "test_count": z.test_count,
        }

    @staticmethod
    def _sweep_to_dict(s: LiquiditySweep) -> dict:
        """تبدیل جاروی نقدینگی به دیکشنری"""
        return {
            "index": s.index,
            "timestamp": str(s.timestamp),
            "type": s.type,
            "swept_level": s.swept_level,
            "wick_high": s.wick_high,
            "wick_low": s.wick_low,
            "reclaimed": s.reclaimed,
        }

    @staticmethod
    def _pd_to_dict(pd_zone: PremiumDiscountZone) -> dict:
        """تبدیل ناحیه پریمیوم/دیسکانت به دیکشنری"""
        return {
            "range_high": pd_zone.range_high,
            "range_low": pd_zone.range_low,
            "equilibrium": pd_zone.equilibrium,
            "current_price": pd_zone.current_price,
            "zone": pd_zone.zone,
            "premium_level": pd_zone.premium_level,
            "discount_level": pd_zone.discount_level,
        }

    @staticmethod
    def _empty_result() -> dict:
        """خروجی خالی در صورت عدم کفایت داده"""
        return {
            "order_blocks": [],
            "fair_value_gaps": [],
            "structure": [],
            "supply_demand_zones": [],
            "liquidity_sweeps": [],
            "premium_discount": {},
            "smc_score": 0,
            "smc_bias": Bias.NEUTRAL.value,
        }
