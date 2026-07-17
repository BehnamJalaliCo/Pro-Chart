"""Deterministic signal lifecycle state machine."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from src.core.exceptions import InvalidSignalStateError


class SignalState(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    TP1_HIT = "TP1_HIT"
    TP2_HIT = "TP2_HIT"
    TP3_HIT = "TP3_HIT"
    SL_HIT = "SL_HIT"
    CLOSED_MANUAL = "CLOSED_MANUAL"
    CANCELLED = "CANCELLED"


@dataclass(frozen=True)
class StateTransition:
    from_state: SignalState
    to_state: SignalState
    actor: str
    at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    reason: str | None = None


_ALLOWED: dict[SignalState, frozenset[SignalState]] = {
    SignalState.PENDING: frozenset({SignalState.ACTIVE, SignalState.CANCELLED}),
    SignalState.ACTIVE: frozenset({SignalState.TP1_HIT, SignalState.SL_HIT, SignalState.CLOSED_MANUAL}),
    SignalState.TP1_HIT: frozenset({SignalState.TP2_HIT, SignalState.SL_HIT, SignalState.CLOSED_MANUAL}),
    SignalState.TP2_HIT: frozenset({SignalState.TP3_HIT, SignalState.SL_HIT, SignalState.CLOSED_MANUAL}),
    SignalState.TP3_HIT: frozenset(), SignalState.SL_HIT: frozenset(),
    SignalState.CLOSED_MANUAL: frozenset(), SignalState.CANCELLED: frozenset(),
}


@dataclass
class SignalStateMachine:
    current_state: SignalState
    history: list[StateTransition] = field(default_factory=list)

    @classmethod
    def fresh(cls) -> "SignalStateMachine":
        return cls(SignalState.PENDING)

    @classmethod
    def from_state(cls, state: SignalState | str) -> "SignalStateMachine":
        return cls(SignalState(state))

    def transition_to(self, state: SignalState | str, *, actor: str, reason: str | None = None) -> None:
        target = SignalState(state)
        if target not in _ALLOWED[self.current_state]:
            raise InvalidSignalStateError(
                f"انتقال {self.current_state.value} به {target.value} نامعتبر است",
                context={"from_state": self.current_state.value, "to_state": target.value},
            )
        self.history.append(StateTransition(self.current_state, target, actor, reason=reason))
        self.current_state = target

    def is_active(self) -> bool:
        return self.current_state in {SignalState.ACTIVE, SignalState.TP1_HIT, SignalState.TP2_HIT}

    def is_terminal(self) -> bool:
        return not _ALLOWED[self.current_state]

    def to_dict(self) -> dict[str, Any]:
        return {"current_state": self.current_state.value, "is_active": self.is_active(), "is_terminal": self.is_terminal(),
                "history": [{"from_state": t.from_state.value, "to_state": t.to_state.value, "actor": t.actor,
                              "at": t.at.isoformat(), "reason": t.reason} for t in self.history]}
