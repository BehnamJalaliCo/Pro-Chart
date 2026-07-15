"""Global fail-closed contract for the OneRoyal referral-only boundary.

The public referral redirect is the only allowed OneRoyal product integration.
Legacy MT5/copy surfaces must be static, redacted, and incapable of touching
request bodies, credentials, databases, Redis, or execution adapters.
"""

from __future__ import annotations

import asyncio
import inspect
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.api.routes import bn_gate, bn_r7, bn_r8, ea, panel, user_panel
from src.bot import keyboards, texts
from src.core.config import settings


REPO_ROOT = Path(__file__).resolve().parents[2]
REFERRAL_PATH = "/go/oneroyal"


class NoIo:
    """Raises on every attempted DB/Redis-like interaction."""

    def __getattr__(self, name):
        raise AssertionError(f"referral-only boundary attempted I/O: {name}")


class UnreadablePayload:
    def __getattr__(self, name):
        raise AssertionError(f"referral-only boundary inspected payload field: {name}")

    def get(self, *_args, **_kwargs):
        raise AssertionError("referral-only boundary inspected payload mapping")

    def items(self):
        raise AssertionError("referral-only boundary iterated payload mapping")


def run(awaitable):
    return asyncio.run(awaitable)


def assert_state(payload: dict) -> None:
    assert payload["referral_only"] is True
    assert payload["integration_level"] == "referral_only"
    assert payload["referral_path"] == REFERRAL_PATH
    assert payload["enabled"] is False
    assert payload["connected"] is False
    assert payload["eligible"] is False


def assert_gone(awaitable) -> dict:
    with pytest.raises(HTTPException) as raised:
        run(awaitable)
    assert raised.value.status_code == 410
    detail = raised.value.detail
    assert_state(detail)
    assert detail["reason"] == "oneroyal_referral_only"
    return detail


def test_copy_live_flag_is_hard_locked_off_even_when_legacy_env_requests_true() -> None:
    from src.core.config import Settings

    assert settings.COPY_LIVE_ENABLED is False
    assert Settings(COPY_LIVE_ENABLED=True).COPY_LIVE_ENABLED is False


def test_user_account_and_copy_routes_are_bodyless_static_or_gone_pre_io() -> None:
    user = SimpleNamespace(id=17, telegram_id=1700)

    assert list(inspect.signature(user_panel.link_account).parameters) == ["user"]
    assert list(inspect.signature(user_panel.unlink_account).parameters) == ["user"]
    assert list(inspect.signature(user_panel.get_copy_config).parameters) == ["user"]
    assert list(inspect.signature(user_panel.set_copy_config).parameters) == ["user"]
    assert list(inspect.signature(user_panel.copy_status).parameters) == ["user"]
    assert list(inspect.signature(user_panel.copy_emergency_stop).parameters) == ["user"]
    assert list(inspect.signature(user_panel.copy_close_all).parameters) == ["user"]

    assert_gone(user_panel.link_account(user))
    assert_gone(user_panel.unlink_account(user))
    assert_state(run(user_panel.get_copy_config(user)))
    assert_gone(user_panel.set_copy_config(user))
    assert_state(run(user_panel.copy_status(user)))
    assert_gone(user_panel.copy_emergency_stop(user))
    assert_gone(user_panel.copy_close_all(user))


def test_user_profile_ai_and_history_do_not_read_or_describe_legacy_execution() -> None:
    profile_source = inspect.getsource(user_panel._profile_dict)
    ai_source = inspect.getsource(user_panel._ai_account_block)
    module_source = Path(user_panel.__file__).read_text(encoding="utf-8")
    assert "TradingAccount" not in profile_source
    assert "ea:status:user" not in ai_source
    assert run(user_panel._ai_account_block(SimpleNamespace(id=17), NoIo())) is None
    assert "from src.api.routes.trade_history import" not in module_source
    assert "password_enc" not in module_source
    assert "encrypt_secret" not in module_source

    history = run(user_panel.trade_history(SimpleNamespace(id=17)))
    assert_state(history)
    assert history["items"] == []
    assert run(user_panel.my_trade_history(user=SimpleNamespace(id=17)))["items"] == []
    assert run(user_panel.my_trade_stats(user=SimpleNamespace(id=17)))["trades"] == 0
    assert run(user_panel.my_trade_daily(user=SimpleNamespace(id=17)))["items"] == []

    prompt = user_panel.PANEL_AI_SYSTEM
    assert "اتصال حساب و معامله مستقیم OneRoyal در Pro Chart فعال نیست" in prompt
    for forbidden in ("سرورِ کپی", "خودکار روی حسابِ کاربر", "حسابِ خودِ کاربر"):
        assert forbidden not in prompt


