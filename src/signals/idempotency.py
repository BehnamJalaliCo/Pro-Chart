"""Stable idempotency and durable outbox value objects."""
from __future__ import annotations
import hashlib, json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

def hash_payload(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode()).hexdigest()

def compute_signal_idempotency_key(symbol: str, timeframe: str, timestamp: datetime, direction: str) -> str:
    return hash_payload({"symbol": symbol, "timeframe": timeframe, "timestamp": timestamp.astimezone(timezone.utc).isoformat(), "direction": direction})

class OutboxStatus(str, Enum):
    PENDING = "pending"
    PUBLISHED = "published"
    FAILED = "failed"
    DEAD = "dead"

@dataclass
class OutboxEvent:
    entity_id: int
    payload: dict[str, Any]
    event_type: str
    idempotency_key: str
    status: OutboxStatus = OutboxStatus.PENDING
    retry_count: int = 0
    max_retries: int = 3
    last_error: str | None = None
    published_at: datetime | None = None

    @classmethod
    def signal_created(cls, signal_id: int, payload: dict[str, Any]) -> "OutboxEvent":
        return cls(signal_id, payload, "signal.created", hash_payload({"event": "signal.created", "id": signal_id, "payload": payload}))
    @classmethod
    def signal_closed(cls, signal_id: int, payload: dict[str, Any]) -> "OutboxEvent":
        return cls(signal_id, payload, "signal.closed", hash_payload({"event": "signal.closed", "id": signal_id, "payload": payload}))
    def can_retry(self) -> bool:
        return self.status != OutboxStatus.PUBLISHED and self.retry_count < self.max_retries
    def mark_failed(self, error: str) -> None:
        self.retry_count += 1; self.last_error = error
        self.status = OutboxStatus.FAILED if self.retry_count < self.max_retries else OutboxStatus.DEAD
    def mark_published(self) -> None:
        self.status = OutboxStatus.PUBLISHED; self.published_at = datetime.now(timezone.utc)
    def to_dict(self) -> dict[str, Any]:
        return {"entity_id": self.entity_id, "payload": self.payload, "event_type": self.event_type, "idempotency_key": self.idempotency_key,
                "status": self.status.value, "retry_count": self.retry_count, "last_error": self.last_error,
                "published_at": self.published_at.isoformat() if self.published_at else None}
