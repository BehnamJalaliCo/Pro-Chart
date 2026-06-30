"""
Volume profile و liquidity check.

منطق متخصص بازار:
    - VWAP (Volume Weighted Average Price): قیمت میانه‌ی واقعی روز.
      قیمت بالای VWAP = bullish bias، پایین = bearish.
    - POC (Point of Control): قیمتی که بیشترین حجم در آن معامله شده.
      POC نقطه‌ی liquidity بالا و معمولاً magnet برای price است.
    - Volume regime: حجم فعلی نسبت به میانگین.
      حجم کم = liquidity پایین = سیگنال احتیاطی.
    - High Volume Node (HVN) / Low Volume Node (LVN): مناطقی که
      قیمت روی آن‌ها معامله‌ی زیاد یا کم داشته. LVN معمولاً قیمت
      را سریع رد می‌کند (no acceptance).

این ماژول به volume واقعی نیاز دارد. برای forex spot، volume = tick
count است که توسط broker گزارش می‌شود. در حد امکان از volume موجود
استفاده می‌کنیم.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd


@dataclass
class VolumeProfile:
    """خلاصه‌ی volume profile یک دوره."""

    poc_price: float           # Point of Control
    value_area_high: float     # 70% volume area upper
    value_area_low: float      # 70% volume area lower
    volume_above_poc: float    # حجم بالای POC
    volume_below_poc: float    # حجم پایین POC
    bins: int

    def is_balanced(self) -> bool:
        """آیا توزیع volume متوازن است؟"""
        total = self.volume_above_poc + self.volume_below_poc
        if total == 0:
            return True
        ratio = min(self.volume_above_poc, self.volume_below_poc) / total
        return ratio > 0.4  # حداقل ۴۰٪ در طرف ضعیف‌تر

    def to_dict(self) -> dict:
        return {
            "poc_price": round(self.poc_price, 5),
            "value_area_high": round(self.value_area_high, 5),
            "value_area_low": round(self.value_area_low, 5),
            "volume_above_poc": round(self.volume_above_poc, 1),
            "volume_below_poc": round(self.volume_below_poc, 1),
            "bins": self.bins,
            "balanced": self.is_balanced(),
        }


@dataclass
class LiquidityAssessment:
    """ارزیابی liquidity فعلی."""

    current_volume: float
    avg_volume_20: float
    volume_ratio: float       # current / avg
    is_low_liquidity: bool
    is_high_liquidity: bool
    vwap: float
    vwap_distance_pips: float  # فاصله‌ی price فعلی از VWAP
    notes: list[str]

    def to_dict(self) -> dict:
        return {
            "current_volume": round(self.current_volume, 1),
            "avg_volume_20": round(self.avg_volume_20, 1),
            "volume_ratio": round(self.volume_ratio, 3),
            "is_low_liquidity": self.is_low_liquidity,
            "is_high_liquidity": self.is_high_liquidity,
            "vwap": round(self.vwap, 5),
            "vwap_distance_pips": round(self.vwap_distance_pips, 1),
            "notes": list(self.notes),
        }


def calculate_vwap(df: pd.DataFrame) -> pd.Series:
    """
    محاسبه‌ی VWAP — Volume Weighted Average Price.

    typical_price = (high + low + close) / 3
    VWAP = cumsum(typical * volume) / cumsum(volume)
    """
    typical = (df["high"] + df["low"] + df["close"]) / 3.0
    vol = df["volume"].fillna(0).astype(float)
    cum_pv = (typical * vol).cumsum()
    cum_v = vol.cumsum().replace(0, np.nan)
    return cum_pv / cum_v


def calculate_volume_profile(
    df: pd.DataFrame,
    bins: int = 40,
    value_area_pct: float = 0.7,
) -> Optional[VolumeProfile]:
    """
    محاسبه‌ی volume profile روی یک پنجره.

    منطق:
        1. محدوده‌ی قیمت را به bins قسمت تقسیم می‌کنیم
        2. حجم هر کندل را به bin هایی که در آن range گسترده شده توزیع می‌کنیم
        3. POC = bin با بیشترین volume
        4. value area = bins اطراف POC که جمعاً value_area_pct از volume کل را شامل شوند
    """
    if df is None or len(df) < 20 or "volume" not in df.columns:
        return None

    low = float(df["low"].min())
    high = float(df["high"].max())
    if high <= low:
        return None

    edges = np.linspace(low, high, bins + 1)
    centers = (edges[:-1] + edges[1:]) / 2.0
    bin_volume = np.zeros(bins, dtype=float)

    # توزیع volume هر کندل بین bin هایی که high-low را پوشش می‌دهند
    for _, row in df.iterrows():
        r_low = float(row["low"])
        r_high = float(row["high"])
        r_vol = float(row.get("volume", 0) or 0)
        if r_vol <= 0 or r_high <= r_low:
            continue
        # bins داخل [r_low, r_high]
        lo_idx = int(np.searchsorted(edges, r_low, side="right") - 1)
        hi_idx = int(np.searchsorted(edges, r_high, side="left"))
        lo_idx = max(0, lo_idx)
        hi_idx = min(bins, hi_idx)
        span = hi_idx - lo_idx
        if span <= 0:
            continue
        per_bin = r_vol / span
        bin_volume[lo_idx:hi_idx] += per_bin

    if bin_volume.sum() == 0:
        return None

    # POC
    poc_idx = int(bin_volume.argmax())
    poc_price = float(centers[poc_idx])

    # Value area — گسترش از POC به دو طرف تا value_area_pct
    total_volume = bin_volume.sum()
    target = total_volume * value_area_pct
    accumulated = bin_volume[poc_idx]
    left = poc_idx
    right = poc_idx
    while accumulated < target and (left > 0 or right < bins - 1):
        vol_left = bin_volume[left - 1] if left > 0 else 0
        vol_right = bin_volume[right + 1] if right < bins - 1 else 0
        if vol_left >= vol_right and left > 0:
            left -= 1
            accumulated += vol_left
        elif right < bins - 1:
            right += 1
            accumulated += vol_right
        else:
            break

    va_low = float(edges[left])
    va_high = float(edges[right + 1])
    above = float(bin_volume[poc_idx + 1:].sum())
    below = float(bin_volume[:poc_idx].sum())

    return VolumeProfile(
        poc_price=poc_price,
        value_area_high=va_high,
        value_area_low=va_low,
        volume_above_poc=above,
        volume_below_poc=below,
        bins=bins,
    )


def assess_liquidity(
    df: pd.DataFrame,
    pip_size: float,
    low_ratio_threshold: float = 0.3,
    high_ratio_threshold: float = 1.8,
) -> Optional[LiquidityAssessment]:
    """
    ارزیابی liquidity در لحظه‌ی فعلی.

    سیگنال‌های low_liquidity:
        - volume_ratio < 0.3: حجم بسیار کم → reject signal (اسپرد بالا)
    سیگنال‌های high_liquidity:
        - volume_ratio > 1.8: حجم بالا → معامله می‌تواند جذاب باشد
        - یا spike خبری (احتیاط)

    نکته (ممیزی سشن): قبلاً recent_vol فقط آخرین کندل بود و آستانه ۰.۵؛ این
    باعث می‌شد یک کندلِ کم‌حجمِ گذرا (مثلاً قبل از یک خبر) یک ستاپ قویِ
    درون-سشن را رد کند (ستاپ طلای ۶۵.۱۴ با ratio=0.336 رد شد). حالا میانگین
    سه کندل اخیر گرفته می‌شود تا نویز تک‌کندلی حذف شود، و آستانه به ۰.۳ کاهش
    یافت تا فقط بازارِ واقعاً مرده رد شود — نه یک مکثِ لحظه‌ای در سشنِ نقد.
    """
    if df is None or len(df) < 20 or "volume" not in df.columns:
        return None

    vol = df["volume"].fillna(0).astype(float)
    # مبنا با «میانه» (نه میانگین): یک اسپایکِ حجمیِ اخیر، میانگینِ پایه را باد می‌کرد
    # و کندل‌های عادی را زیرِ آستانه می‌برد → ردِ نادرستِ low_liquidity. میانه مقاوم
    # به اسپایک است و ستاپ‌های سالمِ درون‌سشن را نجات می‌دهد.
    recent_vol = float(vol.iloc[-3:].median())   # میانهٔ ۳ کندل اخیر
    avg_vol = float(vol.iloc[-20:-3].median())   # میانهٔ پایه (مقاوم به اسپایک)
    if avg_vol <= 0:
        return None

    ratio = recent_vol / avg_vol
    is_low = ratio < low_ratio_threshold
    is_high = ratio > high_ratio_threshold

    # VWAP
    vwap_series = calculate_vwap(df)
    vwap = float(vwap_series.iloc[-1]) if not vwap_series.empty else float(df["close"].iloc[-1])
    current_close = float(df["close"].iloc[-1])
    vwap_dist_pips = (current_close - vwap) / pip_size if pip_size > 0 else 0.0

    notes: list[str] = []
    if is_low:
        notes.append(f"حجم کم — نسبت {ratio:.2f} از میانگین.")
    if is_high:
        notes.append(f"حجم بالا — نسبت {ratio:.2f}، شاید spike خبری.")
    if abs(vwap_dist_pips) < 2.0:
        notes.append("قیمت نزدیک VWAP — منطقه‌ی balanced.")

    return LiquidityAssessment(
        current_volume=recent_vol,
        avg_volume_20=avg_vol,
        volume_ratio=ratio,
        is_low_liquidity=is_low,
        is_high_liquidity=is_high,
        vwap=vwap,
        vwap_distance_pips=vwap_dist_pips,
        notes=notes,
    )