def test_admin_ea_and_per_user_execution_routes_are_static_or_gone_pre_io() -> None:
    admin = SimpleNamespace(username="auditor")

    assert_state(run(panel.ea_config_get(admin)))
    assert_gone(panel.ea_config_set(admin))
    assert_state(run(panel.ea_status(admin)))
    assert_gone(panel.ea_close_all(admin))
    account = run(panel.ea_account_get(admin))
    assert_state(account)
    assert account["configured"] is False
    assert_gone(panel.ea_account_set(admin))
    assert_gone(panel.ea_account_logout(admin))

    assert_gone(panel.panel_user_copy_toggle(1700, admin))
    assert_gone(panel.panel_user_stop(1700, admin))
    assert_gone(panel.panel_user_close_all(1700, admin))

    for fn in (
        panel.ea_config_get,
        panel.ea_config_set,
        panel.ea_status,
        panel.ea_close_all,
        panel.ea_account_get,
        panel.ea_account_set,
        panel.ea_account_logout,
        panel.panel_user_copy_toggle,
        panel.panel_user_stop,
        panel.panel_user_close_all,
    ):
        source = inspect.getsource(fn)
        for forbidden in ("redis_client", "db.execute", "set_master_account", "get_master_account"):
            assert forbidden not in source


def test_indirect_ea_adapter_cannot_feed_signals_credentials_or_deals(monkeypatch) -> None:
    token = "qa-ea-token"
    monkeypatch.setattr(ea.settings, "EA_TOKEN", token)

    signals = run(ea.ea_signals(token=token, uid=0, db=NoIo()))
    assert signals["signals"] == []
    assert_state(signals)

    config = run(ea.ea_config(token=token, uid=17, db=NoIo()))
    assert config.status_code == 200
    assert "enabled=0" in config.body.decode("utf-8")
    assert "expected_login=" not in config.body.decode("utf-8")

    assert_gone(ea.ea_heartbeat(token=token, uid=17, body=UnreadablePayload()))
    assert_gone(ea.ea_diag(token=token, uid=17, body=UnreadablePayload()))
    master = run(ea.ea_master_account(token=token))
    assert master["configured"] is False
    assert_state(master)
    users = run(ea.ea_users(token=token, ip="server", host="host", hid=1, db=NoIo()))
    assert users["users"] == []
    assert users["live"] is False
    assert_state(users)
    assert_gone(ea.ea_deals(UnreadablePayload(), token=token, uid=17, db=NoIo()))
    assert_gone(ea.ea_symbols(UnreadablePayload(), token=token, uid=17))
    assert_gone(ea.ea_specs(UnreadablePayload(), token=token, uid=17, db=NoIo()))

    assert run(ea.get_ea_settings())["enabled"] is False
    assert run(ea.get_ea_status()) == {}
    assert run(ea.get_master_account()) is None
    assert_gone(ea.set_ea_settings(UnreadablePayload()))
    assert_gone(ea.set_master_account("server", "login", "password"))
    assert_gone(ea.clear_master_account())


