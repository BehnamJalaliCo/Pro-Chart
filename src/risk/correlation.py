"""
کنترل همبستگی (Correlation Risk) — جلوگیری از over-exposure به یک ارز.

منطق متخصص بازار:
    EURUSD long + GBPUSD long + AUDUSD long = همگی short USD
    اگر USD ناگهان قوی شود، هر سه معامله ضرر می‌دهند → ریسک سیستمی

    حل: ابتدا هر معامله را به "ارز‌های پایه" تجزیه می‌کنیم.
    سپس مطمئن می‌شویم net exposure به هر ارز از یک سقف عبور نکند.

    این روش (currency leg decomposition) از روش‌های correlation matrix
    استاتیک دقیق‌تر است چون رفتار غیرخطی را هم پوشش می‌دهد.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple


# ---------------------------------------------------------------------------
# نمادها به ارز‌های پایه/مظنه تجزیه می‌شوند
# ---------------------------------------------------------------------------

# نمادهای FX دو‌حرفه‌ای استاندارد
_PAIR_LEGS: Dict[str, Tuple[str, str]] = {
    "EURUSD": ("EUR", "USD"),
    "GBPUSD": ("GBP", "USD"),
    "AUDUSD": ("AUD", "USD"),
    "NZDUSD": ("NZD", "USD"),
    "USDJPY": ("USD", "JPY"),
    "USDCHF": ("USD", "CHF"),
    "USDCAD": ("USD", "CAD"),
    "EURGBP": ("EUR", "GBP"),
    "EURJPY": ("EUR", "JPY"),
    "GBPJPY": ("GBP", "JPY"),
    "AUDJPY": ("AUD", "JPY"),
    "EURAUD": ("EUR", "AUD"),
}

# نمادهای کالا/شاخص که مظنه ضمنی دارند
_INSTRUMENT_LEGS: Dict[str, Tuple[str, str]] = {
    # XAU، XAG، XTI، XNG نسبت به USD
    "XAUUSD": ("XAU", "USD"),
    "XAGUSD": ("XAG", "USD"),
    "XTIUSD": ("XTI", "USD"),
    "XNGUSD": ("XNG", "USD"),
    # شاخص‌ها به USD وابسته‌اند (بازار خانگی آن‌ها)
    "US30":   ("US30", "USD"),
    "US500":  ("US500", "USD"),
    "NAS100": ("NAS100", "USD"),
    "DE40":   ("DE40", "EUR"),
}


def decompose_currency_legs(
    symbol: str,
    direction: str,
) -> Dict[str, int]:
    """
    تجزیه‌ی یک معامله به اکسپوژر ارزها.

    LONG EURUSD → +EUR, -USD
    SHORT USDJPY → -USD, +JPY (یعنی long JPY و short USD)
    LONG XAUUSD → +XAU, -USD

    خروجی: dict[currency, +1 یا -1]
    """
    legs = _PAIR_LEGS.get(symbol) or _INSTRUMENT_LEGS.get(symbol)
    if legs is None:
        return {}
    base, quote = legs
    if direction == "long":
        return {base: +1, quote: -1}
    if direction == "short":
        return {base: -1, quote: +1}
    return {}


# ---------------------------------------------------------------------------
# همبستگی استاتیک — استفاده در یک تابع کمکی برای تحلیل سریع
# مقادیر تقریبی برای حالت "بازار عادی". در شرایط بحران ممکن است متفاوت باشد.
# ---------------------------------------------------------------------------

_CORRELATION_MATRIX: Dict[Tuple[str, str], float] = {
    # نمادهای USD-quoted (تمام تغییرات USD یکسان عمل می‌کنند)
    ("EURUSD", "GBPUSD"): 0.85,
    ("EURUSD", "AUDUSD"): 0.70,
    ("EURUSD", "NZDUSD"): 0.65,
    ("GBPUSD", "AUDUSD"): 0.70,
    ("GBPUSD", "NZDUSD"): 0.65,
    ("AUDUSD", "NZDUSD"): 0.90,
    # EURUSD معکوس USDCHF
    ("EURUSD", "USDCHF"): -0.95,
    ("EURUSD", "USDJPY"): -0.30,
    # طلا
    ("XAUUSD", "USDJPY"): -0.65,
    ("XAUUSD", "EURUSD"): 0.55,
    # شاخص‌ها
    ("US30", "US500"): 0.95,
    ("US30", "NAS100"): 0.85,
    ("US500", "NAS100"): 0.90,
}


def static_correlation(symbol_a: str, symbol_b: str) -> Optional[float]:
    """
    دریافت همبستگی استاتیک بین دو نماد.

    برمی‌گرداند None اگر داده‌ی شناخته‌شده نباشد.
    """
    if symbol_a == symbol_b:
        return 1.0
    v = _CORRELATION_MATRIX.get((symbol_a, symbol_b))
    return v if v is not None else _CORRELATION_MATRIX.get((symbol_b, symbol_a))


# ---------------------------------------------------------------------------
# Guard اصلی
# ---------------------------------------------------------------------------

@dataclass
class OpenPosition:
    """نمایش ساده‌ی یک معامله‌ی باز برای محاسبه‌ی exposure."""

    symbol: str
    direction: str  # "long" یا "short"
    risk_weight: float = 1.0  # وزن بر اساس ریسک (مثلاً lot یا dollar-at-risk)


class CorrelationGuard:
    """
    بررسی همبستگی پیشنهاد جدید با معاملات باز.

    پیکربندی:
        max_currency_exposure: حداکثر net exposure مجاز به هر ارز
            (مثلاً ۳ یعنی نمی‌توان همزمان ۳+ معامله‌ی هم‌جهت روی USD داشت)
        max_same_direction_correlated: حداکثر معاملات هم‌جهت با همبستگی > ۰.۷
    """

    def __init__(
        self,
        max_currency_exposure: float = 2.5,
        correlation_threshold: float = 0.7,
        max_same_direction_correlated: int = 2,
    ) -> None:
        self._max_currency_exposure = max_currency_exposure
        self._corr_threshold = correlation_threshold
        self._max_same_dir_correlated = max_same_direction_correlated

    def evaluate(
        self,
        proposed_symbol: str,
        proposed_direction: str,
        open_positions: Iterable[OpenPosition],
        proposed_risk_weight: float = 1.0,
    ) -> Optional[str]:
        """
        ارزیابی پیشنهاد در برابر معاملات باز.

        خروجی: متن دلیل رد یا None اگر مجاز است.
        """
        positions = list(open_positions)

        # ── ۱) بررسی exposure به ارزها ──
        # net_exposure[currency] = جمع وزن‌ها (positive = long, negative = short)
        net_exposure: Dict[str, float] = {}
        for pos in positions:
            legs = decompose_currency_legs(pos.symbol, pos.direction)
            for ccy, side in legs.items():
                net_exposure[ccy] = net_exposure.get(ccy, 0.0) + side * pos.risk_weight

        # اضافه‌کردن پیشنهاد
        proposed_legs = decompose_currency_legs(proposed_symbol, proposed_direction)
        if not proposed_legs:
            # نمی‌توانیم تجزیه کنیم — اجازه می‌دهیم اما warn می‌کنیم
            return None

        for ccy, side in proposed_legs.items():
            future_exposure = net_exposure.get(ccy, 0.0) + side * proposed_risk_weight
            if abs(future_exposure) > self._max_currency_exposure:
                return (
                    f"اکسپوژر به {ccy} از حد ({self._max_currency_exposure}) "
                    f"رد می‌شود. exposure فعلی: {net_exposure.get(ccy, 0.0):.1f}، "
                    f"این سیگنال: {side:+}"
                )

        # ── ۲) بررسی هم‌جهتی با همبستگی بالا ──
        correlated_same_direction = 0
        for pos in positions:
            corr = static_correlation(proposed_symbol, pos.symbol)
            if corr is None:
                continue
            # هم‌جهت بودن: اگر همبستگی مثبت و جهات یکسان، یا منفی و جهات مخالف
            if (corr >= self._corr_threshold and pos.direction == proposed_direction) or \
               (corr <= -self._corr_threshold and pos.direction != proposed_direction):
                correlated_same_direction += 1
                if correlated_same_direction >= self._max_same_dir_correlated:
                    return (
                        f"{correlated_same_direction} معامله‌ی هم‌جهت با همبستگی بالا "
                        f"(>= {self._corr_threshold}) باز است — افزایش ریسک سیستمی."
                    )

        return None
