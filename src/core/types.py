"""
TypedDict شکل‌های مشترک — جایگزین dict[str, Any] در API های داخلی.

منطق:
    در پروژه، خیلی از توابع `dict[str, Any]` می‌گیرند و `dict[str, Any]`
    برمی‌گردانند. این type-unsafe است و runtime مشکل پیدا می‌کنیم.

    این ماژول TypedDict های مشترک تعریف می‌کند تا:
        - IDE autocomplete کار کند
        - mypy بتواند shapes را check کند
        - سرعت debugging بالا برود
        - مستندات همراه با کد باشد

نکته: استفاده از `total=False` در همه — تمام فیلدها اختیاری اند چون
analyzer ها برخی فیلدها را skip می‌کنند.
"""

from __future__ import annotations

from typing import Literal, NotRequired, TypedDict


# ── Direction ─────────────────────────────────────────────
SignalDirection = Literal["long", "short", "neutral"]
SignalStrength = Literal["STRONG", "MEDIUM", "NO_SIGNAL"]


# ── Analysis Results ──────────────────────────────────────


class TechnicalAnalysisResult(TypedDict, total=False):
    """خروجی TechnicalAnalyzer.analyze()."""

    technical_score: float
    signal: SignalDirection
    rsi: float
    macd: float
    macd_signal: float
    ema_20: float
    ema_50: float
    ema_200: float
    adx: float
    atr: float
    trend: Literal["bullish", "bearish", "neutral"]


class CandlestickAnalysisResult(TypedDict, total=False):
    """خروجی CandlestickAnalyzer.analyze()."""

    pattern_score: float
    patterns_found: list[str]
    bullish_patterns: NotRequired[list[str]]
    bearish_patterns: NotRequired[list[str]]
    direction: SignalDirection


class ChartPatternResult(TypedDict, total=False):
    """خروجی ChartPatternAnalyzer.analyze()."""

    pattern_score: float
    patterns_found: list[dict]
    direction: SignalDirection


class SmartMoneyResult(TypedDict, total=False):
    """خروجی SmartMoneyAnalyzer.analyze()."""

    smc_score: float
    smc_bias: Literal["bullish", "bearish", "neutral"]
    order_blocks: list[dict]
    supply_demand_zones: list[dict]
    fair_value_gaps: NotRequired[list[dict]]


class VolumeAnalysisResult(TypedDict, total=False):
    """خروجی VolumeAnalyzer.analyze()."""

    volume_score: float
    volume_confirms_trend: bool
    avg_volume: NotRequired[float]
    current_volume: NotRequired[float]


class SupportResistanceResult(TypedDict, total=False):
    """خروجی SupportResistanceAnalyzer.analyze()."""

    sr_levels: list[dict]
    nearest_support: NotRequired[float]
    nearest_resistance: NotRequired[float]
    fibonacci_extension: dict


class MLPredictionResult(TypedDict, total=False):
    """خروجی EnsemblePredictor.predict()."""

    ml_score: float
    direction: SignalDirection
    confidence: float
    xgb_prediction: NotRequired[dict]
    lgbm_prediction: NotRequired[dict]
    lstm_prediction: NotRequired[dict]


class MultiTimeframeResult(TypedDict, total=False):
    """خروجی MultiTimeframeAnalyzer.analyze()."""

    confluence_count: int
    net_confluence: int
    weighted_score: float
    direction: SignalDirection
    higher_tf_bias: Literal[
        "bullish", "slightly_bullish", "neutral",
        "slightly_bearish", "bearish",
    ]
    conflict: bool
    timeframe_details: dict
    aligned: bool
    bullish_tfs: int
    bearish_tfs: int


# ── Live Price ────────────────────────────────────────────


class LivePrice(TypedDict, total=False):
    """قیمت لحظه‌ای از Redis."""

    bid: float
    ask: float
    price: NotRequired[float]  # mid
    spread: NotRequired[float]
    timestamp: NotRequired[str]
    source: NotRequired[str]


# ── Signal Payload ────────────────────────────────────────


class SignalPayload(TypedDict, total=False):
    """payload یک سیگنال — برای انتشار/ذخیره."""

    id: NotRequired[int]
    symbol: str
    direction: SignalDirection
    signal_type: SignalStrength
    entry_price: float
    entry_zone_low: NotRequired[float]
    entry_zone_high: NotRequired[float]
    sl: float
    tp1: float
    tp2: NotRequired[float]
    tp3: NotRequired[float]
    signal_score: float
    technical_score: NotRequired[float]
    pattern_score: NotRequired[float]
    ml_score: NotRequired[float]
    timeframe: str
    created_at: NotRequired[str]
    is_paper: NotRequired[bool]

    # متادیتای phase 5
    dominant_component: NotRequired[Literal["technical", "pattern", "ml", "mixed"]]
    market_regime: NotRequired[str]
    session: NotRequired[str]
    higher_tf_bias: NotRequired[str]


# ── Trade Outcome (برای signal close) ─────────────────────


class TradeOutcomeData(TypedDict, total=False):
    """نتیجه‌ی یک معامله‌ی بسته‌شده."""

    signal_id: int
    symbol: str
    direction: SignalDirection
    entry_price: float
    close_price: float
    pnl_pips: float
    pnl_dollar: float
    hit_target: Literal["tp1", "tp2", "tp3", "sl", "trailing", "manual"]
    close_reason: str
    duration_minutes: int
    is_paper: NotRequired[bool]


# ── Risk Check Result ─────────────────────────────────────


class RiskCheckResult(TypedDict, total=False):
    """نتیجه‌ی RiskGuard.evaluate()."""

    allowed: bool
    reasons: list[dict]
    regime: NotRequired[dict]
    metadata: dict
