"""In-memory multi-period loss limits (Redis can be added by caller)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum


class LossLimitLevel(str, Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


@dataclass
class LevelStatus:
    level: LossLimitLevel
    loss: float
    limit: float
    triggered: bool
    size_multiplier: float


class MultiLevelLossLimit:
    LIMITS = {LossLimitLevel.HOURLY: (0.01, 0.5), LossLimitLevel.DAILY: (0.02, 0.0), LossLimitLevel.WEEKLY: (0.05, 0.0), LossLimitLevel.MONTHLY: (0.10, 0.0)}

    def __init__(self, redis_client=None) -> None:
        self.redis_client = redis_client
        self._outcomes: list[tuple[datetime, float]] = []

    @staticmethod
    def _period_key(level: LossLimitLevel, when: datetime) -> str:
        t = when.astimezone(timezone.utc)
        if level == LossLimitLevel.HOURLY:
            return t.strftime("loss:hourly:%Y-%m-%dT%H")
        if level == LossLimitLevel.DAILY:
            return t.strftime("loss:daily:%Y-%m-%d")
        if level == LossLimitLevel.WEEKLY:
            return t.strftime("loss:weekly:%G-W%V")
        return t.strftime("loss:monthly:%Y-%m")

    @staticmethod
    def _start(level: LossLimitLevel, now: datetime) -> datetime:
        if level == LossLimitLevel.HOURLY:
            return now.replace(minute=0, second=0, microsecond=0)
        if level == LossLimitLevel.DAILY:
            return now.replace(hour=0, minute=0, second=0, microsecond=0)
        if level == LossLimitLevel.WEEKLY:
            day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            return day - timedelta(days=day.weekday())
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    async def record_trade_outcome(self, pnl: float) -> None:
        self._outcomes.append((datetime.now(timezone.utc), float(pnl)))

    async def status(self, *, account_equity: float) -> object:
        now = datetime.now(timezone.utc); levels = []
        for level, (fraction, multiplier) in self.LIMITS.items():
            start = self._start(level, now)
            loss = -sum(p for t, p in self._outcomes if t >= start and p < 0)
            limit = account_equity * fraction
            levels.append(LevelStatus(level, loss, limit, loss >= limit, multiplier if loss >= limit else 1.0))
        return type("LimitStatus", (), {"levels": levels})()

    async def can_emit_signal(self, *, account_equity: float) -> tuple[bool, float, str]:
        current = await self.status(account_equity=account_equity)
        for item in current.levels:
            if item.triggered and item.size_multiplier <= 0:
                return False, 0.0, f"{item.level.value} loss limit reached"
        for item in current.levels:
            if item.triggered:
                if item.size_multiplier <= 0:
                    return False, 0.0, f"{item.level.value} loss limit reached"
                return True, item.size_multiplier, f"{item.level.value} loss limit reached; size reduced"
        return True, 1.0, "within limits"
