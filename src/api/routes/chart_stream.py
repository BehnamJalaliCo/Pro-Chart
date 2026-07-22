"""وب‌سوکتِ استریمِ زندهٔ چارت — `/academy/chart/stream`.

قرارداد (سمتِ اپ): `docs/reverse-engineering/SERVER_HANDOFF_03_chart_websocket.md`.

منطق:
- احراز با همان JWTِ آکادمی (از `?token=` یا اولین فریمِ `{"type":"auth"}`)؛ مهمان مجاز/فقط‌خواندنی.
- `subscribe {symbol,timeframe}` → یک `snapshot` (تا ۲۰۰۰ کندل) و سپس `candle{closed:false}`/`candle{closed:true}`.
- `subscribe_prices {symbols[]}` → `tick {price,ts(ms)}` برای واچ‌لیست.
- کندل و tick دقیقاً هم‌شکلِ REST `academy/chart/{symbol}` هستند: کلیدهای `t,o,h,l,c,v`؛ `t` = epoch **ثانیه**؛ `tick.ts` = epoch **میلی‌ثانیه**.

⚠️ کادنسِ داده = منبعِ بالادست: فارکس هر ~۳۰s (yfinance→Redis `price:{sym}`)، کریپتو سریع‌تر
(LBank ws→Redis `bn:cprice:{sym}`). این اندپوینت به‌محضِ رسیدنِ قیمتِ جدید fan-out می‌کند
(تأخیرِ transport ده‌ها میلی‌ثانیه)، اما دادهٔ تازه فقط با همان کادنسِ بالادست می‌آید.
"""

from __future__ import annotations

import asyncio
import re
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from src.core.database import async_session_factory
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.core.security import verify_access_token

logger = get_logger(__name__)
router = APIRouter()

# ثانیهٔ هر تایم‌فریم — برای مرزِ کندلِ درحال‌شکل‌گیری (بازچینی روی مرزِ ساعتِ دیوار)
_TF_SECONDS: dict[str, int] = {
    "M1": 60, "M5": 300, "M15": 900, "M30": 1800,
    "H1": 3600, "H2": 7200, "H4": 14400, "H8": 28800, "H12": 43200,
    "D1": 86400, "W1": 604800, "MN": 2592000,
}

_SYMBOL_RE = re.compile(r"^[A-Z0-9]{6,20}$")
_SEP_RE = re.compile(r"[\s/_\-]+")

# WS close codes — تنها مسیرِ اعلامِ خطا (دیتاپلین هیچ فریمِ error نمی‌دهد)
CLOSE_UNAUTHORIZED = 4401   # توکنِ نبود/نامعتبر/منقضی
CLOSE_TIER = 4403           # نمادِ ویژهٔ VIP برای این توکن (فعلاً استفاده نمی‌شود؛ چارت آزاد است)
CLOSE_BAD_FRAME = 4400      # فریمِ خراب (JSON نامعتبر)
CLOSE_RETRY = 1013          # بعداً تلاش کن

AUTH_TIMEOUT_SECONDS = 5.0
POLL_SECONDS = 1.0          # هر ۱ثانیه Redis را می‌خوانیم (Redis محلی؛ ارزان). سقفِ واقعی = کادنسِ بالادست.
STALE_AFTER_SECONDS = 120   # اگر قیمت > این مدت تغییر نکرد → status:stale (بازارِ بسته/لگ)
SNAPSHOT_LIMIT = 2000
MAX_PRICE_SYMBOLS = 50
MAX_CHART_SUBS = 20


def _norm_symbol(raw: Any) -> Optional[str]:
    """بزرگ، بدونِ جداکننده؛ `^[A-Z0-9]{6,20}$` — همان نرمال‌سازیِ کلاینت."""
    if not isinstance(raw, str):
        return None
    s = _SEP_RE.sub("", raw).upper()
    return s if _SYMBOL_RE.match(s) else None


def _extract_price(payload: Any) -> Optional[float]:
    """قیمتِ منفرد از payloadِ Redis (فارکس bid/ask یا کریپتو price/last/close)."""
    if not isinstance(payload, dict):
        try:
            return float(payload)  # مقدارِ خام
        except (TypeError, ValueError):
            return None
    for key in ("price", "last", "c", "close", "mid"):
        v = payload.get(key)
        if isinstance(v, (int, float)) and v > 0:
            return float(v)
    bid, ask = payload.get("bid"), payload.get("ask")
    if isinstance(bid, (int, float)) and isinstance(ask, (int, float)) and bid > 0 and ask > 0:
        return (float(bid) + float(ask)) / 2.0
    return None


async def _read_live_price(symbol: str, is_crypto: bool) -> Optional[float]:
    """قیمتِ لحظه‌ایِ فعلی از Redis. فارکس: `price:{sym}`. کریپتو: `bn:cprice:{sym}`."""
    try:
        key = f"bn:cprice:{symbol}" if is_crypto else f"price:{symbol}"
        payload = await redis_client.get_json(key)
        return _extract_price(payload)
    except Exception:  # noqa: BLE001
        return None


