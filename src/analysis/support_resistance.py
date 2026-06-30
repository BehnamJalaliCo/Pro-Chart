"""تحلیل سطوح حمایت/مقاومت + پیوت + فیبوناچی"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from src.core.logger import get_logger

logger = get_logger(__name__)


class SupportResistanceAnalyzer:
    """تحلیل سطوح کلیدی بازار"""

    def analyze(self, df: pd.DataFrame, pip_size: float | None = None) -> dict[str, Any]:
        """تحلیل کامل سطوح"""
        if df is None or len(df) < 50:
            return {"sr_levels": [], "pivots": {}, "fibonacci": {}, "score": 50}

        sr_levels = self._find_sr_levels(df, pip_size=pip_size)
        pivots = self._calculate_pivots(df)
        fib_ret = self._fibonacci_retracement(df)
        fib_ext = self._fibonacci_extension(df)

        current_price = float(df["close"].iloc[-1])
        score = self._score_levels(current_price, sr_levels, pivots, fib_ret)

        return {
            "sr_levels": sr_levels,
            "pivots": pivots,
            "fibonacci_retracement": fib_ret,
            "fibonacci_extension": fib_ext,
            "score": score,
            "nearest_support": self._nearest_support(current_price, sr_levels),
            "nearest_resistance": self._nearest_resistance(current_price, sr_levels),
        }

    def _find_sr_levels(
        self, df: pd.DataFrame, window: int = 10, pip_size: float | None = None
    ) -> list[dict[str, Any]]:
        """شناسایی سطوح حمایت و مقاومت از ۲۰۰ کندل اخیر"""
        highs = df["high"].values
        lows = df["low"].values
        levels: list[dict[str, Any]] = []

        # پیدا کردن نقاط اوج و فرود محلی
        for i in range(window, len(df) - window):
            # مقاومت: اوج محلی
            if highs[i] == max(highs[i - window:i + window + 1]):
                levels.append({
                    "price": float(highs[i]),
                    "type": "resistance",
                    "strength": self._level_strength(df, float(highs[i]), "high", pip_size),
                    "touches": self._count_touches(df, float(highs[i]), pip_size),
                    "index": i,
                })

            # حمایت: فرود محلی
            if lows[i] == min(lows[i - window:i + window + 1]):
                levels.append({
                    "price": float(lows[i]),
                    "type": "support",
                    "strength": self._level_strength(df, float(lows[i]), "low", pip_size),
                    "touches": self._count_touches(df, float(lows[i]), pip_size),
                    "index": i,
                })

        # ادغام سطوح نزدیک
        levels = self._merge_close_levels(levels, df)

        # مرتب‌سازی بر اساس قدرت
        levels.sort(key=lambda x: x["strength"], reverse=True)
        return levels[:20]

    def _tolerance(self, price: float, pip_size: float | None) -> float:
        """محاسبه تلورانس برخورد سطح — مبتنی بر اندازه پیپ ابزار در صورت وجود"""
        if pip_size:
            return 5 * pip_size
        return price * 0.001  # ۰.۱٪ — حالت پیش‌فرض ابزار-ناآگاه

    def _level_strength(
        self, df: pd.DataFrame, price: float, price_type: str, pip_size: float | None = None
    ) -> int:
        """محاسبه قدرت سطح"""
        tolerance = self._tolerance(price, pip_size)
        touches = 0
        for _, row in df.iterrows():
            if abs(row[price_type] - price) <= tolerance:
                touches += 1
        return min(touches * 20, 100)

    def _count_touches(
        self, df: pd.DataFrame, price: float, pip_size: float | None = None
    ) -> int:
        """شمارش تعداد برخورد با سطح"""
        tolerance = self._tolerance(price, pip_size)
        count = 0
        for _, row in df.iterrows():
            if abs(row["high"] - price) <= tolerance or abs(row["low"] - price) <= tolerance:
                count += 1
        return count

    def _merge_close_levels(
        self, levels: list[dict], df: pd.DataFrame
    ) -> list[dict]:
        """ادغام سطوح نزدیک به هم"""
        if not levels:
            return levels

        avg_range = float((df["high"] - df["low"]).mean())
        threshold = avg_range * 0.5
        merged: list[dict] = []

        levels.sort(key=lambda x: x["price"])
        current = levels[0].copy()

        for level in levels[1:]:
            if abs(level["price"] - current["price"]) <= threshold:
                # ادغام — میانگین قیمت، حداکثر قدرت
                # نوع سطح را از سطح قوی‌تر (قدرت بیشتر) برمی‌گزینیم
                if level["strength"] > current["strength"]:
                    current["type"] = level["type"]
                current["price"] = (current["price"] + level["price"]) / 2
                current["strength"] = max(current["strength"], level["strength"])
                current["touches"] = current["touches"] + level["touches"]
            else:
                merged.append(current)
                current = level.copy()
        merged.append(current)
        return merged

    def _calculate_pivots(self, df: pd.DataFrame) -> dict[str, dict[str, float]]:
        """محاسبه پیوت پوینت‌ها"""
        # استفاده از کندل کامل‌شده‌ی قبلی (نه کندل در حال شکل‌گیری)
        h = float(df["high"].iloc[-2])
        l_ = float(df["low"].iloc[-2])
        c = float(df["close"].iloc[-2])
        pp = (h + l_ + c) / 3

        return {
            "standard": {
                "PP": pp,
                "R1": 2 * pp - l_,
                "R2": pp + (h - l_),
                "R3": h + 2 * (pp - l_),
                "S1": 2 * pp - h,
                "S2": pp - (h - l_),
                "S3": l_ - 2 * (h - pp),
            },
            "fibonacci": {
                "PP": pp,
                "R1": pp + 0.382 * (h - l_),
                "R2": pp + 0.618 * (h - l_),
                "R3": pp + 1.0 * (h - l_),
                "S1": pp - 0.382 * (h - l_),
                "S2": pp - 0.618 * (h - l_),
                "S3": pp - 1.0 * (h - l_),
            },
            "camarilla": {
                "PP": pp,
                "R1": c + (h - l_) * 1.1 / 12,
                "R2": c + (h - l_) * 1.1 / 6,
                "R3": c + (h - l_) * 1.1 / 4,
                "R4": c + (h - l_) * 1.1 / 2,
                "S1": c - (h - l_) * 1.1 / 12,
                "S2": c - (h - l_) * 1.1 / 6,
                "S3": c - (h - l_) * 1.1 / 4,
                "S4": c - (h - l_) * 1.1 / 2,
            },
            "woodie": {
                "PP": (h + l_ + 2 * c) / 4,
                "R1": 2 * ((h + l_ + 2 * c) / 4) - l_,
                "R2": (h + l_ + 2 * c) / 4 + (h - l_),
                "S1": 2 * ((h + l_ + 2 * c) / 4) - h,
                "S2": (h + l_ + 2 * c) / 4 - (h - l_),
            },
        }

    def _fibonacci_retracement(self, df: pd.DataFrame) -> dict[str, Any]:
        """محاسبه فیبوناچی بازگشتی"""
        # پیدا کردن بالاترین و پایین‌ترین نقطه در ۱۰۰ کندل اخیر
        recent = df.tail(100)
        swing_high = float(recent["high"].max())
        swing_low = float(recent["low"].min())
        high_idx = int(recent["high"].values.argmax())
        low_idx = int(recent["low"].values.argmin())

        diff = swing_high - swing_low
        is_uptrend = low_idx < high_idx

        levels = {
            "0.0": swing_high if is_uptrend else swing_low,
            "23.6": swing_high - diff * 0.236 if is_uptrend else swing_low + diff * 0.236,
            "38.2": swing_high - diff * 0.382 if is_uptrend else swing_low + diff * 0.382,
            "50.0": swing_high - diff * 0.500 if is_uptrend else swing_low + diff * 0.500,
            "61.8": swing_high - diff * 0.618 if is_uptrend else swing_low + diff * 0.618,
            "78.6": swing_high - diff * 0.786 if is_uptrend else swing_low + diff * 0.786,
            "100.0": swing_low if is_uptrend else swing_high,
        }

        return {
            "levels": levels,
            "swing_high": swing_high,
            "swing_low": swing_low,
            "is_uptrend": is_uptrend,
        }

    def _fibonacci_extension(self, df: pd.DataFrame) -> dict[str, Any]:
        """محاسبه فیبوناچی اکستنشن"""
        recent = df.tail(100)
        swing_high = float(recent["high"].max())
        swing_low = float(recent["low"].min())
        high_idx = int(recent["high"].values.argmax())
        low_idx = int(recent["low"].values.argmin())

        diff = swing_high - swing_low
        is_uptrend = low_idx < high_idx

        if is_uptrend:
            levels = {
                "127.2": swing_high + diff * 0.272,
                "161.8": swing_high + diff * 0.618,
                "200.0": swing_high + diff * 1.000,
                "261.8": swing_high + diff * 1.618,
            }
        else:
            levels = {
                "127.2": swing_low - diff * 0.272,
                "161.8": swing_low - diff * 0.618,
                "200.0": swing_low - diff * 1.000,
                "261.8": swing_low - diff * 1.618,
            }

        return {
            "levels": levels,
            "is_uptrend": is_uptrend,
        }

    def _nearest_support(self, price: float, levels: list[dict]) -> float | None:
        """نزدیک‌ترین حمایت"""
        supports = [l["price"] for l in levels if l["price"] < price]
        return max(supports) if supports else None

    def _nearest_resistance(self, price: float, levels: list[dict]) -> float | None:
        """نزدیک‌ترین مقاومت"""
        resistances = [l["price"] for l in levels if l["price"] > price]
        return min(resistances) if resistances else None

    def _score_levels(
        self,
        current_price: float,
        sr_levels: list[dict],
        pivots: dict,
        fib: dict,
    ) -> float:
        """امتیازدهی بر اساس موقعیت قیمت نسبت به سطوح"""
        score = 50.0  # پایه

        # بررسی نزدیکی به حمایت قوی (مثبت برای خرید)
        for level in sr_levels[:5]:
            dist_pct = (current_price - level["price"]) / current_price * 100
            if level["type"] == "support" and 0 < dist_pct < 0.5:
                score += level["strength"] * 0.2
            elif level["type"] == "resistance" and -0.5 < dist_pct < 0:
                score -= 10

        # بررسی پیوت
        pp = pivots.get("standard", {}).get("PP", current_price)
        if current_price > pp:
            score += 5
        else:
            score -= 5

        return max(0, min(100, score))
