"""
داشبوردِ پیشرفتهٔ بازارنما + مدیریتِ پیشرفتهٔ کاربران — همه با دادهٔ ۱۰۰٪ واقعی.
- منابعِ سرور: psutil (CPU/RAM/دیسک/شبکه/uptime) + اطلاعاتِ واقعیِ Redis و اندازهٔ DB
- بازارِ زنده: قیمت‌های واقعی از Redis (price:*) که data-feed/crypto-ws پر می‌کنند
- اسپارک‌لاین: کندل‌های واقعی از جدولِ candles
- کاربران: حذف + عملیاتِ گروهی
همه با احرازِ get_current_admin. هیچ مقدارِ ساختگی وجود ندارد.
"""
from __future__ import annotations

import json
import time as _time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import delete as sa_delete, func, select, text

from src.api.deps import Admin, get_current_admin, get_db
from src.core.database import (
    AcademyStudent,
    ActivityLog,
    BnAiSignal,
    BnExchangeAccount,
    BnOrder,
    BnWatchlist,
)
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)
router = APIRouter()

_GUEST = "student-9%"
_PROC_START = _time.time()

# نمادهایی که می‌خواهیم در بازار نشان دهیم (هرچه در Redis باشد نمایش داده می‌شود).
_MARKET_ORDER = [
    "BTCUSDT", "ETHUSDT", "XAUUSD", "XAGUSD", "EURUSD", "GBPUSD", "USDJPY",
    "US30", "NAS100", "DE40", "XTIUSD", "USDCHF", "USDCAD", "AUDUSD",
    "NZDUSD", "EURGBP", "EURAUD", "GBPJPY", "AUDJPY",
]


