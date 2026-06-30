"""تست‌های مدل‌های ML"""

import numpy as np
import pandas as pd
import pytest

from src.ml.feature_engine import FeatureEngine


def make_sample_df(rows: int = 300) -> pd.DataFrame:
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


class TestFeatureEngine:
    def setup_method(self) -> None:
        self.engine = FeatureEngine()
        self.df = make_sample_df()

    def test_build_features(self) -> None:
        features = self.engine.build_features(self.df)
        assert not features.empty
        assert len(features.columns) > 30

    def test_get_feature_columns(self) -> None:
        features = self.engine.build_features(self.df)
        cols = self.engine.get_feature_columns(features)
        assert isinstance(cols, list)
        assert len(cols) > 20
        assert "timestamp" not in cols
        assert "open" not in cols

    def test_build_target(self) -> None:
        features = self.engine.build_features(self.df)
        features_with_target = self.engine.build_target(features)
        assert "target_class" in features_with_target.columns
        assert "target" in features_with_target.columns

    def test_insufficient_data(self) -> None:
        small_df = self.df.head(50)
        features = self.engine.build_features(small_df)
        assert features.empty
