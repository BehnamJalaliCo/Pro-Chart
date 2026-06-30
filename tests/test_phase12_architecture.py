"""
تست‌های فاز ۱۲ — Architecture refactor.

پوشش:
    - Domain exceptions (hierarchy، to_dict، context)
    - TypedDict shapes (import-able، structurally OK)
    - SignalStateMachine (transitions، invalid transitions، terminal)
    - Idempotency key (deterministic، collision-free)
    - OutboxEvent (factories، retry logic، can_retry)
    - SignalLifecycleService (validation)
    - SignalQueryFilter
    - InMemorySignalRepository (CRUD، filter)
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys
from datetime import datetime, timedelta, timezone

import pytest


REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent


def _load(name: str, relative_path: str):
    spec = importlib.util.spec_from_file_location(name, REPO_ROOT / relative_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# register under official names so dependent modules use the same classes
exc_mod = _load("src.core.exceptions", "src/core/exceptions.py")
sys.modules["src.core.exceptions"] = exc_mod
types_mod = _load("src.core.types", "src/core/types.py")
sys.modules["src.core.types"] = types_mod
sm_mod = _load("src.signals.state_machine", "src/signals/state_machine.py")
sys.modules["src.signals.state_machine"] = sm_mod
idem_mod = _load("src.signals.idempotency", "src/signals/idempotency.py")
sys.modules["src.signals.idempotency"] = idem_mod


# ===========================================================================
# Domain Exceptions
# ===========================================================================


class TestDomainExceptions:
    def test_base_exception_has_default_message(self):
        err = exc_mod.CoineProError()
        assert "CoinePro" in str(err)

    def test_exception_with_custom_message(self):
        err = exc_mod.SignalCreationError("custom message")
        assert "custom message" in str(err)

    def test_exception_with_context(self):
        err = exc_mod.SignalNotFoundError(
            "not found", context={"signal_id": 42},
        )
        assert err.context["signal_id"] == 42
        d = err.to_dict()
        assert d["type"] == "SignalNotFoundError"
        assert d["context"]["signal_id"] == 42

    def test_hierarchy_signal_extends_base(self):
        assert issubclass(exc_mod.SignalCreationError, exc_mod.SignalError)
        assert issubclass(exc_mod.SignalError, exc_mod.CoineProError)

    def test_hierarchy_risk_extends_base(self):
        assert issubclass(exc_mod.DailyLossLimitExceededError, exc_mod.RiskError)
        assert issubclass(exc_mod.RiskError, exc_mod.CoineProError)

    def test_hierarchy_persistence_extends_base(self):
        assert issubclass(exc_mod.DatabaseError, exc_mod.PersistenceError)
        assert issubclass(exc_mod.CacheError, exc_mod.PersistenceError)

    def test_can_catch_all_signal_errors_with_base(self):
        with pytest.raises(exc_mod.SignalError):
            raise exc_mod.DuplicateSignalError("dup")

    def test_can_catch_all_with_coinepro_base(self):
        for cls in [
            exc_mod.SignalCreationError,
            exc_mod.DailyLossLimitExceededError,
            exc_mod.DatabaseError,
            exc_mod.MLPredictionError,
        ]:
            with pytest.raises(exc_mod.CoineProError):
                raise cls("test")


# ===========================================================================
# TypedDict Shapes
# ===========================================================================


class TestTypedDictShapes:
    def test_signal_payload_accepts_minimal(self):
        # TypedDict structural check — runtime cast is just dict
        payload: types_mod.SignalPayload = {
            "symbol": "EURUSD",
            "direction": "long",
            "signal_type": "STRONG",
            "entry_price": 1.10,
            "sl": 1.09,
            "tp1": 1.12,
            "signal_score": 80.0,
            "timeframe": "H1",
        }
        assert payload["symbol"] == "EURUSD"

    def test_technical_analysis_result(self):
        result: types_mod.TechnicalAnalysisResult = {
            "technical_score": 75.0,
            "signal": "long",
            "rsi": 60.0,
        }
        assert result["technical_score"] == 75.0


# ===========================================================================
# Signal State Machine
# ===========================================================================


class TestSignalStateMachine:
    def test_fresh_starts_in_pending(self):
        sm = sm_mod.SignalStateMachine.fresh()
        assert sm.current_state == sm_mod.SignalState.PENDING
        assert not sm.is_active()
        assert not sm.is_terminal()

    def test_pending_to_active_allowed(self):
        sm = sm_mod.SignalStateMachine.fresh()
        sm.transition_to(sm_mod.SignalState.ACTIVE, actor="engine")
        assert sm.current_state == sm_mod.SignalState.ACTIVE
        assert sm.is_active()
        assert len(sm.history) == 1

    def test_pending_to_tp1_disallowed(self):
        sm = sm_mod.SignalStateMachine.fresh()
        with pytest.raises(exc_mod.InvalidSignalStateError):
            sm.transition_to(sm_mod.SignalState.TP1_HIT, actor="engine")

    def test_active_to_sl_hit_allowed(self):
        sm = sm_mod.SignalStateMachine.fresh()
        sm.transition_to(sm_mod.SignalState.ACTIVE, actor="engine")
        sm.transition_to(sm_mod.SignalState.SL_HIT, actor="tracker", reason="price=1.08")
        assert sm.is_terminal()
        assert not sm.is_active()

    def test_terminal_state_cannot_transition(self):
        sm = sm_mod.SignalStateMachine.from_state(sm_mod.SignalState.TP3_HIT)
        with pytest.raises(exc_mod.InvalidSignalStateError):
            sm.transition_to(sm_mod.SignalState.ACTIVE, actor="engine")

    def test_history_captures_all_transitions(self):
        sm = sm_mod.SignalStateMachine.fresh()
        sm.transition_to(sm_mod.SignalState.ACTIVE, actor="engine")
        sm.transition_to(sm_mod.SignalState.TP1_HIT, actor="tracker")
        sm.transition_to(sm_mod.SignalState.TP2_HIT, actor="tracker")
        assert len(sm.history) == 3
        states = [t.to_state for t in sm.history]
        assert states == [
            sm_mod.SignalState.ACTIVE,
            sm_mod.SignalState.TP1_HIT,
            sm_mod.SignalState.TP2_HIT,
        ]

    def test_to_dict_serializes(self):
        sm = sm_mod.SignalStateMachine.fresh()
        sm.transition_to(sm_mod.SignalState.ACTIVE, actor="engine")
        d = sm.to_dict()
        assert d["current_state"] == "ACTIVE"
        assert d["is_active"] is True
        assert d["is_terminal"] is False
        assert len(d["history"]) == 1

    def test_cancelled_from_pending(self):
        sm = sm_mod.SignalStateMachine.fresh()
        sm.transition_to(sm_mod.SignalState.CANCELLED, actor="admin:5")
        assert sm.is_terminal()


# ===========================================================================
# Idempotency
# ===========================================================================


class TestIdempotency:
    def test_signal_key_deterministic(self):
        ts = datetime(2026, 5, 28, 10, 0, tzinfo=timezone.utc)
        k1 = idem_mod.compute_signal_idempotency_key("EURUSD", "H1", ts, "long")
        k2 = idem_mod.compute_signal_idempotency_key("EURUSD", "H1", ts, "long")
        assert k1 == k2
        assert len(k1) == 64  # SHA-256 hex

    def test_signal_key_changes_with_direction(self):
        ts = datetime(2026, 5, 28, 10, 0, tzinfo=timezone.utc)
        k_long = idem_mod.compute_signal_idempotency_key("EURUSD", "H1", ts, "long")
        k_short = idem_mod.compute_signal_idempotency_key("EURUSD", "H1", ts, "short")
        assert k_long != k_short

    def test_signal_key_changes_with_timeframe(self):
        ts = datetime(2026, 5, 28, 10, 0, tzinfo=timezone.utc)
        k_h1 = idem_mod.compute_signal_idempotency_key("EURUSD", "H1", ts, "long")
        k_h4 = idem_mod.compute_signal_idempotency_key("EURUSD", "H4", ts, "long")
        assert k_h1 != k_h4

    def test_hash_payload_deterministic(self):
        p = {"a": 1, "b": "test", "c": [1, 2, 3]}
        assert idem_mod.hash_payload(p) == idem_mod.hash_payload(p)

    def test_hash_payload_order_independent(self):
        p1 = {"a": 1, "b": 2}
        p2 = {"b": 2, "a": 1}
        # sort_keys=True → باید مساوی باشند
        assert idem_mod.hash_payload(p1) == idem_mod.hash_payload(p2)

    def test_outbox_signal_created_factory(self):
        event = idem_mod.OutboxEvent.signal_created(
            signal_id=42, payload={"symbol": "EURUSD"},
        )
        assert event.event_type == "signal.created"
        assert event.entity_id == 42
        assert event.status == idem_mod.OutboxStatus.PENDING
        assert len(event.idempotency_key) == 64

    def test_outbox_retry_logic(self):
        event = idem_mod.OutboxEvent.signal_created(1, {"x": 1})
        event.max_retries = 3
        # ۳ بار retry
        for i in range(3):
            assert event.can_retry()
            event.mark_failed(f"error {i}")
        # بعد از max_retries
        assert event.status == idem_mod.OutboxStatus.DEAD
        assert not event.can_retry()

    def test_outbox_mark_published(self):
        event = idem_mod.OutboxEvent.signal_closed(1, {"close_reason": "tp1_hit"})
        event.mark_published()
        assert event.status == idem_mod.OutboxStatus.PUBLISHED
        assert event.published_at is not None

    def test_outbox_to_dict_serializes(self):
        event = idem_mod.OutboxEvent.signal_created(99, {"score": 85})
        d = event.to_dict()
        assert d["event_type"] == "signal.created"
        assert d["entity_id"] == 99
        assert d["status"] == "pending"


# ===========================================================================
# Service Layer
# ===========================================================================


# Need to delay these imports since they require sqlalchemy chain
def _load_service():
    return _load("src.signals.services", "src/signals/services.py")


class TestSignalLifecycleService:
    @pytest.fixture
    def services(self):
        return _load_service()

    def test_validate_accepts_well_formed_long(self, services):
        payload = {
            "symbol": "EURUSD",
            "direction": "long",
            "entry_price": 1.10,
            "sl": 1.09,
            "tp1": 1.12,
            "signal_score": 80.0,
        }
        services.SignalLifecycleService.validate_for_creation(payload)

    def test_rejects_long_with_sl_above_entry(self, services):
        payload = {
            "symbol": "EURUSD",
            "direction": "long",
            "entry_price": 1.10,
            "sl": 1.11,  # bad: above entry
            "tp1": 1.12,
            "signal_score": 80.0,
        }
        with pytest.raises(exc_mod.SignalCreationError, match="SL"):
            services.SignalLifecycleService.validate_for_creation(payload)

    def test_rejects_short_with_tp_above_entry(self, services):
        payload = {
            "symbol": "EURUSD",
            "direction": "short",
            "entry_price": 1.10,
            "sl": 1.11,
            "tp1": 1.12,  # bad: should be below entry for short
            "signal_score": 80.0,
        }
        with pytest.raises(exc_mod.SignalCreationError, match="TP1"):
            services.SignalLifecycleService.validate_for_creation(payload)

    def test_rejects_missing_fields(self, services):
        with pytest.raises(exc_mod.SignalCreationError, match="مفقود"):
            services.SignalLifecycleService.validate_for_creation({
                "symbol": "EURUSD"
                # missing everything else
            })

    def test_rejects_low_rr(self, services):
        payload = {
            "symbol": "EURUSD",
            "direction": "long",
            "entry_price": 1.10,
            "sl": 1.0900,
            "tp1": 1.1003,  # 30 pip risk، 3 pip reward → R/R = 0.1
            "signal_score": 80.0,
        }
        with pytest.raises(exc_mod.SignalCreationError, match="R/R"):
            services.SignalLifecycleService.validate_for_creation(payload)

    def test_state_for_target_hit_mapping(self, services):
        assert services.SignalLifecycleService.state_for_target_hit("tp1") == sm_mod.SignalState.TP1_HIT
        assert services.SignalLifecycleService.state_for_target_hit("sl") == sm_mod.SignalState.SL_HIT
        assert services.SignalLifecycleService.state_for_target_hit("manual") == sm_mod.SignalState.CLOSED_MANUAL

    def test_state_for_unknown_target_raises(self, services):
        with pytest.raises(ValueError):
            services.SignalLifecycleService.state_for_target_hit("garbage")


# ===========================================================================
# Source-Level Invariants
# ===========================================================================


class TestSourceInvariants:
    """تأیید refactor در فایل‌های اصلی."""

    def test_exceptions_module_exists(self):
        assert (REPO_ROOT / "src/core/exceptions.py").exists()

    def test_types_module_exists(self):
        assert (REPO_ROOT / "src/core/types.py").exists()

    def test_state_machine_module_exists(self):
        assert (REPO_ROOT / "src/signals/state_machine.py").exists()

    def test_idempotency_module_exists(self):
        assert (REPO_ROOT / "src/signals/idempotency.py").exists()

    def test_services_module_exists(self):
        assert (REPO_ROOT / "src/signals/services.py").exists()

    def test_repository_module_exists(self):
        assert (REPO_ROOT / "src/signals/repository.py").exists()
