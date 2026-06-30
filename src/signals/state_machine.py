"""
Signal State Machine — مرکزی کردن state transitions.

منطق:
    قبلاً signal.status در سه فایل مختلف update می‌شد:
        - engine.py (create → ACTIVE)
        - tracker.py (TP/SL hit → CLOSED)
        - api/routes/signals.py (manual close)

    هر یک منطق خود را داشت → drift و bug. این State Machine:
        - state ها و transitions ها را به‌صراحت تعریف می‌کند
        - هر transition validation دارد
        - audit trail برای هر تغییر
        - safer از hand-written checks
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from src.core.exceptions import InvalidSignalStateError


class SignalState(str, Enum):
    """state های ممکن یک سیگنال."""

    PENDING = "PENDING"          # ساخته شده ولی هنوز publish نشده
    ACTIVE = "ACTIVE"            # publish شده، در انتظار TP/SL
    TP1_HIT = "TP1_HIT"          # TP1 برخورد، trailing فعال
    TP2_HIT = "TP2_HIT"          # TP2 برخورد، SL در TP1
    TP3_HIT = "TP3_HIT"          # نهایی
    SL_HIT = "SL_HIT"            # SL برخورد، closed
    TRAILING_HIT = "TRAILING_HIT"  # trailing stop hit
    CLOSED_MANUAL = "CLOSED_MANUAL"  # manual close توسط ادمین
    EXPIRED = "EXPIRED"          # timeout
    CANCELLED = "CANCELLED"      # قبل از ACTIVE شدن لغو


# ── transitions مجاز ──────────────────────────────────────
_ALLOWED_TRANSITIONS: dict[SignalState, set[SignalState]] = {
    SignalState.PENDING: {
        SignalState.ACTIVE,
        SignalState.CANCELLED,
    },
    SignalState.ACTIVE: {
        SignalState.TP1_HIT,
        SignalState.TP2_HIT,  # gap tick ممکن است TP1 را رد کند و مستقیم TP2 بزند
        SignalState.SL_HIT,
        SignalState.CLOSED_MANUAL,
        SignalState.EXPIRED,
    },
    SignalState.TP1_HIT: {
        SignalState.TP2_HIT,
        SignalState.TRAILING_HIT,
        SignalState.SL_HIT,
        SignalState.CLOSED_MANUAL,
        SignalState.EXPIRED,
    },
    SignalState.TP2_HIT: {
        SignalState.TP3_HIT,
        SignalState.TRAILING_HIT,
        SignalState.SL_HIT,
        SignalState.CLOSED_MANUAL,
        SignalState.EXPIRED,
    },
    # terminal states — هیچ transition
    SignalState.TP3_HIT: set(),
    SignalState.SL_HIT: set(),
    SignalState.TRAILING_HIT: set(),
    SignalState.CLOSED_MANUAL: set(),
    SignalState.EXPIRED: set(),
    SignalState.CANCELLED: set(),
}

# states که "بسته" حساب می‌شوند
_TERMINAL_STATES: set[SignalState] = {
    SignalState.TP3_HIT,
    SignalState.SL_HIT,
    SignalState.TRAILING_HIT,
    SignalState.CLOSED_MANUAL,
    SignalState.EXPIRED,
    SignalState.CANCELLED,
}


@dataclass
class StateTransition:
    """یک transition state برای audit trail."""

    from_state: SignalState
    to_state: SignalState
    timestamp: datetime
    actor: str  # "engine" | "tracker" | "admin:user_id" | "timeout"
    reason: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "from": self.from_state.value,
            "to": self.to_state.value,
            "at": self.timestamp.isoformat(),
            "actor": self.actor,
            "reason": self.reason,
            "metadata": dict(self.metadata),
        }


@dataclass
class SignalStateMachine:
    """state machine برای یک سیگنال.

    استفاده:
        sm = SignalStateMachine.fresh()
        sm.transition_to(SignalState.ACTIVE, actor="engine")
        sm.transition_to(SignalState.TP1_HIT, actor="tracker", reason="price=1.1020")
    """

    current_state: SignalState
    history: list[StateTransition] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def fresh(cls) -> "SignalStateMachine":
        """state machine جدید در state PENDING."""
        return cls(current_state=SignalState.PENDING)

    @classmethod
    def from_state(cls, state: SignalState) -> "SignalStateMachine":
        """recovery از state — برای بارگذاری از DB."""
        return cls(current_state=state)

    def is_terminal(self) -> bool:
        """آیا signal بسته شده؟"""
        return self.current_state in _TERMINAL_STATES

    def is_active(self) -> bool:
        """آیا signal باز است (هنوز SL/TP3 hit نشده)؟"""
        return not self.is_terminal() and self.current_state != SignalState.PENDING

    def can_transition_to(self, new_state: SignalState) -> bool:
        return new_state in _ALLOWED_TRANSITIONS.get(self.current_state, set())

    def transition_to(
        self,
        new_state: SignalState,
        actor: str,
        reason: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> StateTransition:
        """
        انتقال به state جدید.

        خطا: InvalidSignalStateError اگر transition مجاز نباشد.
        """
        if not self.can_transition_to(new_state):
            raise InvalidSignalStateError(
                f"transition غیرمجاز: {self.current_state.value} → {new_state.value}",
                context={
                    "from": self.current_state.value,
                    "to": new_state.value,
                    "allowed": [
                        s.value for s in _ALLOWED_TRANSITIONS.get(
                            self.current_state, set()
                        )
                    ],
                },
            )

        transition = StateTransition(
            from_state=self.current_state,
            to_state=new_state,
            timestamp=datetime.now(timezone.utc),
            actor=actor,
            reason=reason,
            metadata=metadata or {},
        )
        self.history.append(transition)
        self.current_state = new_state
        return transition

    def to_dict(self) -> dict:
        return {
            "current_state": self.current_state.value,
            "is_terminal": self.is_terminal(),
            "is_active": self.is_active(),
            "created_at": self.created_at.isoformat(),
            "history": [t.to_dict() for t in self.history],
        }
