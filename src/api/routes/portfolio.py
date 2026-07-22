"""پرتفویِ زندهٔ فاز ۴ — REST `/academy/portfolio/live` + WS `/academy/portfolio/stream`.

قرارداد (سمتِ اپ): `docs/reverse-engineering/SERVER_HANDOFF_05_portfolio.md`.

اصول: فقط حسابِ واقعی (هیچ دمو)، فقط‌نمایشی، پایهٔ USDT، اعدادِ خام، **fail-soft**
(هر بخش/فیلدِ نبود حذف می‌شود). مهمان → 401.

منبعِ داده روی این پروداکشن:
- کریپتو: **واقعی** — LBank فیوچرز (SwapU) با کلیدِ رمزنگاری‌شدهٔ کاربر (`BnExchangeAccount`،
  `crypto_exec.balance()` / `.positions()`). نیازِ کاربرِ premium با کلیدِ متصل.
- فارکس/بروکر (MT5): **منبعِ per-user ندارد** (`connect/mt5`→410، referral-only) → حذف (fail-soft).
- تاریخچه/آنالیتیکس (performance، sharpe، max_drawdown، realized pnl): ذخیرهٔ تاریخیِ پرتفوی
  وجود ندارد → حذف (fail-soft).
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.websockets import WebSocketState

from src.api.deps import get_db
from src.api.routes.academy import current_student
from src.core.database import async_session_factory
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.core.security import verify_access_token

logger = get_logger(__name__)
router = APIRouter()

CLOSE_UNAUTHORIZED = 4401
CLOSE_BAD_FRAME = 4400
CLOSE_RETRY = 1013
AUTH_TIMEOUT_SECONDS = 5.0
TICK_POLL_SECONDS = 2.0
UPDATE_EVERY_SECONDS = 15.0
PING_EVERY_SECONDS = 20.0
OPEN_POSITION_LIMIT = 20


# ── کمکِ استخراجِ عدد از payloadِ خامِ صرافی (چند کلیدِ کاندید، fail-soft) ──
def _num(d: dict, *keys: str) -> Optional[float]:
    for k in keys:
        v = d.get(k)
        if v is None:
            continue
        try:
            return float(v)
        except (TypeError, ValueError):
            continue
    return None


def _drop_none(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


def _extract_price(payload: Any) -> Optional[float]:
    if isinstance(payload, dict):
        for k in ("price", "last", "c", "close", "mid"):
            v = payload.get(k)
            if isinstance(v, (int, float)) and v > 0:
                return float(v)
        bid, ask = payload.get("bid"), payload.get("ask")
        if isinstance(bid, (int, float)) and isinstance(ask, (int, float)) and bid > 0 and ask > 0:
            return (float(bid) + float(ask)) / 2.0
        return None
    try:
        return float(payload)
    except (TypeError, ValueError):
        return None


async def _live_price(symbol: str) -> Optional[float]:
    for key in (f"bn:cprice:{symbol}", f"price:{symbol}"):
        try:
            p = _extract_price(await redis_client.get_json(key))
            if p:
                return p
        except Exception:  # noqa: BLE001
            continue
    return None


def _map_position(raw: dict) -> Optional[dict]:
    """پوزیشنِ خامِ LBank → شکلِ قرارداد (fail-soft: فیلدِ نبود حذف)."""
    if not isinstance(raw, dict):
        return None
    symbol = raw.get("symbol") or raw.get("instrument") or raw.get("contract")
    if not symbol:
        return None
    side_raw = str(raw.get("side") or raw.get("posiDirection") or raw.get("direction") or "").lower()
    side = ("long" if side_raw in ("1", "long", "buy", "bid", "openlong")
            else "short" if side_raw in ("2", "short", "sell", "ask", "openshort") else None)
    size = _num(raw, "volume", "positionVolume", "size", "qty", "amount", "holdVolume", "positionQty")
    entry = _num(raw, "avgPrice", "entryPrice", "openPrice", "costPrice", "avgEntryPrice", "openAvgPrice")
    mark = _num(raw, "markPrice", "marketPrice", "lastPrice", "fairPrice", "indexPrice")
    lev = _num(raw, "leverage", "lever", "leverageLevel", "leverageRatio")
    margin = _num(raw, "margin", "positionMargin", "marginUsed", "imr", "initMargin", "initialMargin")
    upnl = _num(raw, "unrealizedPnl", "unrealisedPnl", "upl", "unrealizedProfit", "floatingPnl", "profit")
    liq = _num(raw, "liquidationPrice", "liqPrice", "forceClosePrice", "bankruptPrice")
    sl = _num(raw, "stopLoss", "slPrice", "stopLossPrice", "sl")
    tp = _num(raw, "takeProfit", "tpPrice", "takeProfitPrice", "tp")
    upnl_pct = (upnl / margin * 100.0) if (upnl is not None and margin) else None
    return _drop_none({
        "id": str(raw.get("positionId") or raw.get("id") or raw.get("posId") or symbol),
        "symbol": symbol,
        "source": "exchange",
        "side": side,
        "size": size,
        "leverage": lev,
        "entry_price": entry,
        "current_price": mark,
        "stop_loss": sl,
        "take_profit": tp,
        "liquidation_price": liq,
        "margin_used": margin,
        "unrealized_pnl": upnl,
        "unrealized_pnl_percent": upnl_pct,
    })


async def _lbank_keys(st, db: AsyncSession) -> Optional[tuple[str, str]]:
    from src.core.database import BnExchangeAccount
    from src.core.crypto import decrypt_secret
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id,
        BnExchangeAccount.kind == "lbank"))).scalar_one_or_none()
    if not a or not a.enc_key or not a.enc_secret or (a.status and a.status != "active"):
        return None
    key = decrypt_secret(a.enc_key)
    secret = decrypt_secret(a.enc_secret)
    if not key or not secret:
        return None
    return key, secret


async def build_portfolio(st, db: AsyncSession) -> dict:
    """پرتفویِ زنده — fail-soft. بخش‌های بدونِ منبع حذف می‌شوند."""
    out: dict = {"currency": "USDT",
                 "updated_at": datetime.now(timezone.utc).isoformat()}

    creds = await _lbank_keys(st, db)
    positions: list[dict] = []
    available_cash: Optional[float] = None
    if creds:
        from src.api.routes import crypto_exec
        key, secret = creds
        try:
            available_cash = await crypto_exec.balance(key, secret)
        except Exception:  # noqa: BLE001
            available_cash = None
        try:
            raw_positions = await crypto_exec.positions(key, secret) or []
        except Exception:  # noqa: BLE001
            raw_positions = []
        for raw in raw_positions:
            mapped = _map_position(raw)
            if mapped:
                # پرکردنِ current_price از Redis اگر صرافی نداد
                if "current_price" not in mapped:
                    lp = await _live_price(mapped["symbol"])
                    if lp:
                        mapped["current_price"] = lp
                positions.append(mapped)

    unrealized = sum(p["unrealized_pnl"] for p in positions if "unrealized_pnl" in p)
    margin_used = sum(p["margin_used"] for p in positions if "margin_used" in p)
    gross = 0.0
    for p in positions:
        size, px = p.get("size"), p.get("current_price") or p.get("entry_price")
        if size is not None and px is not None:
            gross += abs(size * px)

    # overview — فقط فیلدهای قابل‌اتکا (بقیه fail-soft حذف)
    overview = {}
    if available_cash is not None:
        overview["available_cash"] = available_cash
        overview["total_value"] = available_cash + unrealized  # اکوییتی ≈ نقد + PnLِ باز
    if positions:
        overview["unrealized_pnl"] = unrealized
    if overview:
        out["overview"] = overview

    if positions:
        out["positions"] = positions

    # risk — فقط اگر داده‌ای هست
    risk = {"open_positions": len(positions), "open_position_limit": OPEN_POSITION_LIMIT}
    if margin_used:
        risk["margin_used"] = margin_used
    if available_cash is not None:
        risk["margin_available"] = available_cash
    if gross:
        risk["gross_exposure"] = gross
    if margin_used and available_cash:
        ratio = margin_used / (margin_used + available_cash)
        risk["margin_level_percent"] = round(ratio * 100.0, 2)
        risk["risk_level"] = "high" if ratio > 0.5 else "elevated" if ratio > 0.25 else "normal"
    else:
        risk["risk_level"] = "normal"
    out["risk"] = risk

    # holdings[] (اسپاتِ per-asset): منبعِ اسپات نداریم → حذف (fail-soft).
    # performance[]/analytics{}: ذخیرهٔ تاریخی نداریم → حذف (fail-soft).
    return out


def _reject_guest(authorization: Optional[str]) -> None:
    if not authorization or " " not in authorization:
        return
    p = verify_access_token(authorization.split(" ", 1)[1].strip())
    if p and p.get("guest"):
        raise HTTPException(status_code=401, detail="پرتفوی برای مهمان در دسترس نیست.")


@router.get("/portfolio/live")
async def portfolio_live(authorization: Optional[str] = Header(None),
                         st=Depends(current_student),
                         db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    return await build_portfolio(st, db)


# ── WebSocket ──
def _symbols_of(data: dict) -> list[str]:
    return [p["symbol"] for p in data.get("positions", []) if p.get("symbol")]


def _signature(data: dict) -> str:
    """امضای پوزیشن/موجودی برای تشخیصِ تغییرِ ساختاری (نه صرفِ قیمت)."""
    parts = [str(data.get("overview", {}).get("available_cash"))]
    for p in data.get("positions", []):
        parts.append(f"{p.get('id')}:{p.get('size')}:{p.get('side')}")
    return "|".join(parts)


async def _authenticate(ws: WebSocket) -> Optional[dict]:
    token = ws.query_params.get("token")
    if not token:
        try:
            raw = await asyncio.wait_for(ws.receive_text(), timeout=AUTH_TIMEOUT_SECONDS)
            msg = json.loads(raw)
        except Exception:  # noqa: BLE001
            return None
        if not isinstance(msg, dict) or msg.get("type") != "auth":
            return None
        token = msg.get("token")
    if not isinstance(token, str) or not token:
        return None
    payload = verify_access_token(token)
    if not payload:
        return None
    from src.core.config import settings
    central = bool(getattr(settings, "CENTRAL_AUTH_ENABLED", False)) and payload.get("scope") == "app"
    if payload.get("scope") != "academy" and not central:
        return None
    if payload.get("guest"):
        return None  # مهمان بدون پرتفوی
    return payload


async def _load_student(sid: int):
    from src.core.database import AcademyStudent
    async with async_session_factory() as db:
        return (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()


@router.websocket("/portfolio/stream")
async def portfolio_stream(ws: WebSocket) -> None:
    await ws.accept()
    payload = await _authenticate(ws)
    if payload is None:
        await ws.close(code=CLOSE_UNAUTHORIZED)
        return
    sid = int(payload.get("sid", 0) or 0)
    token_exp = payload.get("exp")
    st = await _load_student(sid) if sid > 0 else None
    if st is None:
        await ws.close(code=CLOSE_UNAUTHORIZED)
        return

    async def snapshot() -> dict:
        async with async_session_factory() as db:
            return await build_portfolio(st, db)

    last_prices: dict[str, float] = {}
    last_sig = ""

    async def send(obj: dict) -> bool:
        if ws.client_state != WebSocketState.CONNECTED:
            return False
        try:
            await ws.send_json(obj)
            return True
        except Exception:  # noqa: BLE001
            return False

    async def receive_loop() -> None:
        while True:
            try:
                raw = await ws.receive_text()
            except (WebSocketDisconnect, Exception):  # noqa: BLE001
                break
            try:
                msg = json.loads(raw)
            except Exception:  # noqa: BLE001
                await ws.close(code=CLOSE_BAD_FRAME)
                break
            if isinstance(msg, dict) and msg.get("type") == "ping":
                await send({"type": "pong"})

    async def stream_loop() -> None:
        nonlocal last_prices, last_sig
        data = await snapshot()
        last_sig = _signature(data)
        for s in _symbols_of(data):
            p = await _live_price(s)
            if p:
                last_prices[s] = p
        await send({"type": "snapshot", "data": data})

        last_update = time.time()
        last_ping = time.time()
        while True:
            if ws.client_state != WebSocketState.CONNECTED:
                break
            now = time.time()
            if token_exp and now >= float(token_exp):
                await ws.close(code=CLOSE_UNAUTHORIZED)
                break

            # tick — قیمتِ نمادهای پرتفوی؛ فقط تغییرها
            changed: dict[str, float] = {}
            for s in list(last_prices.keys()) or _symbols_of(data):
                p = await _live_price(s)
                if p and last_prices.get(s) != p:
                    last_prices[s] = p
                    changed[s] = p
            if changed:
                await send({"type": "tick", "prices": changed})

            # update — تغییرِ ساختاریِ پوزیشن/موجودی
            if now - last_update >= UPDATE_EVERY_SECONDS:
                last_update = now
                data = await snapshot()
                sig = _signature(data)
                if sig != last_sig:
                    last_sig = sig
                    for s in _symbols_of(data):
                        p = await _live_price(s)
                        if p:
                            last_prices[s] = p
                    await send({"type": "update", "data": data})

            if now - last_ping >= PING_EVERY_SECONDS:
                last_ping = now
                await send({"type": "ping"})

            await asyncio.sleep(TICK_POLL_SECONDS)

    recv_task = asyncio.create_task(receive_loop())
    stream_task = asyncio.create_task(stream_loop())
    try:
        await asyncio.wait({recv_task, stream_task}, return_when=asyncio.FIRST_COMPLETED)
    except Exception as exc:  # noqa: BLE001
        logger.error("portfolio_stream_error", error=str(exc))
    finally:
        for task in (recv_task, stream_task):
            if not task.done():
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):  # noqa: BLE001
                    pass
        if ws.client_state == WebSocketState.CONNECTED:
            try:
                await ws.close()
            except Exception:  # noqa: BLE001
                pass
