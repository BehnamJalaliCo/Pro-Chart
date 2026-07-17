"""Simple chart-structure analysis from rolling highs/lows."""

from __future__ import annotations

from typing import Any

import pandas as pd


class ChartPatternAnalyzer:
    def analyze(self, frame: pd.DataFrame) -> dict[str, Any]:
        if frame is None or frame.empty or "close" not in frame:
            return {"pattern_score": 0.0, "dominant_direction": "neutral", "patterns_found": []}
        close = pd.to_numeric(frame["close"], errors="coerce").dropna()
        if len(close) < 2:
            return {"pattern_score": 0.0, "dominant_direction": "neutral", "patterns_found": []}
        change = float(close.iloc[-1] - close.iloc[0])
        direction = "bullish" if change > 0 else "bearish" if change < 0 else "neutral"
        score = min(100.0, 50.0 + min(abs(change) / max(abs(float(close.iloc[0])), 1e-9) * 5000.0, 45.0))
        return {"pattern_score": round(score, 2), "dominant_direction": direction, "patterns_found": []}
