"""
لایو ترید — استریم WebRTC + چت زنده + مدیریت.

این ماژول سه بخش دارد:
  ۱) اندپوینت‌های عمومی: پیکربندی پخش (ICE/WHEP)، وضعیت لایو، ورود با تلگرام.
  ۲) چت زندهٔ WebSocket روی Redis pub/sub (سازگار با چند worker).
  ۳) اندپوینت‌های مدیریتی (فقط ادمین): شروع/پایان پخش، حالت عمومی/مشترکین،
     اسلومد، بن/میوت، حذف پیام، سنجاق، و دریافت اطلاعات انتشار (WHIP).

طراحی state:
  تمام وضعیت در Redis نگهداری می‌شود تا بین workerها به‌اشتراک گذاشته شود.
  چت با یک کانال pub/sub مرکزی (``live:chat:events``) بین همهٔ workerها fan-out می‌شود.
"""

import asyncio
import hashlib
import hmac
import json
import time
from typing import Any, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import text as sql_text
from starlette.websockets import WebSocketState

from src.api.deps import get_current_admin, get_db
from src.core.config import settings
from src.core.database import Admin
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.core.security import create_access_token, verify_access_token
from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger(__name__)
router = APIRouter()

# ── کلیدهای Redis ──
K_STATE = "live:state"
K_HISTORY = "live:chat:history"
K_BANNED = "live:banned"          # set از telegram_id
K_MUTED = "live:muted"            # set از telegram_id
K_SEQ = "live:chat:seq"
K_VIEWERS = "live:viewers"
K_LASTMSG = "live:lastmsg:"       # + tg_id → timestamp (برای اسلومد)
CH_EVENTS = "live:chat:events"    # کانال pub/sub

HISTORY_MAX = 200
LIVE_TOKEN_TTL_MIN = 720          # ۱۲ ساعت


# ════════════════════════════════════════════════════════════════
#  وضعیت لایو (Redis-backed)
# ════════════════════════════════════════════════════════════════
DEFAULT_STATE = {
    "live": False,
    "title": "اتاق معاملاتی زنده کوین‌پرو",
    "mode": "public",           # public | subscribers
    "slowmode": 0,              # ثانیه بین پیام‌های هر کاربر
    "chat_enabled": True,
    "pinned": "",
    "started_at": None,
    "mt5_url": "/live/whep/mt5",
    "cam_url": "/live/whep/cam",
}


async def _get_state() -> dict:
    data = await redis_client.get_json(K_STATE)
    if not data:
        return dict(DEFAULT_STATE)
    merged = dict(DEFAULT_STATE)
    merged.update(data)
    return merged


async def _set_state(state: dict) -> None:
    # بدون انقضا — وضعیت ماندگار است
    await redis_client.client.set(K_STATE, json.dumps(state))


# ════════════════════════════════════════════════════════════════
#  احراز هویت ورود با تلگرام (Telegram Login Widget)
# ════════════════════════════════════════════════════════════════
def _verify_telegram_login(data: dict[str, Any]) -> bool:
    """صحت‌سنجی دادهٔ ویجت ورود تلگرام طبق الگوریتم رسمی."""
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        return False
    received_hash = data.get("hash", "")
    pairs = sorted(
        f"{k}={v}" for k, v in data.items() if k != "hash" and v is not None
    )
    check_string = "\n".join(pairs)
    secret_key = hashlib.sha256(token.encode()).digest()
    calc = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(calc, received_hash)


async def _is_vip(db: AsyncSession, tg_id: int) -> bool:
    """آیا کاربر اشتراک فعال دارد؟"""
    try:
        res = await db.execute(
            sql_text(
                "SELECT 1 FROM subscriptions "
                "WHERE telegram_id = :tid AND status = 'active' "
                "AND expires_at > now() LIMIT 1"
            ),
            {"tid": tg_id},
        )
        return res.first() is not None
    except Exception as exc:  # جدول ممکن است وجود نداشته باشد
        logger.warning("vip_check_failed", error=str(exc))
        return False


