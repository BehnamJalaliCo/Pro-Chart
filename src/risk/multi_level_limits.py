"""
Multi-level loss limits — hourly + daily + weekly + monthly circuit breakers.

منطق متخصص بازار:
    Daily loss limit کافی نیست. در یک ساعت می‌توان ۲٪ از کل ضرر سال را
    خورد (مثلاً NFP miss). در هفته‌ی بد، ۵٪ ممکن است. در ماه شکست‌خورده،
    ۱۰٪. هر سطح باید جداگانه circuit breaker داشته باشد.

    استانداردهای صنعتی (prop firms):
        - hourly: -1% → کاهش size به 50% برای ساعت بعد
        - daily: -2% → block سیگنال جدید تا rollover
        - weekly: -5% → review استراتژی، block تا دوشنبه
        - monthly: -10% → review کامل + downsize برای ماه بعد

    این ماژول counter ها را در Redis نگه می‌دارد و در RiskGuard
    integrate می‌شود.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Protocol


class _RedisLike(Protocol):
    async def get(self, key: str) -> Optional[str]: ...
    async def set(self, key: str, value: str, **kwargs) -> object: ...
    async def incrbyfloat(self, key: str, value: float) -> float: ...
    async def expire(self, key: str, seconds: int) -> bool: ...


class LossLimitLevel(str, Enum):
    """سطح loss limit."""

    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


@dataclass
class LimitStatus:
    """وضعیت یک سطح limit."""

    level: LossLimitLevel
    current_loss: float
    limit: float
    period_key: str
    triggered: bool
    size_multiplier: float = 1.0  # برای soft limits که size را کم می‌کنند

    def to_dict(self) -> dict:
        return {
            "level": self.level.value,
            "current_loss": round(self.current_loss, 2),
            "limit": round(self.limit, 2),
            "period_key": self.period_key,
            "triggered": self.triggered,
            "size_multiplier": round(self.size_multiplier, 3),
            "loss_pct_of_limit": (
                round(abs(self.current_loss) / abs(self.limit) * 100, 1)
                if self.limit != 0 else 0.0
            ),
        }


@dataclass
class MultiLevelStatus:
    """تصویر کلی تمام سطوح."""

    timestamp: datetime
    account_equity: float
    levels: list[LimitStatus] = field(default_factory=list)
    any_triggered: bool = False
    overall_size_multiplier: float = 1.0
    block_reason: str = ""

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "account_equity": round(self.account_equity, 2),
            "any_triggered": self.any_triggered,
            "overall_size_multiplier": round(self.overall_size_multiplier, 3),
            "block_reason": self.block_reason,
            "levels": [l.to_dict() for l in self.levels],
        }


@dataclass
class LimitConfig:
    """پیکربندی یک سطح limit."""

    level: LossLimitLevel
    max_loss_pct: float  # درصد از equity
    size_multiplier_on_breach: float = 0.0  # 0 = block کامل، 0.5 = کاهش به 50%
    ttl_seconds: int = 3600  # طول دوره به ثانیه


# ── پیکربندی پیش‌فرض ──
_DEFAULT_CONFIGS: dict[LossLimitLevel, LimitConfig] = {
    LossLimitLevel.HOURLY: LimitConfig(
        level=LossLimitLevel.HOURLY,
        max_loss_pct=1.0,
        size_multiplier_on_breach=0.5,  # soft: کاهش size
        ttl_seconds=3600,
    ),
    LossLimitLevel.DAILY: LimitConfig(
        level=LossLimitLevel.DAILY,
        max_loss_pct=2.0,
        size_multiplier_on_breach=0.0,  # hard: block
        ttl_seconds=24 * 3600,
    ),
    LossLimitLevel.WEEKLY: LimitConfig(
        level=LossLimitLevel.WEEKLY,
        max_loss_pct=5.0,
        size_multiplier_on_breach=0.0,
        ttl_seconds=7 * 24 * 3600,
    ),
    LossLimitLevel.MONTHLY: LimitConfig(
        level=LossLimitLevel.MONTHLY,
        max_loss_pct=10.0,
        size_multiplier_on_breach=0.0,
        ttl_seconds=31 * 24 * 3600,
    ),
}


class MultiLevelLossLimit:
    """
    مدیریت ۴ سطح circuit breaker.

    Storage: Redis (یا dict داخلی برای test).

    کلیدها:
        risk:loss:hourly:{YYYY-MM-DDTHH}
        risk:loss:daily:{YYYY-MM-DD}
        risk:loss:weekly:{YYYY-Www}      # ISO week
        risk:loss:monthly:{YYYY-MM}

    قواعد:
        - hourly soft: کاهش size به 50% برای ساعت بعد
        - daily/weekly/monthly hard: block سیگنال جدید تا انقضای دوره
        - manual unlock فقط برای daily ممکن (نه weekly/monthly)
    """

    def __init__(
        self,
        redis_client: Optional[_RedisLike] = None,
        configs: Optional[dict[LossLimitLevel, LimitConfig]] = None,
    ) -> None:
        self._redis = redis_client
        self._configs = configs or _DEFAULT_CONFIGS
        self._local_store: dict[str, float] = {}

    # ── کلیدسازی ────────────────────────────────────────

    @staticmethod
    def _period_key(level: LossLimitLevel, now: datetime) -> str:
        if level == LossLimitLevel.HOURLY:
            return now.strftime("%Y-%m-%dT%H")
        if level == LossLimitLevel.DAILY:
            return now.strftime("%Y-%m-%d")
        if level == LossLimitLevel.WEEKLY:
            iso_year, iso_week, _ = now.isocalendar()
            return f"{iso_year}-W{iso_week:02d}"
        if level == LossLimitLevel.MONTHLY:
            return now.strftime("%Y-%m")
        return now.isoformat()

    def _redis_key(self, level: LossLimitLevel, period: str) -> str:
        return f"risk:loss:{level.value}:{period}"

    @staticmethod
    def _ttl_to_period_end(
        level: LossLimitLevel, now: datetime, full_ttl: int
    ) -> int:
        """
        ثانیه‌های باقی‌مانده تا پایان دوره‌ی جاری.

        از full_ttl استفاده نمی‌کنیم تا معامله‌ی نزدیک مرز، کلید را به
        دوره‌ی بعد کش ندهد (counter باید با rollover دوره ریست شود).
        """
        from datetime import timedelta

        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        if level == LossLimitLevel.HOURLY:
            end = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        elif level == LossLimitLevel.DAILY:
            end = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        elif level == LossLimitLevel.WEEKLY:
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            # دوشنبه = ابتدای هفته‌ی ISO
            end = start_of_day + timedelta(days=7 - now.weekday())
        elif level == LossLimitLevel.MONTHLY:
            start_of_month = now.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            if start_of_month.month == 12:
                end = start_of_month.replace(year=start_of_month.year + 1, month=1)
            else:
                end = start_of_month.replace(month=start_of_month.month + 1)
        else:
            return full_ttl

        remaining = int((end - now).total_seconds())
        # حداقل ۱ ثانیه تا کلید بلافاصله منقضی نشود
        return max(1, min(remaining, full_ttl))

    # ── خواندن/نوشتن ────────────────────────────────────

    async def _read_loss(self, key: str) -> float:
        if self._redis is not None:
            # fail-closed: اگر Redis خطا داد، استثنا را بالا می‌بریم تا
            # circuit breaker به جای صفر-خواندن، سیگنال را reject کند.
            raw = await self._redis.get(key)
            return float(raw) if raw is not None else 0.0
        return float(self._local_store.get(key, 0.0))

    async def _write_loss(
        self, key: str, value: float, ttl: int
    ) -> None:
        if self._redis is not None:
            # fail-closed: خطای نوشتن را بالا می‌بریم تا counter ضرر
            # بی‌صدا در _local_store گم نشود.
            await self._redis.set(key, str(value), ex=ttl)
            return
        self._local_store[key] = value

    # ── ثبت outcome ─────────────────────────────────────

    async def record_trade_outcome(
        self,
        pnl_dollar: float,
        now: Optional[datetime] = None,
    ) -> None:
        """
        ثبت P&L در تمام ۴ سطح.

        فقط ضرر تجمعی نگهداری می‌شود (مثبت ها به ۰ ریست نمی‌کنند، فقط
        جمع می‌شوند) — این برای رسیدن به breach realistic است.
        """
        if now is None:
            now = datetime.now(timezone.utc)
        for level, cfg in self._configs.items():
            period = self._period_key(level, now)
            key = self._redis_key(level, period)
            current = await self._read_loss(key)
            # فقط ضرر تجمعی نگه می‌داریم؛ سودها نباید ضررهای بعدی را جبران کنند
            new_val = current + min(pnl_dollar, 0.0)
            ttl = self._ttl_to_period_end(level, now, cfg.ttl_seconds)
            await self._write_loss(key, new_val, ttl)

    # ── بررسی وضعیت ─────────────────────────────────────

    async def status(
        self,
        account_equity: float,
        now: Optional[datetime] = None,
    ) -> MultiLevelStatus:
        """گزارش وضعیت تمام سطوح."""
        if now is None:
            now = datetime.now(timezone.utc)
        report = MultiLevelStatus(
            timestamp=now,
            account_equity=account_equity,
        )

        for level, cfg in self._configs.items():
            period = self._period_key(level, now)
            key = self._redis_key(level, period)
            current = await self._read_loss(key)

            limit = -abs(account_equity * cfg.max_loss_pct / 100.0)  # negative
            triggered = current <= limit

            multiplier = (
                cfg.size_multiplier_on_breach if triggered else 1.0
            )

            report.levels.append(LimitStatus(
                level=level,
                current_loss=current,
                limit=limit,
                period_key=period,
                triggered=triggered,
                size_multiplier=multiplier,
            ))

        # overall: minimum multiplier (most restrictive)
        report.overall_size_multiplier = min(
            (l.size_multiplier for l in report.levels), default=1.0
        )
        report.any_triggered = any(l.triggered for l in report.levels)

        # block reason
        triggered_hard = [
            l for l in report.levels
            if l.triggered and l.size_multiplier == 0.0
        ]
        if triggered_hard:
            report.block_reason = "; ".join(
                f"{l.level.value} loss limit hit: "
                f"${l.current_loss:.0f} / ${l.limit:.0f}"
                for l in triggered_hard
            )

        return report

    async def can_emit_signal(
        self,
        account_equity: float,
        now: Optional[datetime] = None,
    ) -> tuple[bool, float, str]:
        """
        آیا می‌توان signal جدید صادر کرد؟

        خروجی: (allowed, size_multiplier, reason)
            size_multiplier=1.0 → معامله‌ی نرمال
            size_multiplier=0.5 → معامله با ۵۰٪ سایز (soft limit)
            size_multiplier=0.0 → block کامل
        """
        report = await self.status(account_equity, now)
        if report.overall_size_multiplier == 0.0:
            return False, 0.0, report.block_reason
        return True, report.overall_size_multiplier, ""
