"""OHLC candlestick pattern evidence."""

from __future__ import annotations

from typing import Any

import pandas as pd


class CandlestickAnalyzer:
    def analyze(self, frame: pd.DataFrame) -> dict[str, Any]:
        if frame is None or frame.empty or not {"open", "high", "low", "close"}.issubset(frame.columns):
            return {"pattern_score": 0.0, "patterns_found": []}
        row = frame.iloc[-1]
        o, h, l, c = [float(row[k]) for k in ("open", "high", "low", "close")]
        body = abs(c - o)
        span = max(h - l, 1e-9)
        upper, lower = h - max(o, c), min(o, c) - l
        patterns: list[str] = []
        if body / span < 0.1:
            patterns.append("doji")
        if lower > body * 2 and upper < body:
            patterns.append("hammer" if c >= o else "hanging_man")
        if upper > body * 2 and lower < body:
            patterns.append("shooting_star" if c <= o else "inverted_hammer")
        if c > o and body / span > 0.6:
            patterns.append("bullish_engulfing")
        if c < o and body / span > 0.6:
            patterns.append("bearish_engulfing")
        score = max(0.0, min(100.0, 50.0 + (15.0 if c > o else -15.0) + min(len(patterns), 2) * 5.0))
        return {"pattern_score": round(score, 2), "patterns_found": patterns}
