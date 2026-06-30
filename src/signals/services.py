"""
Service Layer برای سیگنال‌ها — جدا کردن business logic از delivery (HTTP/Redis/Bot).

منطق:
    قبلاً business logic در سه مکان پراکنده بود:
        - api/routes/signals.py (CRUD)
        - signals/engine.py (creation flow)
        - signals/tracker.py (close flow)

    این فایل یک Service Layer می‌سازد که logic را متمرکز می‌کند:
        - SignalQueryService: تمام queries (per-symbol, active, paginated)
        - SignalLifecycleService: ایجاد، تغییر state، بستن
        - AnalysisAggregator: جمع‌آوری نتایج analyzer ها (با شفافیت)

    Routes فقط مسئول HTTP concerns هستند (validation، status code).
    Engine فقط orchestration. Services business rules.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Sequence

from src.core.exceptions import (
    AnalysisError,
    InsufficientDataError,
    SignalCreationError,
    SignalNotFoundError,
)
from src.core.logger import get_logger
from src.core.types import (
    CandlestickAnalysisResult,
    ChartPatternResult,
    MLPredictionResult,
    MultiTimeframeResult,
    SignalPayload,
    SmartMoneyResult,
    SupportResistanceResult,
    TechnicalAnalysisResult,
    VolumeAnalysisResult,
)
from src.signals.state_machine import SignalState

logger = get_logger(__name__)


# ───────────────── Analysis Aggregator ─────────────────


@dataclass
class AggregatedAnalysis:
    """نتایج جمع‌آوری شده از تمام analyzer ها."""

    technical: TechnicalAnalysisResult
    candlestick: CandlestickAnalysisResult
    chart_pattern: ChartPatternResult
    smart_money: SmartMoneyResult
    volume: VolumeAnalysisResult
    sr: SupportResistanceResult
    ml: MLPredictionResult
    mtf: MultiTimeframeResult
    errors: list[str] = field(default_factory=list)
    primary_timeframe: str = "H1"

    def get_score(self, key: str, default: float = 50.0) -> float:
        """دسترسی به score یک analyzer به‌صورت ایمن."""
        mapping = {
            "technical": self.technical.get("technical_score", default),
            "candlestick": self.candlestick.get("pattern_score", default),
            "chart_pattern": self.chart_pattern.get("pattern_score", default),
            "smart_money": self.smart_money.get("smc_score", default),
            "volume": self.volume.get("volume_score", default),
            "ml": self.ml.get("ml_score", default),
        }
        return float(mapping.get(key, default))

    def is_complete(self) -> bool:
        """آیا تمام analyzer ها موفق بودند؟"""
        return len(self.errors) == 0

    def has_critical_failure(self) -> bool:
        """آیا analyzer های مهم fail کرده‌اند؟ (≥ 3 errors)"""
        return len(self.errors) >= 3


# ───────────────── Lifecycle Service ─────────────────


@dataclass
class SignalLifecycleService:
    """
    سرویس مدیریت چرخه‌ی حیات سیگنال.

    Responsibilities:
        - بررسی idempotency (duplicate check)
        - validation قبل از create
        - state transitions
        - audit logging

    این service DB-agnostic است. repository ها برای persistence
    تزریق می‌شوند (DI-friendly، قابل test).
    """

    @staticmethod
    def validate_for_creation(payload: SignalPayload) -> None:
        """
        validation قبل از ساخت سیگنال.

        خطا: SignalCreationError اگر invalid.
        """
        required = ["symbol", "direction", "entry_price", "sl", "tp1", "signal_score"]
        missing = [f for f in required if f not in payload or payload[f] is None]
        if missing:
            raise SignalCreationError(
                f"فیلدهای ضروری مفقود: {missing}",
                context={"missing": missing, "payload": dict(payload)},
            )

        direction = payload.get("direction")
        if direction not in ("long", "short"):
            raise SignalCreationError(
                f"direction نامعتبر: {direction}",
                context={"direction": direction},
            )

        entry = float(payload["entry_price"])
        sl = float(payload["sl"])
        tp1 = float(payload["tp1"])

        # validate SL/TP placement
        if direction == "long":
            if sl >= entry:
                raise SignalCreationError(
                    f"long: SL ({sl}) باید کمتر از entry ({entry}) باشد",
                )
            if tp1 <= entry:
                raise SignalCreationError(
                    f"long: TP1 ({tp1}) باید بیشتر از entry ({entry}) باشد",
                )
        else:  # short
            if sl <= entry:
                raise SignalCreationError(
                    f"short: SL ({sl}) باید بیشتر از entry ({entry}) باشد",
                )
            if tp1 >= entry:
                raise SignalCreationError(
                    f"short: TP1 ({tp1}) باید کمتر از entry ({entry}) باشد",
                )

        # R/R minimum (loose — RiskGuard بهتر چک می‌کند)
        sl_dist = abs(entry - sl)
        tp1_dist = abs(entry - tp1)
        if sl_dist <= 0:
            raise SignalCreationError("فاصله SL از entry صفر است")
        rr = tp1_dist / sl_dist
        if rr < 0.5:
            raise SignalCreationError(
                f"R/R بسیار پایین ({rr:.2f}) — حداقل ۰.۵ لازم است",
            )

    @staticmethod
    def state_for_target_hit(target: str) -> SignalState:
        """نگاشت hit_target → SignalState."""
        mapping = {
            "tp1": SignalState.TP1_HIT,
            "tp2": SignalState.TP2_HIT,
            "tp3": SignalState.TP3_HIT,
            "sl": SignalState.SL_HIT,
            "trailing": SignalState.TRAILING_HIT,
            "manual": SignalState.CLOSED_MANUAL,
            "timeout": SignalState.EXPIRED,
        }
        if target not in mapping:
            raise ValueError(f"target ناشناخته: {target}")
        return mapping[target]


# ───────────────── Query Service ─────────────────


@dataclass
class SignalQueryFilter:
    """فیلتر برای queries سیگنال."""

    symbol: Optional[str] = None
    direction: Optional[str] = None
    status_in: Optional[list[str]] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    is_paper: Optional[bool] = None
    min_score: Optional[float] = None

    def to_sql_conditions(self, signal_model):
        """تبدیل به SQLAlchemy conditions."""
        conditions = []
        if self.symbol:
            conditions.append(signal_model.symbol == self.symbol)
        if self.direction:
            conditions.append(signal_model.direction == self.direction)
        if self.status_in:
            conditions.append(signal_model.status.in_(self.status_in))
        if self.created_after:
            conditions.append(signal_model.created_at >= self.created_after)
        if self.created_before:
            conditions.append(signal_model.created_at <= self.created_before)
        if self.min_score is not None:
            conditions.append(signal_model.signal_score >= self.min_score)
        return conditions


class SignalQueryService:
    """
    سرویس query سیگنال‌ها — متمرکز کردن query patterns.

    این کلاس wrapper روی repository است؛ منطق caching و access control
    اینجا اعمال می‌شود.

    استفاده در route handler:
        service = SignalQueryService(repo=signal_repo)
        page = await service.paginated(filter=..., page=1, per_page=20)
    """

    def __init__(self, repository) -> None:
        self.repo = repository

    async def get_by_id(self, signal_id: int):
        signal = await self.repo.get_by_id(signal_id)
        if signal is None:
            raise SignalNotFoundError(
                f"سیگنال {signal_id} یافت نشد",
                context={"signal_id": signal_id},
            )
        return signal

    async def list_active(self, limit: int = 100):
        """سیگنال‌های فعال (status IN ACTIVE-like)."""
        active_statuses = [
            SignalState.ACTIVE.value,
            SignalState.TP1_HIT.value,
            SignalState.TP2_HIT.value,
        ]
        return await self.repo.list_by_filter(
            SignalQueryFilter(status_in=active_statuses), limit=limit,
        )

    async def paginated(
        self,
        filter: SignalQueryFilter,
        page: int = 1,
        per_page: int = 20,
    ) -> dict:
        """صفحه‌بندی استاندارد + total count."""
        if page < 1:
            page = 1
        if per_page < 1 or per_page > 100:
            per_page = 20
        offset = (page - 1) * per_page
        items = await self.repo.list_by_filter(filter, limit=per_page, offset=offset)
        total = await self.repo.count_by_filter(filter)
        return {
            "items": items,
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page,
        }
