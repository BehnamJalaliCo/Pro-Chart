"""تست‌های تحلیل تکنیکال"""

import numpy as np
import pandas as pd
import pytest

from src.analysis.technical import TechnicalAnalyzer


def make_sample_df(rows: int = 250) -> pd.DataFrame:
    """ساخت DataFrame نمونه"""
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


class TestTechnicalAnalyzer:
    def setup_method(self) -> None:
        self.analyzer = TechnicalAnalyzer()
        self.df = make_sample_df()

    def test_analyze_returns_dict(self) -> None:
        result = self.analyzer.analyze(self.df)
        assert isinstance(result, dict)

    def test_analyze_has_technical_score(self) -> None:
        result = self.analyzer.analyze(self.df)
        assert "technical_score" in result
        assert 0 <= result["technical_score"] <= 100

    def test_analyze_with_insufficient_data(self) -> None:
        small_df = self.df.head(10)
        result = self.analyzer.analyze(small_df)
        assert isinstance(result, dict)

    def test_analyze_with_empty_df(self) -> None:
        empty_df = pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])
        result = self.analyzer.analyze(empty_df)
        assert isinstance(result, dict)
