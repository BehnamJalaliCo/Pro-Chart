"""
Idempotency + Outbox pattern — جلوگیری از duplicate signals و lost events.

منطق متخصص بازار:
    دو مسئله‌ی معماری کلاسیک:

    1) Duplicate signals: engine restart می‌شود و همان candles را
       reprocess می‌کند → سیگنال تکراری → کاربر دو پیام می‌گیرد، PnL
       غلط محاسبه می‌شود.

    2) Lost events: DB transaction موفق ولی publish به Redis fail شد
       → سیگنال در DB است ولی هرگز به ربات نرسید.

    راه‌حل ها:

    Idempotency key:
        کلید deterministic از (symbol, primary_tf, candle_timestamp,
        direction). قبل از insert، بررسی می‌کنیم. اگر duplicate باشد،
        skip می‌کنیم.

    Outbox pattern:
        به جای publish مستقیم، event ها را در همان DB transaction در
        یک outbox table می‌نویسیم. یک worker جدا (Celery یا polling
        thread) outbox را می‌خواند و publish می‌کند. این تضمین می‌کند
        publish at-least-once است.

References:
    Chris Richardson, "Microservices Patterns" (2018), Ch. 5
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


def compute_signal_idempotency_key(
    symbol: str,
    primary_timeframe: str,
    candle_timestamp: datetime | str,
    direction: str,
) -> str:
    """
    کلید idempotency برای یک سیگنال.

    deterministic: همان ورودی → همان کلید. اگر engine برای همان کندل
    دوبار اجرا شود (مثلاً restart)، کلید یکسان است.

    خروجی: SHA-256 hex (۶۴ کاراکتر).
    """
    if isinstance(candle_timestamp, datetime):
        ts_str = candle_timestamp.replace(tzinfo=candle_timestamp.tzinfo or timezone.utc).isoformat()
    else:
        ts_str = str(candle_timestamp)
    raw = f"{symbol}|{primary_timeframe}|{ts_str}|{direction}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def compute_event_idempotency_key(event_type: str, entity_id: int, payload_hash: str) -> str:
    """کلید idempotency برای یک event در outbox."""
    raw = f"{event_type}|{entity_id}|{payload_hash}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def hash_payload(payload: dict) -> str:
    """hash deterministic از یک dict payload."""
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


# ── Outbox Pattern ─────────────────────────────────────


class OutboxStatus(str, Enum):
    """status یک event در outbox."""

    PENDING = "pending"
    PUBLISHED = "published"
    FAILED = "failed"
    DEAD = "dead"  # بیش از حد retry → human review


@dataclass
class OutboxEvent:
    """یک event در outbox.

    این dataclass یک ORM row نیست — only payload that gets persisted.
    Persistence layer (DB) باید فیلدها را به جدول نگاشت کند.
    """

    event_type: str         # "signal.created" | "signal.closed" | "trade.executed"
    entity_type: str        # "signal" | "trade" | "position"
    entity_id: int
    payload: dict[str, Any]
    idempotency_key: str
    status: OutboxStatus = OutboxStatus.PENDING
    retry_count: int = 0
    max_retries: int = 5
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    published_at: Optional[datetime] = None
    last_error: Optional[str] = None

    @classmethod
    def signal_created(cls, signal_id: int, payload: dict) -> "OutboxEvent":
        """factory برای event ایجاد سیگنال."""
        payload_hash = hash_payload(payload)
        idem_key = compute_event_idempotency_key(
            "signal.created", signal_id, payload_hash
        )
        return cls(
            event_type="signal.created",
            entity_type="signal",
            entity_id=signal_id,
            payload=dict(payload),
            idempotency_key=idem_key,
        )

    @classmethod
    def signal_closed(cls, signal_id: int, payload: dict) -> "OutboxEvent":
        payload_hash = hash_payload(payload)
        return cls(
            event_type="signal.closed",
            entity_type="signal",
            entity_id=signal_id,
            payload=dict(payload),
            idempotency_key=compute_event_idempotency_key(
                "signal.closed", signal_id, payload_hash
            ),
        )

    def mark_published(self) -> None:
        self.status = OutboxStatus.PUBLISHED
        self.published_at = datetime.now(timezone.utc)
        self.last_error = None

    def mark_failed(self, error: str) -> None:
        self.retry_count += 1
        self.last_error = error[:500]  # truncate
        if self.retry_count >= self.max_retries:
            self.status = OutboxStatus.DEAD
        else:
            self.status = OutboxStatus.FAILED

    def can_retry(self) -> bool:
        return (
            self.status in (OutboxStatus.PENDING, OutboxStatus.FAILED)
            and self.retry_count < self.max_retries
        )

    def to_dict(self) -> dict:
        return {
            "event_type": self.event_type,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "payload": dict(self.payload),
            "idempotency_key": self.idempotency_key,
            "status": self.status.value,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "created_at": self.created_at.isoformat(),
            "published_at": (
                self.published_at.isoformat() if self.published_at else None
            ),
            "last_error": self.last_error,
        }