# ───────────────────────── منابعِ سرور (واقعی) ─────────────────────────
@router.get("/server-metrics")
async def server_metrics(_admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """CPU/RAM/دیسک/شبکه/uptime واقعی (psutil) + Redis INFO + اندازهٔ DB. empty-safe."""
    out: dict = {"ok": True}
    try:
        import psutil  # type: ignore

        vm = psutil.virtual_memory()
        du = psutil.disk_usage("/")
        try:
            la1, la5, la15 = psutil.getloadavg()
        except Exception:  # noqa: BLE001
            la1 = la5 = la15 = 0.0
        net = psutil.net_io_counters()
        boot = getattr(psutil, "boot_time", lambda: _PROC_START)()
        out["cpu"] = {
            "percent": round(psutil.cpu_percent(interval=0.15), 1),
            "cores": psutil.cpu_count(logical=True) or 0,
            "load": [round(la1, 2), round(la5, 2), round(la15, 2)],
        }
        out["memory"] = {
            "percent": round(vm.percent, 1),
            "usedGb": round(vm.used / 1e9, 2),
            "totalGb": round(vm.total / 1e9, 2),
        }
        out["disk"] = {
            "percent": round(du.percent, 1),
            "usedGb": round(du.used / 1e9, 1),
            "totalGb": round(du.total / 1e9, 1),
        }
        out["network"] = {
            "sentGb": round(net.bytes_sent / 1e9, 2),
            "recvGb": round(net.bytes_recv / 1e9, 2),
        }
        out["uptimeSec"] = int(max(0, _time.time() - boot))
    except Exception as exc:  # noqa: BLE001
        logger.warning("server_metrics_psutil_failed", error=str(exc))
        out.setdefault("cpu", {"percent": 0, "cores": 0, "load": [0, 0, 0]})
        out.setdefault("memory", {"percent": 0, "usedGb": 0, "totalGb": 0})
        out.setdefault("disk", {"percent": 0, "usedGb": 0, "totalGb": 0})
        out.setdefault("network", {"sentGb": 0, "recvGb": 0})
        out.setdefault("uptimeSec", 0)

    # Redis INFO واقعی
    try:
        info = await redis_client.client.info()
        out["redis"] = {
            "usedMemoryMb": round(int(info.get("used_memory", 0)) / 1e6, 1),
            "clients": int(info.get("connected_clients", 0)),
            "opsPerSec": int(info.get("instantaneous_ops_per_sec", 0)),
            "hits": int(info.get("keyspace_hits", 0)),
            "misses": int(info.get("keyspace_misses", 0)),
            "up": True,
        }
    except Exception as exc:  # noqa: BLE001
        out["redis"] = {"up": False}

    # اندازهٔ واقعیِ دیتابیس + تعداد اتصال‌ها
    try:
        size = (await db.execute(text("SELECT pg_database_size(current_database())"))).scalar() or 0
        conns = (await db.execute(text("SELECT count(*) FROM pg_stat_activity"))).scalar() or 0
        out["database"] = {"sizeMb": round(int(size) / 1e6, 1), "connections": int(conns), "up": True}
    except Exception:  # noqa: BLE001
        out["database"] = {"up": False}

    return out


# ───────────────────────── بازارِ زنده (واقعی) ─────────────────────────
async def _read_price(sym: str) -> dict | None:
    try:
        raw = await redis_client.client.get(f"price:{sym}")
        if not raw:
            return None
        d = json.loads(raw)
        bid = float(d.get("bid") or d.get("last") or 0)
        ask = float(d.get("ask") or d.get("last") or 0)
        last = float(d.get("last") or bid or 0)
        return {
            "symbol": sym,
            "bid": bid,
            "ask": ask,
            "last": last,
            "source": d.get("source"),
            "timestamp": d.get("timestamp"),
        }
    except Exception:  # noqa: BLE001
        return None


async def _daily_change(db, sym: str, last: float) -> float:
    """درصدِ تغییرِ واقعی نسبت به کندلِ روزِ قبل (از جدولِ candles)."""
    if not last:
        return 0.0
    try:
        row = (
            await db.execute(
                text(
                    "SELECT close FROM candles WHERE symbol=:s AND time <= now() - interval '24 hours' "
                    "ORDER BY time DESC LIMIT 1"
                ),
                {"s": sym},
            )
        ).scalar()
        if row:
            prev = float(row)
            if prev:
                return round((last - prev) / prev * 100.0, 2)
    except Exception:  # noqa: BLE001
        pass
    return 0.0


@router.get("/market")
async def market(_admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """قیمت‌های زندهٔ واقعی از Redis + درصدِ تغییرِ روزانه از candles. empty-safe."""
    # نمادهای موجود در Redis
    present = []
    for s in _MARKET_ORDER:
        p = await _read_price(s)
        if p:
            present.append(p)
    # هر نمادِ price:* دیگری که در لیست نبود
    try:
        keys = []
        async for k in redis_client.client.scan_iter(match="price:*", count=200):
            keys.append(k.decode() if isinstance(k, bytes) else k)
        seen = {p["symbol"] for p in present}
        for k in keys:
            sym = k.split("price:", 1)[-1]
            if sym not in seen:
                p = await _read_price(sym)
                if p:
                    present.append(p)
    except Exception:  # noqa: BLE001
        pass
    for p in present:
        p["changePct"] = await _daily_change(db, p["symbol"], p["last"])
    movers = sorted(present, key=lambda x: x.get("changePct", 0), reverse=True)
    return {
        "items": present,
        "count": len(present),
        "topGainers": movers[:5],
        "topLosers": list(reversed(movers[-5:])) if len(movers) >= 5 else [],
        "serverTime": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/market/{symbol}/spark")
async def market_spark(symbol: str, n: int = 40, _admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """آخرین n کندلِ واقعی برای اسپارک‌لاین (کوچک‌ترین تایم‌فریمِ موجود)."""
    n = max(5, min(int(n or 40), 200))
    try:
        rows = (
            await db.execute(
                text(
                    "SELECT time, close FROM candles WHERE symbol=:s ORDER BY time DESC LIMIT :n"
                ),
                {"s": symbol.upper(), "n": n},
            )
        ).all()
        pts = [{"t": r[0].isoformat(), "c": float(r[1])} for r in reversed(rows)]
        return {"symbol": symbol.upper(), "points": pts, "count": len(pts)}
    except Exception:  # noqa: BLE001
        return {"symbol": symbol.upper(), "points": [], "count": 0}


# ───────────────────── مدیریتِ پیشرفتهٔ کاربران ─────────────────────
async def _log(db, admin, action: str, uid, details: dict | None = None):
    try:
        db.add(ActivityLog(action=action, entity_type="bn_user", entity_id=int(uid) if uid else None,
                           admin_id=getattr(admin, "id", None), details=details or {}))
        await db.flush()
    except Exception:  # noqa: BLE001
        pass


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """حذفِ کاملِ کاربر + دادهٔ وابسته (واچ‌لیست/سیگنال/سفارش/صرافی)."""
    s = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == user_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
    uname = s.username
    for model in (BnWatchlist, BnAiSignal, BnOrder, BnExchangeAccount):
        try:
            await db.execute(sa_delete(model).where(model.student_id == user_id))
        except Exception:  # noqa: BLE001
            pass
    await db.execute(sa_delete(AcademyStudent).where(AcademyStudent.id == user_id))
    await _log(db, admin, "bn_user_delete", user_id, {"username": uname})
    return {"ok": True, "id": user_id, "username": uname}


@router.post("/users/bulk")
async def bulk_users(
    action: str = Body(..., embed=True),
    ids: list[int] = Body(..., embed=True),
    tier: str | None = Body(None, embed=True),
    days: int = Body(30, embed=True),
    status: str | None = Body(None, embed=True),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    """عملیاتِ گروهی: set-tier | set-status | delete روی چند کاربر."""
    ids = [int(i) for i in (ids or [])][:1000]
    if not ids:
        return {"ok": True, "affected": 0}
    rows = (await db.execute(select(AcademyStudent).where(AcademyStudent.id.in_(ids)))).scalars().all()
    n = 0
    now = datetime.now(timezone.utc)
    for s in rows:
        if action == "set-tier" and tier in ("free", "vip", "premium"):
            s.tier = tier
            s.expires_at = None if tier == "free" else (now + timedelta(days=max(1, int(days or 30))))
            n += 1
        elif action == "set-status" and status in ("active", "disabled"):
            s.status = status
            n += 1
        elif action == "delete":
            for model in (BnWatchlist, BnAiSignal, BnOrder, BnExchangeAccount):
                try:
                    await db.execute(sa_delete(model).where(model.student_id == s.id))
                except Exception:  # noqa: BLE001
                    pass
            await db.execute(sa_delete(AcademyStudent).where(AcademyStudent.id == s.id))
            n += 1
    await _log(db, admin, f"bn_user_bulk_{action}", None, {"count": n, "ids": ids[:50]})
    return {"ok": True, "affected": n, "action": action}
