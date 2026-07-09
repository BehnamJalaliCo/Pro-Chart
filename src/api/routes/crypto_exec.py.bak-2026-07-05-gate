"""موتورِ مستقلِ فیوچرزِ کریپتوی Pro-Chart — مستقیم به LBank با کلیدِ خودِ کاربر.
۱۰۰٪ مستقل از تریدیار (فقط از کدِ کلاینتِ آزموده‌اش استفاده می‌کند). پشتِ فلگِ BN_CRYPTO_EXEC_ENABLED.
"""
from __future__ import annotations

import os
import secrets

import aiohttp

from src.api.routes._lbank_futures import LBankClient
from src.core.logger import get_logger

logger = get_logger(__name__)

_PG = "SwapU"


def enabled() -> bool:
    return os.getenv("BN_CRYPTO_EXEC_ENABLED", "0") == "1"


async def _run(api_key: str, api_secret: str, fn):
    session = aiohttp.ClientSession()
    try:
        cl = LBankClient({"api_key": api_key, "api_secret": api_secret,
                          "signature_method": "HmacSHA256", "product_group": _PG}, session)
        return await fn(cl)
    finally:
        await session.close()


def _sym(s: str) -> str:
    return (s or "").upper().replace("/", "").replace("-", "").replace("_", "")


async def open_market(api_key: str, api_secret: str, symbol: str, direction: str,
                      usdt: float, leverage: int = 5) -> dict:
    """باز کردنِ پوزیشنِ market فیوچرز روی حسابِ کاربر (amount = مارجینِ USDT)."""
    if not enabled():
        return {"ok": False, "disabled": True, "note": "اجرای واقعیِ کریپتو موقتاً غیرفعال است."}
    sym = _sym(symbol)
    side = "BUY" if str(direction).lower() in ("buy", "long") else "SELL"
    posi = "1" if side == "BUY" else "2"

    async def go(cl):
        try:
            await cl.set_leverage(symbol=sym, leverage=int(leverage), product_group=_PG, posi_direction=posi)
        except Exception as e:  # noqa: BLE001
            logger.warning("crypto_set_leverage_failed", symbol=sym, error=str(e))
        r = await cl.place_order(symbol=sym, side=side, client_order_id="pc" + secrets.token_hex(6),
                                 product_group=_PG, order_price_type="4", offset_flag="0",
                                 amount=float(usdt), posi_direction=posi)
        return {"ok": True, "resp": r, "symbol": sym, "side": side}
    try:
        return await _run(api_key, api_secret, go)
    except Exception as e:  # noqa: BLE001
        logger.warning("crypto_open_failed", symbol=sym, error=str(e))
        return {"ok": False, "error": str(e)[:200]}


async def positions(api_key: str, api_secret: str, symbol: str | None = None) -> list:
    if not (api_key and api_secret):
        return []
    async def go(cl):
        return await cl.get_positions(_PG, symbol=(_sym(symbol) if symbol else None))
    try:
        return await _run(api_key, api_secret, go) or []
    except Exception as e:  # noqa: BLE001
        logger.warning("crypto_positions_failed", error=str(e))
        return []


async def close_symbol(api_key: str, api_secret: str, symbol: str) -> dict:
    if not enabled():
        return {"ok": False, "disabled": True}
    sym = _sym(symbol)
    async def go(cl):
        pos = await cl.get_positions(_PG, symbol=sym) or []
        results = []
        for p in pos:
            vol = p.get("volume") or p.get("openVolume") or p.get("positionVolume") or p.get("holdVolume")
            if not vol:
                continue
            pd = str(p.get("posiDirection") or "2")
            close_side = "SELL" if pd == "1" else "BUY"
            try:
                r = await cl.place_order(symbol=sym, side=close_side, client_order_id="pc" + secrets.token_hex(6),
                                         product_group=_PG, order_price_type="4", offset_flag="1",
                                         volume=float(vol), posi_direction=pd)
                results.append(r)
            except Exception as e:  # noqa: BLE001
                results.append({"error": str(e)[:150]})
        return {"ok": True, "closed": results}
    try:
        return await _run(api_key, api_secret, go)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)[:200]}
