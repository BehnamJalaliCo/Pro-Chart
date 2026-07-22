"""تریدِ واقعیِ فاز ۵ — REST `/academy/trade/*` + WS `/academy/trade/stream`.

قرارداد (سمتِ اپ): `docs/reverse-engineering/SERVER_HANDOFF_06_trade.md`.

اصول: فقط حسابِ واقعیِ خودِ کاربر روی LBank (اپ هرگز مستقیم وصل نمی‌شود)، با تأییدِ صریح
(`risk_ack`)، Bearerِ کاربر، مهمان → 401. سقف‌های ایمنیِ سرور مرجعِ نهایی‌اند.

رولاوتِ امن-مرحله‌ای (این نسخه):
- `preview` (dry-run، بدونِ ثبت) — کامل و امن.
- `order` فقط **MARKET** (روی `crypto_exec.open_market`ِ گیت‌دار) با idempotency + سقف‌ها.
- `orders`/`history` (خواندنی از `BnOrder`)، WS `trade/stream` (خواندنی: snapshot/position/balance).
- `position/close` (کامل، ۱۰۰٪) روی `crypto_exec.close_symbol`ِ گیت‌دار.
- بقیهٔ مدیریت (limit/stop/cancel/modify/reverse/leverage/margin-mode/partial-close):
  فعلاً **`OP_NOT_ENABLED`** برمی‌گردانند تا کدِ اجرای تست‌نشدهٔ پولِ واقعی منتشر نشود.

⚠️ اجرای زندهٔ کریپتو با `BN_CRYPTO_EXEC_ENABLED` گیت می‌شود (پیش‌فرض خاموش) + kill-switch
(`bn:killswitch`) + گیتِ premium و `referral_verified`.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, WebSocket, WebSocketDisconnect
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

# ── سقف‌های ایمنیِ سرور (مرجعِ نهایی؛ قابلِ override با env) ──
MAX_LEVERAGE = int(os.getenv("BN_TRADE_MAX_LEVERAGE", "125"))
MAX_NOTIONAL_USDT = float(os.getenv("BN_TRADE_MAX_NOTIONAL", "100000"))
MAX_ORDER_SIZE_USDT = float(os.getenv("BN_TRADE_MAX_ORDER_SIZE", "50000"))
TAKER_FEE = float(os.getenv("BN_TRADE_TAKER_FEE", "0.0006"))

CLOSE_UNAUTHORIZED = 4401
CLOSE_BAD_FRAME = 4400
AUTH_TIMEOUT_SECONDS = 5.0
STREAM_POLL_SECONDS = 3.0
PING_EVERY_SECONDS = 20.0
IDEM_TTL_SECONDS = 86400

_SIDES = {"BUY", "SELL"}
_TYPES = {"MARKET", "LIMIT", "STOP_MARKET", "STOP_LIMIT", "TAKE_PROFIT", "TAKE_PROFIT_LIMIT"}
_MARGIN_MODES = {"ISOLATED", "CROSS"}
# انواعِ سفارش/عملیاتی که در این نسخه اجرای واقعی دارند
_ENABLED_TYPES = {"MARKET"}


def _bad(code: str, msg: str, status: int = 400) -> HTTPException:
    return HTTPException(status_code=status, detail={"error_code": code, "message": msg})


def _reject_guest(authorization: Optional[str]) -> None:
    if not authorization or " " not in authorization:
        return
    p = verify_access_token(authorization.split(" ", 1)[1].strip())
    if p and p.get("guest"):
        raise HTTPException(status_code=401, detail={"error_code": "GUEST_FORBIDDEN",
                                                     "message": "ترید برای مهمان در دسترس نیست."})


async def _killswitch_on() -> bool:
    try:
        v = await redis_client.client.get("bn:killswitch")
        return v in (b"1", "1")
    except Exception:  # noqa: BLE001
        return False


async def _lbank_account(st, db: AsyncSession):
    from src.core.database import BnExchangeAccount
    return (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id,
        BnExchangeAccount.kind == "lbank"))).scalar_one_or_none()


async def _live_price(symbol: str) -> Optional[float]:
    for key in (f"bn:cprice:{symbol}", f"price:{symbol}"):
        try:
            payload = await redis_client.get_json(key)
        except Exception:  # noqa: BLE001
            payload = None
        if isinstance(payload, dict):
            for k in ("price", "last", "c", "close", "mid"):
                v = payload.get(k)
                if isinstance(v, (int, float)) and v > 0:
                    return float(v)
            bid, ask = payload.get("bid"), payload.get("ask")
            if isinstance(bid, (int, float)) and isinstance(ask, (int, float)) and bid > 0 and ask > 0:
                return (float(bid) + float(ask)) / 2.0
    return None


def _norm_symbol(raw: Any) -> Optional[str]:
    import re
    if not isinstance(raw, str):
        return None
    s = re.sub(r"[\s/_\-]+", "", raw).upper()
    return s if re.match(r"^[A-Z0-9]{6,20}$", s) else None


async def _keys(a) -> Optional[tuple[str, str]]:
    if not a or not a.enc_key or not a.enc_secret:
        return None
    from src.core.crypto import decrypt_secret
    k, s = decrypt_secret(a.enc_key), decrypt_secret(a.enc_secret)
    return (k, s) if k and s else None


# ── محاسبهٔ ریسک/پیش‌نمایش (بدونِ ثبت) ──
def _compute_preview(*, symbol, side, otype, quantity, price, leverage, margin_mode,
                     available_balance) -> dict:
    warnings: list[str] = []
    lev = int(leverage or 1)
    px = float(price) if price else None
    qty = float(quantity or 0)
    notional = (qty * px) if (px and qty) else None
    margin_required = (notional / lev) if (notional and lev) else None
    fee = (notional * TAKER_FEE) if notional else None
    liq = None
    if px and lev:
        # تقریبِ ISOLATED (تخمینی — تأییدِ نهایی با صرافی)
        liq = px * (1 - 1.0 / lev) if side == "BUY" else px * (1 + 1.0 / lev)

    rejected = False
    reject_reason = None
    if lev > MAX_LEVERAGE:
        rejected, reject_reason = True, f"leverage {lev} از سقفِ سرور ({MAX_LEVERAGE}) بیشتر است."
    elif notional and notional > MAX_NOTIONAL_USDT:
        rejected, reject_reason = True, f"notional از سقفِ سرور ({MAX_NOTIONAL_USDT} USDT) بیشتر است."
    elif margin_required and margin_required > MAX_ORDER_SIZE_USDT:
        rejected, reject_reason = True, f"مارجینِ سفارش از سقفِ سرور ({MAX_ORDER_SIZE_USDT} USDT) بیشتر است."
    elif margin_required and available_balance is not None and margin_required > available_balance:
        rejected, reject_reason = True, "موجودیِ کافی نیست."

    if lev >= 50:
        warnings.append("اهرمِ بالا — ریسکِ لیکویید بالا.")
    if margin_required and available_balance and margin_required > 0.5 * available_balance:
        warnings.append("این سفارش بیش از نیمی از موجودی را درگیر می‌کند.")

    risk_level = "normal"
    if margin_required and available_balance:
        r = margin_required / available_balance
        risk_level = "high" if r > 0.5 else "elevated" if r > 0.25 else "normal"

    out = {
        "margin_required": margin_required,
        "estimated_fee": fee,
        "liquidation_price": liq,
        "position_size": qty or None,
        "notional": notional,
        "available_balance": available_balance,
        "risk_level": risk_level,
        "warnings": warnings,
        "rejected": rejected,
        "reject_reason": reject_reason,
    }
    return {k: v for k, v in out.items() if v is not None or k in ("warnings", "rejected")}


def _validate_body(body: dict) -> dict:
    symbol = _norm_symbol(body.get("symbol"))
    if not symbol:
        raise _bad("BAD_SYMBOL", "نمادِ نامعتبر.")
    side = str(body.get("side") or "").upper()
    if side not in _SIDES:
        raise _bad("BAD_SIDE", "side باید BUY یا SELL باشد.")
    otype = str(body.get("type") or "MARKET").upper()
    if otype not in _TYPES:
        raise _bad("BAD_TYPE", "نوعِ سفارش نامعتبر.")
    market = str(body.get("market") or "FUTURES").upper()
    if market != "FUTURES":
        raise _bad("MARKET_NOT_SUPPORTED", "فعلاً فقط FUTURES پشتیبانی می‌شود.")
    margin_mode = str(body.get("margin_mode") or "ISOLATED").upper()
    if margin_mode not in _MARGIN_MODES:
        raise _bad("BAD_MARGIN_MODE", "margin_mode نامعتبر.")
    try:
        quantity = float(body.get("quantity") or 0)
        leverage = int(body.get("leverage") or 1)
    except (TypeError, ValueError):
        raise _bad("BAD_NUMBER", "quantity/leverage عددی نیست.")
    if quantity <= 0:
        raise _bad("BAD_QUANTITY", "quantity باید مثبت باشد.")
    price = body.get("price")
    return {"symbol": symbol, "side": side, "type": otype, "market": market,
            "margin_mode": margin_mode, "quantity": quantity, "leverage": leverage,
            "price": float(price) if price else None,
            "stop_price": body.get("stop_price"),
            "take_profit": body.get("take_profit"), "stop_loss": body.get("stop_loss"),
            "reduce_only": bool(body.get("reduce_only")), "post_only": bool(body.get("post_only")),
            "risk_ack": bool(body.get("risk_ack")),
            "client_request_id": str(body.get("client_request_id") or "").strip()}


@router.post("/trade/preview")
async def trade_preview(body: dict = Body(...), authorization: Optional[str] = Header(None),
                        st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    p = _validate_body(body)
    px = p["price"] or await _live_price(p["symbol"])
    bal = None
    creds = await _keys(await _lbank_account(st, db))
    if creds:
        from src.api.routes import crypto_exec
        try:
            bal = await crypto_exec.balance(*creds)
        except Exception:  # noqa: BLE001
            bal = None
    return _compute_preview(symbol=p["symbol"], side=p["side"], otype=p["type"],
                            quantity=p["quantity"], price=px, leverage=p["leverage"],
                            margin_mode=p["margin_mode"], available_balance=bal)


@router.post("/trade/order")
async def trade_order(body: dict = Body(...), authorization: Optional[str] = Header(None),
                      st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    p = _validate_body(body)
    crid = p["client_request_id"]
    if not crid:
        raise _bad("MISSING_IDEM", "client_request_id لازم است.")
    if not p["risk_ack"]:
        raise _bad("RISK_ACK_REQUIRED", "برای ثبتِ سفارشِ واقعی باید ریسک را بپذیری (risk_ack).")

    # idempotency
    idem_key = f"bn:trade:idem:{st.id}:{crid}"
    try:
        cached = await redis_client.get_json(idem_key)
        if cached:
            return cached
    except Exception:  # noqa: BLE001
        pass

    if p["type"] not in _ENABLED_TYPES:
        raise _bad("OP_NOT_ENABLED",
                   f"نوعِ {p['type']} هنوز فعال نیست؛ فعلاً فقط MARKET. (بعد از تستِ واقعی فعال می‌شود.)")

    if await _killswitch_on():
        raise _bad("KILLSWITCH", "اجرای معاملات موقتاً توسطِ مدیر متوقف شده است.", status=503)

    a = await _lbank_account(st, db)
    if not a or a.status != "active":
        raise _bad("CONNECT_REQUIRED", "ابتدا حساب LBank را وصل کن.")
    if not a.referral_verified:
        raise _bad("REFERRAL_REQUIRED", "برای تریدِ واقعی باید زیرمجموعهٔ رفرالِ ما تأیید شوی.", status=403)
    creds = await _keys(a)
    if not creds:
        raise _bad("BAD_KEYS", "کلیدِ API نامعتبر؛ دوباره وصل کن.")

    # سقف‌ها روی همان محاسبهٔ preview
    from src.api.routes import crypto_exec
    bal = None
    try:
        bal = await crypto_exec.balance(*creds)
    except Exception:  # noqa: BLE001
        bal = None
    px = p["price"] or await _live_price(p["symbol"])
    pv = _compute_preview(symbol=p["symbol"], side=p["side"], otype=p["type"], quantity=p["quantity"],
                          price=px, leverage=p["leverage"], margin_mode=p["margin_mode"],
                          available_balance=bal)
    if pv.get("rejected"):
        raise _bad("RISK_REJECTED", pv.get("reject_reason") or "سفارش توسطِ کنترلِ ریسک رد شد.")

    from src.core.database import BnOrder
    margin_usdt = pv.get("margin_required") or p["quantity"]  # amount = مارجینِ USDT (سازگار با open_market)
    order = BnOrder(student_id=st.id, market="crypto", broker="LBank", account_ref=a.account_ref,
                    symbol=p["symbol"], side=p["side"].lower(), amount=float(margin_usdt),
                    price=p["price"], sl=p["stop_loss"], tp=p["take_profit"], status="pending")
    db.add(order)
    await db.flush()

    res = await crypto_exec.open_market(creds[0], creds[1], p["symbol"], p["side"].lower(),
                                        float(margin_usdt), int(p["leverage"]))
    now_iso = datetime.now(timezone.utc).isoformat()
    if res.get("disabled"):
        order.status = "failed"; order.error = "crypto_exec_disabled"
        await db.commit()
        raise _bad("EXEC_DISABLED", "اجرای واقعیِ کریپتو روی سرور خاموش است (BN_CRYPTO_EXEC_ENABLED).", status=503)
    if res.get("ok"):
        order.status = "filled"
        r = res.get("resp") or {}
        order.broker_order_id = str(r.get("orderId") or r.get("data") or r.get("clientOrderId") or "")[:64]
        await db.commit()
        out = {"order_id": str(order.id), "client_request_id": crid, "status": "filled",
               "symbol": p["symbol"], "side": p["side"], "type": p["type"], "price": p["price"],
               "avg_fill_price": px, "filled_quantity": p["quantity"], "quantity": p["quantity"],
               "created_at": now_iso}
        try:
            await redis_client.client.set(idem_key, json.dumps(out), ex=IDEM_TTL_SECONDS)
        except Exception:  # noqa: BLE001
            pass
        logger.info("bn_trade_order_filled", sid=st.id, sym=p["symbol"], side=p["side"])
        return out
    order.status = "failed"; order.error = str(res.get("error") or "")[:255]
    await db.commit()
    return {"order_id": str(order.id), "client_request_id": crid, "status": "rejected",
            "symbol": p["symbol"], "side": p["side"], "type": p["type"],
            "reject_reason": res.get("error") or "سفارشِ LBank ناموفق بود.", "created_at": now_iso}


# ── مدیریت: فعلاً فقط position/close کامل فعال است ──
@router.post("/position/close")
async def position_close(symbol: str = Body(..., embed=True), percent: float = Body(100.0, embed=True),
                         authorization: Optional[str] = Header(None),
                         st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    sym = _norm_symbol(symbol)
    if not sym:
        raise _bad("BAD_SYMBOL", "نمادِ نامعتبر.")
    if float(percent) < 100:
        raise _bad("OP_NOT_ENABLED", "بستنِ جزئی هنوز فعال نیست؛ فعلاً فقط بستنِ کامل (۱۰۰٪).")
    if await _killswitch_on():
        raise _bad("KILLSWITCH", "اجرای معاملات متوقف است.", status=503)
    creds = await _keys(await _lbank_account(st, db))
    if not creds:
        raise _bad("CONNECT_REQUIRED", "حساب LBank وصل نیست.")
    from src.api.routes import crypto_exec
    res = await crypto_exec.close_symbol(creds[0], creds[1], sym)
    if isinstance(res, dict) and res.get("disabled"):
        raise _bad("EXEC_DISABLED", "اجرای واقعی خاموش است.", status=503)
    return {"symbol": sym, "closed": bool(isinstance(res, dict) and res.get("ok", True)), "result": res}


def _not_enabled():
    raise _bad("OP_NOT_ENABLED", "این عملیات هنوز فعال نیست (بعد از تستِ واقعیِ فاز۵ فعال می‌شود).")


@router.post("/order/cancel")
async def order_cancel(order_id: str = Body(..., embed=True), authorization: Optional[str] = Header(None),
                       st=Depends(current_student)):
    _reject_guest(authorization); _not_enabled()


@router.post("/order/cancel-all")
async def order_cancel_all(symbol: Optional[str] = Body(None, embed=True),
                           authorization: Optional[str] = Header(None), st=Depends(current_student)):
    _reject_guest(authorization); _not_enabled()


@router.post("/order/modify")
async def order_modify(body: dict = Body(...), authorization: Optional[str] = Header(None),
                       st=Depends(current_student)):
    _reject_guest(authorization); _not_enabled()


@router.post("/position/modify")
async def position_modify(body: dict = Body(...), authorization: Optional[str] = Header(None),
                          st=Depends(current_student)):
    _reject_guest(authorization); _not_enabled()


@router.post("/position/reverse")
async def position_reverse(symbol: str = Body(..., embed=True), authorization: Optional[str] = Header(None),
                           st=Depends(current_student)):
    _reject_guest(authorization); _not_enabled()


@router.post("/leverage")
async def set_leverage_ep(body: dict = Body(...), authorization: Optional[str] = Header(None),
                          st=Depends(current_student)):
    _reject_guest(authorization); _not_enabled()


@router.post("/margin-mode")
async def set_margin_mode_ep(body: dict = Body(...), authorization: Optional[str] = Header(None),
                             st=Depends(current_student)):
    _reject_guest(authorization); _not_enabled()


# ── تاریخچه/سفارش‌ها (خواندنی از BnOrder) ──
def _order_row(o) -> dict:
    return {"order_id": str(o.id), "symbol": o.symbol, "side": (o.side or "").upper(),
            "amount": o.amount, "price": o.price, "status": o.status,
            "broker_order_id": o.broker_order_id,
            "stop_loss": o.sl, "take_profit": o.tp,
            "created_at": o.created_at.isoformat() if o.created_at else None}


@router.get("/trade/orders")
async def trade_orders(status: str = "open", authorization: Optional[str] = Header(None),
                       st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    from src.core.database import BnOrder
    q = select(BnOrder).where(BnOrder.student_id == st.id, BnOrder.market == "crypto")
    if status == "open":
        q = q.where(BnOrder.status.in_(("pending", "sent")))
    rows = (await db.execute(q.order_by(BnOrder.id.desc()).limit(200))).scalars().all()
    return {"orders": [_order_row(o) for o in rows]}


@router.get("/trade/history")
async def trade_history(authorization: Optional[str] = Header(None),
                        st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    from src.core.database import BnOrder
    rows = (await db.execute(select(BnOrder).where(
        BnOrder.student_id == st.id, BnOrder.market == "crypto",
        BnOrder.status.in_(("filled", "failed", "canceled"))
    ).order_by(BnOrder.id.desc()).limit(200))).scalars().all()
    return {"history": [_order_row(o) for o in rows]}


# ── WebSocket (خواندنی: snapshot + position/balance) ──
async def _build_trade_snapshot(st, db: AsyncSession) -> dict:
    from src.core.database import BnOrder
    creds = await _keys(await _lbank_account(st, db))
    positions: list = []
    balance = None
    if creds:
        from src.api.routes import crypto_exec
        try:
            balance = await crypto_exec.balance(*creds)
        except Exception:  # noqa: BLE001
            balance = None
        try:
            positions = await crypto_exec.positions(*creds) or []
        except Exception:  # noqa: BLE001
            positions = []
    open_rows = (await db.execute(select(BnOrder).where(
        BnOrder.student_id == st.id, BnOrder.market == "crypto",
        BnOrder.status.in_(("pending", "sent"))).order_by(BnOrder.id.desc()).limit(100))).scalars().all()
    risk = {"open_positions": len(positions), "margin_available": balance,
            "risk_level": "normal"}
    return {"positions": positions, "open_orders": [_order_row(o) for o in open_rows],
            "balance": balance, "risk": risk}


async def _authenticate(ws: WebSocket) -> Optional[dict]:
    token = ws.query_params.get("token")
    if not token:
        try:
            msg = json.loads(await asyncio.wait_for(ws.receive_text(), timeout=AUTH_TIMEOUT_SECONDS))
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
        return None
    return payload


@router.websocket("/trade/stream")
async def trade_stream(ws: WebSocket) -> None:
    await ws.accept()
    payload = await _authenticate(ws)
    if payload is None:
        await ws.close(code=CLOSE_UNAUTHORIZED)
        return
    sid = int(payload.get("sid", 0) or 0)
    token_exp = payload.get("exp")
    from src.core.database import AcademyStudent
    async with async_session_factory() as db:
        st = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    if st is None:
        await ws.close(code=CLOSE_UNAUTHORIZED)
        return

    async def send(obj: dict) -> bool:
        if ws.client_state != WebSocketState.CONNECTED:
            return False
        try:
            await ws.send_json(obj)
            return True
        except Exception:  # noqa: BLE001
            return False

    async def snapshot() -> dict:
        async with async_session_factory() as db:
            return await _build_trade_snapshot(st, db)

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
        data = await snapshot()
        await send({"type": "snapshot", **{k: data[k] for k in data}})
        last = json.dumps(data, sort_keys=True, default=str)
        last_bal = data.get("balance")
        last_ping = time.time()
        while True:
            if ws.client_state != WebSocketState.CONNECTED:
                break
            now = time.time()
            if token_exp and now >= float(token_exp):
                await ws.close(code=CLOSE_UNAUTHORIZED)
                break
            cur = await snapshot()
            sig = json.dumps(cur, sort_keys=True, default=str)
            if sig != last:
                last = sig
                await send({"type": "position", "positions": cur.get("positions", [])})
                if cur.get("balance") != last_bal:
                    last_bal = cur.get("balance")
                    await send({"type": "balance", "balance": last_bal})
                await send({"type": "order", "open_orders": cur.get("open_orders", [])})
            if now - last_ping >= PING_EVERY_SECONDS:
                last_ping = now
                await send({"type": "ping"})
            await asyncio.sleep(STREAM_POLL_SECONDS)

    recv_task = asyncio.create_task(receive_loop())
    stream_task = asyncio.create_task(stream_loop())
    try:
        await asyncio.wait({recv_task, stream_task}, return_when=asyncio.FIRST_COMPLETED)
    except Exception as exc:  # noqa: BLE001
        logger.error("trade_stream_error", error=str(exc))
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
