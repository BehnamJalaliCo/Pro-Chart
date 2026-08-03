"""DB/Redis-free regression contracts for the fixed referral boundary."""

from __future__ import annotations

import asyncio
import importlib
import inspect
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI, HTTPException

from src.api.middleware.security_headers import SecurityHeadersMiddleware
from src.api.routes import referrals


EXPECTED = {
    "/go/lbank": "https://www.lbank.com/ref/PROCHART",
    "/go/oneroyal": "https://vc.cabinet.oneroyal.com/fa/links/go/12412",
}


def _test_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(SecurityHeadersMiddleware, enable_hsts=True)
    app.include_router(referrals.router)
    return app


async def _request(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=_test_app())
    async with httpx.AsyncClient(
        transport=transport,
        base_url="https://pro-chart.test",
        follow_redirects=False,
    ) as client:
        return await client.get(
            path,
            params={"next": "https://attacker.invalid", "destination": "https://attacker.invalid"},
        )


@pytest.mark.parametrize(("path", "destination"), EXPECTED.items())
def test_redirect_is_exact_uncached_and_ignores_query_override(path: str, destination: str) -> None:
    response = asyncio.run(_request(path))
    assert response.status_code == 302
    assert response.headers["location"] == destination
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-security-policy"].startswith("default-src 'none'")


def test_router_exposes_only_two_explicit_get_routes() -> None:
    routes = {route.path: frozenset(route.methods or ()) for route in referrals.router.routes}
    assert routes == {
        "/go/lbank": frozenset({"GET"}),
        "/go/oneroyal": frozenset({"GET"}),
    }
    assert dict(referrals.REFERRAL_DESTINATIONS) == {
        "lbank": EXPECTED["/go/lbank"],
        "oneroyal": EXPECTED["/go/oneroyal"],
    }
    assert referrals.internal_referral_path("lbank") == "/go/lbank"
    assert referrals.internal_referral_path("oneroyal") == "/go/oneroyal"
    with pytest.raises(KeyError):
        referrals.internal_referral_path("unapproved")
    with pytest.raises(TypeError):
        referrals.REFERRAL_DESTINATIONS["lbank"] = "https://attacker.invalid"


def test_redirect_module_does_not_consume_or_log_request_data() -> None:
    source = Path(referrals.__file__).read_text(encoding="utf-8")
    assert "Request" not in source
    assert "get_logger" not in source
    assert "query_params" not in source
    assert "@router.get(\"/go/{" not in source


def test_product_api_payloads_expose_internal_paths_only() -> None:
    from src.api.routes.bazaarnama import referral_link

    crypto = asyncio.run(referral_link(SimpleNamespace(account_type="crypto")))
    broker = asyncio.run(referral_link(SimpleNamespace(account_type="broker")))
    assert crypto["broker"] == "LBank"
    assert crypto["url"] == "/go/lbank"
    assert broker["broker"] == "OneRoyal"
    assert broker["url"] == "/go/oneroyal"
    assert broker["integration_level"] == "referral_only"
    for payload in (crypto, broker):
        assert payload["disclosure"] == referrals.REFERRAL_DISCLOSURE
        assert payload["eligibility"] == referrals.REFERRAL_ELIGIBILITY
        assert not payload["url"].startswith(("http://", "https://"))


def test_legacy_api_fields_keep_names_but_return_internal_paths() -> None:
    from src.api.routes.bn_bauth import referral_crypto, referral_forex

    class EmptyResult:
        def scalars(self):
            return self

        def first(self):
            return None

    class EmptyDb:
        async def execute(self, _query):
            return EmptyResult()

    student = SimpleNamespace(id=7)
    crypto = asyncio.run(referral_crypto(student, EmptyDb()))
    forex = asyncio.run(referral_forex(student, EmptyDb()))
    assert crypto["lbank_ref_link"] == "/go/lbank"
    assert forex["oneroyal_ref_link"] == "/go/oneroyal"
    assert forex["integration_level"] == "referral_only"


def test_bot_departure_uses_notice_gate_and_absolute_internal_route() -> None:
    from src.bot import keyboards, texts
    from src.core.config import settings

    def buttons(markup):
        return [button for row in markup.inline_keyboard for button in row]

    for markup in (
        keyboards.free_subscription_keyboard(),
        keyboards.broker_home_keyboard(),
        keyboards.broker_section_keyboard(),
    ):
        notice_buttons = [
            button for button in buttons(markup)
            if button.callback_data == "broker:referral:notice"
        ]
        assert len(notice_buttons) == 1
        assert notice_buttons[0].url is None
        assert "شرایط لینک معرفی" in notice_buttons[0].text

    acknowledged = buttons(keyboards.broker_referral_ack_keyboard())
    outbound = [button for button in acknowledged if button.url]
    assert len(outbound) == 1
    assert outbound[0].url == "https://pro-chart.ir/go/oneroyal"
    assert outbound[0].url == settings.ONEROYAL_REFERRAL_REDIRECT_URL
    assert "شرایط را بررسی کرده‌ام" in outbound[0].text
    assert settings.BROKER_REFERRAL_URL != outbound[0].url
    assert referrals.REFERRAL_DISCLOSURE in texts.BROKER_REFERRAL_NOTICE
    assert referrals.REFERRAL_ELIGIBILITY in texts.BROKER_REFERRAL_NOTICE
    assert referrals.REFERRAL_DISCLOSURE in texts.free_subscription()
    assert referrals.REFERRAL_ELIGIBILITY in texts.free_subscription()


