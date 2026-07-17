"""Canonical regressions for closed-candle analytical input."""

from __future__ import annotations

import ast
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from src.signals.candle_utils import (
    drop_unclosed_candle,
    drop_unclosed_candle_rows,
    is_candle_closed,
)


ROOT = Path(__file__).resolve().parents[2]


def test_epoch_seconds_and_milliseconds_are_normalized() -> None:
    now = datetime(2026, 7, 15, 2, 0, tzinfo=timezone.utc)
    opened = datetime(2026, 7, 15, 1, 0, tzinfo=timezone.utc)
    seconds = int(opened.timestamp())
    milliseconds = seconds * 1000

    assert is_candle_closed(seconds, "H1", now=now)
    assert is_candle_closed(milliseconds, "H1", now=now)


def test_forming_row_is_removed_without_mutating_input() -> None:
    rows = [
        {"t": 1_752_539_400, "c": 101.0},
        {"t": 1_752_543_000, "c": 102.0},
    ]
    now = datetime.fromtimestamp(1_752_544_800, tz=timezone.utc)

    filtered = drop_unclosed_candle_rows(rows, "H1", now=now)

    assert filtered == rows[:-1]
    assert len(rows) == 2


def test_closed_row_is_retained() -> None:
    rows = [{"t": 1_752_539_400, "c": 101.0}]
    now = datetime.fromtimestamp(1_752_543_000, tz=timezone.utc)

    assert drop_unclosed_candle_rows(rows, "H1", now=now) == rows


def test_unknown_timeframe_fails_closed() -> None:
    rows = [{"t": 1, "c": 1.0}, {"t": 2, "c": 2.0}]

    assert drop_unclosed_candle_rows(rows, "UNKNOWN") == rows[:-1]


def test_dataframe_contract_remains_supported() -> None:
    now = pd.Timestamp.now(tz="UTC")
    frame = pd.DataFrame(
        {
            "timestamp": [now - pd.Timedelta(hours=2), now - pd.Timedelta(minutes=30)],
            "close": [100.0, 101.0],
        }
    )

    filtered = drop_unclosed_candle(frame, "H1")

    assert len(filtered) == 1
    assert filtered.iloc[0]["close"] == 100.0


def test_ai_signal_route_filters_before_indicator_calculation() -> None:
    route = ROOT / "src/api/routes/bazaarnama.py"
    tree = ast.parse(route.read_text(encoding="utf-8"))
    ai_signal = next(
        node
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name == "ai_signal"
    )
    calls = [
        node.func.id
        for node in ast.walk(ai_signal)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    ]

    assert "drop_unclosed_candle_rows" in calls
    assert calls.index("drop_unclosed_candle_rows") < calls.index("_ind_atr")
