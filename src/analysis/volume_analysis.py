"""تحلیل حجم معاملات + Volume Profile"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import pandas_ta as ta

from src.core.logger import get_logger

logger = get_logger(__name__)


class VolumeAnalyzer:
    """تحلیل حجم و جریان پول"""

    def analyze(self, df: pd.DataFrame) -> dict[str, Any]:
        """تحلیل کامل حجم"""
        if df is None or len(df) < 30:
            return {"volume_score": 50, "details": {}}

        obv = self._obv_analysis(df)
        vwap = self._vwap_analysis(df)
        mfi = self._mfi_analysis(df)
        cmf = self._cmf_analysis(df)
        ad_line = self._ad_line_analysis(df)
        vol_profile = self._volume_profile(df)
        vol_trend = self._volume_trend(df)

        # امتیاز نهایی
        scores = [
            obv["score"],
            mfi["score"],
            cmf["score"],
            ad_line["score"],
            vol_trend["score"],
        ]
        final_score = sum(scores) / len(scores)

        return {
            "volume_score": round(final_score, 2),
            "obv": obv,
            "vwap": vwap,
            "mfi": mfi,
            "cmf": cmf,
            "ad_line": ad_line,
            "volume_profile": vol_profile,
            "volume_trend": vol_trend,
            "volume_confirms_trend": final_score > 55,
        }

    def _obv_analysis(self, df: pd.DataFrame) -> dict[str, Any]:
        """تحلیل On-Balance Volume"""
        obv_series = ta.obv(df["close"], df["volume"])
        if obv_series is None or obv_series.empty:
            return {"value": 0, "trend": "neutral", "score": 50}

        obv_val = float(obv_series.iloc[-1])
        obv_sma = float(obv_series.rolling(20).mean().iloc[-1]) if len(obv_series) >= 20 else obv_val

        # روند OBV
        if len(obv_series) >= 5:
            recent_obv = obv_series.tail(5).values
            trend_up = all(recent_obv[i] <= recent_obv[i + 1] for i in range(len(recent_obv) - 1))
            trend_down = all(recent_obv[i] >= recent_obv[i + 1] for i in range(len(recent_obv) - 1))
        else:
            trend_up = trend_down = False

        if obv_val > obv_sma and trend_up:
            score = 75
            trend = "bullish"
        elif obv_val < obv_sma and trend_down:
            score = 25
            trend = "bearish"
        elif obv_val > obv_sma:
            score = 60
            trend = "slightly_bullish"
        elif obv_val < obv_sma:
            score = 40
            trend = "slightly_bearish"
        else:
            score = 50
            trend = "neutral"

        return {"value": obv_val, "sma": obv_sma, "trend": trend, "score": score}

    def _vwap_analysis(self, df: pd.DataFrame) -> dict[str, Any]:
        """تحلیل VWAP"""
        # بدون حجمِ واقعی (فید فارکس volume=0) VWAP بی‌معناست → خنثی.
        vol = df.get("volume")
        if vol is None or float(np.nan_to_num(vol.to_numpy(dtype="float64")).sum()) <= 0.0:
            return {"value": 0, "position": "neutral", "score": 50}

        # pandas_ta.vwap به ایندکسِ زمانیِ مرتب نیاز دارد؛ وگرنه None برمی‌گرداند و
        # VWAP بی‌صدا غیرفعال می‌شود ("VWAP requires an ordered DatetimeIndex").
        d = df
        if "timestamp" in df.columns:
            d = df.copy()
            d.index = pd.to_datetime(d["timestamp"], utc=True)
            d = d.sort_index()
        elif not isinstance(df.index, pd.DatetimeIndex):
            d = df.copy()
            d.index = pd.date_range(end=pd.Timestamp.utcnow(), periods=len(df), freq="min")

        try:
            vwap_series = ta.vwap(d["high"], d["low"], d["close"], d["volume"])
        except Exception:  # noqa: BLE001
            vwap_series = None
        if vwap_series is None or vwap_series.empty:
            return {"value": 0, "position": "neutral", "score": 50}

        vwap_val = float(vwap_series.iloc[-1])
        current_price = float(d["close"].iloc[-1])
        diff_pct = (current_price - vwap_val) / vwap_val * 100

        if current_price > vwap_val:
            position = "above"
            score = min(50 + diff_pct * 10, 80)
        else:
            position = "below"
            score = max(50 + diff_pct * 10, 20)

        return {
            "value": round(vwap_val, 5),
            "position": position,
            "diff_pct": round(diff_pct, 2),
            "score": round(score, 2),
        }

    def _mfi_analysis(self, df: pd.DataFrame) -> dict[str, Any]:
        """تحلیل Money Flow Index"""
        mfi_series = ta.mfi(df["high"], df["low"], df["close"], df["volume"], length=14)
        if mfi_series is None or mfi_series.empty:
            return {"value": 50, "zone": "neutral", "score": 50}

        mfi_val = float(mfi_series.iloc[-1])

        if mfi_val >= 80:
            zone = "overbought"
            score = 30  # احتمال برگشت نزولی
        elif mfi_val <= 20:
            zone = "oversold"
            score = 70  # احتمال برگشت صعودی
        elif mfi_val >= 60:
            zone = "bullish"
            score = 65
        elif mfi_val <= 40:
            zone = "bearish"
            score = 35
        else:
            zone = "neutral"
            score = 50

        return {"value": round(mfi_val, 2), "zone": zone, "score": score}

    def _cmf_analysis(self, df: pd.DataFrame) -> dict[str, Any]:
        """تحلیل Chaikin Money Flow"""
        high = df["high"]
        low = df["low"]
        close = df["close"]
        volume = df["volume"]

        # محاسبه CMF
        mf_multiplier = ((close - low) - (high - close)) / (high - low + 1e-10)
        mf_volume = mf_multiplier * volume
        cmf_val = float(mf_volume.rolling(20).sum().iloc[-1] / volume.rolling(20).sum().iloc[-1])

        if cmf_val > 0.1:
            trend = "strong_bullish"
            score = 75
        elif cmf_val > 0:
            trend = "bullish"
            score = 60
        elif cmf_val < -0.1:
            trend = "strong_bearish"
            score = 25
        elif cmf_val < 0:
            trend = "bearish"
            score = 40
        else:
            trend = "neutral"
            score = 50

        return {"value": round(cmf_val, 4), "trend": trend, "score": score}

    def _ad_line_analysis(self, df: pd.DataFrame) -> dict[str, Any]:
        """تحلیل خط Accumulation/Distribution"""
        ad_series = ta.ad(df["high"], df["low"], df["close"], df["volume"])
        if ad_series is None or ad_series.empty:
            return {"trend": "neutral", "score": 50}

        ad_val = float(ad_series.iloc[-1])
        ad_sma = float(ad_series.rolling(20).mean().iloc[-1]) if len(ad_series) >= 20 else ad_val

        if ad_val > ad_sma:
            trend = "accumulation"
            score = 65
        else:
            trend = "distribution"
            score = 35

        return {"value": ad_val, "sma": ad_sma, "trend": trend, "score": score}

    def _volume_profile(self, df: pd.DataFrame, bins: int = 20) -> dict[str, Any]:
        """محاسبه Volume Profile"""
        prices = df["close"].values
        volumes = df["volume"].values

        price_min = float(prices.min())
        price_max = float(prices.max())
        step = (price_max - price_min) / bins

        if step == 0:
            return {"poc": float(prices[-1]), "vah": float(prices[-1]), "val": float(prices[-1])}

        profile: list[dict] = []
        for i in range(bins):
            level_low = price_min + i * step
            level_high = level_low + step
            mask = (prices >= level_low) & (prices < level_high)
            vol = float(volumes[mask].sum())
            profile.append({
                "price_low": round(level_low, 5),
                "price_high": round(level_high, 5),
                "price_mid": round((level_low + level_high) / 2, 5),
                "volume": vol,
            })

        # پیدا کردن POC (Point of Control)
        poc_level = max(profile, key=lambda x: x["volume"])
        poc = poc_level["price_mid"]

        # VAH و VAL (70% حجم)
        total_vol = sum(p["volume"] for p in profile)
        target_vol = total_vol * 0.7
        sorted_profile = sorted(profile, key=lambda x: x["volume"], reverse=True)

        cumulative_vol = 0.0
        value_area_levels: list[dict] = []
        for level in sorted_profile:
            cumulative_vol += level["volume"]
            value_area_levels.append(level)
            if cumulative_vol >= target_vol:
                break

        value_area_prices = [l["price_mid"] for l in value_area_levels]
        vah = max(value_area_prices) if value_area_prices else poc
        val_ = min(value_area_prices) if value_area_prices else poc

        return {
            "poc": round(poc, 5),
            "vah": round(vah, 5),
            "val": round(val_, 5),
            "profile": profile[:10],
        }

    def _volume_trend(self, df: pd.DataFrame) -> dict[str, Any]:
        """تحلیل روند حجم"""
        vol = df["volume"]
        if len(vol) < 20:
            return {"trend": "neutral", "score": 50}

        avg_20 = float(vol.tail(20).mean())
        avg_5 = float(vol.tail(5).mean())
        current_vol = float(vol.iloc[-1])

        ratio = current_vol / avg_20 if avg_20 > 0 else 1.0

        if ratio > 2.0:
            trend = "very_high"
            score = 70
        elif ratio > 1.5:
            trend = "high"
            score = 65
        elif ratio > 1.0:
            trend = "above_average"
            score = 55
        elif ratio > 0.5:
            trend = "below_average"
            score = 45
        else:
            trend = "very_low"
            score = 35

        return {
            "current": current_vol,
            "avg_20": round(avg_20, 2),
            "avg_5": round(avg_5, 2),
            "ratio": round(ratio, 2),
            "trend": trend,
            "score": score,
        }
