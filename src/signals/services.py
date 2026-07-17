"""Application-level validation for signal lifecycle operations."""
from __future__ import annotations
from typing import Any
from src.core.exceptions import SignalCreationError
from src.signals.state_machine import SignalState

class SignalLifecycleService:
    @staticmethod
    def validate_for_creation(payload: dict[str, Any]) -> None:
        required = ("symbol", "direction", "entry_price", "sl", "tp1", "signal_score")
        missing = [f for f in required if f not in payload]
        if missing:
            raise SignalCreationError(f"فیلدهای مفقود: {', '.join(missing)}")
        direction = payload["direction"]
        entry, sl, tp1 = float(payload["entry_price"]), float(payload["sl"]), float(payload["tp1"])
        if direction == "long" and sl >= entry:
            raise SignalCreationError("SL برای long باید پایین‌تر از entry باشد")
        if direction == "short" and sl <= entry:
            raise SignalCreationError("SL برای short باید بالاتر از entry باشد")
        reward, risk = abs(tp1 - entry), abs(entry - sl)
        if direction == "short" and tp1 >= entry:
            raise SignalCreationError("TP1 برای short باید پایین‌تر از entry باشد")
        if direction == "long" and tp1 <= entry:
            raise SignalCreationError("TP1 برای long باید بالاتر از entry باشد")
        if risk <= 0 or reward / risk < 1.0:
            raise SignalCreationError("R/R باید حداقل 1 باشد")
    @staticmethod
    def state_for_target_hit(target: str) -> SignalState:
        mapping = {"tp1": SignalState.TP1_HIT, "tp2": SignalState.TP2_HIT, "tp3": SignalState.TP3_HIT,
                   "sl": SignalState.SL_HIT, "manual": SignalState.CLOSED_MANUAL}
        if target not in mapping: raise ValueError(f"هدف نامعتبر: {target}")
        return mapping[target]
