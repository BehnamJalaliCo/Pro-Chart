"""Regression contract for legacy OneRoyal/MT5 copy-trade routes."""

from __future__ import annotations

import asyncio
import ast
import inspect
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.api.routes import bn_gate, bn_r7, bn_r8


REPO_ROOT = Path(__file__).resolve().parents[2]
ROUTE_FILES = (
    REPO_ROOT / "src/api/routes/bn_gate.py",
    REPO_ROOT / "src/api/routes/bn_r7.py",
    REPO_ROOT / "src/api/routes/bn_r8.py",
)
REFERRAL_PATH = "/go/oneroyal"


def _run(awaitable):
    return asyncio.run(awaitable)


def _assert_referral_only(payload: dict) -> None:
    assert payload["referral_only"] is True
    assert payload["integration_level"] == "referral_only"
    assert payload["referral_path"] == REFERRAL_PATH
    assert payload["connected"] is False
    assert payload["eligible"] is False
    assert payload["enabled"] is False


def _assert_forbidden(awaitable) -> dict:
    with pytest.raises(HTTPException) as raised:
        _run(awaitable)
    assert raised.value.status_code == 403
    detail = raised.value.detail
    _assert_referral_only(detail)
    assert detail["reason"] == "oneroyal_referral_only"
    return detail


class NoIoDb:
    async def execute(self, *_args, **_kwargs):
        raise AssertionError("forex referral boundary must not query the database")

    async def commit(self):
        raise AssertionError("forex referral boundary must not commit")


class UnreadablePayload:
    def get(self, *_args, **_kwargs):
        raise AssertionError("forbidden forex action inspected its request body")

    def items(self):
        raise AssertionError("forbidden forex action iterated its request body")


def test_all_read_only_forex_views_are_static_non_actionable_contracts() -> None:
    student = SimpleNamespace(id=17, forex_signal_until=None, forex_copy_until=None)
    responses = (
        _run(bn_gate.get_forex_settings(student)),
        _run(bn_r7.forex_copy_config(student)),
        _run(bn_r8.copytrade_history("forex", student)),
    )
    for response in responses:
        _assert_referral_only(response)
    assert responses[0]["settings_available"] is False
    assert responses[2]["trades"] == []


def test_forex_signal_analysis_gate_remains_independent_of_broker_integration() -> None:
    now = bn_gate._now()
    trial = SimpleNamespace(forex_signal_until=now.replace(year=now.year + 1))
    expired = SimpleNamespace(
        forex_signal_until=now.replace(year=now.year - 1),
        prochart_until=None,
        tier="free",
        expires_at=None,
    )
    assert bn_gate._forex_gate(trial)["reason"] == "trial"
    assert bn_gate._forex_gate(trial)["allowed"] is True
    assert bn_gate._forex_gate(expired)["reason"] == "trial_expired"
    assert bn_gate._forex_gate(expired)["allowed"] is False


def test_pure_forex_compatibility_handlers_do_not_inject_a_db_session() -> None:
    handlers = (
        bn_gate.get_forex_settings,
        bn_gate.set_forex_settings,
        bn_r7.forex_copy_config,
        bn_r8.copytrade_close_all,
        bn_r8.copytrade_close_one,
        bn_r8.copytrade_history,
    )
    for handler in handlers:
        assert "db" not in inspect.signature(handler).parameters


def test_forex_settings_post_rejects_before_payload_or_state_access() -> None:
    _assert_forbidden(bn_gate.set_forex_settings(UnreadablePayload(), SimpleNamespace(id=17)))


def test_close_actions_reject_before_payload_or_state_access() -> None:
    student = SimpleNamespace(id=17)
    _assert_forbidden(bn_r8.copytrade_close_all(UnreadablePayload(), student))
    _assert_forbidden(bn_r8.copytrade_close_one(123, UnreadablePayload(), student))


@pytest.mark.parametrize("payload", ({}, {"market": "forex", "enabled": True}))
def test_forex_stop_rejects_without_db_or_forex_state_mutation(payload: dict) -> None:
    student = SimpleNamespace(id=17, copy_crypto=True, copy_forex=True)
    _assert_forbidden(bn_r8.copytrade_stop(payload, student, NoIoDb()))
    assert student.copy_crypto is True
    assert student.copy_forex is True


def test_crypto_stop_and_history_paths_are_preserved() -> None:
    class CryptoDb:
        def __init__(self):
            self.commits = 0

        async def execute(self, *_args, **_kwargs):
            raise AssertionError("crypto stop should not query")

        async def commit(self):
            self.commits += 1

    student = SimpleNamespace(copy_crypto=True, copy_forex=True)
    db = CryptoDb()
    assert _run(bn_r8.copytrade_stop({"market": "crypto"}, student, db)) == {"ok": True}
    assert student.copy_crypto is False
    assert student.copy_forex is True
    assert db.commits == 1
    assert _run(bn_r8.copytrade_history("crypto", student)) == {
        "win_rate": 0,
        "net_pnl": 0.0,
        "closed_count": 0,
        "curve": [],
        "trades": [],
    }


def test_crypto_settings_path_still_clamps_persists_and_returns_data() -> None:
    class EmptyResult:
        def first(self):
            return None

    class CryptoSettingsDb:
        def __init__(self):
            self.executes = 0
            self.commits = 0

        async def execute(self, *_args, **_kwargs):
            self.executes += 1
            return EmptyResult()

        async def commit(self):
            self.commits += 1

    db = CryptoSettingsDb()
    result = _run(bn_gate.set_crypto_settings(
        {"enabled": True, "leverage_value": 999, "margin_mode": "CROSS"},
        SimpleNamespace(id=17),
        db,
    ))
    assert result["ok"] is True
    assert result["enabled"] is True
    assert result["leverage_value"] == 125
    assert result["margin_mode"] == "ISOLATED"
    assert db.executes == 2
    assert db.commits == 1


def test_scoped_sources_contain_no_forex_service_or_settings_backend() -> None:
    forbidden = (
        "BN_FOREX_SVC_URL",
        "/user/copy-svc",
        "bn_forex_copy_settings",
        'kind == "mt5"',
    )
    for path in ROUTE_FILES:
        source = path.read_text(encoding="utf-8")
        ast.parse(source, filename=str(path))
        for marker in forbidden:
            assert marker not in source, f"{path.name} retains forbidden marker {marker}"


def test_fail_closed_handlers_have_no_io_or_body_access_before_rejection() -> None:
    expected_first_call = {
        "set_forex_settings": "_reject_forex_copy_action",
        "copytrade_close_all": "_reject_forex_action",
        "copytrade_close_one": "_reject_forex_action",
    }
    functions = {}
    for path in ROUTE_FILES:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        functions.update({node.name: node for node in tree.body if isinstance(node, ast.AsyncFunctionDef)})

    for name, rejector in expected_first_call.items():
        node = functions[name]
        body = node.body[1:] if (node.body and isinstance(node.body[0], ast.Expr)
                                 and isinstance(node.body[0].value, ast.Constant)
                                 and isinstance(node.body[0].value.value, str)) else node.body
        assert len(body) == 1
        assert isinstance(body[0], ast.Expr)
        assert isinstance(body[0].value, ast.Call)
        assert isinstance(body[0].value.func, ast.Name)
        assert body[0].value.func.id == rejector
