"""Deterministic, bounded signal scoring used by the signal pipeline."""

from __future__ import annotations

from typing import Any


class SignalScorer:
    """Combine normalized signal factors without allowing out-of-range scores."""

    def calculate_score(
        self,
        *,
        technical_score: float,
        pattern_score: float,
        ml_score: float,
        multi_tf_confluence: int,
        volume_confirms: bool,
        against_major_trend: bool,
        news_within_1h: bool,
    ) -> dict[str, Any]:
        base = (
            0.35 * self._clamp(technical_score)
            + 0.25 * self._clamp(pattern_score)
            + 0.25 * self._clamp(ml_score)
            + 5.0 * min(max(int(multi_tf_confluence), 0), 4)
        )
        if volume_confirms:
            base += 5.0
        if against_major_trend:
            base -= 10.0
        if news_within_1h:
            base -= 10.0
        total = round(self._clamp(base), 2)
        if total >= 80:
            signal_type = "STRONG"
        elif total >= 60:
            signal_type = "VALID"
        else:
            signal_type = "NO_SIGNAL"
        return {"total_score": total, "signal_type": signal_type}

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(float(value), 100.0))