# ════════════════════════════════════════════════════════════════
#  مدل‌های ورودی
# ════════════════════════════════════════════════════════════════
class TelegramAuth(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


class StartReq(BaseModel):
    title: Optional[str] = None
    mode: Optional[str] = Field(default=None, pattern="^(public|subscribers)$")


class ModeReq(BaseModel):
    mode: str = Field(pattern="^(public|subscribers)$")


class SlowReq(BaseModel):
    seconds: int = Field(ge=0, le=300)


class TgIdReq(BaseModel):
    telegram_id: int


class PinReq(BaseModel):
    text: str = ""


class TitleReq(BaseModel):
    title: str


# ════════════════════════════════════════════════════════════════
#  اندپوینت‌های عمومی
# ════════════════════════════════════════════════════════════════
@router.get("/config")
async def live_config() -> dict:
    """پیکربندی موردنیاز کلاینت برای پخش (ICE/WHEP) + وضعیت لایو."""
    state = await _get_state()
    try:
        viewers = int(await redis_client.client.get(K_VIEWERS) or 0)
    except Exception:
        viewers = 0
    return {
        "live": bool(state["live"]),
        "title": state["title"],
        "mode": state["mode"],
        "chat_enabled": bool(state["chat_enabled"]),
        "slowmode": int(state["slowmode"]),
        "pinned": state["pinned"],
        "started_at": state["started_at"],
        "viewers": max(viewers, 0),
        # WHEP از طریق nginx به MediaMTX پراکسی می‌شود (همان دامنه، HTTPS)
        "whep": {
            "mt5": "/live/whep/mt5/whep",
            "cam": "/live/whep/cam/whep",
        },
        "ice_servers": [
            {"urls": f"stun:{settings.LIVE_PUBLIC_IP}:3478"},
            {
                "urls": f"turn:{settings.LIVE_PUBLIC_IP}:3478",
                "username": settings.LIVE_TURN_USER,
                "credential": settings.LIVE_TURN_PASSWORD,
            },
        ],
    }


@router.post("/auth/telegram")
async def auth_telegram(body: TelegramAuth, db: AsyncSession = Depends(get_db)) -> dict:
    """تأیید ورود تلگرام و صدور توکن کوتاه‌عمر چت."""
    data = body.model_dump(exclude_none=True)
    if not _verify_telegram_login(data):
        raise HTTPException(status_code=401, detail="اعتبارسنجی ورود تلگرام ناموفق بود.")

    # توکن کهنه؟ (بیش از ۲۴ ساعت)
    if time.time() - body.auth_date > 86400:
        raise HTTPException(status_code=401, detail="نشست ورود منقضی شده است.")

    # کاربر بن‌شده؟
    if await redis_client.client.sismember(K_BANNED, str(body.id)):
        raise HTTPException(status_code=403, detail="شما از چت مسدود شده‌اید.")

    name = body.first_name or body.username or f"کاربر{body.id % 10000}"
    if body.last_name:
        name = f"{name} {body.last_name}"
    is_vip = await _is_vip(db, body.id)

    token = create_access_token(
        data={
            "sub": f"live:{body.id}",
            "scope": "live-chat",
            "tg": body.id,
            "name": name[:40],
            "photo": body.photo_url or "",
            "vip": is_vip,
        },
        expires_delta=_live_ttl(),
    )
    return {"token": token, "name": name, "is_vip": is_vip, "telegram_id": body.id}


def _live_ttl():
    from datetime import timedelta

    return timedelta(minutes=LIVE_TOKEN_TTL_MIN)


def _decode_live(token: str) -> Optional[dict]:
    payload = verify_access_token(token)
    if not payload or payload.get("scope") != "live-chat":
        return None
    return payload


# ── WHEP پراکسی توضیح: پخش از طریق nginx به mediamtx:8889 می‌رود (در nginx.conf) ──


# ════════════════════════════════════════════════════════════════
#  هابِ چت — fan-out بین workerها با یک listener مشترک Redis pub/sub
# ════════════════════════════════════════════════════════════════
class LiveChatHub:
    """مدیریت اتصالات محلی + پل pub/sub برای پخش بین چند worker."""

    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()
        self._listener: Optional[asyncio.Task] = None

    async def _ensure_listener(self) -> None:
        if self._listener and not self._listener.done():
            return
        self._listener = asyncio.create_task(self._listen())

    async def _listen(self) -> None:
        """خواندن کانال Redis و پخش به سوکت‌های محلی."""
        pubsub = redis_client.make_pubsub()
        await pubsub.subscribe(CH_EVENTS)
        try:
            async for msg in pubsub.listen():
                if msg.get("type") != "message":
                    continue
                raw = msg["data"]
                if isinstance(raw, bytes):
                    raw = raw.decode()
                await self._fanout(raw)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("live_chat_listener_error", error=str(exc))
        finally:
            try:
                await pubsub.unsubscribe(CH_EVENTS)
                await pubsub.aclose()
            except Exception:
                pass

    async def _fanout(self, raw: str) -> None:
        dead = []
        for ws in list(self.connections):
            try:
                if ws.application_state == WebSocketState.CONNECTED:
                    await ws.send_text(raw)
                else:
                    dead.append(ws)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.connections.discard(ws)

    async def join(self, ws: WebSocket) -> None:
        self.connections.add(ws)
        await self._ensure_listener()
        try:
            await redis_client.client.incr(K_VIEWERS)
        except Exception:
            pass

    async def leave(self, ws: WebSocket) -> None:
        self.connections.discard(ws)
        try:
            n = await redis_client.client.decr(K_VIEWERS)
            if n < 0:
                await redis_client.client.set(K_VIEWERS, 0)
        except Exception:
            pass

    async def publish(self, event: dict) -> None:
        """انتشار رویداد به همهٔ workerها."""
        await redis_client.client.publish(CH_EVENTS, json.dumps(event, ensure_ascii=False))


hub = LiveChatHub()


async def _push_history(message: dict) -> None:
    """ذخیرهٔ پیام در تاریخچهٔ محدود."""
    cli = redis_client.client
    await cli.rpush(K_HISTORY, json.dumps(message, ensure_ascii=False))
    await cli.ltrim(K_HISTORY, -HISTORY_MAX, -1)


async def _get_history() -> list[dict]:
    cli = redis_client.client
    items = await cli.lrange(K_HISTORY, 0, -1)
    out = []
    for it in items:
        if isinstance(it, bytes):
            it = it.decode()
        try:
            out.append(json.loads(it))
        except Exception:
            continue
    return out


# ════════════════════════════════════════════════════════════════
#  WebSocket چت
# ════════════════════════════════════════════════════════════════
@router.websocket("/ws/chat")
async def live_chat_ws(websocket: WebSocket, token: str = Query(default="")):
    """
    چت زنده. احراز هویت با ``token`` (توکن چت تلگرام یا توکن ادمین).
    ادمین با scope مدیریتی متصل می‌شود و پیام‌هایش با نشانِ ادمین می‌آید.
    """
    # ── احراز هویت ──
    identity = None
    is_admin = False
    payload = _decode_live(token) if token else None
    if payload:
        identity = {
            "tg": payload["tg"],
            "name": payload["name"],
            "photo": payload.get("photo", ""),
            "vip": bool(payload.get("vip")),
        }
    else:
        # شاید توکن ادمین باشد
        admin_payload = verify_access_token(token) if token else None
        if admin_payload and admin_payload.get("role") in ("admin", "superadmin", "analyst"):
            is_admin = True
            identity = {
                "tg": 0,
                "name": settings.LIVE_HOST_NAME,
                "photo": "",
                "vip": True,
            }

    is_guest = identity is None
    if is_guest:
        # مهمان: فقط تماشا و خواندنِ چت (بدون اجازهٔ نوشتن)
        identity = {"tg": 0, "name": "مهمان", "photo": "", "vip": False}

    state = await _get_state()
    # نوشتن: ادمین همیشه؛ کاربرِ واردشده در حالت public؛ فقط VIP در حالت subscribers
    can_write = is_admin or (
        not is_guest and (identity["vip"] or state["mode"] == "public")
    )

    await websocket.accept()
    await hub.join(websocket)

    # ارسال تاریخچه + وضعیت اولیه
    try:
        viewers = int(await redis_client.client.get(K_VIEWERS) or 0)
        await websocket.send_text(json.dumps({
            "type": "init",
            "history": await _get_history(),
            "pinned": state["pinned"],
            "slowmode": state["slowmode"],
            "can_write": can_write,
            "viewers": max(viewers, 0),
            "you": {"name": identity["name"], "vip": identity["vip"], "admin": is_admin},
        }, ensure_ascii=False))
    except Exception:
        pass

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            mtype = msg.get("type")

            # ── دستورهای مدیریتی از سوکت ادمین ──
            if is_admin and mtype in ("delete", "clear", "pin"):
                await _handle_admin_ws(msg)
                continue

            if mtype != "chat":
                continue

            text_body = (msg.get("text") or "").strip()
            if not text_body:
                continue
            text_body = text_body[:500]

            # ── بررسی‌های انتشار ──
            st = await _get_state()
            if not st["chat_enabled"] and not is_admin:
                await _warn(websocket, "چت موقتاً غیرفعال است.")
                continue
            if is_guest:
                await _warn(websocket, "برای ارسال پیام با تلگرام وارد شوید.")
                continue
            can_write_now = is_admin or identity["vip"] or st["mode"] == "public"
            if not can_write_now:
                await _warn(websocket, "فقط مشترکین VIP می‌توانند پیام بفرستند.")
                continue
            if not is_admin:
                if await redis_client.client.sismember(K_BANNED, str(identity["tg"])):
                    await websocket.close(code=4403)
                    break
                if await redis_client.client.sismember(K_MUTED, str(identity["tg"])):
                    await _warn(websocket, "شما در حالت سکوت قرار دارید.")
                    continue
                # اسلومد
                slow = int(st["slowmode"])
                if slow > 0:
                    key = f"{K_LASTMSG}{identity['tg']}"
                    last = await redis_client.client.get(key)
                    now = time.time()
                    if last and now - float(last) < slow:
                        wait = int(slow - (now - float(last)))
                        await _warn(websocket, f"اسلومد فعال است؛ {wait} ثانیه صبر کنید.")
                        continue
                    await redis_client.client.set(key, now, ex=slow + 5)

            seq = await redis_client.client.incr(K_SEQ)
            out = {
                "type": "chat",
                "id": seq,
                "name": identity["name"],
                "photo": identity["photo"],
                "vip": identity["vip"],
                "admin": is_admin,
                "tg": identity["tg"],
                "text": text_body,
                "ts": int(time.time()),
            }
            await _push_history(out)
            await hub.publish(out)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("live_chat_ws_error", error=str(exc))
    finally:
        await hub.leave(websocket)


async def _warn(ws: WebSocket, text_body: str) -> None:
    try:
        await ws.send_text(json.dumps({"type": "warn", "text": text_body}, ensure_ascii=False))
    except Exception:
        pass


async def _handle_admin_ws(msg: dict) -> None:
    """دستورهای مدیریتیِ آمده از سوکت ادمین."""
    if msg.get("type") == "delete" and msg.get("id"):
        await _delete_message(int(msg["id"]))
    elif msg.get("type") == "clear":
        await redis_client.client.delete(K_HISTORY)
        await hub.publish({"type": "clear"})
    elif msg.get("type") == "pin":
        st = await _get_state()
        st["pinned"] = (msg.get("text") or "")[:300]
        await _set_state(st)
        await hub.publish({"type": "pin", "text": st["pinned"]})


async def _delete_message(msg_id: int) -> None:
    """حذف یک پیام از تاریخچه + اعلام به کلاینت‌ها."""
    history = await _get_history()
    kept = [m for m in history if m.get("id") != msg_id]
    cli = redis_client.client
    async with cli.pipeline(transaction=True) as pipe:
        pipe.delete(K_HISTORY)
        for m in kept:
            pipe.rpush(K_HISTORY, json.dumps(m, ensure_ascii=False))
        await pipe.execute()
    await hub.publish({"type": "delete", "id": msg_id})


# ════════════════════════════════════════════════════════════════
#  اندپوینت‌های مدیریتی (فقط ادمین)
# ════════════════════════════════════════════════════════════════
@router.get("/admin/state")
async def admin_state(admin: Admin = Depends(get_current_admin)) -> dict:
    state = await _get_state()
    try:
        viewers = int(await redis_client.client.get(K_VIEWERS) or 0)
        banned = [int(x) for x in await redis_client.client.smembers(K_BANNED)]
        muted = [int(x) for x in await redis_client.client.smembers(K_MUTED)]
    except Exception:
        viewers, banned, muted = 0, [], []
    state["viewers"] = max(viewers, 0)
    state["banned"] = banned
    state["muted"] = muted
    return state


@router.post("/admin/start")
async def admin_start(body: StartReq, admin: Admin = Depends(get_current_admin)) -> dict:
    st = await _get_state()
    st["live"] = True
    if body.title:
        st["title"] = body.title[:120]
    if body.mode:
        st["mode"] = body.mode
    st["started_at"] = int(time.time())
    await _set_state(st)
    await hub.publish({"type": "status", "live": True, "title": st["title"], "mode": st["mode"]})
    logger.info("live_started", admin=admin.username, mode=st["mode"])
    return st


@router.post("/admin/stop")
async def admin_stop(admin: Admin = Depends(get_current_admin)) -> dict:
    st = await _get_state()
    st["live"] = False
    st["started_at"] = None
    await _set_state(st)
    await hub.publish({"type": "status", "live": False})
    logger.info("live_stopped", admin=admin.username)
    return st


@router.post("/admin/mode")
async def admin_mode(body: ModeReq, admin: Admin = Depends(get_current_admin)) -> dict:
    st = await _get_state()
    st["mode"] = body.mode
    await _set_state(st)
    await hub.publish({"type": "status", "live": st["live"], "mode": st["mode"]})
    return st


@router.post("/admin/chat-toggle")
async def admin_chat_toggle(admin: Admin = Depends(get_current_admin)) -> dict:
    st = await _get_state()
    st["chat_enabled"] = not st["chat_enabled"]
    await _set_state(st)
    await hub.publish({"type": "chat_enabled", "enabled": st["chat_enabled"]})
    return st


@router.post("/admin/slowmode")
async def admin_slowmode(body: SlowReq, admin: Admin = Depends(get_current_admin)) -> dict:
    st = await _get_state()
    st["slowmode"] = body.seconds
    await _set_state(st)
    await hub.publish({"type": "slowmode", "seconds": body.seconds})
    return st


@router.post("/admin/pin")
async def admin_pin(body: PinReq, admin: Admin = Depends(get_current_admin)) -> dict:
    st = await _get_state()
    st["pinned"] = body.text[:300]
    await _set_state(st)
    await hub.publish({"type": "pin", "text": st["pinned"]})
    return {"pinned": st["pinned"]}


@router.post("/admin/title")
async def admin_title(body: TitleReq, admin: Admin = Depends(get_current_admin)) -> dict:
    st = await _get_state()
    st["title"] = body.title[:120]
    await _set_state(st)
    await hub.publish({"type": "status", "live": st["live"], "title": st["title"]})
    return {"title": st["title"]}


@router.post("/admin/ban")
async def admin_ban(body: TgIdReq, admin: Admin = Depends(get_current_admin)) -> dict:
    await redis_client.client.sadd(K_BANNED, str(body.telegram_id))
    await hub.publish({"type": "kick", "tg": body.telegram_id})
    return {"ok": True, "banned": body.telegram_id}


@router.post("/admin/unban")
async def admin_unban(body: TgIdReq, admin: Admin = Depends(get_current_admin)) -> dict:
    await redis_client.client.srem(K_BANNED, str(body.telegram_id))
    return {"ok": True}


@router.post("/admin/mute")
async def admin_mute(body: TgIdReq, admin: Admin = Depends(get_current_admin)) -> dict:
    await redis_client.client.sadd(K_MUTED, str(body.telegram_id))
    return {"ok": True, "muted": body.telegram_id}


@router.post("/admin/unmute")
async def admin_unmute(body: TgIdReq, admin: Admin = Depends(get_current_admin)) -> dict:
    await redis_client.client.srem(K_MUTED, str(body.telegram_id))
    return {"ok": True}


@router.delete("/admin/message/{msg_id}")
async def admin_delete_message(msg_id: int, admin: Admin = Depends(get_current_admin)) -> dict:
    await _delete_message(msg_id)
    return {"ok": True}


@router.post("/admin/clear")
async def admin_clear(admin: Admin = Depends(get_current_admin)) -> dict:
    await redis_client.client.delete(K_HISTORY)
    await hub.publish({"type": "clear"})
    return {"ok": True}


@router.get("/admin/publish-info")
async def admin_publish_info(admin: Admin = Depends(get_current_admin)) -> dict:
    """اطلاعات انتشار وبکم از مرورگر مالک (WHIP)."""
    return {
        "cam_whip": "/live/whip/cam/whip",
        "mt5_whip": "/live/whip/mt5/whip",
        "username": settings.LIVE_PUBLISH_USER,
        "password": settings.LIVE_PUBLISH_PASSWORD,
        "desktop_user": settings.LIVE_DESKTOP_USER,
        "desktop_password": settings.LIVE_DESKTOP_PASSWORD,
        "ice_servers": [
            {"urls": f"stun:{settings.LIVE_PUBLIC_IP}:3478"},
            {
                "urls": f"turn:{settings.LIVE_PUBLIC_IP}:3478",
                "username": settings.LIVE_TURN_USER,
                "credential": settings.LIVE_TURN_PASSWORD,
            },
        ],
    }
