"""
LBank API client, request signing, number formatting, and URL resolution utilities.

Extracted from personal_trading.py to keep module sizes manageable.
All public symbols are re-exported by personal_trading.py for backward compatibility.
"""
from __future__ import annotations

import asyncio
from collections import deque
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from decimal import Decimal, ROUND_DOWN, ROUND_UP
from typing import Any, Dict, Iterable, List, Optional

import aiohttp

def normalize_symbol_upper(symbol: str) -> str:
    raw = (symbol or "").upper()
    if ":" in raw:
        raw = raw.split(":", 1)[0]
    for ch in ("/", "-", "_"):
        raw = raw.replace(ch, "")
    return raw


logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Base URL resolution
# ---------------------------------------------------------------------------

_DEFAULT_LBANK_BASE_URL = "https://fmapi.lbankverify.com"
_ENV_BASE_URL = os.getenv("LBANK_BASE_URL", "").strip()
DEFAULT_LBANK_BASE_URL = _ENV_BASE_URL.rstrip("/") if _ENV_BASE_URL else _DEFAULT_LBANK_BASE_URL

_DEPRECATED_LBANK_BASE_URLS: tuple[str, ...] = (
    "https://contract-openapi.lbankapi.com",
    "https://contract-openapi.lbank.pro",
    "https://contract-openapi.lbank.cc",
    "https://contract-openapi.lbank.info",
    "https://contract-openapi.lbank.site",
    "https://contract-openapi.lbank.com",
    "https://contract-openapi.lbkex.com",
    "https://contract-openapi.lbkex.net",
    "https://contract-openapi.lbkex.org",
    "https://api.lbkex.com",
    "https://api.lbkex.net",
)

_DEPRECATED_LBANK_BASE_URLS_SET = frozenset(_DEPRECATED_LBANK_BASE_URLS)

_DEFAULT_FALLBACK_BASE_URLS: tuple[str, ...] = (DEFAULT_LBANK_BASE_URL,)

_ENV_FALLBACKS_RAW = os.getenv("LBANK_FALLBACK_BASE_URLS", "")
_ENV_FALLBACKS = [
    candidate.strip().rstrip("/")
    for candidate in _ENV_FALLBACKS_RAW.split(",")
    if candidate and candidate.strip()
]

LBANK_FALLBACK_BASE_URLS: tuple[str, ...] = tuple(
    dict.fromkeys((*_ENV_FALLBACKS, *_DEFAULT_FALLBACK_BASE_URLS))
)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class LBankAPIError(Exception):
    """Custom exception raised when the LBank API returns an error."""


# ---------------------------------------------------------------------------
# Numeric / time helpers
# ---------------------------------------------------------------------------

def _now_ms(offset_ms: int = 0) -> str:
    return str(int(time.time() * 1000) + int(offset_ms))


def _random_echostr() -> str:
    # 32 hex chars -> length 32 (within the 30-40 requirement)
    return secrets.token_hex(16)


