"""
مدل هزینه‌ی معامله — اسپرد، کمیسیون، اسلیپج، سواپ.

این ماژول هزینه‌های واقعی هر معامله را مدل می‌کند تا R/R محاسبه‌شده
به اجرای واقعی نزدیک باشد. هر نماد پروفایل هزینه‌ی خود را دارد چون
اسپرد و کمیسیون به‌شدت per-symbol متفاوت است.

منطق متخصص بازار:
    - long با ASK وارد می‌شود و در BID خارج (TP یا SL)
    - short با BID وارد می‌شود و در ASK خارج
    - اسپرد در هر دو طرف اعمال می‌شود → معامله از ابتدا با ضرر اسپرد شروع می‌شود
    - کمیسیون per side پرداخت می‌شود (round-turn = 2× per-side)
    - سواپ شبانه: triple swap چهارشنبه (به‌خاطر settlement جمعه به دوشنبه)
    - اسلیپج: ورود ~۱ پیپ بدتر؛ stop ~۲ پیپ بدتر (chase by market)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Optional


# ── ثابت‌ها ─────────────────────────────────────────────
# پیپ ولیو هر نماد: مقدار قیمتی یک پیپ
_DEFAULT_PIP_VALUES: Dict[str, float] = {
    "XAUUSD": 0.1,   "XAGUSD": 0.01,
    "EURUSD": 0.0001, "GBPUSD": 0.0001,
    "USDJPY": 0.01,  "USDCHF": 0.0001,
    "AUDUSD": 0.0001, "NZDUSD": 0.0001,
    "USDCAD": 0.0001, "EURGBP": 0.0001,
    "EURJPY": 0.01,  "GBPJPY": 0.01,
    "AUDJPY": 0.01,  "EURAUD": 0.0001,
    "XTIUSD": 0.01,  "XNGUSD": 0.001,
    "US30": 1.0,     "US500": 0.1,
    "NAS100": 0.1,   "DE40": 0.1,
}

# ارزش دلاری یک پیپ به ازای ۱ لات استاندارد (۱۰۰٬۰۰۰ واحد)
_DEFAULT_PIP_DOLLAR_PER_LOT: Dict[str, float] = {
    "EURUSD": 10.0, "GBPUSD": 10.0, "AUDUSD": 10.0, "NZDUSD": 10.0,
    "USDJPY": 9.0,  "USDCHF": 11.0, "USDCAD": 7.5,
    "EURGBP": 12.5, "EURJPY": 9.0,  "GBPJPY": 9.0,  "AUDJPY": 9.0,
    "EURAUD": 7.0,
    "XAUUSD": 10.0,  # یک پیپ XAU = $0.10، در ۱۰۰ آنس → $10
    "XAGUSD": 50.0,  # 1 lot = 5000 oz; $0.01 = $50
    "XTIUSD": 10.0, "XNGUSD": 10.0,
    "US30": 1.0,    "US500": 1.0,   "NAS100": 1.0, "DE40": 1.0,
}

# اسپرد متوسط (به پیپ) per symbol — برای broker معمولی retail
_DEFAULT_SPREAD_PIPS: Dict[str, float] = {
    "EURUSD": 1.0, "GBPUSD": 1.5, "USDJPY": 1.0, "USDCHF": 1.5,
    "AUDUSD": 1.2, "NZDUSD": 1.8, "USDCAD": 1.5,
    "EURGBP": 1.5, "EURJPY": 1.5, "GBPJPY": 2.5, "AUDJPY": 2.0,
    "EURAUD": 2.5,
    "XAUUSD": 3.0,  # طلا — معمولاً ۳۰ سنت = ۳ پیپ
    "XAGUSD": 4.0,
    "XTIUSD": 4.0, "XNGUSD": 5.0,
    "US30": 3.0, "US500": 0.8, "NAS100": 2.0, "DE40": 2.0,
}

# کمیسیون per side per lot (دلار) — صفر برای حساب standard، ECN معمولاً $3-4/side
_DEFAULT_COMMISSION_PER_SIDE: Dict[str, float] = {}  # default 0

# سواپ شبانه (پیپ per lot per night)
# مقادیر معمول؛ علامت مثبت = دریافت، منفی = پرداخت
_DEFAULT_SWAP_LONG_PIPS: Dict[str, float] = {
    "EURUSD": -0.5, "GBPUSD": -0.3, "USDJPY": 0.8, "USDCHF": 0.7,
    "AUDUSD": -0.1, "NZDUSD": 0.1, "USDCAD": 0.4,
    "EURGBP": -0.4, "EURJPY": 0.5, "GBPJPY": 0.6, "AUDJPY": 0.4,
    "EURAUD": -0.6,
    "XAUUSD": -1.5, "XAGUSD": -0.3,
}
_DEFAULT_SWAP_SHORT_PIPS: Dict[str, float] = {
    "EURUSD": 0.2, "GBPUSD": 0.0, "USDJPY": -1.2, "USDCHF": -1.0,
    "AUDUSD": -0.3, "NZDUSD": -0.5, "USDCAD": -0.7,
    "EURGBP": 0.1, "EURJPY": -0.9, "GBPJPY": -1.0, "AUDJPY": -0.7,
    "EURAUD": 0.2,
    "XAUUSD": 0.5, "XAGUSD": 0.1,
}


@dataclass
class SymbolCostProfile:
    """پروفایل هزینه‌ی یک نماد."""

    symbol: str
    pip_size: float                  # اندازه‌ی یک پیپ به واحد قیمت
    pip_dollar_per_lot: float        # دلار سود/زیان به ازای ۱ پیپ × ۱ لات
    spread_pips: float               # اسپرد متوسط (پیپ)
    commission_per_side_per_lot: float  # کمیسیون per side per lot ($)
    swap_long_pips_per_night: float  # سواپ long شبانه (پیپ per lot)
    swap_short_pips_per_night: float  # سواپ short شبانه (پیپ per lot)
    entry_slippage_pips: float = 1.0  # اسلیپج ورود
    stop_slippage_pips: float = 2.0   # اسلیپج هنگام stop-out (chase)


class CostModel:
    """
    مدل هزینه‌ی معامله.

    شامل پروفایل per-symbol و توابع محاسبه‌ی هر مؤلفه‌ی هزینه.
    """

    def __init__(self, profiles: Optional[Dict[str, SymbolCostProfile]] = None) -> None:
        self._profiles: Dict[str, SymbolCostProfile] = profiles or {}

    @classmethod
    def default(cls) -> "CostModel":
        """ساخت مدل هزینه با پیش‌فرض‌های منطقی برای retail broker."""
        profiles: Dict[str, SymbolCostProfile] = {}
        for symbol in _DEFAULT_PIP_VALUES:
            profiles[symbol] = SymbolCostProfile(
                symbol=symbol,
                pip_size=_DEFAULT_PIP_VALUES[symbol],
                pip_dollar_per_lot=_DEFAULT_PIP_DOLLAR_PER_LOT.get(symbol, 10.0),
                spread_pips=_DEFAULT_SPREAD_PIPS.get(symbol, 2.0),
                commission_per_side_per_lot=_DEFAULT_COMMISSION_PER_SIDE.get(symbol, 0.0),
                swap_long_pips_per_night=_DEFAULT_SWAP_LONG_PIPS.get(symbol, 0.0),
                swap_short_pips_per_night=_DEFAULT_SWAP_SHORT_PIPS.get(symbol, 0.0),
            )
        return cls(profiles)

    def profile(self, symbol: str) -> SymbolCostProfile:
        """دریافت پروفایل نماد — در صورت نبود، profile محافظه‌کارانه می‌سازد."""
        if symbol in self._profiles:
            return self._profiles[symbol]
        # نماد ناشناخته: محافظه‌کارانه‌ترین فرض
        return SymbolCostProfile(
            symbol=symbol,
            pip_size=_DEFAULT_PIP_VALUES.get(symbol, 0.0001),
            pip_dollar_per_lot=10.0,
            spread_pips=3.0,
            commission_per_side_per_lot=0.0,
            swap_long_pips_per_night=-0.5,
            swap_short_pips_per_night=-0.5,
        )

    # ── محاسبات هزینه ──────────────────────────────────

    def apply_entry_slippage(
        self,
        symbol: str,
        direction: str,
        entry_price: float,
    ) -> float:
        """
        اعمال اسلیپج روی قیمت ورود.

        LONG: قیمت بدتر یعنی بالاتر (ASK + slippage)
        SHORT: قیمت بدتر یعنی پایین‌تر (BID - slippage)
        """
        p = self.profile(symbol)
        slip = p.entry_slippage_pips * p.pip_size
        return entry_price + slip if direction == "long" else entry_price - slip

    def apply_stop_slippage(
        self,
        symbol: str,
        direction: str,
        stop_price: float,
    ) -> float:
        """
        اعمال اسلیپج روی stop-out.

        LONG: stop در قیمت پایین‌تر اجرا می‌شود (بازار سقوط کرده)
        SHORT: stop در قیمت بالاتر اجرا می‌شود (بازار جهیده)
        """
        p = self.profile(symbol)
        slip = p.stop_slippage_pips * p.pip_size
        return stop_price - slip if direction == "long" else stop_price + slip

    def commission_round_turn(self, symbol: str, lot_size: float) -> float:
        """کمیسیون رفت‌و‌برگشت برای حجم مشخص."""
        p = self.profile(symbol)
        return 2.0 * p.commission_per_side_per_lot * lot_size

    def spread_cost_pips(self, symbol: str) -> float:
        """هزینه‌ی اسپرد به پیپ — مستقیماً از سود قابل کسر."""
        return self.profile(symbol).spread_pips

    def swap_cost_dollar(
        self,
        symbol: str,
        direction: str,
        entry_time: datetime,
        exit_time: datetime,
        lot_size: float,
    ) -> float:
        """
        هزینه‌ی سواپ بین دو زمان.

        قواعد بازار FX:
            - سواپ روزانه در ساعت rollover (معمولاً ۲۲:۰۰ UTC در زمستان،
              ۲۱:۰۰ UTC در تابستان) اعمال می‌شود.
            - چهارشنبه شب: triple swap (به‌خاطر T+2 settlement که
              معامله‌ی پنج‌شنبه به شنبه/یکشنبه می‌رسد).
            - آخر هفته: بازار بسته است، سواپ اعمال نمی‌شود.

        ساده‌سازی شده: تعداد شب‌های rollover را می‌شماریم.
        """
        if exit_time <= entry_time:
            return 0.0

        p = self.profile(symbol)
        swap_pips_per_night = (
            p.swap_long_pips_per_night
            if direction == "long"
            else p.swap_short_pips_per_night
        )
        if swap_pips_per_night == 0:
            return 0.0

        # شمارش شب‌های rollover (با وزن triple برای چهارشنبه)
        total_units = self._count_rollover_nights(entry_time, exit_time)

        dollar_per_pip_per_lot = p.pip_dollar_per_lot
        return total_units * swap_pips_per_night * dollar_per_pip_per_lot * lot_size

    @staticmethod
    def _count_rollover_nights(start: datetime, end: datetime) -> float:
        """
        شمارش تعداد شب‌های rollover بین دو زمان.

        منطق:
            - هر شب rollover (۲۲:۰۰ UTC) که بین start و end باشد را +۱ می‌شماریم
            - چهارشنبه شب → ۳ شب حساب می‌شود (T+2 جمعه به دوشنبه)
            - آخر هفته (شنبه/یکشنبه) → ۰
        """
        # نرمال‌سازی به UTC
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        total = 0.0
        # شروع از 22:00 UTC روز شروع (یا روز بعد اگر گذشته)
        cursor = start.replace(hour=22, minute=0, second=0, microsecond=0)
        if cursor <= start:
            # rollover امروز گذشته — به فردا برو
            from datetime import timedelta
            cursor += timedelta(days=1)

        from datetime import timedelta
        while cursor < end:
            weekday = cursor.weekday()  # 0=دوشنبه, ..., 6=یکشنبه
            # طبق رویه‌ی بازار FX:
            #   جمعه (4): swap ندارد — settlement جمعه قبلاً چهارشنبه triple شده
            #   شنبه (5)، یکشنبه (6): بازار بسته
            #   چهارشنبه (2): triple swap (به‌خاطر T+2 پنج‌شنبه → دوشنبه)
            #   سایر روزها (دوشنبه/سه‌شنبه/پنج‌شنبه): swap عادی
            if weekday in (4, 5, 6):  # جمعه/شنبه/یکشنبه شب
                cursor += timedelta(days=1)
                continue
            if weekday == 2:  # چهارشنبه شب → triple
                total += 3.0
            else:
                total += 1.0
            cursor += timedelta(days=1)

        return total
