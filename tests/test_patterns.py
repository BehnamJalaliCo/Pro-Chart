"""تست‌های تشخیص الگوها"""

import numpy as np
import pandas as pd
import pytest

from src.analysis.candlestick_patterns import CandlestickAnalyzer
from src.analysis.chart_patterns import ChartPatternAnalyzer


def make_sample_df(rows: int = 250) -> pd.DataFrame:
    np.random.seed(42)
    dates = pd.date_range("2024-01-01", periods=rows, freq="h", tz="UTC")
    close = 2000 + np.cumsum(np.random.randn(rows) * 2)
    high = close + np.abs(np.random.randn(rows)) * 3
    low = close - np.abs(np.random.randn(rows)) * 3
    open_ = close + np.random.randn(rows) * 1

    return pd.DataFrame({
        "timestamp": dates,
        "open": open_,
        "high": high,
        "low": low,
        "close": close,
        "volume": np.random.randint(100, 10000, rows).astype(float),
    })


class TestCandlestickAnalyzer:
    def setup_method(self) -> None:
        self.analyzer = CandlestickAnalyzer()
        self.df = make_sample_df()

    def test_analyze_returns_dict(self) -> None:
        result = self.analyzer.analyze(self.df)
        assert isinstance(result, dict)

    def test_analyze_has_pattern_score(self) -> None:
        result = self.analyzer.analyze(self.df)
        assert "pattern_score" in result
        assert 0 <= result["pattern_score"] <= 100

    def test_patterns_found_is_list(self) -> None:
        result = self.analyzer.analyze(self.df)
        assert isinstance(result.get("patterns_found", []), list)


class TestChartPatternAnalyzer:
    def setup_method(self) -> None:
        self.analyzer = ChartPatternAnalyzer()
        self.df = make_sample_df()

    def test_analyze_returns_dict(self) -> None:
        result = self.analyzer.analyze(self.df)
        assert isinstance(result, dict)

    def test_analyze_has_pattern_score(self) -> None:
        result = self.analyzer.analyze(self.df)
        assert "pattern_score" in result

    def test_dominant_direction(self) -> None:
        result = self.analyzer.analyze(self.df)
        assert result.get("dominant_direction") in ("bullish", "bearish", "neutral")
