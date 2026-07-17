"""تست‌های سیستم سیگنال"""

import pytest


class TestScorer:
    def test_score_calculation(self) -> None:
        from src.signals.scorer import SignalScorer
        scorer = SignalScorer()
        result = scorer.calculate_score(
            technical_score=80,
            pattern_score=70,
            ml_score=85,
            multi_tf_confluence=3,
            volume_confirms=True,
            against_major_trend=False,
            news_within_1h=False,
        )
        assert isinstance(result, dict)
        assert "total_score" in result
        assert 0 <= result["total_score"] <= 100

    def test_strong_signal(self) -> None:
        from src.signals.scorer import SignalScorer
        scorer = SignalScorer()
        result = scorer.calculate_score(
            technical_score=90,
            pattern_score=85,
            ml_score=90,
            multi_tf_confluence=4,
            volume_confirms=True,
            against_major_trend=False,
            news_within_1h=False,
        )
        assert result["signal_type"] == "STRONG"

    def test_no_signal_low_score(self) -> None:
        from src.signals.scorer import SignalScorer
        scorer = SignalScorer()
        result = scorer.calculate_score(
            technical_score=40,
            pattern_score=30,
            ml_score=50,
            multi_tf_confluence=1,
            volume_confirms=False,
            against_major_trend=True,
            news_within_1h=True,
        )
        assert result["signal_type"] == "NO_SIGNAL"


class TestRiskManager:
    def test_calculate_levels(self) -> None:
        from src.signals.risk_manager import RiskManager
        rm = RiskManager()
        result = rm.calculate_levels(
            entry_price=2045.0,
            direction="long",
            atr=7.3,
            nearest_support=2038.0,
            nearest_resistance=2060.0,
            symbol="XAUUSD",
        )
        assert "sl" in result
        assert "tp1" in result
        assert "tp2" in result
        assert "tp3" in result
        assert result["sl"] < result["entry_price"]
        assert result["tp1"] > result["entry_price"]
