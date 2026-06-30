"""
شبیه‌ساز معامله — یک سیگنال + کندل‌های بعد از ورود → نتیجه (P&L).

قواعد متخصص بازار:
    - LONG: ورود ASK = (mid + half-spread + entry_slippage)
            خروج TP/SL در BID = (mid - half-spread)
    - SHORT: ورود BID = (mid - half-spread - entry_slippage)
             خروج TP/SL در ASK = (mid + half-spread)
    - تشخیص hit در یک کندل:
        * LONG: low <= SL → stop hit
                high >= TP → target hit
        * اگر هر دو در یک کندل hit شدند: محافظه‌کارانه = stop اول (worst case)
    - Gap handling: اگر open از قبل سطح را رد کرده، fill در open
    - Trailing stop: پس از hit شدن TP1 (در صورت فعال بودن)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional

import pandas as pd

from src.backtest.cost_model import CostModel


class ExitReason(str, Enum):
    """دلایل خروج از معامله."""

    STOP_LOSS = "stop_loss"
    TAKE_PROFIT_1 = "take_profit_1"
    TAKE_PROFIT_2 = "take_profit_2"
    TAKE_PROFIT_3 = "take_profit_3"
    TRAILING_STOP = "trailing_stop"
    TIMEOUT = "timeout"
    END_OF_DATA = "end_of_data"


@dataclass
class TradeOutcome:
    """نتیجه‌ی یک معامله‌ی شبیه‌سازی‌شده."""

    symbol: str
    direction: str  # "long" or "short"
    entry_time: datetime
    entry_price: float          # قیمت ورود پس از اسپرد + اسلیپج
    exit_time: datetime
    exit_price: float           # قیمت خروج پس از اسپرد + اسلیپج
    exit_reason: ExitReason

    lot_size: float

    # نتایج به پیپ
    gross_pips: float           # قبل از کسر هزینه
    spread_cost_pips: float
    slippage_cost_pips: float
    net_pips: float             # پس از اسپرد و اسلیپج

    # نتایج دلاری
    gross_pnl_dollar: float
    commission_dollar: float
    swap_dollar: float
    net_pnl_dollar: float       # نهایی پس از تمام هزینه‌ها

    # متادیتا
    r_multiple: float           # سود/زیان به ضریب ریسک اولیه
    duration_minutes: int
    candles_held: int

    # برچسب‌گذاری برای attribution
    tags: dict = field(default_factory=dict)


class TradeSimulator:
    """شبیه‌ساز معامله‌ی منفرد."""

    def __init__(
        self,
        cost_model: Optional[CostModel] = None,
        max_bars: int = 500,
    ) -> None:
        """
        پارامترها:
            cost_model: مدل هزینه. اگر None باشد، default استفاده می‌شود.
            max_bars: حداکثر تعداد کندل برای نگه‌داشتن معامله (timeout).
        """
        self._cost = cost_model or CostModel.default()
        self._max_bars = max_bars

    def simulate(
        self,
        symbol: str,
        direction: str,
        entry_time: datetime,
        entry_price_mid: float,
        sl: float,
        tp1: float,
        tp2: Optional[float],
        tp3: Optional[float],
        future_candles: pd.DataFrame,
        lot_size: float = 1.0,
        use_trailing_after_tp1: bool = False,
        tags: Optional[dict] = None,
    ) -> TradeOutcome:
        """
        شبیه‌سازی یک معامله.

        پارامترها:
            symbol: نماد
            direction: 'long' یا 'short'
            entry_time: زمان ورود
            entry_price_mid: قیمت ورود به‌صورت mid (بدون اسپرد)
            sl, tp1, tp2, tp3: سطوح (در فضای mid قیمت)
            future_candles: DataFrame کندل‌های پس از ورود
                (شامل timestamp, open, high, low, close)
            lot_size: حجم به لات
            use_trailing_after_tp1: فعال‌کردن trailing پس از TP1
            tags: متادیتای دلخواه برای attribution

        خروجی:
            TradeOutcome شامل تمام جزئیات
        """
        if direction not in ("long", "short"):
            raise ValueError(f"direction نامعتبر: {direction}")

        profile = self._cost.profile(symbol)
        pip = profile.pip_size

        # ── محاسبه‌ی قیمت ورود واقعی (ASK برای long، BID برای short) ──
        half_spread = profile.spread_pips * pip * 0.5
        if direction == "long":
            entry_actual = entry_price_mid + half_spread
        else:
            entry_actual = entry_price_mid - half_spread

        entry_actual = self._cost.apply_entry_slippage(symbol, direction, entry_actual)

        # ── ریسک اولیه (به پیپ، در فضای mid برای هم‌خوانی با سطح SL) ──
        initial_risk_pips = abs(entry_price_mid - sl) / pip if pip > 0 else 0.0

        # ── شبیه‌سازی کندل‌به‌کندل ──
        exit_price_mid: float = entry_price_mid
        exit_reason: ExitReason = ExitReason.END_OF_DATA
        exit_time: datetime = entry_time
        candles_held = 0
        active_sl = sl
        tp1_hit = False

        for idx in range(min(len(future_candles), self._max_bars)):
            row = future_candles.iloc[idx]
            candles_held = idx + 1
            try:
                bar_time = pd.to_datetime(row["timestamp"], utc=True).to_pydatetime()
            except Exception:
                bar_time = entry_time
            bar_open = float(row["open"])
            bar_high = float(row["high"])
            bar_low = float(row["low"])

            # بالاترین TP موجود برای تشخیص gap مطلوب (در صورت None بودن tp3/tp2)
            best_tp = tp3 if tp3 is not None else (tp2 if tp2 is not None else tp1)
            best_tp_reason = (
                ExitReason.TAKE_PROFIT_3 if tp3 is not None
                else ExitReason.TAKE_PROFIT_2 if tp2 is not None
                else ExitReason.TAKE_PROFIT_1
            )

            # ── بررسی gap در باز شدن کندل ──
            if direction == "long":
                # gap-down نامطلوب: open <= SL → fill at open (بدتر از SL)
                if bar_open <= active_sl:
                    exit_price_mid = bar_open
                    exit_reason = ExitReason.STOP_LOSS
                    exit_time = bar_time
                    break
                # gap-up مطلوب: open >= TP → fill at open (بهتر از TP)
                if best_tp is not None and bar_open >= best_tp:
                    exit_price_mid = bar_open
                    exit_reason = best_tp_reason
                    exit_time = bar_time
                    break
            else:  # short
                if bar_open >= active_sl:
                    exit_price_mid = bar_open
                    exit_reason = ExitReason.STOP_LOSS
                    exit_time = bar_time
                    break
                if best_tp is not None and bar_open <= best_tp:
                    exit_price_mid = bar_open
                    exit_reason = best_tp_reason
                    exit_time = bar_time
                    break

            # ── بررسی محدوده‌ی کندل ──
            hit_stop = False
            hit_tp_level: Optional[ExitReason] = None
            hit_tp_price: float = 0.0

            if direction == "long":
                if bar_low <= active_sl:
                    hit_stop = True
                if tp3 is not None and bar_high >= tp3:
                    hit_tp_level, hit_tp_price = ExitReason.TAKE_PROFIT_3, tp3
                elif tp2 is not None and bar_high >= tp2:
                    hit_tp_level, hit_tp_price = ExitReason.TAKE_PROFIT_2, tp2
                elif bar_high >= tp1:
                    hit_tp_level, hit_tp_price = ExitReason.TAKE_PROFIT_1, tp1
            else:
                if bar_high >= active_sl:
                    hit_stop = True
                if tp3 is not None and bar_low <= tp3:
                    hit_tp_level, hit_tp_price = ExitReason.TAKE_PROFIT_3, tp3
                elif tp2 is not None and bar_low <= tp2:
                    hit_tp_level, hit_tp_price = ExitReason.TAKE_PROFIT_2, tp2
                elif bar_low <= tp1:
                    hit_tp_level, hit_tp_price = ExitReason.TAKE_PROFIT_1, tp1

            # ── تصمیم پایان معامله در همین کندل ──
            # محافظه‌کارانه: اگر هم stop و هم TP در یک کندل hit شدند → stop می‌برد
            if hit_stop:
                exit_price_mid = active_sl
                exit_reason = (
                    ExitReason.TRAILING_STOP if tp1_hit and use_trailing_after_tp1
                    else ExitReason.STOP_LOSS
                )
                exit_time = bar_time
                break

            if hit_tp_level is not None:
                if hit_tp_level == ExitReason.TAKE_PROFIT_1 and use_trailing_after_tp1:
                    # TP1 hit → trailing را فعال کن، معامله ادامه دارد
                    if not tp1_hit:
                        tp1_hit = True
                        # SL را به breakeven منتقل کن (در فضای mid)
                        active_sl = entry_price_mid
                    continue
                # TP2/TP3 یا TP1 بدون trailing → پایان
                exit_price_mid = hit_tp_price
                exit_reason = hit_tp_level
                exit_time = bar_time
                break

        else:
            # حلقه بدون break تمام شد → timeout/end of data
            if candles_held == self._max_bars:
                exit_reason = ExitReason.TIMEOUT
            try:
                last_row = future_candles.iloc[min(candles_held - 1, len(future_candles) - 1)]
                exit_price_mid = float(last_row["close"])
                exit_time = pd.to_datetime(last_row["timestamp"], utc=True).to_pydatetime()
            except Exception:
                exit_price_mid = entry_price_mid

        # ── اعمال اسپرد روی exit ──
        if direction == "long":
            exit_actual = exit_price_mid - half_spread
        else:
            exit_actual = exit_price_mid + half_spread

        # ── اعمال slippage stop در صورت stop-out ──
        if exit_reason in (ExitReason.STOP_LOSS, ExitReason.TRAILING_STOP):
            exit_actual = self._cost.apply_stop_slippage(symbol, direction, exit_actual)

        # ── محاسبه‌ی P&L به پیپ و دلار ──
        if direction == "long":
            gross_price_diff = exit_actual - entry_actual
        else:
            gross_price_diff = entry_actual - exit_actual

        gross_pips = gross_price_diff / pip if pip > 0 else 0.0
        spread_cost_pips = profile.spread_pips  # تقریب، چون از mid → actual رد کردیم
        slippage_cost_pips = profile.entry_slippage_pips + (
            profile.stop_slippage_pips
            if exit_reason in (ExitReason.STOP_LOSS, ExitReason.TRAILING_STOP)
            else 0.0
        )
        # توجه: gross_pips از قبل شامل اسپرد و slippage در قیمت‌هاست،
        # این فیلدها فقط برای گزارش‌گیری هستند.
        net_pips = gross_pips

        gross_pnl_dollar = gross_pips * profile.pip_dollar_per_lot * lot_size
        commission_dollar = self._cost.commission_round_turn(symbol, lot_size)
        swap_dollar = self._cost.swap_cost_dollar(
            symbol, direction, entry_time, exit_time, lot_size
        )
        net_pnl_dollar = gross_pnl_dollar - commission_dollar + swap_dollar

        # R-multiple
        r_multiple = (net_pips / initial_risk_pips) if initial_risk_pips > 0 else 0.0

        duration_minutes = int((exit_time - entry_time).total_seconds() / 60.0)

        return TradeOutcome(
            symbol=symbol,
            direction=direction,
            entry_time=entry_time,
            entry_price=entry_actual,
            exit_time=exit_time,
            exit_price=exit_actual,
            exit_reason=exit_reason,
            lot_size=lot_size,
            gross_pips=round(gross_pips, 2),
            spread_cost_pips=round(spread_cost_pips, 2),
            slippage_cost_pips=round(slippage_cost_pips, 2),
            net_pips=round(net_pips, 2),
            gross_pnl_dollar=round(gross_pnl_dollar, 2),
            commission_dollar=round(commission_dollar, 2),
            swap_dollar=round(swap_dollar, 2),
            net_pnl_dollar=round(net_pnl_dollar, 2),
            r_multiple=round(r_multiple, 3),
            duration_minutes=duration_minutes,
            candles_held=candles_held,
            tags=tags or {},
        )
