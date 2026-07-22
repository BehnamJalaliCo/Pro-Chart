"""فاز ۷ — بخشِ 7B: سیگنال (تکمیلِ فیدِ موجود با شکلِ کاملِ Signal JSON).

قرارداد: `SERVER_HANDOFF_08_...md` §7B. مسیرها زیرِ `/academy/signals`.
منبعِ زنده = همان سرویس‌های خارجی که `academy/bn/signals` استفاده می‌کند (tradeyar کریپتو،
coinepro-fx فارکس) + سیگنال‌های ادمین‌نوشتهٔ جدولِ محلیِ `signals` (۸D). این ماژول شکلِ
غنیِ قرارداد (tp[]/status/rr/analyst/premium/…) را می‌دهد و قفلِ پریمیوم را اعمال می‌کند.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Header, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from src.core.logger import get_logger
from src.core.security import verify_access_token

logger = get_logger(__name__)
router = APIRouter()

_STATUS_MAP = [
    ("PEND", "waiting"), ("WAIT", "waiting"), ("ACTIVE", "entered"), ("OPEN", "entered"),
    ("RUNNING", "entered"), ("ENTER", "entered"), ("TP3", "tp3"), ("TP2", "tp2"),
    ("TP1", "tp1"), ("STOP", "sl"), ("SL", "sl"), ("EXPIR", "expired"), ("CANCEL", "cancelled"),
]


def _fl(v):
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _norm_status(s: Any) -> str:
    su = str(s or "").upper()
    for k, v in _STATUS_MAP:
        if k in su:
            return v
    return (str(s).lower() if s else "waiting")


def _norm_dir(d: Any) -> str:
    return "buy" if str(d or "").lower() in ("buy", "long", "1") else "sell"


def _ms(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(v if v > 1e11 else v * 1000)
    return None


def _crypto_sig(x: dict) -> dict:
    tp = [_fl(v) for v in (x.get("tp1_price"), x.get("tp2_price"), x.get("tp3_price")) if v is not None]
    return {"id": f"cx-{x.get('id')}", "market": "crypto", "symbol": x.get("symbol"),
            "direction": _norm_dir(x.get("direction")), "timeframe": x.get("timeframe"),
            "entry": _fl(x.get("entry_price")), "tp": tp, "sl": _fl(x.get("sl_price")),
            "confidence": _fl(x.get("confidence")), "rr": _fl(x.get("risk_reward")),
            "reason": x.get("reason"), "chart_snapshot_url": None,
            "analyst": {"name": "CoinePro AI", "type": "ai"},
            "status": _norm_status(x.get("status")), "premium": False,
            "created_at": _ms(x.get("created_at")), "updated_at": _ms(x.get("updated_at") or x.get("created_at"))}


def _forex_sig(x: dict) -> dict:
    tp = [_fl(v) for v in (x.get("tp1"), x.get("tp2"), x.get("tp3")) if v is not None]
    return {"id": f"fx-{x.get('id')}", "market": "forex", "symbol": x.get("symbol"),
            "direction": _norm_dir(x.get("direction")), "timeframe": x.get("timeframe"),
            "entry": _fl(x.get("entry_price")), "tp": tp, "sl": _fl(x.get("sl")),
            "confidence": _fl(x.get("signal_score")), "rr": _fl(x.get("risk_reward") or x.get("rr")),
            "reason": x.get("reason"), "chart_snapshot_url": None,
            "analyst": {"name": "CoinePro FX", "type": "ai"},
            "status": _norm_status(x.get("status")), "premium": False,
            "created_at": _ms(x.get("created_at")), "updated_at": _ms(x.get("updated_at") or x.get("created_at"))}


async def _fetch(market: str, limit: int) -> list[dict]:
    out: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=6.0) as cx:
            if market == "crypto":
                base = os.getenv("BN_CRYPTO_SVC_URL", "http://10.10.1.4:8000")
                r = await cx.get(base + "/api/demo/signals")
                data = (r.json().get("signals", []) if r.status_code == 200 else [])
                out = [_crypto_sig(x) for x in data[:limit]]
            else:
                base = os.getenv("BN_FOREX_SVC_URL", "http://10.10.1.3:8000")
                r = await cx.get(base + "/public/signals/svc", params={"limit": limit},
                                 headers={"X-Internal-Token": os.getenv("BN_BRIDGE_TOKEN", "")})
                data = (r.json().get("items", []) if r.status_code == 200 else [])
                out = [_forex_sig(x) for x in data[:limit]]
    except Exception as e:  # noqa: BLE001
        logger.warning("signals_fetch_failed", market=market, error=str(e))
    return out


async def _local_admin_signals(limit: int) -> list[dict]:
    """سیگنال‌های ادمین‌نوشتهٔ جدولِ محلیِ signals (۸D)."""
    try:
        from src.api.routes.admin_ops import _get_signal
        from src.core.database import async_session_factory
        from sqlalchemy import text
        async with async_session_factory() as db:
            ids = (await db.execute(text("SELECT id FROM signals ORDER BY id DESC LIMIT :l"), {"l": limit})).all()
            out = []
            for (sid,) in ids:
                s = await _get_signal(db, sid)
                if s:
                    s["analyst"] = {"name": "Analyst", "type": s.get("source", "human")}
                    s["updated_at"] = s.get("created_at")
                    out.append(s)
            return out
    except Exception:  # noqa: BLE001
        return []


def _lock(sig: dict) -> dict:
    """قفلِ پریمیوم: فیلدهای حساس null، premium=true."""
    s = dict(sig)
    s["premium"] = True
    s["entry"] = None
    s["tp"] = []
    s["sl"] = None
    return s


def _auth_state(authorization: Optional[str]) -> tuple[bool, bool]:
    """(is_guest, is_prochart). بدونِ توکن یا مهمان = guest."""
    if not authorization or " " not in authorization:
        return True, False
    p = verify_access_token(authorization.split(" ", 1)[1].strip())
    if not p or p.get("guest"):
        return True, False
    tier = str(p.get("tier") or "").lower()
    return False, tier in ("vip", "premium")


async def _feed(market: str, limit: int, is_guest: bool, is_prochart: bool,
                status: str = "all") -> list[dict]:
    sigs = await _fetch(market if market in ("crypto", "forex") else "crypto", limit)
    admin = await _local_admin_signals(limit)
    sigs = admin + sigs
    if status and status != "all":
        want = {"active": ("waiting", "entered")}.get(status, (status,))
        sigs = [s for s in sigs if s["status"] in want]
    if is_guest:
        return [_lock(s) for s in sigs[:3]]
    if not is_prochart:
        return [_lock(s) for s in sigs[:limit]]
    return sigs[:limit]


@router.get("/signals")
async def signals_list(market: str = "crypto", status: str = "all", limit: int = 50,
                       authorization: Optional[str] = Header(None)) -> dict:
    limit = max(1, min(int(limit), 100))
    is_guest, is_pro = _auth_state(authorization)
    sigs = await _feed(market, limit, is_guest, is_pro, status)
    return {"market": market, "signals": sigs, "count": len(sigs)}


@router.get("/signals/performance")
async def signals_performance(market: str = "crypto", authorization: Optional[str] = Header(None)) -> dict:
    """آماری از فیدِ زنده (fail-soft؛ منبعِ تاریخیِ محلی خالی است)."""
    sigs = await _fetch(market if market in ("crypto", "forex") else "crypto", 200)
    closed = [s for s in sigs if s["status"] in ("tp1", "tp2", "tp3", "sl", "expired")]
    wins = [s for s in closed if s["status"] in ("tp1", "tp2", "tp3")]
    rrs = [s["rr"] for s in sigs if s.get("rr")]
    total = len(closed)
    win_rate = round(len(wins) / total * 100, 1) if total else None
    avg_rr = round(sum(rrs) / len(rrs), 2) if rrs else None
    out = {"total": total, "win_rate": win_rate, "avg_rr": avg_rr, "profit_factor": None, "monthly": []}
    return {k: v for k, v in out.items() if v is not None or k in ("monthly", "total")}


@router.get("/signals/archive")
async def signals_archive(market: str = "crypto", limit: int = 100,
                          authorization: Optional[str] = Header(None)) -> dict:
    limit = max(1, min(int(limit), 200))
    is_guest, is_pro = _auth_state(authorization)
    sigs = await _fetch(market if market in ("crypto", "forex") else "crypto", limit)
    archived = [s for s in sigs if s["status"] in ("tp1", "tp2", "tp3", "sl", "expired", "cancelled")]
    if is_guest or not is_pro:
        archived = [_lock(s) for s in archived[:(3 if is_guest else limit)]]
    return {"signals": archived}


@router.get("/signals/{id}")
async def signal_detail(id: str, authorization: Optional[str] = Header(None)) -> dict:
    is_guest, is_pro = _auth_state(authorization)
    market = "forex" if id.startswith("fx-") else "crypto"
    sigs = await _fetch(market, 200)
    admin = await _local_admin_signals(200)
    hit = next((s for s in (admin + sigs) if str(s["id"]) == id), None)
    if not hit:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "سیگنال یافت نشد."}})
    if is_guest or not is_pro:
        hit = _lock(hit)
    return hit


# ── WebSocket (توکن اختیاری؛ مهمان مجاز) ──
@router.websocket("/signals/stream")
async def signals_stream(ws: WebSocket) -> None:
    await ws.accept()
    token = ws.query_params.get("token")
    is_guest, is_pro = _auth_state(f"Bearer {token}" if token else None)
    token_exp = None
    if token:
        p = verify_access_token(token)
        if p and not p.get("guest"):
            token_exp = p.get("exp")

    async def send(obj):
        if ws.client_state != WebSocketState.CONNECTED:
            return
        try:
            await ws.send_json(obj)
        except Exception:  # noqa: BLE001
            pass

    async def recv_loop():
        while True:
            try:
                raw = await ws.receive_text()
            except (WebSocketDisconnect, Exception):  # noqa: BLE001
                break
            try:
                m = json.loads(raw)
            except Exception:  # noqa: BLE001
                continue
            if isinstance(m, dict) and m.get("type") == "ping":
                await send({"type": "pong"})

    async def stream_loop():
        sigs = await _feed("crypto", 50, is_guest, is_pro)
        await send({"type": "snapshot", "data": {"signals": sigs}})
        seen = {s["id"]: s["status"] for s in sigs}
        last_ping = time.time()
        while True:
            if ws.client_state != WebSocketState.CONNECTED:
                break
            now = time.time()
            if token_exp and now >= float(token_exp):
                await ws.close(code=4401)
                break
            cur = await _feed("crypto", 50, is_guest, is_pro)
            for s in cur:
                if seen.get(s["id"]) != s["status"]:
                    seen[s["id"]] = s["status"]
                    await send({"type": "signal", "data": s})
            if now - last_ping >= 20:
                last_ping = now
                await send({"type": "pong"})
            await asyncio.sleep(10.0)

    rt = asyncio.create_task(recv_loop())
    stt = asyncio.create_task(stream_loop())
    try:
        await asyncio.wait({rt, stt}, return_when=asyncio.FIRST_COMPLETED)
    except Exception as exc:  # noqa: BLE001
        logger.error("signals_stream_error", error=str(exc))
    finally:
        for t in (rt, stt):
            if not t.done():
                t.cancel()
                try:
                    await t
                except (asyncio.CancelledError, Exception):  # noqa: BLE001
                    pass
        if ws.client_state == WebSocketState.CONNECTED:
            try:
                await ws.close()
            except Exception:  # noqa: BLE001
                pass
