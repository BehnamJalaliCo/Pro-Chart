"""Leak-safe feature construction for market-model training."""

from __future__ import annotations

import pandas as pd


class FeatureEngine:
    MIN_ROWS = 100

    def build_features(self, frame: pd.DataFrame) -> pd.DataFrame:
        if frame is None or len(frame) < self.MIN_ROWS:
            return pd.DataFrame()
        required = {"open", "high", "low", "close", "volume"}
        if not required.issubset(frame.columns):
            return pd.DataFrame()
        out = frame.copy()
        close = pd.to_numeric(out["close"], errors="coerce")
        high = pd.to_numeric(out["high"], errors="coerce")
        low = pd.to_numeric(out["low"], errors="coerce")
        volume = pd.to_numeric(out["volume"], errors="coerce")
        ret = close.pct_change()
        for window in (3, 5, 8, 10, 14, 20, 30, 50, 100):
            out[f"return_{window}"] = close.pct_change(window)
            out[f"sma_{window}"] = close.rolling(window).mean()
            out[f"ema_{window}"] = close.ewm(span=window, adjust=False).mean()
            out[f"volatility_{window}"] = ret.rolling(window).std()
        out["range"] = high - low
        out["body"] = close - pd.to_numeric(out["open"], errors="coerce")
        out["upper_wick"] = high - out[["open", "close"]].max(axis=1)
        out["lower_wick"] = out[["open", "close"]].min(axis=1) - low
        out["volume_change"] = volume.pct_change()
        out["volume_sma_20"] = volume.rolling(20).mean()
        out["rsi_14"] = self._rsi(close)
        out["atr_14"] = pd.concat([high - low, (high - close.shift()).abs(), (low - close.shift()).abs()], axis=1).max(axis=1).rolling(14).mean()
        out = out.replace([float("inf"), float("-inf")], pd.NA).dropna().reset_index(drop=True)
        return out

    def get_feature_columns(self, features: pd.DataFrame) -> list[str]:
        excluded = {"timestamp", "open", "high", "low", "close", "volume", "target", "target_class"}
        return [c for c in features.columns if c not in excluded]

    def build_target(self, features: pd.DataFrame) -> pd.DataFrame:
        out = features.copy()
        future = out["close"].shift(-1) / out["close"] - 1
        out["target"] = future
        out["target_class"] = (future > 0).astype("Int64")
        return out.dropna(subset=["target"]).reset_index(drop=True)

    @staticmethod
    def _rsi(close: pd.Series) -> pd.Series:
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = -delta.clip(upper=0).rolling(14).mean()
        rs = gain / loss.replace(0, pd.NA)
        return 100 - 100 / (1 + rs)
