"""موتور ساخت فیچر — 60+ فیچر برای مدل‌های ML"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
import pandas_ta as ta

from src.core.logger import get_logger

logger = get_logger(__name__)


class FeatureEngine:
    """ساخت فیچرهای ML از داده‌های OHLCV"""

    # تعداد کندل‌ها در یک سال بر اساس تایم‌فریم — برای سالانه‌سازی نوسان
    _PERIODS_PER_YEAR = {
        "M15": 252 * 96,
        "H1": 252 * 24,
        "H4": 252 * 6,
        "D1": 252,
    }

    def build_features(self, df: pd.DataFrame, timeframe: str = "D1") -> pd.DataFrame:
        """ساخت تمام فیچرها و برگرداندن DataFrame آماده آموزش"""
        if df is None or len(df) < 200:
            logger.warning("insufficient_data_for_features", rows=len(df) if df is not None else 0)
            return pd.DataFrame()

        features = df[["timestamp", "open", "high", "low", "close", "volume"]].copy()

        # ── فیچرهای قیمتی ────────────────────────────────
        features = self._price_features(features)

        # ── اندیکاتورهای روند ────────────────────────────
        features = self._trend_indicators(features)

        # ── اندیکاتورهای مومنتوم ─────────────────────────
        features = self._momentum_indicators(features)

        # ── اندیکاتورهای نوسان ───────────────────────────
        features = self._volatility_indicators(features, timeframe)

        # ── اندیکاتورهای حجم ─────────────────────────────
        features = self._volume_indicators(features)

        # ── فیچرهای زمانی ────────────────────────────────
        features = self._temporal_features(features)

        # ── فیچرهای لگ ───────────────────────────────────
        features = self._lag_features(features)

        # ── فیچرهای رژیم ─────────────────────────────────
        features = self._regime_features(features)

        # حذف ردیف‌های NaN
        # تقسیم بر open/low/close می‌تواند inf تولید کند که dropna آن را نمی‌گیرد
        features.replace([np.inf, -np.inf], np.nan, inplace=True)
        features.dropna(inplace=True)
        features.reset_index(drop=True, inplace=True)

        logger.info("features_built", total_features=len(features.columns), rows=len(features))
        return features

    def _price_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """فیچرهای مشتق از قیمت"""
        df["body"] = df["close"] - df["open"]
        df["body_pct"] = df["body"] / df["open"] * 100
        df["upper_shadow"] = df["high"] - df[["open", "close"]].max(axis=1)
        df["lower_shadow"] = df[["open", "close"]].min(axis=1) - df["low"]
        df["range"] = df["high"] - df["low"]
        df["range_pct"] = df["range"] / df["low"] * 100
        df["body_to_range"] = np.where(df["range"] > 0, abs(df["body"]) / df["range"], 0)
        df["mid_price"] = (df["high"] + df["low"]) / 2
        df["typical_price"] = (df["high"] + df["low"] + df["close"]) / 3
        df["close_to_high"] = (df["high"] - df["close"]) / df["range"].replace(0, np.nan)
        df["close_to_low"] = (df["close"] - df["low"]) / df["range"].replace(0, np.nan)

        # درصد تغییرات
        for period in [1, 2, 3, 5, 10, 20]:
            df[f"pct_change_{period}"] = df["close"].pct_change(period) * 100

        return df

    def _trend_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """اندیکاتورهای روند"""
        # EMA
        for period in [8, 13, 20, 50, 100, 200]:
            ema = ta.ema(df["close"], length=period)
            if ema is not None:
                df[f"ema_{period}"] = ema

        # فاصله قیمت از EMA
        if "ema_20" in df.columns:
            df["price_to_ema20"] = (df["close"] - df["ema_20"]) / df["ema_20"] * 100
        if "ema_50" in df.columns:
            df["price_to_ema50"] = (df["close"] - df["ema_50"]) / df["ema_50"] * 100
        if "ema_200" in df.columns:
            df["price_to_ema200"] = (df["close"] - df["ema_200"]) / df["ema_200"] * 100

        # Golden/Death Cross
        if "ema_50" in df.columns and "ema_200" in df.columns:
            df["ema_50_200_diff"] = df["ema_50"] - df["ema_200"]
            df["golden_cross"] = ((df["ema_50"] > df["ema_200"]) & (df["ema_50"].shift(1) <= df["ema_200"].shift(1))).astype(int)
            df["death_cross"] = ((df["ema_50"] < df["ema_200"]) & (df["ema_50"].shift(1) >= df["ema_200"].shift(1))).astype(int)

        # ADX
        adx_df = ta.adx(df["high"], df["low"], df["close"], length=14)
        if adx_df is not None:
            df["adx"] = adx_df.iloc[:, 0]
            df["di_plus"] = adx_df.iloc[:, 1]
            df["di_minus"] = adx_df.iloc[:, 2]
            df["di_diff"] = df["di_plus"] - df["di_minus"]

        # SuperTrend
        st = ta.supertrend(df["high"], df["low"], df["close"], length=10, multiplier=3.0)
        if st is not None:
            df["supertrend"] = st.iloc[:, 0]
            df["supertrend_dir"] = st.iloc[:, 1]

        # Parabolic SAR — در هر ردیف فقط یکی از long/short مقدار دارد و دیگری NaN است.
        # اگر خام رها شوند، dropna نهایی همه‌ی ردیف‌ها را حذف می‌کند. به مقدار «فعال»
        # + جهت تبدیل و ستون‌ها با مقدار فعال پر می‌شوند.
        psar = ta.psar(df["high"], df["low"], df["close"])
        if psar is not None:
            pl = psar.iloc[:, 0]
            ps = psar.iloc[:, 1]
            active = pl.fillna(ps)
            df["psar"] = active
            df["psar_is_long"] = pl.notna().astype(int)
            df["psar_long"] = pl.fillna(active)
            df["psar_short"] = ps.fillna(active)

        return df

    def _momentum_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """اندیکاتورهای مومنتوم"""
        # RSI
        rsi = ta.rsi(df["close"], length=14)
        if rsi is not None:
            df["rsi"] = rsi
            df["rsi_change"] = rsi.diff()

        # MACD
        macd_df = ta.macd(df["close"], fast=12, slow=26, signal=9)
        if macd_df is not None:
            df["macd"] = macd_df.iloc[:, 0]
            df["macd_signal"] = macd_df.iloc[:, 1]
            df["macd_hist"] = macd_df.iloc[:, 2]
            df["macd_hist_change"] = df["macd_hist"].diff()

        # Stochastic
        stoch = ta.stoch(df["high"], df["low"], df["close"], k=14, d=3, smooth_k=3)
        if stoch is not None:
            df["stoch_k"] = stoch.iloc[:, 0]
            df["stoch_d"] = stoch.iloc[:, 1]
            df["stoch_diff"] = df["stoch_k"] - df["stoch_d"]

        # Williams %R
        willr = ta.willr(df["high"], df["low"], df["close"], length=14)
        if willr is not None:
            df["willr"] = willr

        # CCI
        cci = ta.cci(df["high"], df["low"], df["close"], length=20)
        if cci is not None:
            df["cci"] = cci

        # ROC
        roc = ta.roc(df["close"], length=12)
        if roc is not None:
            df["roc"] = roc

        # Ultimate Oscillator
        uo = ta.uo(df["high"], df["low"], df["close"], fast=7, medium=14, slow=28)
        if uo is not None:
            df["ult_osc"] = uo

        return df

    def _volatility_indicators(self, df: pd.DataFrame, timeframe: str = "D1") -> pd.DataFrame:
        """اندیکاتورهای نوسان"""
        # ATR
        atr = ta.atr(df["high"], df["low"], df["close"], length=14)
        if atr is not None:
            df["atr"] = atr
            df["atr_pct"] = atr / df["close"] * 100

        # Bollinger Bands
        bb = ta.bbands(df["close"], length=20, std=2.0)
        if bb is not None:
            df["bb_upper"] = bb.iloc[:, 0]
            df["bb_mid"] = bb.iloc[:, 1]
            df["bb_lower"] = bb.iloc[:, 2]
            df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / df["bb_mid"] * 100
            df["bb_position"] = (df["close"] - df["bb_lower"]) / (df["bb_upper"] - df["bb_lower"]).replace(0, np.nan)

        # Keltner Channel
        kc = ta.kc(df["high"], df["low"], df["close"], length=20, scalar=1.5)
        if kc is not None:
            df["kc_upper"] = kc.iloc[:, 0]
            df["kc_lower"] = kc.iloc[:, 1]

        # BB Squeeze (BB inside KC)
        if "bb_upper" in df.columns and "kc_upper" in df.columns:
            df["bb_squeeze"] = ((df["bb_upper"] < df["kc_upper"]) & (df["bb_lower"] > df["kc_lower"])).astype(int)

        # Donchian Channel
        dc = ta.donchian(df["high"], df["low"], lower_length=20, upper_length=20)
        if dc is not None:
            df["dc_upper"] = dc.iloc[:, 0]
            df["dc_mid"] = dc.iloc[:, 1]
            df["dc_lower"] = dc.iloc[:, 2]

        # Historical Volatility — سالانه‌سازی بر اساس تایم‌فریم (sqrt(252) فقط برای D1 درست است)
        periods_per_year = self._PERIODS_PER_YEAR.get(timeframe, 252)
        df["hist_vol"] = df["close"].pct_change().rolling(20).std() * np.sqrt(periods_per_year) * 100

        return df

    def _volume_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """اندیکاتورهای حجم"""
        # OBV
        obv = ta.obv(df["close"], df["volume"])
        if obv is not None:
            df["obv"] = obv
            df["obv_sma"] = obv.rolling(20).mean()

        # MFI
        mfi = ta.mfi(df["high"], df["low"], df["close"], df["volume"], length=14)
        if mfi is not None:
            df["mfi"] = mfi

        # Volume SMA
        df["vol_sma_20"] = df["volume"].rolling(20).mean()
        df["vol_ratio"] = df["volume"] / df["vol_sma_20"].replace(0, np.nan)

        # نمادهای فاقد حجم (مثل فارکس در yfinance، volume=0) → فیچرهای حجمی
        # کاملاً NaN می‌شوند و dropna نهایی همه‌ی ردیف‌ها را حذف می‌کند.
        # مقادیر خنثی جایگزین می‌شوند تا فقط NaNهای warmup عادی drop شوند.
        df["vol_ratio"] = df["vol_ratio"].replace([np.inf, -np.inf], np.nan).fillna(1.0)
        if "mfi" in df.columns:
            df["mfi"] = df["mfi"].fillna(50.0)
        if "obv" in df.columns:
            df["obv"] = df["obv"].fillna(0.0)
        if "obv_sma" in df.columns:
            df["obv_sma"] = df["obv_sma"].fillna(0.0)

        return df

    def _temporal_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """فیچرهای زمانی"""
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"])
            df["hour"] = ts.dt.hour
            df["day_of_week"] = ts.dt.dayofweek  # 0=دوشنبه
            df["month"] = ts.dt.month

            # جلسات معاملاتی
            df["session_asian"] = ((df["hour"] >= 0) & (df["hour"] < 8)).astype(int)
            df["session_london"] = ((df["hour"] >= 8) & (df["hour"] < 16)).astype(int)
            df["session_ny"] = ((df["hour"] >= 13) & (df["hour"] < 22)).astype(int)
            df["session_overlap"] = ((df["hour"] >= 13) & (df["hour"] < 16)).astype(int)

            # سینوسی (چرخه‌ای)
            df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
            df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
            df["dow_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 5)
            df["dow_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 5)

        return df

    def _lag_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """فیچرهای لگ"""
        for lag in range(1, 11):
            df[f"close_lag_{lag}"] = df["close"].shift(lag)
            df[f"return_lag_{lag}"] = df["close"].pct_change().shift(lag)

        # میانگین بازده‌ها
        returns = df["close"].pct_change()
        df["avg_return_5"] = returns.rolling(5).mean()
        df["avg_return_10"] = returns.rolling(10).mean()
        df["avg_return_20"] = returns.rolling(20).mean()

        # انحراف معیار بازده
        df["std_return_5"] = returns.rolling(5).std()
        df["std_return_20"] = returns.rolling(20).std()

        return df

    def _regime_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """فیچرهای رژیم بازار"""
        # ATR percentile
        # رتبه‌بندی شامل خود مقدار جاری همیشه ۱.۰ می‌دهد و O(N²) است؛
        # نسبت مقادیر گذشته‌ی کوچک‌تر از مقدار جاری محاسبه می‌شود.
        if "atr" in df.columns:
            df["atr_percentile"] = df["atr"].rolling(100).apply(
                lambda x: (x[:-1] < x[-1]).mean(), raw=True
            )

        # Volatility regime
        if "hist_vol" in df.columns:
            vol_median = df["hist_vol"].rolling(100).median()
            df["high_vol_regime"] = (df["hist_vol"] > vol_median).astype(int)

        # Momentum regime
        if "adx" in df.columns and "rsi" in df.columns:
            df["trending"] = (df["adx"] > 25).astype(int)
            df["strong_momentum"] = ((df["adx"] > 25) & ((df["rsi"] > 60) | (df["rsi"] < 40))).astype(int)

        return df

    def get_feature_columns(self, df: pd.DataFrame) -> list[str]:
        """لیست ستون‌های فیچر (بدون timestamp و هدف).

        نکته‌ی مهم: future_return/future_return_pct از قیمت آینده ساخته می‌شوند و
        باید حذف شوند، وگرنه (۱) نشت هدف رخ می‌دهد و دقت ساختگی بالا می‌رود و
        (۲) موقع predict که این ستون‌ها وجود ندارند، خطای «not in index» می‌دهد.
        """
        exclude = {
            "timestamp", "open", "high", "low", "close", "volume",
            "target", "target_class", "future_return", "future_return_pct",
        }
        return [c for c in df.columns if c not in exclude]

    def build_target(
        self,
        df: pd.DataFrame,
        forward_periods: int = 4,
        threshold_pct: float = 0.1,
    ) -> pd.DataFrame:
        """ساخت متغیر هدف"""
        df = df.copy()
        # بازده آینده
        df["future_return"] = df["close"].shift(-forward_periods) / df["close"] - 1
        df["future_return_pct"] = df["future_return"] * 100

        # طبقه‌بندی: Long / Short / Neutral
        df["target_class"] = 1  # Neutral
        df.loc[df["future_return_pct"] > threshold_pct, "target_class"] = 2  # Long
        df.loc[df["future_return_pct"] < -threshold_pct, "target_class"] = 0  # Short

        # هدف رگرسیون
        df["target"] = df["close"].shift(-forward_periods)

        df.dropna(subset=["target", "target_class"], inplace=True)
        return df
