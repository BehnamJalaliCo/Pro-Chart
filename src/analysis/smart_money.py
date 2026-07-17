"""Deterministic smart-money structure evidence from OHLCV candles."""

from __future__ import annotations

from typing import Any

import pandas as pd


class SmartMoneyAnalyzer:
    def analyze(self, frame: pd.DataFrame) -> dict[str, Any]:
        base = {"smc_score": 0.0, "smc_bias": "neutral", "structure": "unknown", "order_blocks": [], "fair_value_gaps": []}
        if frame is None or len(frame) < 3 or not {"high", "low", "close"}.issubset(frame.columns):
            return base
        high = pd.to_numeric(frame["high"], errors="coerce")
        low = pd.to_numeric(frame["low"], errors="coerce")
        close = pd.to_numeric(frame["close"], errors="coerce")
        if close.dropna().empty:
            return base
        first, last = float(close.iloc[0]), float(close.iloc[-1])
        delta = last - first
        bias = "bullish" if delta > 0 else "bearish" if delta < 0 else "neutral"
        structure = "higher_highs" if bias == "bullish" else "lower_lows" if bias == "bearish" else "range"
        score = min(100.0, 50.0 + min(abs(delta) / max(abs(first), 1e-9) * 5000.0, 45.0))
        order_blocks: list[dict[str, float]] = []
        for i in range(1, len(frame)):
            if bias == "bullish" and close.iloc[i] > high.iloc[i - 1]:
                order_blocks.append({"high": float(high.iloc[i - 1]), "low": float(low.iloc[i - 1]), "index": i - 1})
            elif bias == "bearish" and close.iloc[i] < low.iloc[i - 1]:
                order_blocks.append({"high": float(high.iloc[i - 1]), "low": float(low.iloc[i - 1]), "index": i - 1})
        gaps: list[dict[str, float]] = []
        for i in range(2, len(frame)):
            if low.iloc[i] > high.iloc[i - 2]:
                gaps.append({"low": float(high.iloc[i - 2]), "high": float(low.iloc[i]), "direction": "bullish", "index": i})
            elif high.iloc[i] < low.iloc[i - 2]:
                gaps.append({"low": float(high.iloc[i]), "high": float(low.iloc[i - 2]), "direction": "bearish", "index": i})
        return {"smc_score": round(score, 2), "smc_bias": bias, "structure": structure, "order_blocks": order_blocks[-20:], "fair_value_gaps": gaps[-20:]}