def _safe_float(value: Any) -> Optional[float]:
    """Convert value to float when possible; return None on failure."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and not value.strip():
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _format_number(
    value: float,
    tick: Optional[float] = None,
    *,
    direction: Optional[str] = None,
    is_tp: bool = False,
    is_sl: bool = False,
) -> str:
    """Format a price to exchange tick precision.

    F25 (2026-05-25) — WIN_RATE_AUDIT §1.2.  Direction-aware rounding:

    * TP for a LONG → ROUND_UP so the limit order sits one tick
      above-or-equal to the requested level (helps fill when the
      market touches the level once).
    * TP for a SHORT → ROUND_DOWN (symmetric reasoning, below entry).
    * SL for a LONG → ROUND_DOWN (be lenient on losses — give the
      position the requested distance, not less).
    * SL for a SHORT → ROUND_UP (lenient above entry).
    * Everything else (quantities, entry prices) → ROUND_DOWN, the
      historical default.

    Old call sites with no `direction`/`is_tp`/`is_sl` kwargs keep
    the ROUND_DOWN behaviour they had, so this is a strictly
    backwards-compatible addition."""
    if tick:
        try:
            tick_dec = Decimal(str(tick))
            if tick_dec > 0:
                val_dec = Decimal(str(value))
                _dir = (direction or "").upper()
                if is_tp and _dir == "LONG":
                    rounding = ROUND_UP
                elif is_tp and _dir == "SHORT":
                    rounding = ROUND_DOWN
                elif is_sl and _dir == "LONG":
                    rounding = ROUND_DOWN
                elif is_sl and _dir == "SHORT":
                    rounding = ROUND_UP
                else:
                    rounding = ROUND_DOWN
                quantized = (val_dec / tick_dec).quantize(Decimal("1"), rounding=rounding) * tick_dec
                value = float(quantized)
        except Exception:
            logger.exception("ERROR LOCATION: personal_trading._format_number quantize", exc_info=True)
    text = f"{value:.10f}".rstrip("0").rstrip(".")
    return text or "0"


def _ceil_to_tick(value: float, tick: Optional[float]) -> float:
    if not tick:
        return value
    try:
        tick_dec = Decimal(str(tick))
        if tick_dec <= 0:
            return value
        value_dec = Decimal(str(value))
        if value_dec <= 0:
            return float(value_dec)
        steps = (value_dec / tick_dec).quantize(Decimal("1"), rounding=ROUND_UP)
        quantized = steps * tick_dec
        return float(quantized)
    except Exception:
        return value


def _floor_to_tick(value: float, tick: Optional[float]) -> float:
    if not tick:
        return value
    try:
        tick_dec = Decimal(str(tick))
        if tick_dec <= 0:
            return value
        value_dec = Decimal(str(value))
        if value_dec <= 0:
            return float(value_dec)
        steps = (value_dec / tick_dec).quantize(Decimal("1"), rounding=ROUND_DOWN)
        quantized = steps * tick_dec
        return float(quantized)
    except Exception:
        return value


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

def _normalize_base_url(url: Optional[str]) -> str:
    if not url:
        return ""
    return str(url).strip().rstrip("/")


def _collect_additional_urls(extras: Any) -> Iterable[str]:
    if not extras:
        return []
    if isinstance(extras, dict):
        payload = extras.get("additional_base_urls") or extras.get("fallback_base_urls") or extras.get("alternate_base_urls")
    else:
        payload = extras

    urls: list[str] = []
    if isinstance(payload, str):
        urls = [item.strip() for item in payload.split(",") if item and item.strip()]
    elif isinstance(payload, (list, tuple, set)):
        urls = [str(item).strip() for item in payload if str(item).strip()]
    else:
        return []

    return [_normalize_base_url(url) for url in urls if _normalize_base_url(url)]


def _build_base_url_candidates(settings: Dict[str, Any]) -> list[str]:
    first = _normalize_base_url(settings.get("base_url"))
    candidates: list[str] = []
    if first:
        candidates.append(first)
    extras = settings.get("extras")
    extra_urls = list(_collect_additional_urls(extras))
    extra_urls = [
        url for url in extra_urls if url and url not in _DEPRECATED_LBANK_BASE_URLS_SET
    ]
    for candidate in extra_urls:
        if candidate not in candidates:
            candidates.append(candidate)
    if not candidates:
        for candidate in (DEFAULT_LBANK_BASE_URL, *LBANK_FALLBACK_BASE_URLS):
            if candidate not in candidates:
                candidates.append(candidate)
    else:
        if DEFAULT_LBANK_BASE_URL not in candidates:
            candidates.append(DEFAULT_LBANK_BASE_URL)
    return candidates


# ---------------------------------------------------------------------------
# Symbol normalization
# ---------------------------------------------------------------------------

def _normalize_symbol(symbol: str) -> str:
    return normalize_symbol_upper(symbol)


# ---------------------------------------------------------------------------
# LBankClient
# ---------------------------------------------------------------------------

class LBankClient:
    def __init__(
        self,
        settings: Dict[str, Any],
        session: aiohttp.ClientSession,
        *,
        time_offset_ms: int = 0,
    ) -> None:
        self.api_key = (settings.get("api_key") or "").strip()
        self.api_secret = (settings.get("api_secret") or "").strip()
        self._base_urls = _build_base_url_candidates(settings)
        self.base_url = self._base_urls[0]
        self.product_group = settings.get("product_group") or "SwapU"
        signature_method = str(settings.get("signature_method") or "HmacSHA256").strip()
        signature_upper = signature_method.upper()
        if signature_upper == "HMACSHA256":
            self.signature_method = "HmacSHA256"
            self._signature_method_upper = "HMACSHA256"
        elif signature_upper == "RSA":
            self.signature_method = "RSA"
            self._signature_method_upper = "RSA"
        else:
            self.signature_method = signature_method or "HmacSHA256"
            self._signature_method_upper = self.signature_method.upper()
        self.session = session
        self._time_offset_ms = int(time_offset_ms)

    def _sign(self, params: Dict[str, Any]) -> str:
        if not self.api_secret:
            raise LBankAPIError("API secret is missing for signing request")
        items = []
        for key, value in params.items():
            if key == "sign" or value is None:
                continue
            items.append((key, str(value)))
        items.sort(key=lambda item: item[0])
        prepared = "&".join(f"{k}={v}" for k, v in items)
        md5_digest = hashlib.md5(prepared.encode("utf-8"), usedforsecurity=False).hexdigest().upper()
        if self._signature_method_upper == "HMACSHA256":
            signature = hmac.new(
                self.api_secret.encode("utf-8"),
                md5_digest.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            return signature
        if self._signature_method_upper == "RSA":
            raise LBankAPIError("RSA signature is not implemented in this build")
        raise LBankAPIError(f"Unsupported signature method {self.signature_method}")

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        private: bool = True,
    ) -> Any:
        method_upper = method.upper()
        base_params = dict(params or {})
        base_data = dict(data or {})
        errors: list[str] = []
        last_exc: Exception | None = None

        for idx, candidate in enumerate(self._base_urls):
            try:
                result = await self._execute_request(
                    base_url=candidate,
                    method_upper=method_upper,
                    path=path,
                    params=dict(base_params),
                    data=dict(base_data),
                    private=private,
                )
                if idx != 0:
                    self._base_urls.pop(idx)
                    self._base_urls.insert(0, candidate)
                self.base_url = candidate
                return result
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                errors.append(f"{candidate}: {exc}")
                last_exc = exc
                if idx < len(self._base_urls) - 1:
                    logger.warning(
                        "LBank endpoint %s failed (%s); trying %s",
                        candidate,
                        exc,
                        self._base_urls[idx + 1],
                    )
                    continue
                break
            except LBankAPIError as exc:
                last_exc = exc
                if idx < len(self._base_urls) - 1 and self._should_retry_with_next_base(exc):
                    errors.append(f"{candidate}: {exc}")
                    logger.warning(
                        "LBank endpoint %s responded with %s; trying %s",
                        candidate,
                        exc,
                        self._base_urls[idx + 1],
                    )
                    continue
                raise

        if last_exc is not None:
            attempted = ", ".join(self._base_urls)
            details = "; ".join(errors) if errors else str(last_exc)
            raise LBankAPIError(
                "Unable to reach any LBank endpoint. "
                f"Tried: {attempted}. Last error: {details}. "
                f"Confirm the personal trading base_url (default {DEFAULT_LBANK_BASE_URL})."
            ) from last_exc

        raise LBankAPIError("Unable to reach any LBank endpoint.")

    async def _execute_request(
        self,
        *,
        base_url: str,
        method_upper: str,
        path: str,
        params: Dict[str, Any],
        data: Dict[str, Any],
        private: bool,
    ) -> Any:
        url = f"{base_url}{path}"
        headers: Dict[str, str] = {}

        if private:
            if not self.api_key:
                raise LBankAPIError("API key is missing for authenticated call")
            timestamp = _now_ms(self._time_offset_ms)
            echostr = _random_echostr()
            headers.update(
                {
                    "timestamp": timestamp,
                    "signature_method": self.signature_method,
                    "echostr": echostr,
                }
            )
            payload = params if method_upper == "GET" else data
            payload.update(
                {
                    "api_key": self.api_key,
                    "signature_method": self.signature_method,
                    "timestamp": timestamp,
                    "echostr": echostr,
                }
            )
            payload["sign"] = self._sign(payload)

        # 2026-06-25 — optional outbound proxy so all LBank traffic egresses from
        # a single STATIC IP. Users whitelist that one IP on their API key once
        # and it never breaks again on a server move (the IP-whitelist problem
        # that left copy-trade dead for weeks). No-op unless LBANK_PROXY_URL set.
        _proxy = os.environ.get("LBANK_PROXY_URL", "").strip() or None
        if method_upper == "GET":
            async with self.session.get(url, params=params, headers=headers, proxy=_proxy) as resp:
                status = resp.status
                text = await resp.text()
        elif method_upper == "POST":
            headers.setdefault("Content-Type", "application/json")
            payload = json.dumps(data)
            async with self.session.post(url, data=payload, headers=headers, proxy=_proxy) as resp:
                status = resp.status
                text = await resp.text()
        else:
            raise LBankAPIError(f"Unsupported HTTP method {method_upper}")

        text_stripped = text.strip()
        if status >= 400:
            snippet = text_stripped[:200] if text_stripped else ""
            lower_snippet = snippet.lower()
            if lower_snippet.startswith("<!doctype") or lower_snippet.startswith("<html"):
                raise LBankAPIError(
                    f"LBank host {base_url} returned HTML (HTTP {status}). "
                    f"Confirm the personal trading base_url (default {DEFAULT_LBANK_BASE_URL})."
                )
            detail = snippet or f"HTTP {status} with empty body"
            raise LBankAPIError(f"LBank request failed ({status}): {detail}")
        if not text_stripped:
            raise LBankAPIError(f"Empty response from LBank (HTTP {status})")

        try:
            result = json.loads(text_stripped)
        except json.JSONDecodeError:
            logger.debug("Non-JSON response from LBank: %s", text)
            snippet = text[:200].strip()
            lower_snippet = snippet.lower()
            if lower_snippet.startswith("<!doctype") or lower_snippet.startswith("<html"):
                raise LBankAPIError(
                    f"LBank host {base_url} returned HTML. "
                    f"Confirm the personal trading base_url (default {DEFAULT_LBANK_BASE_URL})."
                )
            raise LBankAPIError(f"Invalid JSON response from LBank: {snippet}")

        if isinstance(result, dict) and "error_code" in result:
            code = result.get("error_code")
            if code not in (0, "0", None):
                raise LBankAPIError(result.get("msg") or f"API error code {code}")
        return result

    async def get_server_time(self) -> Optional[int]:
        resp = await self._request(
            "GET",
            "/cfd/openApi/v1/pub/getTime",
            private=False,
        )
        containers: list[Any] = []
        if isinstance(resp, dict):
            containers.append(resp)
            data = resp.get("data")
            if isinstance(data, dict):
                containers.append(data)
        if isinstance(resp, (list, tuple)):
            containers.extend(item for item in resp if isinstance(item, dict))

        for container in containers:
            for key in ("serverTime", "servertime", "server_time", "timestamp", "time", "ts", "now"):
                if key in container and container[key] not in (None, ""):
                    try:
                        return int(float(container[key]))
                    except (TypeError, ValueError):
                        continue
        # Fallback: some variants return top-level field
        for key in ("serverTime", "timestamp", "time", "ts", "now"):
            if isinstance(resp, dict) and resp.get(key) not in (None, ""):
                try:
                    return int(float(resp[key]))
                except (TypeError, ValueError):
                    continue
        return None

    @staticmethod
    def _should_retry_with_next_base(exc: LBankAPIError) -> bool:
        message = str(exc).lower()
        retriable_tokens = (
            "returned html",
            "empty response",
            "cannot connect",
            "dns",
            "timed out",
            "connection reset",
        )
        return any(token in message for token in retriable_tokens)

    async def get_instruments(self, product_group: str) -> list[dict]:
        resp = await self._request(
            "GET",
            "/cfd/openApi/v1/pub/instrument",
            params={"productGroup": product_group},
            private=False,
        )
        if isinstance(resp, list):
            return resp
        if isinstance(resp, dict):
            items = self._extract_list_from_payload(resp)
            if items is not None:
                return items
        raise LBankAPIError("Unexpected instruments response format")

    @staticmethod
    def _extract_list_from_payload(payload: Any) -> Optional[list[Any]]:
        """
        LBank recently started wrapping public responses (like instrument lists)
        inside nested dictionaries. Traverse the payload breadth-first and return
        the first list encountered, prioritising common container keys.
        """
        queue: deque[Any] = deque([payload])
        seen: set[int] = set()
        preferred_keys = (
            "data",
            "datas",
            "result",
            "results",
            "rows",
            "contracts",
            "items",
            "list",
        )

        while queue:
            current = queue.popleft()
            current_id = id(current)
            if current_id in seen:
                continue
            seen.add(current_id)

            if isinstance(current, list):
                return current

            if not isinstance(current, dict):
                continue

            for key in preferred_keys:
                if key not in current:
                    continue
                value = current[key]
                if isinstance(value, list):
                    return value
                if isinstance(value, dict):
                    queue.append(value)

            for value in current.values():
                if isinstance(value, list):
                    return value
                if isinstance(value, dict):
                    queue.append(value)

        return None

    async def query_account(self, asset: str, product_group: str) -> dict:
        resp = await self._request(
            "GET",
            "/cfd/openApi/v1/prv/account",
            params={"asset": asset, "productGroup": product_group},
            private=True,
        )
        if not isinstance(resp, dict):
            raise LBankAPIError("Unexpected account response format")
        data = resp.get("data") if isinstance(resp.get("data"), dict) else None
        return data or resp

    async def get_positions(self, product_group: str, symbol: Optional[str] = None) -> list[dict]:
        params: Dict[str, Any] = {"productGroup": product_group}
        if symbol:
            params["symbol"] = symbol
        resp = await self._request(
            "GET",
            "/cfd/openApi/v1/prv/position",
            params=params,
            private=True,
        )
        if isinstance(resp, list):
            return resp
        if isinstance(resp, dict):
            data = resp.get("data")
            if isinstance(data, list):
                return data
        raise LBankAPIError("Unexpected position response format")

    async def get_market_data(self, product_group: str) -> list[dict]:
        resp = await self._request(
            "GET",
            "/cfd/openApi/v1/pub/marketData",
            params={"productGroup": product_group},
            private=False,
        )
        if isinstance(resp, list):
            return resp
        if isinstance(resp, dict):
            data = resp.get("data")
            if isinstance(data, list):
                return data
        raise LBankAPIError("Unexpected market data response format")

    async def get_order_cache(
        self,
        *,
        client_order_id: Optional[str] = None,
        order_id: Optional[str] = None,
    ) -> dict:
        params: Dict[str, Any] = {}
        if client_order_id:
            params["clientOrderId"] = client_order_id
        if order_id:
            params["orderId"] = order_id
        resp = await self._request(
            "GET",
            "/cfd/openApi/v1/prv/orderCache",
            params=params,
            private=True,
        )
        if not isinstance(resp, dict):
            raise LBankAPIError("Unexpected order cache response format")
        return resp

    async def set_leverage(
        self,
        symbol: str,
        leverage: int,
        product_group: str,
        *,
        posi_direction: Optional[str] = None,
    ) -> None:
        payload = {
            "symbol": symbol,
            "leverage": leverage,
            "productGroup": product_group,
            "posiDirection": str(posi_direction or "2"),
        }
        await self._request(
            "POST",
            "/cfd/openApi/v1/prv/setLeverage",
            data=payload,
            private=True,
        )

    async def set_margin_mode(self, symbol: str, is_group_margin: bool) -> None:
        payload = {
            "symbol": symbol,
            "isGroupMargin": 1 if is_group_margin else 0,
        }
        await self._request(
            "POST",
            "/cfd/openApi/v1/prv/setGroupMargin",
            data=payload,
            private=True,
        )

    async def place_order(
        self,
        *,
        symbol: str,
        side: str,
        client_order_id: str,
        product_group: str,
        order_price_type: str,
        offset_flag: str | int = "0",
        amount: Optional[float] = None,
        volume: Optional[float] = None,
        price: Optional[float] = None,
        posi_direction: Optional[str] = None,
        position_side: Optional[str] = None,
    ) -> dict:
        if amount is None and volume is None:
            raise ValueError("Either amount or volume must be provided to place an order")

        # FIX-15 (2026-05-18): pre-entry order-book imbalance check. Only
        # runs for *opening* orders (offset_flag '0' = open), never for
        # closes — we never want to delay a stop-loss. Failures fall
        # through to a normal order placement so this can't block real
        # orders if Binance public depth is down.
        import os as _os
        if _os.getenv("OB_TIMING_ENABLED", "0").strip().lower() in {"1", "true", "yes", "on"} and str(offset_flag) == "0":
            try:
                from app.trading.orderbook_timing import wait_for_favourable_book
                _direction = "LONG" if str(side).upper() in {"BUY", "LONG"} else "SHORT"
                _r = await wait_for_favourable_book(symbol, _direction)
                if not _r.proceed:
                    logger.warning(
                        "[order_executor] FIX-15 OB-timing CANCEL %s side=%s "
                        "delays_used=%d imbalance=%s reason=%s",
                        symbol, side, _r.delays_used, _r.imbalance, _r.reason,
                    )
                    raise RuntimeError(f"orderbook_timing_cancel:{_r.reason}")
                if _r.delays_used > 0:
                    logger.info(
                        "[order_executor] FIX-15 OB-timing waited %d×30s before %s/%s",
                        _r.delays_used, symbol, side,
                    )
            except RuntimeError:
                raise
            except Exception:
                logger.debug(
                    "[order_executor] FIX-15 OB-timing skipped (best-effort)",
                    exc_info=True,
                )
        payload = {
            "clientOrderId": client_order_id,
            "symbol": symbol,
            "side": side,
            "offsetFlag": str(offset_flag),
            "orderPriceType": order_price_type,
            "origType": "0",
            "resultType": "RESULT",
            "productGroup": product_group,
        }
        if posi_direction is not None:
            payload["posiDirection"] = str(posi_direction)
        if position_side is not None:
            payload["positionSide"] = position_side
        if volume is not None:
            payload["volume"] = _format_number(volume)
        if amount is not None:
            payload["amount"] = _format_number(amount)
        if price is not None:
            payload["price"] = _format_number(price)
        resp = await self._request(
            "POST",
            "/cfd/openApi/v1/prv/placeOrder",
            data=payload,
            private=True,
        )
        if not isinstance(resp, dict):
            raise LBankAPIError("Unexpected placeOrder response format")
        return resp

    async def trader_place_order(
        self,
        *,
        symbol: str,
        side: str,
        client_order_id: str,
        product_group: str,
        order_price_type: str,
        offset_flag: str | int = "0",
        amount: Optional[float] = None,
        volume: Optional[float] = None,
        price: Optional[float] = None,
        posi_direction: Optional[str] = None,
        position_side: Optional[str] = None,
        trade_unit_id: Optional[str] = None,
    ) -> dict:
        if amount is None and volume is None:
            raise ValueError("Either amount or volume must be provided to place a trader order")
        payload = {
            "clientOrderId": client_order_id,
            "symbol": symbol,
            "side": side,
            "offsetFlag": str(offset_flag),
            "orderPriceType": order_price_type,
            "origType": "0",
            "resultType": "RESULT",
            "productGroup": product_group,
        }
        if posi_direction is not None:
            payload["posiDirection"] = str(posi_direction)
        if position_side is not None:
            payload["positionSide"] = position_side
        if trade_unit_id:
            payload["tradeUnitID"] = trade_unit_id
        if volume is not None:
            payload["volume"] = _format_number(volume)
        if amount is not None:
            payload["amount"] = _format_number(amount)
        if price is not None:
            payload["price"] = _format_number(price)
        resp = await self._request(
            "POST",
            "/cfd/openApi/v1/prv/traderPlaceOrder",
            data=payload,
            private=True,
        )
        if not isinstance(resp, dict):
            raise LBankAPIError("Unexpected traderPlaceOrder response format")
        return resp

    async def place_trigger_order(
        self,
        *,
        symbol: str,
        side: str,
        trigger_price: float,
        client_order_id: str,
        product_group: str,
        order_price_type: str,
        amount: Optional[float] = None,
        volume: Optional[float] = None,
        price: Optional[float] = None,
        posi_direction: Optional[str] = None,
        position_side: Optional[str] = None,
    ) -> dict:
        if amount is None and volume is None:
            raise ValueError("Either amount or volume must be provided to place a trigger order")
        payload = {
            "clientOrderId": client_order_id,
            "symbol": symbol,
            "side": side,
            "offsetFlag": "1",
            "orderPriceType": order_price_type,
            "origType": "0",
            "resultType": "RESULT",
            "triggerPrice": _format_number(trigger_price),
            "productGroup": product_group,
        }
        if posi_direction is not None:
            payload["posiDirection"] = str(posi_direction)
        if position_side is not None:
            payload["positionSide"] = position_side
        if volume is not None:
            payload["volume"] = _format_number(volume)
        if amount is not None:
            payload["amount"] = _format_number(amount)
        if price is not None:
            payload["price"] = _format_number(price)
        resp = await self._request(
            "POST",
            "/cfd/openApi/v1/prv/placeTriggerOrder",
            data=payload,
            private=True,
        )
        if not isinstance(resp, dict):
            raise LBankAPIError("Unexpected triggerOrder response format")
        return resp

    async def place_stop_profit_and_loss_order(
        self,
        *,
        instrument_id: str,
        exchange_id: str,
        direction: str,
        offset_flag: str,
        posi_direction: str,
        trigger_price_type: str | int,
        tp_trigger_price: Optional[float] = None,
        sl_trigger_price: Optional[float] = None,
        tp_trigger_rate: Optional[float] = None,
        sl_trigger_rate: Optional[float] = None,
        trigger_price_calc_type: Optional[int] = None,
        volume_rate: Optional[float] = None,
        price: Optional[float] = None,
        volume: Optional[float] = None,
        close_tp_price: Optional[float] = None,
        close_sl_price: Optional[float] = None,
        profit_and_loss_direction: str | int = "0",
        result_type: str = "RESULT",
        order_price_type: str | int = "0",
    ) -> dict:
        payload: Dict[str, Any] = {
            "instrumentID": instrument_id,
            "exchangeID": exchange_id,
            "direction": str(direction),
            "offsetFlag": str(offset_flag),
            "posiDirection": str(posi_direction),
            "triggerPriceType": str(trigger_price_type),
            "triggerOrderType": "2",
            "profitAndLossDirection": str(profit_and_loss_direction),
            "orderPriceType": str(order_price_type),
            "resultType": result_type,
        }
        if tp_trigger_price is not None:
            payload["closeTPTriggerPrice"] = _format_number(tp_trigger_price)
        if sl_trigger_price is not None:
            payload["closeSLTriggerPrice"] = _format_number(sl_trigger_price)
        if tp_trigger_rate is not None:
            payload["tPTriggerRate"] = _format_number(tp_trigger_rate)
        if sl_trigger_rate is not None:
            payload["sLTriggerRate"] = _format_number(sl_trigger_rate)
        if trigger_price_calc_type is not None:
            payload["triggerPriceCalType"] = trigger_price_calc_type
        if volume_rate is not None:
            payload["volumeRate"] = _format_number(volume_rate)
        if price is not None:
            payload["price"] = _format_number(price)
        if volume is not None:
            payload["volume"] = _format_number(volume)
        if close_tp_price is not None:
            payload["closeTPPrice"] = _format_number(close_tp_price)
        if close_sl_price is not None:
            payload["closeSLPrice"] = _format_number(close_sl_price)
        resp = await self._request(
            "POST",
            "/cfd/openApi/v1/prv/placeStopProfitAndLossOrder",
            data=payload,
            private=True,
        )
        if not isinstance(resp, dict):
            raise LBankAPIError("Unexpected placeStopProfitAndLossOrder response format")
        return resp

    async def trader_place_stop_profit_and_loss_order(
        self,
        *,
        instrument_id: str,
        exchange_id: str,
        direction: str,
        offset_flag: str,
        posi_direction: str,
        trigger_price_type: str | int,
        trade_unit_id: str,
        tp_trigger_price: Optional[float] = None,
        sl_trigger_price: Optional[float] = None,
        tp_trigger_rate: Optional[float] = None,
        sl_trigger_rate: Optional[float] = None,
        trigger_price_calc_type: Optional[int] = None,
        volume_rate: Optional[float] = None,
        price: Optional[float] = None,
        volume: Optional[float] = None,
        close_tp_price: Optional[float] = None,
        close_sl_price: Optional[float] = None,
        profit_and_loss_direction: str | int = "0",
        result_type: str = "RESULT",
        order_price_type: str | int = "0",
    ) -> dict:
        payload = {
            "instrumentID": instrument_id,
            "exchangeID": exchange_id,
            "direction": str(direction),
            "offsetFlag": str(offset_flag),
            "posiDirection": str(posi_direction),
            "triggerPriceType": str(trigger_price_type),
            "triggerOrderType": "2",
            "profitAndLossDirection": str(profit_and_loss_direction),
            "orderPriceType": str(order_price_type),
            "tradeUnitID": trade_unit_id,
            "resultType": result_type,
        }
        if tp_trigger_price is not None:
            payload["closeTPTriggerPrice"] = _format_number(tp_trigger_price)
        if sl_trigger_price is not None:
            payload["closeSLTriggerPrice"] = _format_number(sl_trigger_price)
        if tp_trigger_rate is not None:
            payload["tPTriggerRate"] = _format_number(tp_trigger_rate)
        if sl_trigger_rate is not None:
            payload["sLTriggerRate"] = _format_number(sl_trigger_rate)
        if trigger_price_calc_type is not None:
            payload["triggerPriceCalType"] = trigger_price_calc_type
        if volume_rate is not None:
            payload["volumeRate"] = _format_number(volume_rate)
        if price is not None:
            payload["price"] = _format_number(price)
        if volume is not None:
            payload["volume"] = _format_number(volume)
        if close_tp_price is not None:
            payload["closeTPPrice"] = _format_number(close_tp_price)
        if close_sl_price is not None:
            payload["closeSLPrice"] = _format_number(close_sl_price)
        resp = await self._request(
            "POST",
            "/cfd/openApi/v1/prv/traderPlaceStopProfitAndLossOrder",
            data=payload,
            private=True,
        )
        if not isinstance(resp, dict):
            raise LBankAPIError("Unexpected traderPlaceStopProfitAndLossOrder response format")
        return resp

    async def get_fee_rate(self, symbol: str, match_role: str = "0") -> dict:
        params = {"symbol": symbol, "matchRole": str(match_role)}
        resp = await self._request(
            "GET",
            "/cfd/openApi/v1/prv/qryOneFee",
            params=params,
            private=True,
        )
        if not isinstance(resp, dict):
            raise LBankAPIError("Unexpected fee rate response format")
        return resp

    async def get_historical_orders(
        self,
        *,
        product_group: str,
        page_no: int = 1,
        page_size: int = 20,
        order_type: str = "price",
    ) -> dict:
        params = {
            "productGroup": product_group,
            "pageNo": page_no,
            "pageSize": page_size,
            "orderType": order_type,
        }
        resp = await self._request(
            "GET",
            "/cfd/openApi/v1/prv/historyOrder",
            params=params,
            private=True,
        )
        if not isinstance(resp, dict):
            raise LBankAPIError("Unexpected historyOrder response format")
        return resp

    async def set_position_type(self, position_type: str) -> None:
        payload = {"positionType": position_type}
        await self._request(
            "POST",
            "/cfd/openApi/v1/prv/setPositionType",
            data=payload,
            private=True,
        )

    async def get_max_local_id(self, asset: str, product_group: str) -> Optional[str]:
        payload = {"asset": asset, "productGroup": product_group}
        resp = await self._request(
            "POST",
            "/cfd/openApi/v1/prv/getMaxLocalId",
            data=payload,
            private=True,
        )
        if isinstance(resp, dict):
            data = resp.get("data") or resp.get("result") or resp.get("maxLocalId")
            if data is None:
                return None
            return str(data)
        return None

    async def reset_local_id(self, asset: str, product_group: str) -> Optional[str]:
        payload = {"asset": asset, "productGroup": product_group}
        resp = await self._request(
            "POST",
            "/cfd/openApi/v1/prv/resetLocalId",
            data=payload,
            private=True,
        )
        if isinstance(resp, dict):
            data = resp.get("data") or resp.get("result")
            if data is None:
                return None
            return str(data)
        return None

    async def cancel_order(
        self,
        *,
        order_type: str = "price",
        order_id: Optional[str] = None,
        client_order_id: Optional[str] = None,
        symbol: Optional[str] = None,
    ) -> dict:
        payload: Dict[str, Any] = {
            "orderType": order_type,
        }
        if order_id:
            payload["orderId"] = order_id
        if client_order_id:
            payload["clientOrderId"] = client_order_id
        if symbol:
            payload["symbol"] = symbol
        resp = await self._request(
            "POST",
            "/cfd/openApi/v1/prv/cancelOrder",
            data=payload,
            private=True,
        )
        if not isinstance(resp, dict):
            raise LBankAPIError("Unexpected cancelOrder response format")
        return resp

    async def reverse_send_order(
        self,
        *,
        trade_unit_id: str,
        instrument_id: str,
        product_group: str,
        posi_direction: str,
        volume: Optional[float] = None,
        volume_rate: Optional[float] = None,
    ) -> dict:
        if not trade_unit_id or not instrument_id or not product_group:
            raise ValueError("trade_unit_id, instrument_id, and product_group are required for reverse order")
        payload: Dict[str, Any] = {
            "tradeUnitID": trade_unit_id,
            "instrumentID": instrument_id,
            "productGroup": product_group,
            "posiDirection": str(posi_direction),
        }
        if volume is not None:
            payload["volume"] = _format_number(volume)
        if volume_rate is not None:
            payload["volumeRate"] = _format_number(volume_rate)
        resp = await self._request(
            "POST",
            "/cfd/openApi/v1/prv/reverseSendOrder",
            data=payload,
            private=True,
        )
        if not isinstance(resp, dict):
            raise LBankAPIError("Unexpected reverseSendOrder response format")
        return resp


def _normalize_symbol(symbol: str) -> str:
    return normalize_symbol_upper(symbol)


def _normalize_position_type(value: Any) -> str:
    """Return LBank's canonical position mode.

    LBank accepts one-way and hedge mode under several spellings in the
    surrounding configuration/API payloads.  Keep the conversion local so
    this compatibility module remains usable without a missing side-module.
    """
    raw = str(value or "").strip().upper().replace("-", "_").replace(" ", "_")
    if raw in {"1", "ONEWAY", "ONE_WAY", "SINGLE", "SINGLE_SIDE", "BOTH"}:
        return "ONE_WAY"
    return "HEDGE"


def _posi_direction_candidates(direction: str, settings: Dict[str, Any]) -> List[Optional[str]]:
    """Build ordered LBank position-direction candidates for an order.

    ``1`` is the long side and ``2`` is the short side.  A hedge-mode order
    must carry its side; one-way mode can omit it, so ``None`` is tried first
    there and the explicit side is retained as a compatibility fallback.
    """
    side = str(direction or "").strip().upper()
    posi = "1" if side in {"BUY", "LONG", "1"} else "2"
    if _normalize_position_type((settings or {}).get("position_type")) == "ONE_WAY":
        return [None, posi]
    return [posi]


def _apply_trailing_stop(
    db_position: Dict[str, Any],
    *,
    direction: str,
    entry_price: Optional[float],
    current_sl: float,
    enabled: bool,
) -> float:
    """Advance a trailing stop without ever weakening the current stop.

    The position payload may provide ``trailing_distance`` (absolute price)
    or ``trailing_distance_frac`` (fraction of entry).  Missing/invalid
    values intentionally leave the existing stop unchanged.
    """
    if not enabled or entry_price is None or not isinstance(db_position, dict):
        return current_sl
    try:
        entry = float(entry_price)
        stop = float(current_sl)
        distance = db_position.get("trailing_distance")
        if distance is None:
            frac = db_position.get("trailing_distance_frac")
            distance = abs(entry) * float(frac) if frac is not None else None
        if distance is None or float(distance) <= 0:
            return current_sl
        distance = float(distance)
        watermark = db_position.get("high_watermark" if str(direction).lower() in {"long", "buy"} else "low_watermark")
        if watermark is None:
            return current_sl
        candidate = float(watermark) - distance if str(direction).lower() in {"long", "buy"} else float(watermark) + distance
        return max(stop, candidate) if str(direction).lower() in {"long", "buy"} else min(stop, candidate)
    except (TypeError, ValueError):
        return current_sl