def test_bot_has_no_copy_webapp_credential_collection_or_reconnect_copy() -> None:
    menu_buttons = [button for row in keyboards.main_menu_keyboard().keyboard for button in row]
    assert all(button.web_app is None for button in menu_buttons)
    assert all(button.text != texts.BTN_COPY for button in menu_buttons)

    free_buttons = [button for row in keyboards.free_subscription_keyboard().inline_keyboard for button in row]
    assert all("شناسه" not in button.text for button in free_buttons)

    shipping_copy = "\n".join((texts.vip_plans(), texts.free_subscription(), texts.BROKER_INTRO))
    assert "OneRoyal" in shipping_copy
    assert "فقط" in shipping_copy and "معرفی" in shipping_copy
    for forbidden in (
        "شمارهٔ حساب",
        "ایمیلی که با آن در OneRoyal",
        "معاملات به‌صورتِ خودکار روی حساب",
        "پنل برایتان کاملاً رایگان",
    ):
        assert forbidden not in shipping_copy

    from src.bot import tasks
    from src.bot.handlers import menu

    assert "WebAppInfo" not in inspect.getsource(menu.copy_trade)
    assert "USER_PANEL_URL" not in inspect.getsource(menu.copy_trade)
    assert "حساب متاتریدر" not in inspect.getsource(menu.copy_trade)
    assert run(tasks._panel_resource_sweep()) == {
        "warned": 0,
        "removed": 0,
        "disabled": True,
        "integration_level": "referral_only",
    }


def test_all_legacy_forex_compatibility_routes_remain_static_fail_closed() -> None:
    from src.api.routes import admin_bn_trading, bazaarnama, bn_bauth, bn_user_extra

    student = SimpleNamespace(id=17, forex_signal_until=None, forex_copy_until=None)
    for payload in (
        run(bn_gate.get_forex_settings(student)),
        run(bn_r7.forex_copy_config(student)),
        run(bn_r8.copytrade_history("forex", student)),
        run(bn_bauth.referral_forex(student, NoIo())),
    ):
        assert_state(payload)

    assert_gone(bn_bauth.referral_verify({"kind": "forex"}, student, NoIo()))

    # Dedicated OneRoyal/forex write routes must expose no FastAPI body params;
    # rejecting inside a handler is too late because validation already parsed it.
    bodyless_routes = (
        (bn_gate.router, "/copytrade/forex/settings"),
        (bn_r8.router, "/copytrade/stop"),
        (bn_r8.router, "/copytrade/close-all"),
        (bn_r8.router, "/copytrade/close/{pos_id}"),
        (bazaarnama.router, "/copytrade/forex"),
    )
    for api_router, path in bodyless_routes:
        route = next(
            route for route in api_router.routes
            if route.path == path and "POST" in route.methods
        )
        assert route.dependant.body_params == [], path

    admin_source = inspect.getsource(admin_bn_trading.list_exchange_accounts)
    assert 'BnExchangeAccount.kind == "lbank"' in admin_source
    for fn in (admin_bn_trading.set_exchange_referral, admin_bn_trading.set_exchange_status):
        source = inspect.getsource(fn)
        assert 'acc.kind != "lbank"' in source
        assert "oneroyal_referral_only" in source

    overview_source = inspect.getsource(bn_user_extra.overview)
    assert 'BnExchangeAccount.kind == "lbank"' in overview_source
    assert 'BnOrder.market == "crypto"' in overview_source

    source_markers = {
        "src/api/routes/bn_gate.py": "_reject_forex_copy_action",
        "src/api/routes/bn_r7.py": '"integration_level": "referral_only"',
        "src/api/routes/bn_r8.py": "_reject_forex_action",
        "src/api/routes/bazaarnama.py": "oneroyal_referral_only",
    }
    for relative, marker in source_markers.items():
        source = (REPO_ROOT / relative).read_text(encoding="utf-8")
        assert marker in source
        assert "/go/oneroyal" in source


def test_shipping_source_and_bundle_scanner_knows_operational_one_royal_rules() -> None:
    scanner = (REPO_ROOT / "qa/scripts/provider-exclusivity-scan.mjs").read_text(encoding="utf-8")
    tests = (REPO_ROOT / "qa/tests/provider-exclusivity-scan.test.mjs").read_text(encoding="utf-8")
    for marker in (
        "OneRoyal operational account-link API",
        "OneRoyal operational copy API",
        "OneRoyal operational admin EA API",
        "OneRoyal operational MT5 activation state",
    ):
        assert marker in scanner
    assert "OneRoyal operational" in tests
