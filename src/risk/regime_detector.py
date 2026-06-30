"""
تشخیص رژیم بازار — trending / ranging / high-volatility.

منطق متخصص بازار:
    استراتژی‌های مختلف در رژیم‌های مختلف عملکرد متفاوت دارند:
        - Trend-following (breakout, MA crossover): فقط در trending خوب عمل می‌کند
        - Mean-reversion (RSI extremes, S/R bounce): فقط در ranging خوب است
        - معامله در رژیم اشتباه = ضرر سیستماتیک

    ADX > 25: قطعاً trending
    ADX < 20: قطعاً ranging
    ADX 20-25: transitional (محتاط باشید)

    ATR percentile (نسبت به ۱۰۰ کندل گذشته):
        > 0.95 → volatility spike (احتمالاً خبر یا panic) → سیگنال محتاط
        < 0.20 → low volatility → احتمال breakout قریب‌الوقوع
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

import pandas as pd


class MarketRegime(str, Enum):
    """رژیم بازار شناسایی‌شده."""

    TRENDING_UP = "trending_up"
    TRENDING_DOWN = "trending_down"
    RANGING = "ranging"
    TRANSITIONAL = "transitional"
    HIGH_VOLATILITY = "high_volatility"  # spike (probably news)
    LOW_VOLATILITY = "low_volatility"    # squeeze (pre-breakout)


@dataclass
class RegimeAnalysis:
    """نتیجه‌ی تشخیص رژیم."""

    regime: MarketRegime
    adx: float
    atr: float
    atr_percentile: float
    di_plus: float
    di_minus: float
    notes: list[str]

    def is_trending(self) -> bool:
        return self.regime in (MarketRegime.TRENDING_UP, MarketRegime.TRENDING_DOWN)

    def is_ranging(self) -> bool:
        return self.regime == MarketRegime.RANGING

    def to_dict(self) -> dict:
        # float() صریح تا numpy.float64 (که JSON-serializable نیست) به float پایتون
        # تبدیل شود — وگرنه publish رژیم به Redis با خطا شکست می‌خورد.
        return {
            "regime": self.regime.value,
            "adx": round(float(self.adx), 2),
            "atr": round(float(self.atr), 5),
            "atr_percentile": round(float(self.atr_percentile), 3),
            "di_plus": round(float(self.di_plus), 2),
            "di_minus": round(float(self.di_minus), 2),
            "notes": list(self.notes),
        }


def _wilder_smooth(series: pd.Series, period: int) -> pd.Series:
    """Wilder smoothing — مشابه EMA با weight = 1/period."""
    alpha = 1.0 / period
    return series.ewm(alpha=alpha, adjust=False).mean()


def _adx_components(
    df: pd.DataFrame, period: int = 14
) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    """محاسبه‌ی ADX و +DI و -DI و ATR از OHLC."""
    high = df["high"].astype(float)
    low = df["low"].astype(float)
    close = df["close"].astype(float)

    up_move = high.diff()
    down_move = -low.diff()

    plus_dm = up_move.where((up_move > down_move) & (up_move > 0), 0.0)
    minus_dm = down_move.where((down_move > up_move) & (down_move > 0), 0.0)

    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    atr = _wilder_smooth(tr, period)
    plus_di = 100.0 * _wilder_smooth(plus_dm, period) / atr.replace(0, pd.NA)
    minus_di = 100.0 * _wilder_smooth(minus_dm, period) / atr.replace(0, pd.NA)

    dx = 100.0 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, pd.NA)
    # dx به‌خاطر pd.NA در مخرج dtype=object می‌شود؛ to_numeric(coerce) آن را به
    # float64 با np.nan تبدیل می‌کند تا ewm با adjust=False آن را skip کند
    # (بدون pad کردن با صفر که ADX را پایین می‌آورد، و بدون کرشِ object dtype).
    adx = _wilder_smooth(pd.to_numeric(dx, errors="coerce"), period)

    return adx, plus_di.fillna(0), minus_di.fillna(0), atr.fillna(0)


def detect_regime(
    df: pd.DataFrame,
    adx_period: int = 14,
    atr_lookback: int = 100,
    adx_trend_threshold: float = 25.0,
    adx_range_threshold: float = 20.0,
    high_vol_percentile: float = 0.95,
    low_vol_percentile: float = 0.20,
) -> Optional[RegimeAnalysis]:
    """
    تشخیص رژیم بازار از یک سری OHLC.

    پارامترها:
        df: DataFrame با ستون‌های high/low/close و حداقل ۱۰۰ ردیف
        adx_period: دوره‌ی ADX
        atr_lookback: تعداد کندل برای محاسبه‌ی percentile ATR
        thresholds: حدود تصمیم

    خروجی: RegimeAnalysis یا None اگر داده ناکافی است.
    """
    if df is None or len(df) < max(adx_period * 5, 100):
        return None

    adx_series, plus_di, minus_di, atr_series = _adx_components(df, adx_period)

    adx = float(adx_series.iloc[-1])
    atr = float(atr_series.iloc[-1])
    di_plus = float(plus_di.iloc[-1])
    di_minus = float(minus_di.iloc[-1])

    # all-zero ATR → percentile بی‌معنا (می‌شد HIGH_VOLATILITY دائمی)
    if atr <= 0.0:
        return None

    # ATR percentile — کندل جاری را از پنجره‌ی خودش حذف می‌کنیم
    lookback = min(atr_lookback, len(atr_series) - 1)
    recent_atr = atr_series.iloc[-lookback - 1:-1]
    atr_rank = (recent_atr <= atr).sum() / len(recent_atr) if len(recent_atr) > 0 else 0.5

    notes: list[str] = []

    # ── volatility extreme فقط به‌صورت note؛ early-return نمی‌کنیم تا breakout
    #    در رژیم trending از دست نرود. atr_percentile برگشتی به guard می‌رسد. ──
    if atr_rank >= high_vol_percentile:
        notes.append(f"ATR در صدک {int(atr_rank * 100)} → volatility spike.")
    elif atr_rank <= low_vol_percentile:
        notes.append(f"ATR در صدک {int(atr_rank * 100)} → low-volatility squeeze.")

    # ── تصمیم: trending vs ranging ──
    if adx >= adx_trend_threshold:
        if di_plus > di_minus:
            regime = MarketRegime.TRENDING_UP
            notes.append(f"ADX={adx:.1f} ≥ {adx_trend_threshold}، +DI > -DI → trending up.")
        else:
            regime = MarketRegime.TRENDING_DOWN
            notes.append(f"ADX={adx:.1f} ≥ {adx_trend_threshold}، -DI > +DI → trending down.")
    elif adx <= adx_range_threshold:
        regime = MarketRegime.RANGING
        notes.append(f"ADX={adx:.1f} ≤ {adx_range_threshold} → ranging.")
    else:
        regime = MarketRegime.TRANSITIONAL
        notes.append(f"ADX={adx:.1f} در منطقه‌ی گذار — احتیاط لازم است.")

    return RegimeAnalysis(regime, adx, atr, atr_rank, di_plus, di_minus, notes)
