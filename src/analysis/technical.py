"""Technical-analysis primitive used by signal composition."""

from __future__ import annotations

from typing import Any

import pandas as pd


class TechnicalAnalyzer:
    """Compute bounded trend/momentum/volatility evidence from OHLCV data."""

    def analyze(self, frame: pd.DataFrame) -> dict[str, Any]:
        if frame is None or frame.empty or "close" not in frame:
            return {"technical_score": 0.0, "trend": "neutral", "rsi": None, "atr": None}
        close = pd.to_numeric(frame["close"], errors="coerce").dropna()
        if close.empty:
            return {"technical_score": 0.0, "trend": "neutral", "rsi": None, "atr": None}
        delta = close.diff()
        gains = delta.clip(lower=0).rolling(14, min_periods=1).mean()
        losses = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
        rs = gains / losses.replace(0, pd.NA)
        rsi = float((100 - (100 / (1 + rs))).iloc[-1]) if losses.iloc[-1] else 50.0
        fast = close.ewm(span=12, adjust=False).mean().iloc[-1]
        slow = close.ewm(span=26, adjust=False).mean().iloc[-1]
        trend = "bullish" if fast > slow else "bearish" if fast < slow else "neutral"
        momentum = 1.0 if trend == "bullish" and rsi >= 50 else -1.0 if trend == "bearish" and rsi < 50 else 0.0
        score = max(0.0, min(100.0, 50.0 + momentum * min(abs(rsi - 50.0), 35.0)))
        atr = None
        if {"high", "low"}.issubset(frame.columns):
            high = pd.to_numeric(frame["high"], errors="coerce")
            low = pd.to_numeric(frame["low"], errors="coerce")
            tr = pd.concat([high - low, (high - close).abs(), (low - close).abs()], axis=1).max(axis=1)
            atr = float(tr.rolling(14, min_periods=1).mean().iloc[-1])
        return {"technical_score": round(score, 2), "trend": trend, "rsi": round(rsi, 2), "atr": atr}
