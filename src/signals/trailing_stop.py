"""
Trailing stop پیشرفته — Chandelier exit + breakeven stages.

منطق متخصص بازار:
    Trailing ساده‌ی ATR-based خوب است ولی محدودیت دارد. تکنیک‌های پیشرفته:

    1) Chandelier Exit (Le Beau):
       Long: SL = highest_high(N) - ATR * multiplier
       Short: SL = lowest_low(N) + ATR * multiplier
       SL از high/low اخیر دنبال می‌شود، نه قیمت لحظه‌ای. این یعنی
       trailing فقط در جهت سود (مطلوب) حرکت می‌کند، نه عقب.

    2) Breakeven stage:
       پس از hit TP1، SL را به entry منتقل کن (breakeven).
       پس از hit TP2، SL را به TP1 منتقل کن.
       این "lock in profit" است.

    3) Tighten در سود بزرگ:
       اگر unrealized R > 3، trailing را فشرده‌تر کن (multiplier کاهش).
       این جلوگیری از give-back در سود بزرگ است.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

import pandas as pd


class TrailingStage(str, Enum):
    """مرحله‌ی trailing — تعیین رفتار."""

    INITIAL = "initial"          # هنوز هیچ TP hit نشده
    BREAKEVEN = "breakeven"      # TP1 hit → SL به entry
    LOCKED_TP1 = "locked_tp1"    # TP2 hit → SL به TP1
    LOCKED_TP2 = "locked_tp2"    # TP3 hit (در صورت TP3) → SL به TP2
    TIGHT = "tight"              # سود بزرگ → trailing فشرده


@dataclass
class TrailingState:
    """وضعیت trailing برای یک معامله‌ی باز."""

    direction: str
    entry_price: float
    initial_sl: float
    current_sl: float
    stage: TrailingStage
    tp1_price: float
    tp2_price: Optional[float] = None
    tp3_price: Optional[float] = None
    highest_seen: float = 0.0    # برای long: highest high
    lowest_seen: float = 0.0     # برای short: lowest low

    def to_dict(self) -> dict:
        return {
            "direction": self.direction,
            "entry_price": round(self.entry_price, 5),
            "initial_sl": round(self.initial_sl, 5),
            "current_sl": round(self.current_sl, 5),
            "stage": self.stage.value,
            "highest_seen": round(self.highest_seen, 5),
            "lowest_seen": round(self.lowest_seen, 5),
        }


def chandelier_exit(
    df: pd.DataFrame,
    direction: str,
    atr: float,
    multiplier: float = 3.0,
    lookback: int = 22,
) -> Optional[float]:
    """
    محاسبه‌ی Chandelier Exit.

    Long: highest_high(lookback) - ATR * multiplier
    Short: lowest_low(lookback) + ATR * multiplier

    پارامترها:
        df: دیتافریم با ستون‌های high, low
        direction: 'long' یا 'short'
        atr: مقدار ATR فعلی
        multiplier: ضریب ATR (پیش‌فرض ۳ — استاندارد Le Beau)
        lookback: تعداد کندل برای high/low (پیش‌فرض ۲۲ روز معاملاتی)

    خروجی: قیمت trailing stop، یا None در صورت ناکافی بودن داده.
    """
    if df is None or len(df) < lookback or atr <= 0:
        return None
    window = df.iloc[-lookback:]
    if direction == "long":
        highest = float(window["high"].max())
        return highest - atr * multiplier
    elif direction == "short":
        lowest = float(window["low"].min())
        return lowest + atr * multiplier
    return None


def update_trailing(
    state: TrailingState,
    current_price: float,
    candles_df: Optional[pd.DataFrame] = None,
    atr: float = 0.0,
    chandelier_multiplier: float = 3.0,
    tight_multiplier: float = 1.5,
    tight_threshold_r: float = 3.0,
) -> TrailingState:
    """
    به‌روزرسانی trailing stop بر اساس مرحله و قیمت فعلی.

    منطق:
        1) بررسی hit شدن TP1, TP2, TP3 و انتقال به مرحله‌ی بعد.
        2) محاسبه‌ی trailing مناسب با مرحله:
            - INITIAL: SL تغییر نمی‌کند
            - BREAKEVEN: SL = entry
            - LOCKED_TP1: SL = TP1
            - LOCKED_TP2: SL = TP2
            - TIGHT: Chandelier با tight multiplier
        3) trailing فقط در جهت سود حرکت می‌کند (هرگز عقب).

    خروجی: TrailingState به‌روزرسانی شده.
    """
    is_long = state.direction == "long"

    # ── به‌روزرسانی highest/lowest ──
    if is_long:
        state.highest_seen = max(state.highest_seen, current_price)
    else:
        state.lowest_seen = (
            min(state.lowest_seen, current_price)
            if state.lowest_seen > 0 else current_price
        )

    # ── محاسبه‌ی R-multiple فعلی ──
    risk = abs(state.entry_price - state.initial_sl)
    if risk <= 0:
        return state
    if is_long:
        current_r = (current_price - state.entry_price) / risk
    else:
        current_r = (state.entry_price - current_price) / risk

    # ── تشخیص hit شدن TP ها ──
    def _hit(price_target: Optional[float]) -> bool:
        if price_target is None:
            return False
        if is_long:
            return state.highest_seen >= price_target
        return state.lowest_seen > 0 and state.lowest_seen <= price_target

    # تعیین مرحله‌ی جدید
    new_stage = state.stage
    if _hit(state.tp3_price) and state.stage != TrailingStage.LOCKED_TP2:
        new_stage = TrailingStage.LOCKED_TP2
    elif _hit(state.tp2_price) and state.stage in (TrailingStage.INITIAL, TrailingStage.BREAKEVEN):
        new_stage = TrailingStage.LOCKED_TP1
    elif _hit(state.tp1_price) and state.stage == TrailingStage.INITIAL:
        new_stage = TrailingStage.BREAKEVEN

    # tight stage: اگر سود بزرگ بدون TP hit (مثلاً gap-up رفته بالا)
    if current_r >= tight_threshold_r and new_stage in (
        TrailingStage.BREAKEVEN, TrailingStage.LOCKED_TP1
    ):
        new_stage = TrailingStage.TIGHT

    state.stage = new_stage

    # ── محاسبه‌ی SL جدید برای هر مرحله ──
    candidate_sl: Optional[float] = None
    if new_stage == TrailingStage.BREAKEVEN:
        candidate_sl = state.entry_price
    elif new_stage == TrailingStage.LOCKED_TP1:
        candidate_sl = state.tp1_price
    elif new_stage == TrailingStage.LOCKED_TP2 and state.tp2_price is not None:
        candidate_sl = state.tp2_price
    elif new_stage == TrailingStage.TIGHT and candles_df is not None and atr > 0:
        candidate_sl = chandelier_exit(
            candles_df, state.direction, atr,
            multiplier=tight_multiplier,
        )

    # ── trailing فقط در جهت سود حرکت می‌کند ──
    if candidate_sl is not None:
        if is_long:
            state.current_sl = max(state.current_sl, candidate_sl)
        else:
            state.current_sl = min(state.current_sl, candidate_sl)

    return state
