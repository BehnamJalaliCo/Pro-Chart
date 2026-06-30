"""اعتبارسنجی و مقایسه داده بین منابع مختلف"""

from __future__ import annotations

from typing import Optional

from src.core.logger import get_logger

logger = get_logger(__name__)

# حداکثر اختلاف مجاز بین منابع (درصد)
MAX_PRICE_DIFF_PERCENT: dict[str, float] = {
    "XAUUSD": 0.05, "XAGUSD": 0.1,
    "default_forex": 0.02,
    "default_commodity": 0.1,
    "default_index": 0.05,
}


def get_max_diff(symbol: str) -> float:
    """دریافت حداکثر اختلاف مجاز"""
    if symbol in MAX_PRICE_DIFF_PERCENT:
        return MAX_PRICE_DIFF_PERCENT[symbol]
    if symbol.startswith(("XTI", "XNG")):
        return MAX_PRICE_DIFF_PERCENT["default_commodity"]
    if symbol in ("US30", "US500", "NAS100", "DE40"):
        return MAX_PRICE_DIFF_PERCENT["default_index"]
    return MAX_PRICE_DIFF_PERCENT["default_forex"]


class DataValidator:
    """اعتبارسنجی داده‌های دریافتی"""

    @staticmethod
    def validate_tick(tick: dict) -> bool:
        """بررسی صحت تیک"""
        if not tick:
            return False

        bid = tick.get("bid", 0)
        ask = tick.get("ask", 0)

        # بررسی مقادیر مثبت
        if bid <= 0 or ask <= 0:
            return False

        # بررسی اسپرد منطقی (اسپرد نباید بیشتر از ۱٪ قیمت باشه)
        spread_pct = abs(ask - bid) / bid * 100
        if spread_pct > 1.0:
            logger.warning(
                "suspicious_spread",
                symbol=tick.get("symbol"),
                spread_pct=round(spread_pct, 4),
            )
            return False

        return True

    @staticmethod
    def cross_validate_price(
        symbol: str,
        price1: float,
        source1: str,
        price2: float,
        source2: str,
    ) -> bool:
        """مقایسه قیمت بین دو منبع"""
        if price1 <= 0 or price2 <= 0:
            return False

        diff_pct = abs(price1 - price2) / price1 * 100
        max_diff = get_max_diff(symbol)

        if diff_pct > max_diff:
            logger.warning(
                "price_cross_validation_failed",
                symbol=symbol,
                price1=price1,
                source1=source1,
                price2=price2,
                source2=source2,
                diff_pct=round(diff_pct, 4),
                max_allowed=max_diff,
            )
            return False

        return True

    @staticmethod
    def validate_candle(candle: dict) -> bool:
        """بررسی صحت یک کندل"""
        o = candle.get("open", 0)
        h = candle.get("high", 0)
        l_ = candle.get("low", 0)
        c = candle.get("close", 0)

        if any(v <= 0 for v in [o, h, l_, c]):
            return False

        # high باید بالاترین باشه
        if h < max(o, c) or l_ > min(o, c):
            return False

        # رنج غیرمنطقی (بیشتر از ۱۰٪ حرکت در یک کندل)
        range_pct = (h - l_) / l_ * 100
        if range_pct > 10.0:
            return False

        return True

    @staticmethod
    def select_best_price(
        symbol: str,
        ticks: list[dict],
    ) -> Optional[dict]:
        """انتخاب بهترین قیمت از بین منابع"""
        valid_ticks = [t for t in ticks if DataValidator.validate_tick(t)]

        if not valid_ticks:
            return None

        if len(valid_ticks) == 1:
            return valid_ticks[0]

        # اگه چند منبع داریم، میانگین بگیر و نزدیک‌ترین رو برگردون
        avg_price = sum(t["bid"] for t in valid_ticks) / len(valid_ticks)
        best = min(valid_ticks, key=lambda t: abs(t["bid"] - avg_price))

        # بررسی متقابل
        for t in valid_ticks:
            if t["source"] != best["source"]:
                DataValidator.cross_validate_price(
                    symbol, best["bid"], best["source"], t["bid"], t["source"]
                )

        return best