async def _load_snapshot(symbol: str, timeframe: str) -> list[dict]:
    """کندل‌های snapshot — همان مسیرِ دادهٔ REST (فارکس: جدولِ candles؛ کریپتو: LBank)."""
    from src.api.routes._crypto_feed import is_crypto, crypto_klines
    if is_crypto(symbol):
        try:
            return await crypto_klines(symbol, timeframe, limit=SNAPSHOT_LIMIT)
        except Exception:  # noqa: BLE001
            return []
    from src.api.routes.academy import _chart_rows
    async with async_session_factory() as db:
        return await _chart_rows(db, symbol, timeframe, limit=SNAPSHOT_LIMIT)


def _bar_start(now: float, tf_seconds: int) -> int:
    return int(now // tf_seconds) * tf_seconds


class _FormingCandle:
    """وضعیتِ کندلِ درحال‌شکل‌گیری برای یک (نماد، تایم‌فریم)."""

    __slots__ = ("tf_seconds", "cur", "last_change", "stale")

    def __init__(self, tf_seconds: int, seed: Optional[dict]) -> None:
        self.tf_seconds = tf_seconds
        self.cur: Optional[dict] = dict(seed) if seed else None
        self.last_change: float = time.time()
        self.stale: bool = False

    def on_price(self, price: float, now: float) -> list[dict]:
        """قیمتِ جدید → فریم(های) candle. کندلِ بسته‌شده قبل از کندلِ جدید می‌آید."""
        frames: list[dict] = []
        bar = _bar_start(now, self.tf_seconds)
        if self.cur is None:
            self.cur = {"t": bar, "o": price, "h": price, "l": price, "c": price, "v": 0.0}
            self.last_change = now
            return [{"closed": False, "candle": dict(self.cur)}]
        if bar > self.cur["t"]:
            # کندلِ قبلی بسته شد
            frames.append({"closed": True, "candle": dict(self.cur)})
            self.cur = {"t": bar, "o": price, "h": price, "l": price, "c": price, "v": 0.0}
            self.last_change = now
            frames.append({"closed": False, "candle": dict(self.cur)})
            return frames
        # همان کندل — به‌روزرسانیِ درجا
        changed = price != self.cur["c"]
        self.cur["c"] = price
        if price > self.cur["h"]:
            self.cur["h"] = price
        if price < self.cur["l"]:
            self.cur["l"] = price
        if changed:
            self.last_change = now
            frames.append({"closed": False, "candle": dict(self.cur)})
        return frames


class _Client:
    """وضعیتِ یک اتصال."""

    def __init__(self, ws: WebSocket) -> None:
        self.ws = ws
        self.chart_subs: dict[tuple[str, str], _FormingCandle] = {}
        self.price_subs: set[str] = set()
        self.last_tick: dict[str, float] = {}
        self.token_exp: Optional[int] = None

    async def send(self, obj: dict) -> bool:
        if self.ws.client_state != WebSocketState.CONNECTED:
            return False
        try:
            await self.ws.send_json(obj)
            return True
        except Exception:  # noqa: BLE001
            return False


async def _authenticate(ws: WebSocket) -> Optional[dict]:
    """توکن از `?token=` یا اولین فریمِ `{"type":"auth","token":...}`؛ payload یا None."""
    token = ws.query_params.get("token")
    if not token:
        try:
            raw = await asyncio.wait_for(ws.receive_text(), timeout=AUTH_TIMEOUT_SECONDS)
        except (asyncio.TimeoutError, WebSocketDisconnect, Exception):  # noqa: BLE001
            return None
        try:
            import json
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
    # همان قاعدهٔ current_student: scope باید academy باشد (یا app در حالتِ SSO مرکزی)
    from src.core.config import settings
    central = bool(getattr(settings, "CENTRAL_AUTH_ENABLED", False)) and payload.get("scope") == "app"
    if payload.get("scope") != "academy" and not central:
        return None
    return payload


@router.get("/chart/education/{tool_id}")
async def chart_education(tool_id: str) -> dict:
    """مقالهٔ آموزشیِ ابزار برای دکمهٔ «؟».

    استابِ فعلی: محتوای آموزشی هم‌اکنون سمتِ اپ سرو می‌شود (۱۷۷ مدخلِ دوزبانه در
    `src/bazaarnama/help/*.js`). این مسیر تا آماده‌شدنِ کورپوسِ سرور، **۴۰۴ نرم** می‌دهد
    (کلاینت fail-soft است و به محتوای محلیِ خود برمی‌گردد).
    """
    raise HTTPException(status_code=404, detail="مقالهٔ آموزشیِ این ابزار روی سرور هنوز آماده نیست.")


@router.websocket("/chart/stream")
async def chart_stream(ws: WebSocket) -> None:
    await ws.accept()
    payload = await _authenticate(ws)
    if payload is None:
        await ws.close(code=CLOSE_UNAUTHORIZED)
        return

    client = _Client(ws)
    client.token_exp = payload.get("exp")
    from src.api.routes._crypto_feed import is_crypto as _is_crypto

    async def handle_subscribe(msg: dict) -> None:
        symbol = _norm_symbol(msg.get("symbol"))
        tf = str(msg.get("timeframe") or "").upper()
        if not symbol or tf not in _TF_SECONDS:
            return  # نمادِ بدون‌داده/tf نامعتبر هرگز stream نمی‌شود (بدون فریمِ خطا)
        if len(client.chart_subs) >= MAX_CHART_SUBS:
            return
        candles = await _load_snapshot(symbol, tf)
        if not candles:
            return  # قاعده: نمادِ بدون‌داده هرگز stream نمی‌شود
        crypto = _is_crypto(symbol)
        price = await _read_live_price(symbol, crypto)
        stale = price is None
        await client.send({
            "type": "snapshot", "symbol": symbol, "timeframe": tf,
            "candles": candles, "status": "stale" if stale else "live",
        })
        seed = candles[-1] if candles and candles[-1]["t"] == _bar_start(time.time(), _TF_SECONDS[tf]) else None
        client.chart_subs[(symbol, tf)] = _FormingCandle(_TF_SECONDS[tf], seed)

    async def handle_subscribe_prices(msg: dict) -> None:
        raw = msg.get("symbols")
        if not isinstance(raw, list):
            return
        syms = {s for s in (_norm_symbol(x) for x in raw[:MAX_PRICE_SYMBOLS]) if s}
        client.price_subs = syms  # جایگزینیِ کاملِ مجموعه
        client.last_tick = {s: v for s, v in client.last_tick.items() if s in syms}

    async def receive_loop() -> None:
        import json
        while True:
            try:
                raw = await ws.receive_text()
            except WebSocketDisconnect:
                break
            except Exception:  # noqa: BLE001
                break
            try:
                msg = json.loads(raw)
            except Exception:  # noqa: BLE001
                await ws.close(code=CLOSE_BAD_FRAME)
                break
            if not isinstance(msg, dict):
                await ws.close(code=CLOSE_BAD_FRAME)
                break
            mtype = msg.get("type")
            if mtype == "subscribe":
                await handle_subscribe(msg)
            elif mtype == "subscribe_prices":
                await handle_subscribe_prices(msg)
            elif mtype == "unsubscribe":
                symbol = _norm_symbol(msg.get("symbol"))
                tf = str(msg.get("timeframe") or "").upper()
                client.chart_subs.pop((symbol, tf), None)
            elif mtype == "unsubscribe_prices":
                client.price_subs.clear()
                client.last_tick.clear()
            elif mtype == "ping":
                await client.send({"type": "pong"})
            elif mtype == "auth":
                pass  # قبلاً احراز شده
            # سایرِ typeها بی‌صدا نادیده — دیتاپلین فریمِ error نمی‌دهد

    async def stream_loop() -> None:
        while True:
            if ws.client_state != WebSocketState.CONNECTED:
                break
            now = time.time()
            # انقضای توکنِ وسطِ استریم → بستن با 4401
            if client.token_exp and now >= float(client.token_exp):
                await ws.close(code=CLOSE_UNAUTHORIZED)
                break

            # کندل‌های درحال‌شکل‌گیری
            for (symbol, tf), forming in list(client.chart_subs.items()):
                crypto = _is_crypto(symbol)
                price = await _read_live_price(symbol, crypto)
                if price is None:
                    if not forming.stale:
                        forming.stale = True
                        await client.send({"type": "status", "symbol": symbol,
                                           "timeframe": tf, "status": "stale"})
                    continue
                for frame in forming.on_price(price, now):
                    await client.send({
                        "type": "candle", "symbol": symbol, "timeframe": tf,
                        "closed": frame["closed"], "candle": frame["candle"],
                    })
                # گذارِ تازگی
                is_stale = (now - forming.last_change) > STALE_AFTER_SECONDS
                if is_stale != forming.stale:
                    forming.stale = is_stale
                    await client.send({"type": "status", "symbol": symbol, "timeframe": tf,
                                       "status": "stale" if is_stale else "live"})

            # tickهای واچ‌لیست
            for symbol in list(client.price_subs):
                crypto = _is_crypto(symbol)
                price = await _read_live_price(symbol, crypto)
                if price is None or client.last_tick.get(symbol) == price:
                    continue
                client.last_tick[symbol] = price
                await client.send({"type": "tick", "symbol": symbol,
                                   "price": price, "ts": int(now * 1000)})

            await asyncio.sleep(POLL_SECONDS)

    recv_task = asyncio.create_task(receive_loop())
    stream_task = asyncio.create_task(stream_loop())
    try:
        done, pending = await asyncio.wait(
            {recv_task, stream_task}, return_when=asyncio.FIRST_COMPLETED,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("chart_stream_error", error=str(exc))
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
