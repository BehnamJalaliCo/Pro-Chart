"""پنلِ ادمین فاز۸ — بخشِ ۸A-۲: overview + kill-switch + WS stream + میدل‌ورِ requireAdmin.

قرارداد: `SERVER_HANDOFF_09_admin.md`. همهٔ مسیرها زیرِ `/academy/admin/`.
هر mutation: چکِ permission + `reason` (ثبت در audit) + `X-Admin-Confirm` برای حساس‌ها.
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.websockets import WebSocketState

from src.api.deps import get_db
from src.api.routes import admin_audit
from src.api.routes.academy import current_student
from src.api.routes.admin_roles import has_permission, permissions_for, role_for
from src.core.database import async_session_factory
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.core.security import verify_access_token

logger = get_logger(__name__)
router = APIRouter()

PING_EVERY = 20.0


def _forbidden(permission: str) -> HTTPException:
    return HTTPException(status_code=403, detail={
        "error": {"code": "forbidden", "message": "دسترسیِ لازم را ندارید.",
                  "required_permission": permission}})


def require_admin(permission: str):
    """Dependencyِ ادمین: توکنِ معتبر + مجوزِ granular، وگرنه ۴۰۳ با required_permission."""
    async def dep(st=Depends(current_student)):
        role = role_for(st)
        if not has_permission(role, permission):
            raise _forbidden(permission)
        return st
    return dep


def _require_confirm(x_admin_confirm: Optional[str]) -> None:
    if not x_admin_confirm or not x_admin_confirm.strip():
        raise HTTPException(status_code=400, detail={
            "error": {"code": "confirm_required",
                      "message": "برای این اکشنِ حساس هدرِ X-Admin-Confirm لازم است."}})


# ── Overview ──
async def _scalar(db: AsyncSession, sql: str) -> Optional[float]:
    try:
        r = (await db.execute(text(sql))).scalar()
        return float(r) if r is not None else 0.0
    except Exception:  # noqa: BLE001
        return None


async def _series(db: AsyncSession, sql: str) -> Optional[list[dict]]:
    try:
        rows = (await db.execute(text(sql))).all()
        return [{"t": int(r[0].timestamp() * 1000), "value": float(r[1])} for r in rows]
    except Exception:  # noqa: BLE001
        return None


async def _kpis(db: AsyncSession) -> dict:
    out: dict[str, Any] = {}
    m = {
        "total_users": "SELECT count(*) FROM academy_students",
        "active_users": "SELECT count(*) FROM academy_students WHERE last_login_at > now()-interval '30 day'",
        "signups_today": "SELECT count(*) FROM academy_students WHERE created_at >= date_trunc('day', now())",
        "active_subscriptions": "SELECT count(*) FROM academy_students WHERE tier IN ('vip','premium') AND (expires_at IS NULL OR expires_at > now())",
        "kyc_pending": "SELECT count(*) FROM academy_students WHERE kyc_status='pending'",
        "open_tickets": "SELECT count(*) FROM academy_support_tickets WHERE status='open'",
        "running_trades": "SELECT count(*) FROM bn_orders WHERE status IN ('pending','sent')",
        "revenue_today": "SELECT coalesce(sum(amount_usdt),0) FROM academy_payments WHERE status='paid' AND created_at >= date_trunc('day', now())",
    }
    for k, sql in m.items():
        v = await _scalar(db, sql)
        if v is not None:
            out[k] = v
    out["revenue_currency"] = "USD"
    out.setdefault("active_signals", 0)
    return out


async def _system_health() -> dict:
    comps = []
    # database
    t0 = time.time()
    try:
        async with async_session_factory() as db:
            await db.execute(text("SELECT 1"))
        comps.append({"key": "database", "status": "operational",
                      "latency_ms": round((time.time() - t0) * 1000, 1), "detail": None})
    except Exception:  # noqa: BLE001
        comps.append({"key": "database", "status": "down", "detail": None})
    # redis
    t0 = time.time()
    try:
        await redis_client.client.ping()
        comps.append({"key": "queue", "status": "operational",
                      "latency_ms": round((time.time() - t0) * 1000, 1), "detail": None})
    except Exception:  # noqa: BLE001
        comps.append({"key": "queue", "status": "down", "detail": None})
    comps.append({"key": "api", "status": "operational", "latency_ms": 1, "detail": None})
    comps.append({"key": "websocket", "status": "operational", "detail": None})
    comps.append({"key": "workers", "status": "unknown", "detail": None})
    comps.append({"key": "exchange_lbank", "status": "unknown", "detail": None})
    comps.append({"key": "exchange_coinprofx8", "status": "unknown", "detail": None})
    return {"components": comps}


@router.get("/admin/overview")
async def admin_overview(st=Depends(require_admin("overview.read")),
                         db: AsyncSession = Depends(get_db)) -> dict:
    kpis = await _kpis(db)
    series = {}
    ns = await _series(db, "SELECT date_trunc('day',created_at) d, count(*) FROM academy_students "
                           "WHERE created_at > now()-interval '30 day' GROUP BY d ORDER BY d")
    if ns is not None:
        series["new_users"] = ns
    rev = await _series(db, "SELECT date_trunc('day',created_at) d, coalesce(sum(amount_usdt),0) "
                            "FROM academy_payments WHERE status='paid' AND created_at > now()-interval '30 day' "
                            "GROUP BY d ORDER BY d")
    if rev is not None:
        series["revenue"] = rev
    out = {"kpis": kpis, "system_health": await _system_health(),
           "kill_switches": await admin_audit.ks_all()}
    if series:
        out["series"] = series
    return out


# ── Kill switch (system.killswitch = فقط superadmin؛ حساس) ──
@router.post("/admin/kill-switch")
async def admin_kill_switch(key: str = Body(..., embed=True), enabled: bool = Body(..., embed=True),
                            reason: str = Body(..., embed=True),
                            x_admin_confirm: Optional[str] = Header(None),
                            st=Depends(require_admin("system.killswitch"))) -> dict:
    if key not in admin_audit.KILL_SWITCHES:
        raise HTTPException(status_code=400, detail={"error": {"code": "bad_key", "message": "کلیدِ نامعتبر."}})
    if not (reason or "").strip():
        raise HTTPException(status_code=400, detail={"error": {"code": "reason_required", "message": "reason لازم است."}})
    _require_confirm(x_admin_confirm)
    role = role_for(st)
    sw = await admin_audit.ks_set(key, enabled, by=st.username)
    audit = await admin_audit.record(actor_id=st.id, actor_name=st.username, actor_role=role,
                                     action="system.killswitch", target_type="kill_switch",
                                     target_id=key, target_label=key, reason=reason,
                                     metadata={"enabled": enabled, "confirm": x_admin_confirm})
    return {"switch": sw, "accepted": True, "audit": audit}


# ── WebSocket مشترک ──
async def _authenticate(ws: WebSocket) -> Optional[dict]:
    token = ws.query_params.get("token")
    if not token:
        return None
    payload = verify_access_token(token)
    if not payload or payload.get("guest"):
        return None
    from src.core.config import settings
    central = bool(getattr(settings, "CENTRAL_AUTH_ENABLED", False)) and payload.get("scope") == "app"
    if payload.get("scope") != "academy" and not central:
        return None
    return payload


@router.websocket("/admin/stream")
async def admin_stream(ws: WebSocket) -> None:
    await ws.accept()
    payload = await _authenticate(ws)
    if payload is None:
        await ws.close(code=4401)
        return
    sid = int(payload.get("sid", 0) or 0)
    token_exp = payload.get("exp")
    from src.core.database import AcademyStudent
    from sqlalchemy import select
    async with async_session_factory() as db:
        st = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    role = role_for(st) if st else "user"
    if st is None or not has_permission(role, "admin.access"):
        await ws.close(code=4403)
        return
    can_system = has_permission(role, "system.read")
    can_audit = has_permission(role, "audit.read")

    topics: set[str] = set()

    async def send(obj: dict) -> bool:
        if ws.client_state != WebSocketState.CONNECTED:
            return False
        try:
            await ws.send_json(obj)
            return True
        except Exception:  # noqa: BLE001
            return False

    async def receive_loop() -> None:
        nonlocal topics
        while True:
            try:
                raw = await ws.receive_text()
            except (WebSocketDisconnect, Exception):  # noqa: BLE001
                break
            try:
                msg = json.loads(raw)
            except Exception:  # noqa: BLE001
                continue
            if not isinstance(msg, dict):
                continue
            if msg.get("type") == "ping":
                await send({"type": "pong"})
            elif msg.get("type") == "subscribe":
                t = msg.get("topics")
                if isinstance(t, list):
                    topics = {str(x) for x in t}

    async def stream_loop() -> None:
        last_overview = 0.0
        last_health = 0.0
        last_ping = time.time()
        ks_sig = ""
        audit_seen: Optional[str] = None
        ticket_seen: Optional[str] = None
        while True:
            if ws.client_state != WebSocketState.CONNECTED:
                break
            now = time.time()
            if token_exp and now >= float(token_exp):
                await ws.close(code=4401)
                break
            if "overview" in topics and now - last_overview >= 5:
                last_overview = now
                async with async_session_factory() as db:
                    await send({"type": "overview", "data": {"kpis": await _kpis(db)}})
            if "system_health" in topics and can_system and now - last_health >= 10:
                last_health = now
                await send({"type": "system_health", "data": await _system_health()})
            if "kill_switch" in topics and can_system:
                sw = await admin_audit.ks_all()
                sig = json.dumps(sw, sort_keys=True)
                if sig != ks_sig:
                    if ks_sig:  # فقط روی تغییر (نه اولین بار)
                        for s in sw:
                            await send({"type": "kill_switch", "data": s})
                    ks_sig = sig
            if "audit" in topics and can_audit:
                res = await admin_audit.read(limit=5)
                items = res.get("items", [])
                if items:
                    newest = items[0]["id"]
                    if audit_seen is None:
                        audit_seen = newest
                    elif newest != audit_seen:
                        for e in items:
                            if e["id"] == audit_seen:
                                break
                            await send({"type": "audit", "data": e})
                        audit_seen = newest
            if "ticket" in topics:
                evs = await admin_audit.read_ticket_events(limit=5)
                if evs:
                    newest = evs[0]["id"]
                    if ticket_seen is None:
                        ticket_seen = newest
                    elif newest != ticket_seen:
                        for e in evs:
                            if e["id"] == ticket_seen:
                                break
                            await send({"type": "ticket", "data": e})
                        ticket_seen = newest
            if now - last_ping >= PING_EVERY:
                last_ping = now
                await send({"type": "pong"})
            await asyncio.sleep(2.0)

    recv_task = asyncio.create_task(receive_loop())
    stream_task = asyncio.create_task(stream_loop())
    try:
        await asyncio.wait({recv_task, stream_task}, return_when=asyncio.FIRST_COMPLETED)
    except Exception as exc:  # noqa: BLE001
        logger.error("admin_stream_error", error=str(exc))
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