class _FailOnWriteDb:
    async def execute(self, *_args, **_kwargs):
        raise AssertionError("referral-only request must not execute a DB query")

    def add(self, *_args, **_kwargs):
        raise AssertionError("referral-only request must not add a DB row")

    async def commit(self):
        raise AssertionError("referral-only request must not commit")


class _RowsResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _RowsDb:
    def __init__(self, rows):
        self._rows = rows

    async def execute(self, _query):
        return _RowsResult(self._rows)


def _assert_oneroyal_referral_only(exc: HTTPException, status_code: int) -> None:
    assert exc.status_code == status_code
    assert exc.detail["oneroyal_referral_only"] is True
    assert exc.detail["referral_path"] == "/go/oneroyal"


def test_mt5_connect_is_bodyless_and_never_reaches_storage() -> None:
    from src.api.routes import bazaarnama

    assert list(inspect.signature(bazaarnama.connect_mt5).parameters) == ["st"]
    with pytest.raises(HTTPException) as caught:
        asyncio.run(bazaarnama.connect_mt5(SimpleNamespace(id=7)))
    _assert_oneroyal_referral_only(caught.value, 410)

    source = inspect.getsource(bazaarnama.connect_mt5)
    for forbidden in ("login", "password", "server", "encrypt_secret", "db."):
        assert forbidden not in source


def test_historical_mt5_status_is_inactive_and_redacted() -> None:
    from src.api.routes import bazaarnama

    mt5 = SimpleNamespace(
        kind="mt5",
        account_ref="must-not-leak",
        server="must-not-leak",
        status="active",
    )
    student = SimpleNamespace(
        id=7,
        copy_crypto=False,
        copy_crypto_risk=1.0,
        copy_forex=True,
        forex_copy_until=datetime.now(timezone.utc) + timedelta(days=1),
    )
    status = asyncio.run(bazaarnama.bn_copytrade_status(student, _RowsDb([mt5])))
    assert status["forex"]["enabled"] is False
    assert status["forex"]["connected"] is False
    assert status["forex"]["eligible"] is False
    assert status["forex"]["integration_level"] == "referral_only"
    assert status["forex"]["referral_path"] == "/go/oneroyal"
    assert status["forex"]["legacy_connection_present"] is True

    connection = asyncio.run(bazaarnama.connect_status(student, _RowsDb([mt5])))
    legacy = connection["accounts"]["mt5"]
    assert legacy["connected"] is False
    assert legacy["legacy_record_present"] is True
    assert legacy["integration_level"] == "referral_only"
    assert "account_ref" not in legacy
    assert "server" not in legacy


def test_forex_copy_toggle_and_subscription_fail_before_db_or_network() -> None:
    from src.api.routes import bazaarnama

    student = SimpleNamespace(id=7)
    with pytest.raises(HTTPException) as toggle_caught:
        asyncio.run(bazaarnama.bn_copytrade_set(
            "forex",
            {"enabled": True, "risk_pct": 10},
            student,
            _FailOnWriteDb(),
        ))
    _assert_oneroyal_referral_only(toggle_caught.value, 410)

    with pytest.raises(HTTPException) as payment_caught:
        asyncio.run(bazaarnama.payment_submit(
            "untrusted-tx-hash",
            "forex_copy",
            "monthly",
            student,
            _FailOnWriteDb(),
        ))
    _assert_oneroyal_referral_only(payment_caught.value, 410)

    toggle_source = inspect.getsource(bazaarnama.bn_copytrade_set)
    assert "mt5_login" not in toggle_source
    assert "/user/copy-svc" not in toggle_source
    payment_source = inspect.getsource(bazaarnama.payment_submit)
    assert payment_source.index('if product == "forex_copy"') < payment_source.index("verify_usdt_payment")
    assert "st.forex_copy_until" not in payment_source


def test_non_crypto_real_order_fails_before_account_or_order_work(monkeypatch) -> None:
    from src.api.routes import bazaarnama

    class _NoKillswitch:
        async def get(self, _key):
            return None

    async def _no_pair_refresh():
        return None

    redis_module = importlib.import_module("src.core.redis_client")
    crypto_feed = importlib.import_module("src.api.routes._crypto_feed")
    monkeypatch.setattr(redis_module, "redis_client", SimpleNamespace(client=_NoKillswitch()))
    monkeypatch.setattr(crypto_feed, "ensure_pairs", _no_pair_refresh)
    monkeypatch.setattr(crypto_feed, "is_crypto", lambda _symbol: False)

    student = SimpleNamespace(
        id=7,
        prochart_until=datetime.now(timezone.utc) + timedelta(days=1),
    )
    with pytest.raises(HTTPException) as caught:
        asyncio.run(bazaarnama.real_order(
            side="buy",
            symbol="EURUSD",
            amount=1.0,
            price=0.0,
            leverage=5,
            st=student,
            db=_FailOnWriteDb(),
        ))
    _assert_oneroyal_referral_only(caught.value, 403)

    source = inspect.getsource(bazaarnama.real_order)
    assert source.index("if not crypto") < source.index("db.execute")
    assert 'market="forex"' not in source
    assert "bn-forex-open" not in source


def test_seo_copy_distinguishes_lbank_trading_from_oneroyal_referral() -> None:
    from src.api.routes import seo

    faq_text = " ".join(answer for _question, answer in seo._HOME_FAQ)
    assert "ترید مستقیم فقط برای ارز دیجیتال" in faq_text
    assert "LBank" in faq_text
    assert "OneRoyal" in faq_text
    assert "referral-only" in faq_text
    assert "بروکر OneRoyal (متاتریدر ۵)" not in faq_text

    home = seo._home_doc([]).body.decode("utf-8")
    assert "LBank" in home
    assert "OneRoyal" in home
    assert "referral-only" in home
