"""
Repository pattern برای Signal — abstract DB layer.

منطق:
    Route handlers و services نباید مستقیماً با SQLAlchemy queries کار کنند.
    Repository یک interface تمیز ارائه می‌دهد:
        - get_by_id, save, delete
        - list_by_filter, count_by_filter
        - find_by_idempotency_key

    مزیت‌ها:
        - testability: می‌توان InMemorySignalRepository ساخت برای test
        - swap-ability: روزی DynamoDB بخواهیم، فقط repo را عوض کنیم
        - business logic در service ها متمرکز
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Protocol, runtime_checkable

from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import Signal
from src.core.exceptions import DatabaseError
from src.core.logger import get_logger
from src.signals.services import SignalQueryFilter

logger = get_logger(__name__)


@runtime_checkable
class SignalRepositoryProtocol(Protocol):
    """contract یک signal repository — برای DI و testability."""

    async def get_by_id(self, signal_id: int) -> Optional[Signal]: ...
    async def save(self, signal: Signal) -> Signal: ...
    async def delete(self, signal_id: int) -> bool: ...
    async def list_by_filter(
        self,
        filter: SignalQueryFilter,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Signal]: ...
    async def count_by_filter(self, filter: SignalQueryFilter) -> int: ...
    async def find_by_idempotency_key(self, key: str) -> Optional[Signal]: ...


class SqlAlchemySignalRepository:
    """
    Repository روی SQLAlchemy async session.

    Caller مسئول session lifecycle است (commit/rollback).
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, signal_id: int) -> Optional[Signal]:
        try:
            return await self.session.get(Signal, signal_id)
        except Exception as exc:
            raise DatabaseError(
                f"خطا در get_by_id signal {signal_id}",
                context={"signal_id": signal_id, "error": str(exc)},
            ) from exc

    async def save(self, signal: Signal) -> Signal:
        try:
            self.session.add(signal)
            await self.session.flush()
            return signal
        except Exception as exc:
            raise DatabaseError(
                f"خطا در save signal",
                context={"signal_id": signal.id, "error": str(exc)},
            ) from exc

    async def delete(self, signal_id: int) -> bool:
        try:
            signal = await self.get_by_id(signal_id)
            if signal is None:
                return False
            await self.session.delete(signal)
            await self.session.flush()
            return True
        except Exception as exc:
            raise DatabaseError(
                f"خطا در delete signal {signal_id}",
                context={"signal_id": signal_id, "error": str(exc)},
            ) from exc

    async def list_by_filter(
        self,
        filter: SignalQueryFilter,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Signal]:
        try:
            stmt = select(Signal).where(and_(*filter.to_sql_conditions(Signal))) \
                .order_by(desc(Signal.created_at)) \
                .limit(limit) \
                .offset(offset)
            result = await self.session.execute(stmt)
            return list(result.scalars().all())
        except Exception as exc:
            raise DatabaseError(
                "خطا در list_by_filter",
                context={"error": str(exc)},
            ) from exc

    async def count_by_filter(self, filter: SignalQueryFilter) -> int:
        try:
            stmt = select(func.count(Signal.id)).where(
                and_(*filter.to_sql_conditions(Signal))
            )
            result = await self.session.execute(stmt)
            return int(result.scalar() or 0)
        except Exception as exc:
            raise DatabaseError(
                "خطا در count_by_filter",
                context={"error": str(exc)},
            ) from exc

    async def find_by_idempotency_key(self, key: str) -> Optional[Signal]:
        """
        یافتن signal بر اساس idempotency key.

        نکته: نیاز به ستون `idempotency_key` در جدول signals دارد
        (به migration بعدی اضافه می‌شود). فعلاً از mtf_confirmation
        به‌عنوان catch-all استفاده می‌کنیم.
        """
        try:
            # TODO: migration برای ستون اختصاصی idempotency_key
            # فعلاً در analysis_details JSONB ذخیره می‌شود
            stmt = select(Signal).where(
                Signal.analysis_details["idempotency_key"].astext == key
            ).limit(1)
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except Exception:
            # ستون JSONB ممکن است key نداشته باشد
            return None


# ── In-Memory Repository — برای test ────────────────────


class InMemorySignalRepository:
    """
    Repository in-memory — برای unit test ها بدون DB.

    این اجازه می‌دهد services را در isolation تست کنیم.
    """

    def __init__(self) -> None:
        self._store: dict[int, Signal] = {}
        self._by_idempotency: dict[str, int] = {}
        self._next_id: int = 1

    async def get_by_id(self, signal_id: int) -> Optional[Signal]:
        return self._store.get(signal_id)

    async def save(self, signal: Signal) -> Signal:
        if signal.id is None:
            signal.id = self._next_id
            self._next_id += 1
        self._store[signal.id] = signal
        # ساده‌سازی: idempotency key از analysis_details
        details = getattr(signal, "analysis_details", None) or {}
        if isinstance(details, dict):
            key = details.get("idempotency_key")
            if key:
                self._by_idempotency[key] = signal.id
        return signal

    async def delete(self, signal_id: int) -> bool:
        if signal_id not in self._store:
            return False
        del self._store[signal_id]
        return True

    async def list_by_filter(
        self,
        filter: SignalQueryFilter,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Signal]:
        results: list[Signal] = []
        for s in self._store.values():
            if filter.symbol and s.symbol != filter.symbol:
                continue
            if filter.direction and s.direction != filter.direction:
                continue
            if filter.status_in and s.status not in filter.status_in:
                continue
            if filter.min_score is not None and (s.signal_score or 0) < filter.min_score:
                continue
            if filter.created_after and s.created_at < filter.created_after:
                continue
            if filter.created_before and s.created_at > filter.created_before:
                continue
            results.append(s)
        # sort
        results.sort(
            key=lambda s: s.created_at or datetime.min,
            reverse=True,
        )
        return results[offset:offset + limit]

    async def count_by_filter(self, filter: SignalQueryFilter) -> int:
        count = 0
        for s in self._store.values():
            if filter.symbol and s.symbol != filter.symbol:
                continue
            if filter.direction and s.direction != filter.direction:
                continue
            if filter.status_in and s.status not in filter.status_in:
                continue
            if filter.min_score is not None and (s.signal_score or 0) < filter.min_score:
                continue
            if filter.created_after and s.created_at < filter.created_after:
                continue
            if filter.created_before and s.created_at > filter.created_before:
                continue
            count += 1
        return count

    async def find_by_idempotency_key(self, key: str) -> Optional[Signal]:
        signal_id = self._by_idempotency.get(key)
        return self._store.get(signal_id) if signal_id else None
