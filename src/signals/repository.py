"""Small in-memory repository useful for deterministic tests and local workflows."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Iterable

@dataclass
class SignalQueryFilter:
    symbol: str | None = None
    direction: str | None = None
    state: str | None = None
    limit: int = 100

@dataclass
class InMemorySignalRepository:
    _items: dict[int, dict[str, Any]] = field(default_factory=dict)
    _next_id: int = 1
    def create(self, signal: dict[str, Any]) -> dict[str, Any]:
        item = dict(signal); item.setdefault("id", self._next_id); self._next_id = max(self._next_id, int(item["id"]) + 1)
        self._items[int(item["id"])] = item; return dict(item)
    def get(self, signal_id: int) -> dict[str, Any] | None:
        item = self._items.get(int(signal_id)); return dict(item) if item else None
    def update(self, signal_id: int, values: dict[str, Any]) -> dict[str, Any] | None:
        if int(signal_id) not in self._items: return None
        self._items[int(signal_id)].update(values); return self.get(signal_id)
    def delete(self, signal_id: int) -> bool: return self._items.pop(int(signal_id), None) is not None
    def list(self, query: SignalQueryFilter | None = None) -> list[dict[str, Any]]:
        query = query or SignalQueryFilter(); values = self._items.values()
        if query.symbol is not None: values = (x for x in values if x.get("symbol") == query.symbol)
        if query.direction is not None: values = (x for x in values if x.get("direction") == query.direction)
        if query.state is not None: values = (x for x in values if x.get("state") == query.state)
        return [dict(x) for x in list(values)[:query.limit]]
