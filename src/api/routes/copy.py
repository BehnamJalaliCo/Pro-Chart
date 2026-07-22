"""فاز ۷ — بخشِ 7A: کپی‌ترید.

قرارداد: `SERVER_HANDOFF_08_copy_signals_home_security.md` §7A. مسیرها زیرِ `/academy/copy/`.
leaderboard/trader عمومی؛ following/actions/stream نیازِ توکن (مهمان→401).

توجه: موتورِ اجرای واقعیِ کپی (اتصالِ پوزیشنِ کاربر به لیدر) هنوز نیست؛ leaderboard از
`bn_copy_leaders` (لیدرهای ادمینِ ۸D)، followها در `bn_copy_follows`، و copy-positions از
پوزیشنِ واقعیِ خودِ کاربر (LBank) با تگِ لیدر (fail-soft) می‌آیند.
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
from src.api.routes.academy import current_student
from src.core.database import async_session_factory
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.core.security import verify_access_token

logger = get_logger(__name__)
router = APIRouter()

_SORT = {"roi": "roi", "winrate": "win_rate", "followers": "followers",
         "aum": "volume", "drawdown": "max_drawdown"}
_LEAD_COLS = ("id,name,market,status,roi,win_rate,max_drawdown,followers,volume,"
              "commission_earned,profit_share,management_fee")


def _fl(v):
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _trader(r) -> dict:
    (lid, name, market, status, roi, wr, dd, followers, vol, comm, ps, mf) = r
    return {
        "id": f"t{lid}", "name": name, "avatar_url": None, "market": market,
        "verified": status == "approved", "roi": _fl(roi), "roi_30d": None,
        "win_rate": _fl(wr), "followers": followers or 0, "aum": _fl(vol),
        "max_drawdown": _fl(dd), "sharpe": None, "total_trades": None, "risk_score": None,
        "profit_share": _fl(ps), "management_fee": _fl(mf), "sparkline": None,
    }


def _reject_guest(authorization: Optional[str]) -> None:
    if not authorization or " " not in authorization:
        return
    p = verify_access_token(authorization.split(" ", 1)[1].strip())
    if p and p.get("guest"):
        raise HTTPException(status_code=401, detail={"error": {"code": "GUEST_FORBIDDEN",
                            "message": "برای کپی‌ترید وارد شو."}})


def _tid(id: str) -> int:
    raw = id[1:] if id.startswith("t") else id
    if not raw.isdigit():
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "تریدر یافت نشد."}})
    return int(raw)


# ── REST عمومی ──
@router.get("/copy/leaderboard")
async def copy_leaderboard(market: str = "", sort: str = "roi", limit: int = 50,
                           db: AsyncSession = Depends(get_db)) -> dict:
    limit = max(1, min(int(limit), 100))
    order_col = _SORT.get(sort, "roi")
    params: dict[str, Any] = {"lim": limit}
    where = ["status='approved'"]
    if market:
        where.append("market=:m"); params["m"] = market
    order_dir = "ASC" if sort == "drawdown" else "DESC"
    rows = (await db.execute(text(
        f"SELECT {_LEAD_COLS} FROM bn_copy_leaders WHERE {' AND '.join(where)} "
        f"ORDER BY {order_col} {order_dir} NULLS LAST LIMIT :lim"), params)).all()
    return {"traders": [_trader(r) for r in rows]}


@router.get("/copy/trader/{id}")
async def copy_trader(id: str, db: AsyncSession = Depends(get_db)) -> dict:
    lid = _tid(id)
    r = (await db.execute(text(f"SELECT {_LEAD_COLS} FROM bn_copy_leaders WHERE id=:i"), {"i": lid})).first()
    if not r:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "تریدر یافت نشد."}})
    # equity_curve/positions/closed_trades/monthly_roi: منبعِ ترید نداریم → fail-soft خالی
    return {"trader": _trader(r), "equity_curve": [], "open_positions": [],
            "closed_trades": [], "monthly_roi": [], "about": None}


# ── following + actions (token) ──
@router.get("/copy/following")
async def copy_following(authorization: Optional[str] = Header(None), st=Depends(current_student),
                         db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    rows = (await db.execute(text(
        "SELECT trader_id,mode,amount,status FROM bn_copy_follows WHERE student_id=:s ORDER BY id DESC"),
        {"s": st.id})).all()
    return {"following": [{"trader_id": f"t{r[0]}", "mode": r[1], "amount": _fl(r[2]), "status": r[3]}
                          for r in rows]}


@router.post("/copy/start")
async def copy_start(trader_id: str = Body(..., embed=True), mode: str = Body("fixed", embed=True),
                     amount: float = Body(..., embed=True), leverage: Optional[int] = Body(None, embed=True),
                     risk_percent: Optional[float] = Body(None, embed=True),
                     max_positions: Optional[int] = Body(None, embed=True),
                     risk_ack: bool = Body(False, embed=True),
                     authorization: Optional[str] = Header(None), st=Depends(current_student),
                     db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    if not risk_ack:
        raise HTTPException(status_code=400, detail={"error": {"code": "risk_ack_required", "message": "پذیرشِ ریسک لازم است."}})
    tid = _tid(trader_id)
    if not (await db.execute(text("SELECT 1 FROM bn_copy_leaders WHERE id=:i"), {"i": tid})).first():
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "تریدر یافت نشد."}})
    await db.execute(text(
        "INSERT INTO bn_copy_follows (student_id,trader_id,mode,amount,leverage,risk_percent,max_positions,status,created_at,updated_at) "
        "VALUES (:s,:t,:m,:a,:l,:r,:mp,'active',now(),now()) "
        "ON CONFLICT (student_id,trader_id) DO UPDATE SET mode=:m,amount=:a,leverage=:l,risk_percent=:r,"
        "max_positions=:mp,status='active',updated_at=now()"),
        {"s": st.id, "t": tid, "m": mode, "a": amount, "l": leverage, "r": risk_percent, "mp": max_positions})
    await db.commit()
    return {"accepted": True, "following": {"trader_id": trader_id, "mode": mode, "amount": _fl(amount), "status": "active"}}


async def _set_status(db, st, trader_id, status) -> dict:
    tid = _tid(trader_id)
    res = (await db.execute(text("UPDATE bn_copy_follows SET status=:st, updated_at=now() "
                                 "WHERE student_id=:s AND trader_id=:t RETURNING trader_id"),
                            {"st": status, "s": st.id, "t": tid})).first()
    if not res:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "کپیِ فعال یافت نشد."}})
    await db.commit()
    return {"accepted": True, "following": {"trader_id": trader_id, "status": status}}


@router.post("/copy/pause")
async def copy_pause(trader_id: str = Body(..., embed=True), authorization: Optional[str] = Header(None),
                     st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    return await _set_status(db, st, trader_id, "paused")


@router.post("/copy/resume")
async def copy_resume(trader_id: str = Body(..., embed=True), authorization: Optional[str] = Header(None),
                      st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    return await _set_status(db, st, trader_id, "active")


@router.post("/copy/stop")
async def copy_stop(trader_id: str = Body(..., embed=True), close_positions: bool = Body(False, embed=True),
                    authorization: Optional[str] = Header(None), st=Depends(current_student),
                    db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    tid = _tid(trader_id)
    await db.execute(text("DELETE FROM bn_copy_follows WHERE student_id=:s AND trader_id=:t"),
                     {"s": st.id, "t": tid})
    await db.commit()
    return {"accepted": True, "trader_id": trader_id, "stopped": True, "closed_positions": bool(close_positions)}


@router.post("/copy/simulate")
async def copy_simulate(trader_id: str = Body(..., embed=True), mode: str = Body("fixed", embed=True),
                        amount: float = Body(..., embed=True), authorization: Optional[str] = Header(None),
                        st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    lid = _tid(trader_id)
    r = (await db.execute(text(f"SELECT {_LEAD_COLS} FROM bn_copy_leaders WHERE id=:i"), {"i": lid})).first()
    if not r:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "تریدر یافت نشد."}})
    tr = _trader(r)
    amt = float(amount or 0)
    dd = tr.get("max_drawdown") or 0
    est_loss = amt * (dd / 100.0)
    fee = amt * ((tr.get("profit_share") or 0) / 100.0)
    warnings = []
    if dd and dd > 20:
        warnings.append("این تریدر افتِ سرمایهٔ بالایی داشته است.")
    risk_level = "high" if dd > 25 else "elevated" if dd > 12 else "normal"
    return {"trader_id": trader_id, "mode": mode, "amount": amt,
            "allocated": amt, "estimated_max_loss": round(est_loss, 2),
            "estimated_profit_share_fee_pct": tr.get("profit_share"),
            "projected_fee_on_amount": round(fee, 2), "risk_level": risk_level, "warnings": warnings}


# ── WebSocket ──
async def _authenticate(ws: WebSocket) -> Optional[dict]:
    token = ws.query_params.get("token")
    if not token:
        try:
            msg = json.loads(await asyncio.wait_for(ws.receive_text(), timeout=5.0))
        except Exception:  # noqa: BLE001
            return None
        if not isinstance(msg, dict) or msg.get("type") != "auth":
            return None
        token = msg.get("token")
    if not isinstance(token, str) or not token:
        return None
    p = verify_access_token(token)
    if not p or p.get("guest"):
        return None
    from src.core.config import settings
    central = bool(getattr(settings, "CENTRAL_AUTH_ENABLED", False)) and p.get("scope") == "app"
    if p.get("scope") != "academy" and not central:
        return None
    return p


async def _copy_snapshot(st, db) -> dict:
    """پوزیشن‌های واقعیِ کاربر (LBank) با تگِ لیدرِ فعال (fail-soft)."""
    from src.api.routes.portfolio import _lbank_keys, _map_position
    follows = (await db.execute(text("SELECT trader_id,status FROM bn_copy_follows "
                                     "WHERE student_id=:s AND status='active' ORDER BY id DESC"),
                                {"s": st.id})).all()
    lead_id = follows[0][0] if follows else None
    lead_name = None
    if lead_id is not None:
        lr = (await db.execute(text("SELECT name FROM bn_copy_leaders WHERE id=:i"), {"i": lead_id})).first()
        lead_name = lr[0] if lr else None
    positions, floating, margin = [], 0.0, 0.0
    creds = await _lbank_keys(st, db)
    if creds:
        from src.api.routes import crypto_exec
        try:
            raw = await crypto_exec.positions(*creds) or []
        except Exception:  # noqa: BLE001
            raw = []
        for rp in raw:
            mp = _map_position(rp)
            if not mp:
                continue
            mp["trader_id"] = f"t{lead_id}" if lead_id is not None else None
            mp["trader_name"] = lead_name
            positions.append(mp)
            floating += mp.get("unrealized_pnl") or 0
            margin += mp.get("margin_used") or 0
    return {"positions": positions, "summary": {"floating_pnl": floating, "roe": None, "margin": margin}}


@router.websocket("/copy/stream")
async def copy_stream(ws: WebSocket) -> None:
    await ws.accept()
    p = await _authenticate(ws)
    if p is None:
        await ws.close(code=4401)
        return
    sid = int(p.get("sid", 0) or 0)
    token_exp = p.get("exp")
    from src.core.database import AcademyStudent
    from sqlalchemy import select
    async with async_session_factory() as db:
        st = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    if st is None:
        await ws.close(code=4401)
        return

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
        async with async_session_factory() as db:
            snap = await _copy_snapshot(st, db)
        await send({"type": "snapshot", "data": snap})
        last_ping = time.time()
        last_sig = json.dumps(snap, sort_keys=True, default=str)
        while True:
            if ws.client_state != WebSocketState.CONNECTED:
                break
            now = time.time()
            if token_exp and now >= float(token_exp):
                await ws.close(code=4401)
                break
            async with async_session_factory() as db:
                snap = await _copy_snapshot(st, db)
            sig = json.dumps(snap, sort_keys=True, default=str)
            if sig != last_sig:
                last_sig = sig
                for pos in snap["positions"]:
                    await send({"type": "position", "data": pos})
            if now - last_ping >= 20:
                last_ping = now
                await send({"type": "pong"})
            await asyncio.sleep(3.0)

    rt = asyncio.create_task(recv_loop())
    stt = asyncio.create_task(stream_loop())
    try:
        await asyncio.wait({rt, stt}, return_when=asyncio.FIRST_COMPLETED)
    except Exception as exc:  # noqa: BLE001
        logger.error("copy_stream_error", error=str(exc))
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
