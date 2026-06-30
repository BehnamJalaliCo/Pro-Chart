"""تست‌های تحلیل Smart Money"""

import numpy as np
import pandas as pd
import pytest

from src.analysis.smart_money import SmartMoneyAnalyzer


def make_trending_df(rows: int = 250, direction: str = "up") -> pd.DataFrame:
    np.random.seed(42)
    dates = pd.date_range("2024-01-01", periods=rows, freq="h", tz="UTC")
    trend = np.linspace(0, 50, rows) if direction == "up" else np.linspace(50, 0, rows)
    noise = np.random.randn(rows) * 2
    close = 2000 + trend + noise
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


class TestSmartMoneyAnalyzer:
    def setup_method(self) -> None:
        self.analyzer = SmartMoneyAnalyzer()

    def test_analyze_uptrend(self) -> None:
        df = make_trending_df(direction="up")
        result = self.analyzer.analyze(df)
        assert isinstance(result, dict)
        assert "smc_score" in result
        assert 0 <= result["smc_score"] <= 100

    def test_analyze_downtrend(self) -> None:
        df = make_trending_df(direction="down")
        result = self.analyzer.analyze(df)
        assert isinstance(result, dict)
        assert "smc_bias" in result

    def test_order_blocks_detected(self) -> None:
        df = make_trending_df()
        result = self.analyzer.analyze(df)
        assert isinstance(result.get("order_blocks", []), list)

    def test_fair_value_gaps(self) -> None:
        df = make_trending_df()
        result = self.analyzer.analyze(df)
        assert isinstance(result.get("fair_value_gaps", []), list)

    def test_structure(self) -> None:
        df = make_trending_df()
        result = self.analyzer.analyze(df)
        assert "structure" in result
