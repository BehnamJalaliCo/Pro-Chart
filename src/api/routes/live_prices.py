"""
وب‌سوکت قیمت‌های زنده.

این ماژول یک اندپوینت WebSocket فراهم می‌کند که قیمت‌های لحظه‌ای
ارزها را از ردیس خوانده و به کلاینت‌های متصل استریم می‌کند.
"""

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)
router = APIRouter()

DEFAULT_SYMBOLS = [
    "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD",
    "USDCAD", "NZDUSD", "XAUUSD", "XAGUSD", "BTCUSD",
]


class ConnectionManager:
    """
    مدیریت اتصالات وب‌سوکت.

    اتصالات فعال را نگهداری کرده و قابلیت ارسال پیام به تمام
    کلاینت‌های متصل یا کلاینت‌های خاص را فراهم می‌کند.
    """

    def __init__(self):
        """مقداردهی اولیه لیست اتصالات فعال."""
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """
        پذیرش و افزودن اتصال جدید.

        اتصال وب‌سوکت را پذیرفته و به لیست اتصالات فعال اضافه می‌کند.
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("اتصال وب‌سوکت جدید. تعداد فعال: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        """
        حذف اتصال قطع‌شده.

        اتصال را از لیست اتصالات فعال حذف می‌کند.
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info("اتصال وب‌سوکت قطع شد. تعداد فعال: %d", len(self.active_connections))

    async def broadcast(self, message: str):
        """
        ارسال پیام به تمام کلاینت‌های متصل.

        در صورت خطا در ارسال به یک کلاینت، اتصال آن قطع می‌شود.
        """
        disconnected = []
        for connection in self.active_connections:
            try:
                if connection.client_state == WebSocketState.CONNECTED:
                    await connection.send_text(message)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


async def _read_prices_from_redis(symbols: list[str]) -> dict:
    """
    خواندن قیمت‌های فعلی از ردیس.

    قیمت هر نماد از کلید مربوطه در ردیس خوانده می‌شود.
    نمادهایی که قیمتشان موجود نیست، نادیده گرفته می‌شوند.
    """
    client = redis_client.get_client()
    if client is None:
        return {}

    prices = {}
    pipe = client.pipeline()
    for symbol in symbols:
        pipe.get(f"price:{symbol}")

    try:
        results = await pipe.execute()
    except Exception as exc:
        logger.error("خطا در خواندن قیمت‌ها از ردیس: %s", exc)
        return {}

    for symbol, raw_value in zip(symbols, results):
        if raw_value is not None:
            try:
                value = raw_value.decode() if isinstance(raw_value, bytes) else raw_value
                prices[symbol] = json.loads(value)
            except (json.JSONDecodeError, AttributeError):
                try:
                    prices[symbol] = {"bid": float(value), "ask": float(value)}
                except (ValueError, TypeError):
                    logger.debug("price_parse_failed", symbol=symbol)

    return prices


@router.websocket("/prices")
async def websocket_live_prices(websocket: WebSocket):
    """
    اندپوینت وب‌سوکت برای استریم قیمت‌های زنده.

    پس از اتصال، کلاینت می‌تواند لیست نمادهای مورد نظر را ارسال کند.
    سپس قیمت‌ها هر ثانیه از ردیس خوانده شده و به کلاینت ارسال می‌شوند.
    کلاینت می‌تواند در هر زمان لیست نمادها را تغییر دهد.
    """
    await manager.connect(websocket)

    subscribed_symbols = list(DEFAULT_SYMBOLS)

    try:
        receive_task: Optional[asyncio.Task] = None

        async def receive_messages():
            """دریافت پیام‌های کلاینت برای تغییر نمادهای مشترک."""
            nonlocal subscribed_symbols
            while True:
                try:
                    data = await websocket.receive_text()
                    message = json.loads(data)

                    if message.get("action") == "subscribe":
                        new_symbols = message.get("symbols", [])
                        if isinstance(new_symbols, list) and all(isinstance(s, str) for s in new_symbols):
                            subscribed_symbols = [s.upper() for s in new_symbols[:50]]
                            await websocket.send_text(json.dumps({
                                "type": "subscribed",
                                "symbols": subscribed_symbols,
                            }))
                            logger.debug("نمادهای مشترک به‌روز شد: %s", subscribed_symbols)

                    elif message.get("action") == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))

                except WebSocketDisconnect:
                    break
                except json.JSONDecodeError:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": "فرمت پیام نامعتبر است. JSON ارسال کنید.",
                    }))
                except Exception:
                    break

        receive_task = asyncio.create_task(receive_messages())

        while True:
            if websocket.client_state != WebSocketState.CONNECTED:
                break

            prices = await _read_prices_from_redis(subscribed_symbols)

            if prices:
                await websocket.send_text(json.dumps({
                    "type": "prices",
                    "data": prices,
                }))

            await asyncio.sleep(1)

    except WebSocketDisconnect:
        logger.debug("کلاینت وب‌سوکت قطع شد.")
    except Exception as exc:
        logger.error("خطا در وب‌سوکت قیمت‌های زنده: %s", exc)
    finally:
        if receive_task and not receive_task.done():
            receive_task.cancel()
            try:
                await receive_task
            except asyncio.CancelledError:
                logger.debug("websocket_receive_task_cancelled")
        manager.disconnect(websocket)
