"""
ماژول تحلیل تکنیکال جامع برای پلتفرم سیگنال فارکس.

این ماژول شامل اندیکاتورهای روند، مومنتوم، نوسان و حجم می‌باشد.
هر اندیکاتور امتیازی بین صفر تا صد تولید می‌کند و نتیجه نهایی
میانگین وزنی تمام اندیکاتورهاست.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import pandas_ta as ta

from src.core.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# ثابت‌ها و انواع کمکی
# ---------------------------------------------------------------------------

class Signal(Enum):
    """نوع سیگنال تولید شده توسط هر اندیکاتور."""

    STRONG_BULLISH = "strong_bullish"
    BULLISH = "bullish"
    NEUTRAL = "neutral"
    BEARISH = "bearish"
    STRONG_BEARISH = "strong_bearish"


# نگاشت سیگنال به امتیاز عددی (۰ تا ۱۰۰)
_SIGNAL_SCORE: Dict[Signal, float] = {
    Signal.STRONG_BULLISH: 100.0,
    Signal.BULLISH: 75.0,
    Signal.NEUTRAL: 50.0,
    Signal.BEARISH: 25.0,
    Signal.STRONG_BEARISH: 0.0,
}


@dataclass
class IndicatorResult:
    """نتیجه محاسبه یک اندیکاتور."""

    name: str
    signal: Signal
    score: float
    details: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# وزن‌های دسته‌بندی‌ها
# ---------------------------------------------------------------------------

_CATEGORY_WEIGHTS: Dict[str, float] = {
    "trend": 0.35,
    "momentum": 0.30,
    "volatility": 0.15,
    "volume": 0.20,
}


# ---------------------------------------------------------------------------
# توابع کمکی
# ---------------------------------------------------------------------------

def _safe_last(series: pd.Series) -> Optional[float]:
    """آخرین مقدار معتبر یک سری را برمی‌گرداند؛ اگر خالی باشد None."""
    if series is None or series.empty:
        return None
    val = series.iloc[-1]
    if pd.isna(val):
        return None
    return float(val)


def _safe_prev(series: pd.Series, offset: int = 1) -> Optional[float]:
    """مقدار قبلی (با فاصله *offset*) یک سری را برمی‌گرداند."""
    if series is None or len(series) <= offset:
        return None
    val = series.iloc[-(offset + 1)]
    if pd.isna(val):
        return None
    return float(val)


def _detect_divergence(
    price: pd.Series,
    indicator: pd.Series,
    lookback: int = 30,
) -> Tuple[bool, bool, bool, bool]:
    """
    واگرایی معمولی و مخفی را بین قیمت و اندیکاتور تشخیص می‌دهد.

    Returns:
        (regular_bullish, regular_bearish, hidden_bullish, hidden_bearish)
    """
    if price is None or indicator is None:
        return False, False, False, False
    if len(price) < lookback or len(indicator) < lookback:
        return False, False, False, False

    p = price.iloc[-lookback:].values
    ind = indicator.iloc[-lookback:].values

    # حذف NaN
    mask = ~(np.isnan(p) | np.isnan(ind))
    p = p[mask]
    ind = ind[mask]
    if len(p) < 10:
        return False, False, False, False

    mid = len(p) // 2

    # کف‌ها و سقف‌های محلی
    p_first_low = np.min(p[:mid])
    p_second_low = np.min(p[mid:])
    ind_first_low = ind[:mid][np.argmin(p[:mid])]
    ind_second_low = ind[mid:][np.argmin(p[mid:])]

    p_first_high = np.max(p[:mid])
    p_second_high = np.max(p[mid:])
    ind_first_high = ind[:mid][np.argmax(p[:mid])]
    ind_second_high = ind[mid:][np.argmax(p[mid:])]

    # واگرایی معمولی صعودی: قیمت کف پایین‌تر، اندیکاتور کف بالاتر
    regular_bullish = (p_second_low < p_first_low) and (ind_second_low > ind_first_low)

    # واگرایی معمولی نزولی: قیمت سقف بالاتر، اندیکاتور سقف پایین‌تر
    regular_bearish = (p_second_high > p_first_high) and (ind_second_high < ind_first_high)

    # واگرایی مخفی صعودی: قیمت کف بالاتر، اندیکاتور کف پایین‌تر
    hidden_bullish = (p_second_low > p_first_low) and (ind_second_low < ind_first_low)

    # واگرایی مخفی نزولی: قیمت سقف پایین‌تر، اندیکاتور سقف بالاتر
    hidden_bearish = (p_second_high < p_first_high) and (ind_second_high > ind_first_high)

    return regular_bullish, regular_bearish, hidden_bullish, hidden_bearish


# ---------------------------------------------------------------------------
# کلاس اصلی تحلیل تکنیکال
# ---------------------------------------------------------------------------

class TechnicalAnalyzer:
    """
    تحلیل‌گر تکنیکال جامع.

    این کلاس تمامی اندیکاتورهای روند، مومنتوم، نوسان و حجم را محاسبه
    کرده و یک امتیاز نهایی (۰ تا ۱۰۰) به همراه جزئیات کامل برمی‌گرداند.
    """

    # -- پارامترهای پیش‌فرض اندیکاتورها --
    EMA_FAST: int = 20
    EMA_MID: int = 50
    EMA_SLOW: int = 200
    SUPERTREND_LENGTH: int = 10
    SUPERTREND_MULT: float = 3.0
    ADX_LENGTH: int = 14
    VWMA_LENGTH: int = 20

    RSI_LENGTH: int = 14
    MACD_FAST: int = 12
    MACD_SLOW: int = 26
    MACD_SIGNAL: int = 9
    STOCH_K: int = 14
    STOCH_D: int = 3
    STOCH_SMOOTH: int = 3
    WILLIAMS_LENGTH: int = 14
    CCI_LENGTH: int = 20
    ROC_LENGTH: int = 12
    UO_SHORT: int = 7
    UO_MID: int = 14
    UO_LONG: int = 28

    ATR_LENGTH: int = 14
    BB_LENGTH: int = 20
    BB_STD: float = 2.0
    KC_LENGTH: int = 20
    KC_MULT: float = 1.5
    DC_LENGTH: int = 20
    HV_LENGTH: int = 20

    MFI_LENGTH: int = 14
    CMF_LENGTH: int = 20

    DIVERGENCE_LOOKBACK: int = 30
    MIN_BARS: int = 250

    # تعداد کندل در هر روز معاملاتی برای سالانه‌سازی نوسان تاریخی
    _BARS_PER_DAY: Dict[str, int] = {"M15": 96, "H1": 24, "H4": 6, "D1": 1}

    def __init__(self) -> None:
        """سازنده کلاس تحلیل‌گر."""
        logger.info("TechnicalAnalyzer مقداردهی اولیه شد.")

    # ===================================================================
    # متد اصلی
    # ===================================================================

    def analyze(self, df: pd.DataFrame, timeframe: Optional[str] = None) -> Dict[str, Any]:
        """
        تحلیل تکنیکال کامل روی دیتافریم قیمتی انجام می‌دهد.

        Args:
            df: دیتافریم با ستون‌های [timestamp, open, high, low, close, volume].
            timeframe: تایم‌فریم کندل‌ها (مثل "M15"، "H1"، "H4"، "D1") برای
                سالانه‌سازی صحیح نوسان تاریخی.

        Returns:
            دیکشنری شامل امتیاز کل، امتیاز هر دسته و جزئیات هر اندیکاتور.
        """
        self._validate(df)
        df = df.copy().reset_index(drop=True)

        # اطمینان از نوع عددی
        for col in ("open", "high", "low", "close", "volume"):
            df[col] = pd.to_numeric(df[col], errors="coerce")

        trend_results: List[IndicatorResult] = self._analyze_trend(df)
        momentum_results: List[IndicatorResult] = self._analyze_momentum(df)
        volatility_results: List[IndicatorResult] = self._analyze_volatility(df, timeframe)
        volume_results: List[IndicatorResult] = self._analyze_volume(df)

        category_scores: Dict[str, float] = {
            "trend": self._avg_score(trend_results),
            "momentum": self._avg_score(momentum_results),
            "volatility": self._avg_score(volatility_results),
            "volume": self._avg_score(volume_results),
        }

        technical_score: float = sum(
            category_scores[cat] * _CATEGORY_WEIGHTS[cat]
            for cat in _CATEGORY_WEIGHTS
        )

        overall_signal: Signal = self._score_to_signal(technical_score)

        result: Dict[str, Any] = {
            "technical_score": round(technical_score, 2),
            "signal": overall_signal.value,
            "category_scores": {k: round(v, 2) for k, v in category_scores.items()},
            "trend": self._results_to_dicts(trend_results),
            "momentum": self._results_to_dicts(momentum_results),
            "volatility": self._results_to_dicts(volatility_results),
            "volume": self._results_to_dicts(volume_results),
        }

        logger.info(
            "تحلیل تکنیکال انجام شد — امتیاز: %.2f — سیگنال: %s",
            technical_score,
            overall_signal.value,
        )
        return result

    # ===================================================================
    # اعتبارسنجی
    # ===================================================================

    def _validate(self, df: pd.DataFrame) -> None:
        """اعتبارسنجی ستون‌ها و حداقل تعداد ردیف‌ها."""
        required: set[str] = {"timestamp", "open", "high", "low", "close", "volume"}
        missing: set[str] = required - set(df.columns)
        if missing:
            raise ValueError(f"ستون‌های زیر در دیتافریم وجود ندارد: {missing}")
        if len(df) < self.MIN_BARS:
            logger.warning(
                "تعداد کندل‌ها (%d) کمتر از حداقل توصیه‌شده (%d) است.",
                len(df),
                self.MIN_BARS,
            )

    # ===================================================================
    # توابع کمکی امتیازدهی
    # ===================================================================

    @staticmethod
    def _avg_score(results: List[IndicatorResult]) -> float:
        """میانگین امتیاز لیستی از نتایج اندیکاتور."""
        if not results:
            return 50.0
        return sum(r.score for r in results) / len(results)

    @staticmethod
    def _score_to_signal(score: float) -> Signal:
        """تبدیل امتیاز عددی به سیگنال."""
        if score >= 80.0:
            return Signal.STRONG_BULLISH
        if score >= 60.0:
            return Signal.BULLISH
        if score >= 40.0:
            return Signal.NEUTRAL
        if score >= 20.0:
            return Signal.BEARISH
        return Signal.STRONG_BEARISH

    @staticmethod
    def _results_to_dicts(results: List[IndicatorResult]) -> List[Dict[str, Any]]:
        """تبدیل لیست نتایج به لیست دیکشنری."""
        return [
            {
                "name": r.name,
                "signal": r.signal.value,
                "score": round(r.score, 2),
                "details": r.details,
            }
            for r in results
        ]

    # ===================================================================
    # اندیکاتورهای روند
    # ===================================================================

    def _analyze_trend(self, df: pd.DataFrame) -> List[IndicatorResult]:
        """
        تحلیل اندیکاتورهای روند شامل:
        EMA، سوپرترند، ایچیموکو، ADX، پارابولیک SAR و VWMA.
        """
        results: List[IndicatorResult] = []

        results.append(self._calc_ema_cross(df))
        results.append(self._calc_supertrend(df))
        results.append(self._calc_ichimoku(df))
        results.append(self._calc_adx(df))
        results.append(self._calc_psar(df))
        results.append(self._calc_vwma(df))

        return results

    # -- EMA Golden/Death Cross --

    def _calc_ema_cross(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه میانگین متحرک نمایی و تشخیص تقاطع طلایی / مرگ.

        EMA(20), EMA(50), EMA(200) محاسبه شده و وضعیت تقاطع‌ها بررسی می‌شود.
        """
        close: pd.Series = df["close"]
        ema_fast: pd.Series = ta.ema(close, length=self.EMA_FAST)
        ema_mid: pd.Series = ta.ema(close, length=self.EMA_MID)
        ema_slow: pd.Series = ta.ema(close, length=self.EMA_SLOW)

        ef: Optional[float] = _safe_last(ema_fast)
        em: Optional[float] = _safe_last(ema_mid)
        es: Optional[float] = _safe_last(ema_slow)
        price: Optional[float] = _safe_last(close)

        ef_prev: Optional[float] = _safe_prev(ema_fast)
        em_prev: Optional[float] = _safe_prev(ema_mid)

        if None in (ef, em, es, price, ef_prev, em_prev):
            return IndicatorResult("EMA_Cross", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        golden_cross: bool = (ef_prev <= em_prev) and (ef > em)
        death_cross: bool = (ef_prev >= em_prev) and (ef < em)
        bullish_alignment: bool = (ef > em > es)
        bearish_alignment: bool = (ef < em < es)
        price_above_200: bool = price > es

        score: float = 50.0
        if golden_cross:
            score += 25.0
        if death_cross:
            score -= 25.0
        if bullish_alignment:
            score += 15.0
        elif bearish_alignment:
            score -= 15.0
        if price_above_200:
            score += 10.0
        else:
            score -= 10.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="EMA_Cross",
            signal=signal,
            score=score,
            details={
                "ema_20": round(ef, 5),
                "ema_50": round(em, 5),
                "ema_200": round(es, 5),
                "golden_cross": golden_cross,
                "death_cross": death_cross,
                "bullish_alignment": bullish_alignment,
                "bearish_alignment": bearish_alignment,
                "price_above_200": price_above_200,
            },
        )

    # -- SuperTrend --

    def _calc_supertrend(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه سوپرترند و تشخیص جهت روند.

        از ATR با طول ۱۰ و ضریب ۳ استفاده می‌شود.
        """
        st_df: pd.DataFrame = ta.supertrend(
            df["high"],
            df["low"],
            df["close"],
            length=self.SUPERTREND_LENGTH,
            multiplier=self.SUPERTREND_MULT,
        )

        if st_df is None or st_df.empty:
            return IndicatorResult("SuperTrend", Signal.NEUTRAL, 50.0, {"error": "محاسبه ناموفق"})

        direction_col: str = f"SUPERTd_{self.SUPERTREND_LENGTH}_{self.SUPERTREND_MULT}"
        value_col: str = f"SUPERT_{self.SUPERTREND_LENGTH}_{self.SUPERTREND_MULT}"

        direction: Optional[float] = _safe_last(st_df[direction_col])
        st_value: Optional[float] = _safe_last(st_df[value_col])
        prev_direction: Optional[float] = _safe_prev(st_df[direction_col])
        price: Optional[float] = _safe_last(df["close"])

        if direction is None or st_value is None or price is None:
            return IndicatorResult("SuperTrend", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        is_bullish: bool = direction == 1
        flip_bull: bool = (prev_direction is not None) and (prev_direction == -1) and (direction == 1)
        flip_bear: bool = (prev_direction is not None) and (prev_direction == 1) and (direction == -1)

        score: float = 50.0
        if is_bullish:
            score += 20.0
        else:
            score -= 20.0
        if flip_bull:
            score += 15.0
        if flip_bear:
            score -= 15.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="SuperTrend",
            signal=signal,
            score=score,
            details={
                "value": round(st_value, 5),
                "direction": "bullish" if is_bullish else "bearish",
                "flip_bullish": flip_bull,
                "flip_bearish": flip_bear,
            },
        )

    # -- Ichimoku --

    def _calc_ichimoku(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه ابر ایچیموکو شامل:
        - تقاطع تنکان‌سن و کیجون‌سن (TK Cross)
        - شکست ابر کومو (Kumo Breakout)
        - تأیید چیکو اسپن (Chikou Confirmation)
        """
        ichimoku_df, _ = ta.ichimoku(df["high"], df["low"], df["close"])

        if ichimoku_df is None or ichimoku_df.empty:
            return IndicatorResult("Ichimoku", Signal.NEUTRAL, 50.0, {"error": "محاسبه ناموفق"})

        tenkan_col: str = "ITS_9"
        kijun_col: str = "IKS_26"
        span_a_col: str = "ISA_9"
        span_b_col: str = "ISB_26"

        tenkan: Optional[float] = _safe_last(ichimoku_df[tenkan_col])
        kijun: Optional[float] = _safe_last(ichimoku_df[kijun_col])
        # ابرِ «جاری» که قیمت در آن است = سنکو اسپنِ محاسبه‌شده ۲۶ دوره قبل (displacement)
        # بدون این shift، با ابرِ آینده مقایسه می‌شد و repaint می‌داد.
        span_a: Optional[float] = _safe_last(ichimoku_df[span_a_col].shift(26))
        span_b: Optional[float] = _safe_last(ichimoku_df[span_b_col].shift(26))
        price: Optional[float] = _safe_last(df["close"])

        tenkan_prev: Optional[float] = _safe_prev(ichimoku_df[tenkan_col])
        kijun_prev: Optional[float] = _safe_prev(ichimoku_df[kijun_col])

        if None in (tenkan, kijun, span_a, span_b, price):
            return IndicatorResult("Ichimoku", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        # TK Cross
        tk_bullish: bool = False
        tk_bearish: bool = False
        if tenkan_prev is not None and kijun_prev is not None:
            tk_bullish = (tenkan_prev <= kijun_prev) and (tenkan > kijun)
            tk_bearish = (tenkan_prev >= kijun_prev) and (tenkan < kijun)

        # Kumo Breakout
        kumo_top: float = max(span_a, span_b)
        kumo_bottom: float = min(span_a, span_b)
        above_kumo: bool = price > kumo_top
        below_kumo: bool = price < kumo_bottom
        inside_kumo: bool = not above_kumo and not below_kumo

        # Bullish kumo: span_a > span_b
        bullish_kumo: bool = span_a > span_b

        # Chikou confirmation — تست استانداردِ غیر-repaint:
        # قیمتِ بسته‌شدنِ جاری در برابر قیمتِ ۲۶ کندل قبل.
        chikou_bullish: bool = False
        chikou_bearish: bool = False
        if len(df) > 26:
            cur_close = float(df["close"].iloc[-1])
            close_26_ago = float(df["close"].iloc[-27])
            chikou_bullish = cur_close > close_26_ago
            chikou_bearish = cur_close < close_26_ago

        score: float = 50.0
        if tk_bullish:
            score += 12.0
        if tk_bearish:
            score -= 12.0
        if above_kumo:
            score += 12.0
        elif below_kumo:
            score -= 12.0
        if bullish_kumo:
            score += 6.0
        else:
            score -= 6.0
        if chikou_bullish:
            score += 8.0
        elif chikou_bearish:
            score -= 8.0
        # تقاطع TK بالای ابر قوی‌تر است
        if tk_bullish and above_kumo:
            score += 6.0
        if tk_bearish and below_kumo:
            score -= 6.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="Ichimoku",
            signal=signal,
            score=score,
            details={
                "tenkan_sen": round(tenkan, 5),
                "kijun_sen": round(kijun, 5),
                "span_a": round(span_a, 5),
                "span_b": round(span_b, 5),
                "tk_bullish_cross": tk_bullish,
                "tk_bearish_cross": tk_bearish,
                "price_vs_kumo": "above" if above_kumo else ("below" if below_kumo else "inside"),
                "bullish_kumo": bullish_kumo,
                "chikou_bullish": chikou_bullish,
                "chikou_bearish": chikou_bearish,
            },
        )

    # -- ADX --

    def _calc_adx(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه شاخص جهت‌دار میانگین (ADX) برای سنجش قدرت روند.

        ADX بالای ۲۵ نشان‌دهنده روند قوی و زیر ۲۰ بازار رنج است.
        """
        adx_df: pd.DataFrame = ta.adx(df["high"], df["low"], df["close"], length=self.ADX_LENGTH)

        if adx_df is None or adx_df.empty:
            return IndicatorResult("ADX", Signal.NEUTRAL, 50.0, {"error": "محاسبه ناموفق"})

        adx_col: str = f"ADX_{self.ADX_LENGTH}"
        dmp_col: str = f"DMP_{self.ADX_LENGTH}"
        dmn_col: str = f"DMN_{self.ADX_LENGTH}"

        adx_val: Optional[float] = _safe_last(adx_df[adx_col])
        dmp_val: Optional[float] = _safe_last(adx_df[dmp_col])
        dmn_val: Optional[float] = _safe_last(adx_df[dmn_col])

        if None in (adx_val, dmp_val, dmn_val):
            return IndicatorResult("ADX", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        is_trending: bool = adx_val >= 25.0
        strong_trend: bool = adx_val >= 40.0
        bullish_di: bool = dmp_val > dmn_val

        score: float = 50.0
        if is_trending:
            if bullish_di:
                score += 15.0
                if strong_trend:
                    score += 10.0
            else:
                score -= 15.0
                if strong_trend:
                    score -= 10.0
        # بازار رنج — خنثی
        # DI+ > DI- بدون روند قوی
        if not is_trending and bullish_di:
            score += 5.0
        elif not is_trending and not bullish_di:
            score -= 5.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="ADX",
            signal=signal,
            score=score,
            details={
                "adx": round(adx_val, 2),
                "di_plus": round(dmp_val, 2),
                "di_minus": round(dmn_val, 2),
                "is_trending": is_trending,
                "strong_trend": strong_trend,
                "bullish_di": bullish_di,
            },
        )

    # -- Parabolic SAR --

    def _calc_psar(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه پارابولیک SAR برای تشخیص نقاط بازگشت روند.

        اگر SAR زیر قیمت باشد روند صعودی و بالعکس.
        """
        psar_df: pd.DataFrame = ta.psar(df["high"], df["low"], df["close"])

        if psar_df is None or psar_df.empty:
            return IndicatorResult("PSAR", Signal.NEUTRAL, 50.0, {"error": "محاسبه ناموفق"})

        # pandas_ta ستون‌های PSARl (long) و PSARs (short) تولید می‌کند
        long_col: Optional[str] = None
        short_col: Optional[str] = None
        for col in psar_df.columns:
            if col.startswith("PSARl"):
                long_col = col
            elif col.startswith("PSARs"):
                short_col = col

        price: Optional[float] = _safe_last(df["close"])
        if price is None:
            return IndicatorResult("PSAR", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        psar_long: Optional[float] = _safe_last(psar_df[long_col]) if long_col else None
        psar_short: Optional[float] = _safe_last(psar_df[short_col]) if short_col else None

        # تشخیص تغییر جهت (flip)
        psar_long_prev: Optional[float] = _safe_prev(psar_df[long_col]) if long_col else None
        psar_short_prev: Optional[float] = _safe_prev(psar_df[short_col]) if short_col else None

        is_bullish: bool = psar_long is not None and not np.isnan(psar_long)
        is_bearish: bool = psar_short is not None and not np.isnan(psar_short)

        # Flip detection
        was_bearish: bool = psar_short_prev is not None and not np.isnan(psar_short_prev)
        was_bullish: bool = psar_long_prev is not None and not np.isnan(psar_long_prev)
        flip_to_bull: bool = is_bullish and was_bearish
        flip_to_bear: bool = is_bearish and was_bullish

        sar_value: float = psar_long if is_bullish else (psar_short if is_bearish else price)

        score: float = 50.0
        if is_bullish:
            score += 20.0
        elif is_bearish:
            score -= 20.0
        if flip_to_bull:
            score += 10.0
        if flip_to_bear:
            score -= 10.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="PSAR",
            signal=signal,
            score=score,
            details={
                "sar_value": round(sar_value, 5),
                "direction": "bullish" if is_bullish else "bearish",
                "flip_to_bullish": flip_to_bull,
                "flip_to_bearish": flip_to_bear,
            },
        )

    # -- VWMA --

    def _calc_vwma(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه میانگین متحرک وزنی حجمی.

        اگر قیمت بالای VWMA باشد تأیید صعودی و بالعکس.
        """
        vwma: pd.Series = ta.vwma(df["close"], df["volume"], length=self.VWMA_LENGTH)

        vwma_val: Optional[float] = _safe_last(vwma)
        price: Optional[float] = _safe_last(df["close"])

        if vwma_val is None or price is None:
            return IndicatorResult("VWMA", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        above: bool = price > vwma_val
        distance_pct: float = ((price - vwma_val) / vwma_val) * 100.0

        score: float = 50.0
        if above:
            score += min(abs(distance_pct) * 5.0, 25.0)
        else:
            score -= min(abs(distance_pct) * 5.0, 25.0)

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="VWMA",
            signal=signal,
            score=score,
            details={
                "vwma_20": round(vwma_val, 5),
                "price": round(price, 5),
                "price_above_vwma": above,
                "distance_pct": round(distance_pct, 3),
            },
        )

    # ===================================================================
    # اندیکاتورهای مومنتوم
    # ===================================================================

    def _analyze_momentum(self, df: pd.DataFrame) -> List[IndicatorResult]:
        """
        تحلیل اندیکاتورهای مومنتوم شامل:
        RSI، MACD، استوکستیک، ویلیامز %R، CCI، ROC و اسیلاتور نهایی.
        """
        results: List[IndicatorResult] = []

        results.append(self._calc_rsi(df))
        results.append(self._calc_macd(df))
        results.append(self._calc_stochastic(df))
        results.append(self._calc_williams_r(df))
        results.append(self._calc_cci(df))
        results.append(self._calc_roc(df))
        results.append(self._calc_ultimate_oscillator(df))

        return results

    # -- RSI --

    def _calc_rsi(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه شاخص قدرت نسبی (RSI) با تشخیص واگرایی معمولی و مخفی.

        RSI بالای ۷۰ اشباع خرید، زیر ۳۰ اشباع فروش.
        """
        rsi: pd.Series = ta.rsi(df["close"], length=self.RSI_LENGTH)

        rsi_val: Optional[float] = _safe_last(rsi)
        if rsi_val is None:
            return IndicatorResult("RSI", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        overbought: bool = rsi_val >= 70.0
        oversold: bool = rsi_val <= 30.0

        reg_bull, reg_bear, hid_bull, hid_bear = _detect_divergence(
            df["close"], rsi, self.DIVERGENCE_LOOKBACK,
        )

        score: float = 50.0
        # ناحیه اشباع
        if oversold:
            score += 15.0  # احتمال بازگشت صعودی
        elif overbought:
            score -= 15.0  # احتمال بازگشت نزولی
        else:
            # RSI بین ۵۰-۷۰ صعودی، ۳۰-۵۰ نزولی
            if rsi_val > 50.0:
                score += (rsi_val - 50.0) * 0.5
            else:
                score -= (50.0 - rsi_val) * 0.5

        # واگرایی‌ها
        if reg_bull:
            score += 12.0
        if reg_bear:
            score -= 12.0
        if hid_bull:
            score += 8.0
        if hid_bear:
            score -= 8.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="RSI",
            signal=signal,
            score=score,
            details={
                "rsi": round(rsi_val, 2),
                "overbought": overbought,
                "oversold": oversold,
                "regular_bullish_divergence": reg_bull,
                "regular_bearish_divergence": reg_bear,
                "hidden_bullish_divergence": hid_bull,
                "hidden_bearish_divergence": hid_bear,
            },
        )

    # -- MACD --

    def _calc_macd(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه MACD شامل تقاطع خط سیگنال، جهت هیستوگرام و واگرایی.

        MACD(12,26,9) استفاده می‌شود.
        """
        macd_df: pd.DataFrame = ta.macd(
            df["close"],
            fast=self.MACD_FAST,
            slow=self.MACD_SLOW,
            signal=self.MACD_SIGNAL,
        )

        if macd_df is None or macd_df.empty:
            return IndicatorResult("MACD", Signal.NEUTRAL, 50.0, {"error": "محاسبه ناموفق"})

        macd_col: str = f"MACD_{self.MACD_FAST}_{self.MACD_SLOW}_{self.MACD_SIGNAL}"
        signal_col: str = f"MACDs_{self.MACD_FAST}_{self.MACD_SLOW}_{self.MACD_SIGNAL}"
        hist_col: str = f"MACDh_{self.MACD_FAST}_{self.MACD_SLOW}_{self.MACD_SIGNAL}"

        macd_val: Optional[float] = _safe_last(macd_df[macd_col])
        signal_val: Optional[float] = _safe_last(macd_df[signal_col])
        hist_val: Optional[float] = _safe_last(macd_df[hist_col])

        macd_prev: Optional[float] = _safe_prev(macd_df[macd_col])
        signal_prev: Optional[float] = _safe_prev(macd_df[signal_col])
        hist_prev: Optional[float] = _safe_prev(macd_df[hist_col])

        if None in (macd_val, signal_val, hist_val):
            return IndicatorResult("MACD", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        # تقاطع
        bullish_cross: bool = False
        bearish_cross: bool = False
        if macd_prev is not None and signal_prev is not None:
            bullish_cross = (macd_prev <= signal_prev) and (macd_val > signal_val)
            bearish_cross = (macd_prev >= signal_prev) and (macd_val < signal_val)

        # جهت هیستوگرام
        hist_rising: bool = False
        hist_falling: bool = False
        if hist_prev is not None:
            hist_rising = hist_val > hist_prev
            hist_falling = hist_val < hist_prev

        above_zero: bool = macd_val > 0

        # واگرایی
        reg_bull, reg_bear, hid_bull, hid_bear = _detect_divergence(
            df["close"], macd_df[macd_col], self.DIVERGENCE_LOOKBACK,
        )

        score: float = 50.0
        if bullish_cross:
            score += 15.0
        if bearish_cross:
            score -= 15.0
        if above_zero:
            score += 5.0
        else:
            score -= 5.0
        if hist_rising:
            score += 8.0
        elif hist_falling:
            score -= 8.0
        if reg_bull:
            score += 10.0
        if reg_bear:
            score -= 10.0
        if hid_bull:
            score += 6.0
        if hid_bear:
            score -= 6.0

        score = float(np.clip(score, 0.0, 100.0))
        signal_out: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="MACD",
            signal=signal_out,
            score=score,
            details={
                "macd": round(macd_val, 6),
                "signal_line": round(signal_val, 6),
                "histogram": round(hist_val, 6),
                "bullish_crossover": bullish_cross,
                "bearish_crossover": bearish_cross,
                "histogram_rising": hist_rising,
                "histogram_falling": hist_falling,
                "above_zero": above_zero,
                "regular_bullish_divergence": reg_bull,
                "regular_bearish_divergence": reg_bear,
                "hidden_bullish_divergence": hid_bull,
                "hidden_bearish_divergence": hid_bear,
            },
        )

    # -- Stochastic --

    def _calc_stochastic(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه استوکستیک (K%14, D%3, Smooth3).

        K بالای ۸۰ اشباع خرید و زیر ۲۰ اشباع فروش.
        """
        stoch_df: pd.DataFrame = ta.stoch(
            df["high"],
            df["low"],
            df["close"],
            k=self.STOCH_K,
            d=self.STOCH_D,
            smooth_k=self.STOCH_SMOOTH,
        )

        if stoch_df is None or stoch_df.empty:
            return IndicatorResult("Stochastic", Signal.NEUTRAL, 50.0, {"error": "محاسبه ناموفق"})

        k_col: str = f"STOCHk_{self.STOCH_K}_{self.STOCH_D}_{self.STOCH_SMOOTH}"
        d_col: str = f"STOCHd_{self.STOCH_K}_{self.STOCH_D}_{self.STOCH_SMOOTH}"

        k_val: Optional[float] = _safe_last(stoch_df[k_col])
        d_val: Optional[float] = _safe_last(stoch_df[d_col])
        k_prev: Optional[float] = _safe_prev(stoch_df[k_col])
        d_prev: Optional[float] = _safe_prev(stoch_df[d_col])

        if None in (k_val, d_val):
            return IndicatorResult("Stochastic", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        overbought: bool = k_val >= 80.0
        oversold: bool = k_val <= 20.0

        bullish_cross: bool = False
        bearish_cross: bool = False
        if k_prev is not None and d_prev is not None:
            bullish_cross = (k_prev <= d_prev) and (k_val > d_val)
            bearish_cross = (k_prev >= d_prev) and (k_val < d_val)

        score: float = 50.0
        if oversold:
            score += 10.0
        elif overbought:
            score -= 10.0

        if bullish_cross:
            score += 15.0
            if oversold:
                score += 10.0  # تقاطع در ناحیه اشباع فروش قوی‌تر
        if bearish_cross:
            score -= 15.0
            if overbought:
                score -= 10.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="Stochastic",
            signal=signal,
            score=score,
            details={
                "k": round(k_val, 2),
                "d": round(d_val, 2),
                "overbought": overbought,
                "oversold": oversold,
                "bullish_crossover": bullish_cross,
                "bearish_crossover": bearish_cross,
            },
        )

    # -- Williams %R --

    def _calc_williams_r(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه اندیکاتور ویلیامز %R.

        مقادیر بالای -۲۰ اشباع خرید و زیر -۸۰ اشباع فروش.
        """
        willr: pd.Series = ta.willr(
            df["high"], df["low"], df["close"], length=self.WILLIAMS_LENGTH,
        )

        willr_val: Optional[float] = _safe_last(willr)
        if willr_val is None:
            return IndicatorResult("Williams_R", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        overbought: bool = willr_val > -20.0
        oversold: bool = willr_val < -80.0

        score: float = 50.0
        if oversold:
            score += 15.0  # احتمال بازگشت صعودی
        elif overbought:
            score -= 15.0  # احتمال بازگشت نزولی
        else:
            # نرمال‌سازی خطی: -80 -> +15 ... -50 -> 0 ... -20 -> -15
            normalized: float = (willr_val + 50.0) / 30.0  # -1 to 1 roughly
            score -= normalized * 15.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="Williams_R",
            signal=signal,
            score=score,
            details={
                "williams_r": round(willr_val, 2),
                "overbought": overbought,
                "oversold": oversold,
            },
        )

    # -- CCI --

    def _calc_cci(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه شاخص کانال کالا (CCI).

        CCI بالای ۱۰۰+ صعودی قوی، زیر -۱۰۰ نزولی قوی.
        """
        cci: pd.Series = ta.cci(
            df["high"], df["low"], df["close"], length=self.CCI_LENGTH,
        )

        cci_val: Optional[float] = _safe_last(cci)
        if cci_val is None:
            return IndicatorResult("CCI", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        strong_bullish: bool = cci_val > 100.0
        strong_bearish: bool = cci_val < -100.0
        overbought: bool = cci_val > 200.0
        oversold: bool = cci_val < -200.0

        score: float = 50.0
        if overbought:
            score -= 10.0  # اشباع شدید — بازگشت محتمل
        elif strong_bullish:
            score += 20.0
        elif oversold:
            score += 10.0  # اشباع شدید — بازگشت محتمل
        elif strong_bearish:
            score -= 20.0
        else:
            # بین -100 و 100: نرمال‌سازی
            score += (cci_val / 100.0) * 15.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="CCI",
            signal=signal,
            score=score,
            details={
                "cci": round(cci_val, 2),
                "strong_bullish": strong_bullish,
                "strong_bearish": strong_bearish,
                "extreme_overbought": overbought,
                "extreme_oversold": oversold,
            },
        )

    # -- ROC --

    def _calc_roc(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه نرخ تغییر (Rate of Change).

        ROC مثبت نشان‌دهنده مومنتوم صعودی و منفی نزولی.
        """
        roc: pd.Series = ta.roc(df["close"], length=self.ROC_LENGTH)

        roc_val: Optional[float] = _safe_last(roc)
        roc_prev: Optional[float] = _safe_prev(roc)

        if roc_val is None:
            return IndicatorResult("ROC", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        accelerating: bool = (roc_prev is not None) and (roc_val > roc_prev)
        decelerating: bool = (roc_prev is not None) and (roc_val < roc_prev)

        score: float = 50.0
        # ROC مثبت = صعودی، منفی = نزولی
        # محدود به [-5, 5] درصد برای نرمال‌سازی
        clamped: float = float(np.clip(roc_val, -5.0, 5.0))
        score += (clamped / 5.0) * 25.0

        if roc_val > 0 and accelerating:
            score += 5.0
        if roc_val < 0 and decelerating:
            score -= 5.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="ROC",
            signal=signal,
            score=score,
            details={
                "roc": round(roc_val, 4),
                "accelerating": accelerating,
                "decelerating": decelerating,
            },
        )

    # -- Ultimate Oscillator --

    def _calc_ultimate_oscillator(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه اسیلاتور نهایی (Ultimate Oscillator) با دوره‌های ۷، ۱۴ و ۲۸.

        بالای ۷۰ اشباع خرید و زیر ۳۰ اشباع فروش.
        """
        uo: pd.Series = ta.uo(
            df["high"],
            df["low"],
            df["close"],
            fast=self.UO_SHORT,
            medium=self.UO_MID,
            slow=self.UO_LONG,
        )

        uo_val: Optional[float] = _safe_last(uo)
        if uo_val is None:
            return IndicatorResult("UltimateOscillator", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        overbought: bool = uo_val >= 70.0
        oversold: bool = uo_val <= 30.0

        score: float = 50.0
        if oversold:
            score += 15.0
        elif overbought:
            score -= 15.0
        else:
            # نرمال‌سازی خطی بین ۳۰ و ۷۰
            normalized: float = (uo_val - 50.0) / 20.0  # -1 to +1
            score += normalized * 15.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="UltimateOscillator",
            signal=signal,
            score=score,
            details={
                "uo": round(uo_val, 2),
                "overbought": overbought,
                "oversold": oversold,
            },
        )

    # ===================================================================
    # اندیکاتورهای نوسان
    # ===================================================================

    def _analyze_volatility(
        self, df: pd.DataFrame, timeframe: Optional[str] = None,
    ) -> List[IndicatorResult]:
        """
        تحلیل اندیکاتورهای نوسان شامل:
        ATR، بولینگر باند، کانال کلتنر، کانال دونچیان و نوسان تاریخی.
        """
        results: List[IndicatorResult] = []

        results.append(self._calc_atr(df))
        results.append(self._calc_bollinger(df))
        results.append(self._calc_keltner(df))
        results.append(self._calc_donchian(df))
        results.append(self._calc_historical_volatility(df, timeframe))

        return results

    # -- ATR --

    def _calc_atr(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه میانگین محدوده واقعی (ATR).

        ATR رو به افزایش نشان‌دهنده افزایش نوسان و بالعکس.
        سیگنال خنثی تولید می‌کند مگر در ترکیب با روند.
        """
        atr: pd.Series = ta.atr(
            df["high"], df["low"], df["close"], length=self.ATR_LENGTH,
        )

        atr_val: Optional[float] = _safe_last(atr)
        atr_prev: Optional[float] = _safe_prev(atr, offset=5)

        price: Optional[float] = _safe_last(df["close"])
        if atr_val is None or price is None:
            return IndicatorResult("ATR", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        atr_pct: float = (atr_val / price) * 100.0 if price != 0 else 0.0

        expanding: bool = (atr_prev is not None) and (atr_val > atr_prev)
        contracting: bool = (atr_prev is not None) and (atr_val < atr_prev)

        # ATR به تنهایی جهتی ندارد — نوسان بالا در روند صعودی مثبت است
        # اما برای ساده‌سازی، نوسان پایین‌تر را مطلوب‌تر می‌دانیم
        score: float = 50.0
        if expanding:
            score += 5.0  # نوسان بالاتر = فرصت بیشتر
        elif contracting:
            score -= 2.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="ATR",
            signal=signal,
            score=score,
            details={
                "atr": round(atr_val, 5),
                "atr_pct": round(atr_pct, 3),
                "volatility_expanding": expanding,
                "volatility_contracting": contracting,
            },
        )

    # -- Bollinger Bands --

    def _calc_bollinger(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه باندهای بولینگر با تشخیص فشردگی و شکست.

        فشردگی (Squeeze) زمانی رخ می‌دهد که پهنای باند به حداقل اخیر برسد.
        """
        bb_df: pd.DataFrame = ta.bbands(
            df["close"], length=self.BB_LENGTH, std=self.BB_STD,
        )

        if bb_df is None or bb_df.empty:
            return IndicatorResult("BollingerBands", Signal.NEUTRAL, 50.0, {"error": "محاسبه ناموفق"})

        # pandas_ta naming varies between versions; find columns by prefix
        upper_col: Optional[str] = next((c for c in bb_df.columns if c.startswith("BBU")), None)
        mid_col: Optional[str] = next((c for c in bb_df.columns if c.startswith("BBM")), None)
        lower_col: Optional[str] = next((c for c in bb_df.columns if c.startswith("BBL")), None)
        bw_col: Optional[str] = next((c for c in bb_df.columns if c.startswith("BBB")), None)
        pct_col: Optional[str] = next((c for c in bb_df.columns if c.startswith("BBP")), None)

        if upper_col is None or mid_col is None or lower_col is None:
            return IndicatorResult("BollingerBands", Signal.NEUTRAL, 50.0, {"error": "محاسبه ناموفق"})

        upper: Optional[float] = _safe_last(bb_df[upper_col])
        mid: Optional[float] = _safe_last(bb_df[mid_col])
        lower: Optional[float] = _safe_last(bb_df[lower_col])
        price: Optional[float] = _safe_last(df["close"])

        if None in (upper, mid, lower, price):
            return IndicatorResult("BollingerBands", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        bandwidth: float = ((upper - lower) / mid) * 100.0 if mid != 0 else 0.0

        # Squeeze Detection: پهنای باند در ۲۰% پایینی محدوده اخیر
        bw_series: pd.Series = ((bb_df[upper_col] - bb_df[lower_col]) / bb_df[mid_col]) * 100.0
        bw_series = bw_series.dropna()
        squeeze: bool = False
        if len(bw_series) >= 120:
            bw_min: float = float(bw_series.iloc[-120:].min())
            bw_max: float = float(bw_series.iloc[-120:].max())
            if bw_max > bw_min:
                bw_pct_rank: float = (bandwidth - bw_min) / (bw_max - bw_min)
                squeeze = bw_pct_rank < 0.20
        elif len(bw_series) >= 20:
            bw_min = float(bw_series.min())
            bw_max = float(bw_series.max())
            if bw_max > bw_min:
                bw_pct_rank = (bandwidth - bw_min) / (bw_max - bw_min)
                squeeze = bw_pct_rank < 0.20

        # شکست
        breakout_up: bool = price > upper
        breakout_down: bool = price < lower
        above_mid: bool = price > mid

        # %B position
        bb_pct: float = (price - lower) / (upper - lower) if (upper - lower) != 0 else 0.5

        score: float = 50.0
        if breakout_up:
            score += 15.0  # شکست صعودی
        elif breakout_down:
            score -= 15.0  # شکست نزولی
        elif above_mid:
            score += 8.0
        else:
            score -= 8.0

        if squeeze:
            # فشردگی — حرکت بزرگ در راه است، جهت نامشخص
            # کمی به سمت خنثی تنظیم می‌کنیم
            score = score * 0.8 + 50.0 * 0.2

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="BollingerBands",
            signal=signal,
            score=score,
            details={
                "upper": round(upper, 5),
                "middle": round(mid, 5),
                "lower": round(lower, 5),
                "bandwidth": round(bandwidth, 3),
                "percent_b": round(bb_pct, 3),
                "squeeze": squeeze,
                "breakout_up": breakout_up,
                "breakout_down": breakout_down,
            },
        )

    # -- Keltner Channel --

    def _calc_keltner(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه کانال کلتنر (EMA20, ATR*1.5).

        شکست بالا صعودی و شکست پایین نزولی است.
        """
        kc_df: pd.DataFrame = ta.kc(
            df["high"],
            df["low"],
            df["close"],
            length=self.KC_LENGTH,
            scalar=self.KC_MULT,
        )

        if kc_df is None or kc_df.empty:
            return IndicatorResult("KeltnerChannel", Signal.NEUTRAL, 50.0, {"error": "محاسبه ناموفق"})

        upper_col: str = f"KCUe_{self.KC_LENGTH}_{self.KC_MULT}"
        lower_col: str = f"KCLe_{self.KC_LENGTH}_{self.KC_MULT}"
        mid_col: str = f"KCBe_{self.KC_LENGTH}_{self.KC_MULT}"

        upper: Optional[float] = _safe_last(kc_df[upper_col])
        lower: Optional[float] = _safe_last(kc_df[lower_col])
        mid: Optional[float] = _safe_last(kc_df[mid_col])
        price: Optional[float] = _safe_last(df["close"])

        if None in (upper, lower, mid, price):
            return IndicatorResult("KeltnerChannel", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        above_upper: bool = price > upper
        below_lower: bool = price < lower
        above_mid: bool = price > mid

        score: float = 50.0
        if above_upper:
            score += 18.0
        elif below_lower:
            score -= 18.0
        elif above_mid:
            score += 8.0
        else:
            score -= 8.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="KeltnerChannel",
            signal=signal,
            score=score,
            details={
                "upper": round(upper, 5),
                "middle": round(mid, 5),
                "lower": round(lower, 5),
                "price_above_upper": above_upper,
                "price_below_lower": below_lower,
                "price_above_middle": above_mid,
            },
        )

    # -- Donchian Channel --

    def _calc_donchian(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه کانال دونچیان (بالاترین و پایین‌ترین قیمت ۲۰ دوره).

        شکست سقف کانال صعودی و شکست کف نزولی است.
        """
        dc_df: pd.DataFrame = ta.donchian(
            df["high"], df["low"], lower_length=self.DC_LENGTH, upper_length=self.DC_LENGTH,
        )

        if dc_df is None or dc_df.empty:
            return IndicatorResult("DonchianChannel", Signal.NEUTRAL, 50.0, {"error": "محاسبه ناموفق"})

        upper_col: str = f"DCU_{self.DC_LENGTH}_{self.DC_LENGTH}"
        lower_col: str = f"DCL_{self.DC_LENGTH}_{self.DC_LENGTH}"
        mid_col: str = f"DCM_{self.DC_LENGTH}_{self.DC_LENGTH}"

        upper: Optional[float] = _safe_last(dc_df[upper_col])
        lower: Optional[float] = _safe_last(dc_df[lower_col])
        mid: Optional[float] = _safe_last(dc_df[mid_col])
        price: Optional[float] = _safe_last(df["close"])

        if None in (upper, lower, mid, price):
            return IndicatorResult("DonchianChannel", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        at_upper: bool = abs(price - upper) / upper < 0.001 if upper != 0 else False
        at_lower: bool = abs(price - lower) / lower < 0.001 if lower != 0 else False
        above_mid: bool = price > mid

        # موقعیت نسبی در کانال
        position: float = (price - lower) / (upper - lower) if (upper - lower) != 0 else 0.5

        score: float = 50.0
        if at_upper:
            score += 20.0  # شکست سقف — مومنتوم صعودی
        elif at_lower:
            score -= 20.0
        elif above_mid:
            score += 10.0
        else:
            score -= 10.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="DonchianChannel",
            signal=signal,
            score=score,
            details={
                "upper": round(upper, 5),
                "middle": round(mid, 5),
                "lower": round(lower, 5),
                "position": round(position, 3),
                "at_upper": at_upper,
                "at_lower": at_lower,
            },
        )

    # -- Historical Volatility --

    def _calc_historical_volatility(
        self, df: pd.DataFrame, timeframe: Optional[str] = None,
    ) -> IndicatorResult:
        """
        محاسبه نوسان تاریخی (انحراف معیار بازده لگاریتمی ۲۰ دوره‌ای).

        نوسان بالا فرصت بیشتر اما ریسک بالاتر.
        """
        close: pd.Series = df["close"]
        log_returns: pd.Series = np.log(close / close.shift(1))
        # سالانه‌سازی بر اساس تعداد کندل در سال (۲۵۲ روز معاملاتی × کندل در روز)
        bars_per_day: int = self._BARS_PER_DAY.get(timeframe, 1) if timeframe else 1
        annualization: float = np.sqrt(252 * bars_per_day)
        hv: pd.Series = log_returns.rolling(window=self.HV_LENGTH).std() * annualization

        hv_val: Optional[float] = _safe_last(hv)
        hv_prev: Optional[float] = _safe_prev(hv, offset=5)

        if hv_val is None:
            return IndicatorResult("HistoricalVolatility", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        expanding: bool = (hv_prev is not None) and (hv_val > hv_prev)

        # مقدار نرمال نوسان فارکس حدود ۵-۱۵ درصد سالانه
        hv_pct: float = hv_val * 100.0
        high_vol: bool = hv_pct > 20.0
        low_vol: bool = hv_pct < 5.0

        # نوسان زیاد = فرصت بیشتر اما ریسک بالاتر — امتیاز خنثی‌تر
        score: float = 50.0
        if expanding:
            score += 3.0
        else:
            score -= 2.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="HistoricalVolatility",
            signal=signal,
            score=score,
            details={
                "hv_annualized": round(hv_pct, 3),
                "high_volatility": high_vol,
                "low_volatility": low_vol,
                "expanding": expanding,
            },
        )

    # ===================================================================
    # اندیکاتورهای حجم
    # ===================================================================

    def _analyze_volume(self, df: pd.DataFrame) -> List[IndicatorResult]:
        """
        تحلیل اندیکاتورهای حجم شامل:
        OBV، VWAP، MFI، جریان پول چایکین و خط A/D.
        """
        results: List[IndicatorResult] = []

        results.append(self._calc_obv(df))
        results.append(self._calc_vwap(df))
        results.append(self._calc_mfi(df))
        results.append(self._calc_cmf(df))
        results.append(self._calc_ad_line(df))

        return results

    # -- OBV --

    def _calc_obv(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه حجم تعادلی (On-Balance Volume).

        OBV رو به افزایش تأیید روند صعودی و بالعکس.
        """
        obv: pd.Series = ta.obv(df["close"], df["volume"])

        obv_val: Optional[float] = _safe_last(obv)
        if obv_val is None:
            return IndicatorResult("OBV", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        # روند OBV با EMA(20) مقایسه می‌شود
        obv_ema: pd.Series = ta.ema(obv, length=20)
        obv_ema_val: Optional[float] = _safe_last(obv_ema)

        # شیب OBV در ۱۰ دوره اخیر
        obv_slope_positive: bool = False
        obv_slope_negative: bool = False
        if len(obv.dropna()) >= 10:
            obv_recent: np.ndarray = obv.dropna().iloc[-10:].values
            x: np.ndarray = np.arange(len(obv_recent))
            slope: float = float(np.polyfit(x, obv_recent, 1)[0])
            obv_slope_positive = slope > 0
            obv_slope_negative = slope < 0

        # OBV بالای EMA خودش = تأیید صعودی
        above_ema: bool = (obv_ema_val is not None) and (obv_val > obv_ema_val)

        # واگرایی قیمت و OBV
        price_rising: bool = False
        obv_rising: bool = False
        if len(df) >= 20:
            price_rising = float(df["close"].iloc[-1]) > float(df["close"].iloc[-20])
            obv_rising = float(obv.iloc[-1]) > float(obv.iloc[-20])

        price_obv_divergence_bear: bool = price_rising and not obv_rising
        price_obv_divergence_bull: bool = not price_rising and obv_rising

        score: float = 50.0
        if above_ema:
            score += 10.0
        else:
            score -= 10.0
        if obv_slope_positive:
            score += 8.0
        elif obv_slope_negative:
            score -= 8.0
        if price_obv_divergence_bull:
            score += 10.0
        if price_obv_divergence_bear:
            score -= 10.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="OBV",
            signal=signal,
            score=score,
            details={
                "obv": round(obv_val, 2),
                "obv_above_ema": above_ema,
                "slope_positive": obv_slope_positive,
                "price_obv_divergence_bullish": price_obv_divergence_bull,
                "price_obv_divergence_bearish": price_obv_divergence_bear,
            },
        )

    # -- VWAP --

    def _calc_vwap(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه قیمت میانگین وزنی حجمی (VWAP).

        قیمت بالای VWAP صعودی و زیر آن نزولی.
        """
        # بدون حجمِ واقعی (مثل فید فارکسِ yfinance با volume=0) VWAP بی‌معنا و
        # نزدیک‌تصادفی است → خنثی، تا امتیاز کاذب به scoring تزریق نشود.
        vol = df.get("volume")
        if vol is None or float(np.nan_to_num(vol).sum()) <= 0.0:
            return IndicatorResult("VWAP", Signal.NEUTRAL, 50.0,
                                   {"note": "بدون حجم — VWAP اعمال نشد"})

        # ایندکس زمانیِ مرتب + anchor روزانه → VWAP معنادار و بدون هشدار
        d = df
        if "timestamp" in df.columns:
            d = df.copy()
            d.index = pd.to_datetime(d["timestamp"], utc=True)
            d = d.sort_index()
        try:
            vwap: pd.Series = ta.vwap(d["high"], d["low"], d["close"], d["volume"], anchor="D")
        except Exception:  # noqa: BLE001 — fallback بدون anchor
            vwap = ta.vwap(d["high"], d["low"], d["close"], d["volume"])

        vwap_val: Optional[float] = _safe_last(vwap)
        price: Optional[float] = _safe_last(d["close"])

        if vwap_val is None or price is None:
            return IndicatorResult("VWAP", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        above_vwap: bool = price > vwap_val
        distance_pct: float = ((price - vwap_val) / vwap_val) * 100.0

        score: float = 50.0
        if above_vwap:
            score += min(abs(distance_pct) * 5.0, 25.0)
        else:
            score -= min(abs(distance_pct) * 5.0, 25.0)

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="VWAP",
            signal=signal,
            score=score,
            details={
                "vwap": round(vwap_val, 5),
                "price": round(price, 5),
                "price_above_vwap": above_vwap,
                "distance_pct": round(distance_pct, 3),
            },
        )

    # -- MFI --

    def _calc_mfi(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه شاخص جریان پول (Money Flow Index).

        MFI بالای ۸۰ اشباع خرید و زیر ۲۰ اشباع فروش.
        """
        mfi: pd.Series = ta.mfi(
            df["high"], df["low"], df["close"], df["volume"],
            length=self.MFI_LENGTH,
        )

        mfi_val: Optional[float] = _safe_last(mfi)
        if mfi_val is None:
            return IndicatorResult("MFI", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        overbought: bool = mfi_val >= 80.0
        oversold: bool = mfi_val <= 20.0

        score: float = 50.0
        if oversold:
            score += 15.0  # احتمال بازگشت صعودی
        elif overbought:
            score -= 15.0  # احتمال بازگشت نزولی
        else:
            # نرمال‌سازی
            score += ((mfi_val - 50.0) / 30.0) * 15.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="MFI",
            signal=signal,
            score=score,
            details={
                "mfi": round(mfi_val, 2),
                "overbought": overbought,
                "oversold": oversold,
            },
        )

    # -- Chaikin Money Flow --

    def _calc_cmf(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه جریان پول چایکین (CMF).

        CMF مثبت نشان‌دهنده فشار خرید و منفی فشار فروش.
        """
        cmf: pd.Series = ta.cmf(
            df["high"], df["low"], df["close"], df["volume"],
            length=self.CMF_LENGTH,
        )

        cmf_val: Optional[float] = _safe_last(cmf)
        if cmf_val is None:
            return IndicatorResult("CMF", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        buying_pressure: bool = cmf_val > 0.05
        selling_pressure: bool = cmf_val < -0.05
        strong_buying: bool = cmf_val > 0.15
        strong_selling: bool = cmf_val < -0.15

        score: float = 50.0
        if strong_buying:
            score += 25.0
        elif buying_pressure:
            score += 15.0
        elif strong_selling:
            score -= 25.0
        elif selling_pressure:
            score -= 15.0
        else:
            # نزدیک صفر — خنثی با کمی تمایل
            score += cmf_val * 100.0  # cmf بین -0.05 و 0.05

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="CMF",
            signal=signal,
            score=score,
            details={
                "cmf": round(cmf_val, 4),
                "buying_pressure": buying_pressure,
                "selling_pressure": selling_pressure,
                "strong_buying": strong_buying,
                "strong_selling": strong_selling,
            },
        )

    # -- A/D Line --

    def _calc_ad_line(self, df: pd.DataFrame) -> IndicatorResult:
        """
        محاسبه خط انباشت/توزیع (Accumulation/Distribution Line).

        A/D رو به بالا = انباشت (صعودی)، رو به پایین = توزیع (نزولی).
        """
        ad: pd.Series = ta.ad(df["high"], df["low"], df["close"], df["volume"])

        ad_val: Optional[float] = _safe_last(ad)
        if ad_val is None:
            return IndicatorResult("AD_Line", Signal.NEUTRAL, 50.0, {"error": "داده کافی نیست"})

        # شیب A/D در ۱۰ دوره اخیر
        ad_slope_positive: bool = False
        ad_slope_negative: bool = False
        ad_clean: pd.Series = ad.dropna()
        if len(ad_clean) >= 10:
            ad_recent: np.ndarray = ad_clean.iloc[-10:].values
            x: np.ndarray = np.arange(len(ad_recent))
            slope: float = float(np.polyfit(x, ad_recent, 1)[0])
            ad_slope_positive = slope > 0
            ad_slope_negative = slope < 0

        # A/D بالای EMA(20) خودش
        ad_ema: pd.Series = ta.ema(ad, length=20)
        ad_ema_val: Optional[float] = _safe_last(ad_ema)
        above_ema: bool = (ad_ema_val is not None) and (ad_val > ad_ema_val)

        # واگرایی ساده
        price_rising: bool = False
        ad_rising: bool = False
        if len(df) >= 20 and len(ad_clean) >= 20:
            price_rising = float(df["close"].iloc[-1]) > float(df["close"].iloc[-20])
            ad_rising = float(ad_clean.iloc[-1]) > float(ad_clean.iloc[-20])

        divergence_bear: bool = price_rising and not ad_rising
        divergence_bull: bool = not price_rising and ad_rising

        score: float = 50.0
        if above_ema:
            score += 8.0
        else:
            score -= 8.0
        if ad_slope_positive:
            score += 8.0
        elif ad_slope_negative:
            score -= 8.0
        if divergence_bull:
            score += 10.0
        if divergence_bear:
            score -= 10.0

        score = float(np.clip(score, 0.0, 100.0))
        signal: Signal = self._score_to_signal(score)

        return IndicatorResult(
            name="AD_Line",
            signal=signal,
            score=score,
            details={
                "ad": round(ad_val, 2),
                "ad_above_ema": above_ema,
                "slope_positive": ad_slope_positive,
                "divergence_bullish": divergence_bull,
                "divergence_bearish": divergence_bear,
            },
        )
