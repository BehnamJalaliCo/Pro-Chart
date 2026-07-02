"""روتر پنل ادمین (frontend/admin) — دادهٔ واقعی با شکل دقیقی که فرانت‌اند مصرف می‌کند.

فرانت‌اند پنل همه‌چیز را با پیشوند ``/admin`` و فیلدهای camelCase صدا می‌زند
(مثل ``signal.entry``/``signal.tp``/``createdAt``)، در حالی‌که routerهای پایتونی
موجود snake_case و نام‌های متفاوت برمی‌گردانند. این روتر مستقیماً از DB/Redis/سیستم
دادهٔ واقعی می‌خواند و دقیقاً مطابق قرارداد فرانت reshape می‌کند. هیچ مقدار ساختگی
تولید نمی‌شود؛ نبودِ داده = خالی/صفر/null.
"""

from __future__ import annotations

import asyncio
import glob
import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import psutil
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator, model_validator

from src.core.html_sanitizer import sanitize_article_html
from sqlalchemy import and_, func, or_, select, text

from src.api.deps import get_current_admin, get_db, get_redis
from src.core.config import settings
from src.core.database import (
    Admin,
    Article,
    Broadcast,
    ChannelMember,
    CopySettings,
    Signal,
    Subscription,
    TradingAccount,
    User,
)
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)
router = APIRouter()


async def _live_ea_metrics(uid: int) -> dict:
    """مارجین/اکوییتی/سود/پوزیشن‌های زندهٔ کاربر (در نبودِ داده dict خالی)."""
    try:
        raw = await redis_client.client.get(f"ea:status:user:{uid}")
        if not raw:
            return {}
        st = json.loads(raw)
        def f(k):
            v = st.get(k)
            try:
                return float(v) if v not in (None, "") else None
            except (TypeError, ValueError):
                return None
        positions = []
        praw = st.get("positions", "")
        if praw:
            for chunk in str(praw).split("|"):
                p = chunk.split(";")
                if len(p) >= 4:
                    positions.append({"symbol": p[0], "direction": p[1],
                                      "lots": _safe_float(p[2]), "profit": _safe_float(p[3])})
        return {
            "balance": f("balance"), "equity": f("equity"), "margin": f("margin"),
            "free_margin": f("free_margin"), "margin_level": f("margin_level"),
            "floating_pnl": f("profit"), "open_count": int(f("open") or 0),
            "currency": st.get("currency"), "positions": positions, "live": True,
        }
    except Exception:  # noqa: BLE001
        return {}


def _safe_float(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0

# وضعیت‌های بسته‌شدهٔ سیگنال (برای محاسبهٔ winrate/آمار) — نرمال‌سازی‌شده به lowercase
_CLOSED_STATUSES_LOWER = ["tp_hit", "sl_hit", "closed", "tp1_hit", "tp2_hit", "tp3_hit"]
# نسخهٔ کوئری DB هر دو حالت را پوشش می‌دهد تا ردیف‌های قدیمیِ uppercase نیز شمرده شوند
_CLOSED_STATUSES = _CLOSED_STATUSES_LOWER + [s.upper() for s in _CLOSED_STATUSES_LOWER]


# ───────────────────────── کمک‌تابع‌ها ─────────────────────────

def _fmt_dt(dt: Optional[datetime]) -> Optional[str]:
    """تاریخ-زمان خوانا (میلادی) یا None."""
    if not dt:
        return None
    return dt.strftime("%Y-%m-%d %H:%M")


def _fmt_time(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    return dt.strftime("%H:%M")


def _rel_time(dt: Optional[datetime]) -> str:
    """زمان نسبی فارسی (مثلاً «۵ دقیقه پیش»)."""
    if not dt:
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - dt
    s = int(delta.total_seconds())
    if s < 0:
        s = 0
    if s < 60:
        return f"{s} ثانیه پیش"
    if s < 3600:
        return f"{s // 60} دقیقه پیش"
    if s < 86400:
        return f"{s // 3600} ساعت پیش"
    return f"{s // 86400} روز پیش"


def _type_from_direction(direction: Optional[str]) -> str:
    d = (direction or "").lower()
    if d in ("short", "sell"):
        return "SELL"
    return "BUY"


def _f(v: Any) -> Optional[float]:
    return float(v) if v is not None else None


# ───────────────────────── داشبورد ─────────────────────────

@router.get("/dashboard/stats")
async def dashboard_stats(
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    signals_today = (await db.execute(
        select(func.count(Signal.id)).where(Signal.created_at >= today)
    )).scalar() or 0
    closed = (await db.execute(
        select(func.count(Signal.id)).where(Signal.status.in_(_CLOSED_STATUSES))
    )).scalar() or 0
    won = (await db.execute(
        select(func.count(Signal.id)).where(
            and_(Signal.pnl_pips > 0, Signal.status.in_(_CLOSED_STATUSES))
        )
    )).scalar() or 0
    total_pips = (await db.execute(
        select(func.sum(Signal.pnl_pips)).where(Signal.status.in_(_CLOSED_STATUSES))
    )).scalar() or 0

    win_rate = round((won / closed * 100), 1) if closed else 0.0
    return {
        "totalUsers": int(total_users),
        "signalsToday": int(signals_today),
        "winRate": win_rate,
        "totalProfit": round(float(total_pips), 1),
    }


@router.get("/dashboard/active-signals")
async def dashboard_active_signals(
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    rows = (await db.execute(
        select(Signal).where(Signal.status.in_(["active", "ACTIVE"]))
        .order_by(Signal.created_at.desc()).limit(20)
    )).scalars().all()
    return [
        {
            "id": s.id,
            "symbol": s.symbol,
            "type": _type_from_direction(s.direction),
            "entry": _f(s.entry_price),
            "tp": _f(s.tp1),
            "sl": _f(s.sl),
            "pnl": round(float(s.pnl_pips), 1) if s.pnl_pips is not None else 0,
            "time": _fmt_time(s.created_at),
        }
        for s in rows
    ]


@router.get("/dashboard/services")
async def dashboard_services(
    admin: Admin = Depends(get_current_admin),
):
    """وضعیت سرویس‌های اصلی از روی کانتینرهای واقعی داکر."""
    containers = await _docker_containers()
    by_name = {c["name"]: c for c in containers}
    wanted = [
        ("موتور سیگنال", "signal-engine"),
        ("ردیاب سیگنال", "signal-tracker"),
        ("داده‌خوان بازار", "data-feed"),
        ("ربات تلگرام", "bot-worker-1"),
        ("استنتاج ML", "ml-inference"),
        ("API", "api"),
    ]
    out = []
    for label, svc in wanted:
        c = _match_container(by_name, svc)
        if c and c["status"] == "running":
            st = "online"
        elif c:
            st = "warning"
        else:
            st = "offline"
        out.append({"name": label, "status": st, "uptime": c["uptime"] if c else "—"})
    return out


@router.get("/dashboard/signal-chart")
async def dashboard_signal_chart(
    days: int = Query(30, ge=1, le=365),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (await db.execute(
        select(
            func.date(Signal.created_at).label("d"),
            func.count(Signal.id),
            func.count(func.nullif(Signal.pnl_pips > 0, False)),
        ).where(Signal.created_at >= since).group_by("d").order_by("d")
    )).all()
    return [
        {"date": str(d), "signals": int(total or 0), "wins": int(wins or 0)}
        for d, total, wins in rows
    ]


@router.get("/dashboard/user-growth")
async def dashboard_user_growth(
    days: int = Query(30, ge=1, le=365),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    # تعداد قبل از بازه (پایهٔ تجمعی)
    base = (await db.execute(
        select(func.count(User.id)).where(User.joined_at < since)
    )).scalar() or 0
    rows = (await db.execute(
        select(func.date(User.joined_at).label("d"), func.count(User.id))
        .where(User.joined_at >= since).group_by("d").order_by("d")
    )).all()
    out = []
    cum = int(base)
    for d, cnt in rows:
        cum += int(cnt or 0)
        out.append({"date": str(d), "users": cum})
    if not out:
        # حداقل یک نقطهٔ واقعی امروز با کل کاربران
        total = (await db.execute(select(func.count(User.id)))).scalar() or 0
        out = [{"date": str(datetime.now(timezone.utc).date()), "users": int(total)}]
    return out


# ───────────────────────── سیگنال‌ها ─────────────────────────

def _signal_panel(s: Signal) -> dict:
    return {
        "id": s.id,
        "symbol": s.symbol,
        "type": _type_from_direction(s.direction),
        "entry": _f(s.entry_price),
        "tp1": _f(s.tp1),
        "tp2": _f(s.tp2),
        "tp3": _f(s.tp3),
        "sl": _f(s.sl),
        "status": (s.status or "").lower(),
        "score": int(s.signal_score) if s.signal_score is not None else 0,
        "pnl": round(float(s.pnl_pips), 1) if s.pnl_pips is not None else 0,
        "createdAt": _fmt_dt(s.created_at),
        "source": "manual" if (s.signal_type or "").lower() == "manual" else "auto",
    }


@router.get("/signals")
async def list_signals(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    q = select(Signal)
    cq = select(func.count(Signal.id))
    conds = []
    if search:
        conds.append(Signal.symbol.ilike(f"%{search}%"))
    if status_filter and status_filter != "all":
        conds.append(func.lower(Signal.status) == status_filter.lower())
    if type and type != "all":
        if type.upper() == "SELL":
            conds.append(func.lower(Signal.direction).in_(["short", "sell"]))
        else:
            conds.append(func.lower(Signal.direction).in_(["long", "buy"]))
    if conds:
        q = q.where(and_(*conds))
        cq = cq.where(and_(*conds))
    total = (await db.execute(cq)).scalar() or 0
    rows = (await db.execute(
        q.order_by(Signal.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    items = [_signal_panel(s) for s in rows]
    # ── سود/زیانِ لحظه‌ای برای سیگنال‌های فعال (قیمتِ زندهٔ کندل) ──
    active_syms = list({s.symbol for s in rows if (s.status or "").lower() == "active"})
    if active_syms:
        from src.api.routes.public import _live_price_map, _dir_sign
        prices = await _live_price_map(db, active_syms)
        by_id = {s.id: s for s in rows}
        for it in items:
            it["pnlPercent"] = None
            it["currentPrice"] = None
            if it["status"] == "active":
                s = by_id.get(it["id"])
                cur = prices.get(s.symbol) if s else None
                if cur is not None and s and s.entry_price:
                    entry = float(s.entry_price)
                    it["currentPrice"] = round(cur, 6)
                    if entry:
                        it["pnlPercent"] = round((cur - entry) / entry * 100.0 * _dir_sign(s.direction), 3)
    return {
        "items": items,
        "total": int(total),
        "pages": (int(total) + limit - 1) // limit,
    }


@router.get("/signals/{signal_id}")
async def get_signal(
    signal_id: int,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    s = (await db.execute(select(Signal).where(Signal.id == signal_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="سیگنال یافت نشد")
    return _signal_panel(s)


class SignalCreate(BaseModel):
    symbol: str
    type: str
    entry: float
    tp1: float
    tp2: Optional[float] = None
    tp3: Optional[float] = None
    sl: float
    description: Optional[str] = None

    @model_validator(mode="after")
    def _validate_ordering(self) -> "SignalCreate":
        # همهٔ قیمت‌ها باید مثبت باشند
        vals = [self.entry, self.tp1, self.sl]
        if self.tp2 is not None:
            vals.append(self.tp2)
        if self.tp3 is not None:
            vals.append(self.tp3)
        if any(v <= 0 for v in vals):
            raise ValueError("همهٔ قیمت‌ها باید بزرگ‌تر از صفر باشند")
        is_sell = self.type.upper() == "SELL"
        tps = [self.tp1]
        if self.tp2 is not None:
            tps.append(self.tp2)
        if self.tp3 is not None:
            tps.append(self.tp3)
        if is_sell:
            # SELL: tp1 < entry < sl و tp ها نزولی
            if not (max(tps) < self.entry < self.sl):
                raise ValueError("برای SELL باید tp < entry < sl باشد")
            if tps != sorted(tps, reverse=True):
                raise ValueError("برای SELL باید tp1 > tp2 > tp3 باشد")
        else:
            # BUY: sl < entry < tp1 و tp ها صعودی
            if not (self.sl < self.entry < min(tps)):
                raise ValueError("برای BUY باید sl < entry < tp باشد")
            if tps != sorted(tps):
                raise ValueError("برای BUY باید tp1 < tp2 < tp3 باشد")
        return self


@router.post("/signals")
async def create_signal(
    body: SignalCreate,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    s = Signal(
        symbol=body.symbol.upper(),
        direction="SELL" if body.type.upper() == "SELL" else "BUY",
        signal_type="manual",
        entry_price=body.entry,
        tp1=body.tp1,
        tp2=body.tp2,
        tp3=body.tp3,
        sl=body.sl,
        status="active",
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _signal_panel(s)


class CloseBody(BaseModel):
    reason: Optional[str] = "manual"


@router.post("/signals/{signal_id}/close")
async def close_signal(
    signal_id: int,
    body: CloseBody = CloseBody(),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    s = (await db.execute(select(Signal).where(Signal.id == signal_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="سیگنال یافت نشد")
    if (s.status or "").lower() in _CLOSED_STATUSES_LOWER:
        raise HTTPException(status_code=409, detail="سیگنال قبلاً بسته شده است")
    s.status = "closed"
    s.closed_at = datetime.now(timezone.utc)
    s.close_reason = body.reason or "manual"
    await db.commit()
    await db.refresh(s)
    return _signal_panel(s)


@router.delete("/signals/{signal_id}")
async def delete_signal(
    signal_id: int,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    s = (await db.execute(select(Signal).where(Signal.id == signal_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="سیگنال یافت نشد")
    await db.delete(s)
    await db.commit()
    return {"success": True}


# ───────────────────────── کاربران ─────────────────────────

_VALID_PLANS = {"free", "trial", "monthly", "quarterly", "biannual"}
_VALID_STATUS = {"new", "onboarding", "trial", "active", "expired"}
_PLAN_DAYS = {"trial": 2, "monthly": 30, "quarterly": 90, "biannual": 180}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _days_left(expires_at: Optional[datetime]) -> Optional[int]:
    if not expires_at:
        return None
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    delta = (expires_at - _now()).total_seconds()
    return int(delta // 86400) if delta > 0 else 0


def _full_name(u: User) -> str:
    return " ".join(x for x in [u.first_name, u.last_name] if x) or (u.username or f"user{u.id}")


def _user_row(u: User, sub: Optional[Subscription] = None) -> dict:
    return {
        "id": u.id,
        "telegramId": str(u.telegram_id),
        "name": _full_name(u),
        "username": u.username or "",
        "firstName": u.first_name or "",
        "lastName": u.last_name or "",
        "phone": u.phone_number or "",
        "plan": u.plan or "free",
        "status": (u.status or "active"),
        "isBanned": bool(u.is_banned),
        "banReason": u.ban_reason or "",
        "skillLevel": u.skill_level or "",
        "skillScore": u.skill_score,
        "language": u.language or "fa",
        "referralCode": u.referral_code or "",
        "referredBy": str(u.referred_by) if u.referred_by else "",
        "joinedAt": u.joined_at.isoformat() if u.joined_at else None,
        "joinDate": _fmt_dt(u.joined_at),
        "registrationDate": _fmt_dt(u.registration_date),
        "lastActive": _rel_time(u.last_active),
        "lastActiveAt": u.last_active.isoformat() if u.last_active else None,
        "vip": bool(sub and sub.status == "active" and _days_left(sub.expires_at)),
        "subPlan": sub.plan if sub else None,
        "subExpires": _fmt_dt(sub.expires_at) if sub else None,
        "daysLeft": _days_left(sub.expires_at) if sub else None,
    }


async def _active_sub_map(db, user_ids: list[int]) -> dict[int, Subscription]:
    """آخرین اشتراکِ فعالِ هر کاربر (برای پرهیز از N+1)."""
    if not user_ids:
        return {}
    rows = (await db.execute(
        select(Subscription)
        .where(Subscription.user_id.in_(user_ids), Subscription.status == "active")
        .order_by(Subscription.expires_at.desc())
    )).scalars().all()
    out: dict[int, Subscription] = {}
    for s in rows:
        out.setdefault(s.user_id, s)  # اولین = جدیدترین انقضا
    return out


_SORT_COLS = {
    "joined": User.joined_at,
    "lastActive": User.last_active,
    "name": User.first_name,
}


@router.get("/users")
async def list_users(
    search: Optional[str] = None,
    plan: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    skill: Optional[str] = None,
    banned: Optional[str] = None,
    vip: Optional[str] = None,
    sort: str = Query("joined"),
    order: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    conds = []
    if search:
        like = f"%{search.strip()}%"
        sub = [
            User.username.ilike(like),
            User.first_name.ilike(like),
            User.last_name.ilike(like),
            User.phone_number.ilike(like),
            User.referral_code.ilike(like),
        ]
        if search.strip().isdigit():
            sub.append(User.telegram_id == int(search.strip()))
        conds.append(or_(*sub))
    if plan and plan != "all":
        conds.append(User.plan == plan)
    if status_filter and status_filter != "all":
        conds.append(User.status == status_filter)
    if skill and skill != "all":
        conds.append(User.skill_level == skill)
    if banned in ("true", "1"):
        conds.append(User.is_banned.is_(True))
    elif banned in ("false", "0"):
        conds.append(User.is_banned.is_(False))

    q = select(User)
    cq = select(func.count(User.id))
    if conds:
        q = q.where(and_(*conds))
        cq = cq.where(and_(*conds))

    total = (await db.execute(cq)).scalar() or 0
    col = _SORT_COLS.get(sort, User.joined_at)
    col = col.asc() if order == "asc" else col.desc()
    rows = (await db.execute(
        q.order_by(col).offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    submap = await _active_sub_map(db, [u.id for u in rows])
    items = [_user_row(u, submap.get(u.id)) for u in rows]
    # فیلترِ VIP بعد از enrich (چون به subscription بستگی دارد)
    if vip in ("true", "1"):
        items = [it for it in items if it["vip"]]
    return {
        "items": items,
        "total": int(total),
        "page": page,
        "limit": limit,
        "pages": (int(total) + limit - 1) // limit,
    }


@router.get("/users/stats")
async def users_stats(
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    async def _count(*conds):
        cq = select(func.count(User.id))
        if conds:
            cq = cq.where(and_(*conds))
        return int((await db.execute(cq)).scalar() or 0)

    total = await _count()
    banned = await _count(User.is_banned.is_(True))
    today = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    week = _now() - timedelta(days=7)
    new_today = await _count(User.joined_at >= today)
    new_week = await _count(User.joined_at >= week)

    # شمارش بر اساس وضعیتِ قیف
    status_rows = (await db.execute(
        select(User.status, func.count(User.id)).group_by(User.status)
    )).all()
    by_status = {(s or "active"): int(c) for s, c in status_rows}

    plan_rows = (await db.execute(
        select(User.plan, func.count(User.id)).group_by(User.plan)
    )).all()
    by_plan = {(p or "free"): int(c) for p, c in plan_rows}

    # VIP فعال = اشتراکِ active با انقضای آینده
    vip_active = int((await db.execute(
        select(func.count(func.distinct(Subscription.user_id)))
        .where(Subscription.status == "active", Subscription.expires_at > _now())
    )).scalar() or 0)

    return {
        "total": total,
        "active": total - banned,
        "banned": banned,
        "vip": vip_active,
        "newToday": new_today,
        "newWeek": new_week,
        "byStatus": by_status,
        "byPlan": by_plan,
    }


@router.get("/users/export")
async def export_users_roster(
    search: Optional[str] = Query(None),
    plan: Optional[str] = Query(None),
    skill_level: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    is_banned: Optional[bool] = Query(None),
    has_phone: Optional[bool] = Query(None, description="فیلترِ دارا/فاقدِ شماره"),
    limit: int = Query(5000, ge=1, le=20000),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    """خروجیِ کاملِ کاربران (بدونِ صفحه‌بندی) برای پرینت/اکسلِ پشتیبانی — با شمارهٔ تماس."""
    conds = []
    if search:
        term = f"%{search.strip()}%"
        sub = [User.username.ilike(term), User.first_name.ilike(term),
               User.last_name.ilike(term), User.phone_number.ilike(term)]
        if search.strip().isdigit():
            sub.append(User.telegram_id == int(search.strip()))
        conds.append(or_(*sub))
    if plan and plan != "all":
        conds.append(User.plan == plan)
    if skill_level and skill_level != "all":
        conds.append(User.skill_level == skill_level)
    if status_filter and status_filter != "all":
        conds.append(User.status == status_filter)
    if is_banned is not None:
        conds.append(User.is_banned.is_(is_banned))
    if has_phone is True:
        conds.append(and_(User.phone_number.isnot(None), User.phone_number != ""))
    elif has_phone is False:
        conds.append(or_(User.phone_number.is_(None), User.phone_number == ""))
    q = select(User)
    if conds:
        q = q.where(and_(*conds))
    rows = (await db.execute(q.order_by(User.joined_at.desc()).limit(limit))).scalars().all()
    items = [{
        "id": u.id, "telegram_id": int(u.telegram_id),
        "username": u.username,
        "full_name": " ".join(x for x in [u.first_name, u.last_name] if x) or None,
        "first_name": u.first_name, "last_name": u.last_name,
        "phone_number": getattr(u, "phone_number", None),
        "email": getattr(u, "email", None),
        "plan": u.plan or "free", "skill_level": getattr(u, "skill_level", None),
        "skill_score": getattr(u, "skill_score", None), "status": getattr(u, "status", None),
        "is_banned": u.is_banned, "is_active": u.is_active,
        "referral_code": getattr(u, "referral_code", None),
        "joined_at": _fmt_dt(u.joined_at), "last_activity": _fmt_dt(u.last_active),
    } for u in rows]
    return {"items": items, "count": len(items),
            "filters": {"search": search, "plan": plan, "skill_level": skill_level, "is_banned": is_banned},
            "generated_at": _fmt_dt(_now())}


class GrantSignalBody(BaseModel):
    days: int = Field(ge=1, le=3650)
    message: Optional[str] = None


@router.post("/users/{user_id}/grant-signal-access")
async def grant_signal_access(
    user_id: int,
    body: GrantSignalBody,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
    redis=Depends(get_redis),
):
    """اعطای دسترسیِ رایگانِ کانالِ سیگنال برای N روز + اعلانِ آنیِ تلگرامی به کاربر."""
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")

    cur = (await db.execute(
        select(Subscription).where(
            Subscription.user_id == u.id, Subscription.status == "active"
        ).order_by(Subscription.expires_at.desc()).limit(1)
    )).scalar_one_or_none()
    base = cur.expires_at if (cur and cur.expires_at and _days_left(cur.expires_at)) else _now()
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    new_expires = base + timedelta(days=body.days)

    if cur and _days_left(cur.expires_at):
        if new_expires > cur.expires_at:
            cur.expires_at = new_expires
        cur.expiry_processed = False
    else:
        db.add(Subscription(
            user_id=u.id, telegram_id=int(u.telegram_id), plan="gift_trial",
            status="active", started_at=_now(), expires_at=new_expires, amount_usdt=0,
        ))
    u.status = "active"
    if (u.plan or "") in ("", "new", "free", "trial"):
        u.plan = "gift_trial"
    u.is_banned = False

    cm = (await db.execute(
        select(ChannelMember).where(ChannelMember.telegram_id == int(u.telegram_id))
        .order_by(ChannelMember.id.desc())
    )).scalar_one_or_none()
    if cm is None:
        db.add(ChannelMember(
            user_id=u.id, telegram_id=int(u.telegram_id),
            channel_id=settings.TELEGRAM_CHANNEL_ID, status="invited", is_active=True,
        ))
    else:
        cm.is_active = True
        cm.status = "invited"
    await db.commit()

    # لینکِ دعوت + پیامِ فعال‌سازی (event) و سپس اعلانِ شفافِ هدیه
    try:
        await redis.rpush("telegram:events", json.dumps({
            "action": "subscription_approved",
            "telegram_id": int(u.telegram_id),
            "plan_label": f"{body.days} روزه (هدیهٔ کانالِ سیگنال)",
        }))
        notify = body.message or (
            f"🎁 تبریک! به شما <b>{body.days} روز</b> دسترسیِ <b>رایگانِ کانالِ سیگنال</b> "
            f"داده شد.\nلینکِ ورود به کانال در پیامِ بعدی برایتان ارسال می‌شود. ✅"
        )
        await redis.rpush("telegram:direct_messages", json.dumps({
            "telegram_id": int(u.telegram_id), "message": notify,
        }))
    except Exception as exc:  # noqa: BLE001
        logger.warning("grant_signal_enqueue_failed", error=str(exc))

    logger.info("signal_access_granted", user_id=u.id, days=body.days, admin=admin.username)
    return {"success": True, "days": body.days, "expiresAt": _fmt_dt(new_expires),
            "daysLeft": _days_left(new_expires)}


@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")

    subs = (await db.execute(
        select(Subscription).where(Subscription.user_id == u.id)
        .order_by(Subscription.created_at.desc()).limit(20)
    )).scalars().all()
    active = next((s for s in subs if s.status == "active" and _days_left(s.expires_at)), None)

    referrals = int((await db.execute(
        select(func.count(User.id)).where(User.referred_by == u.telegram_id)
    )).scalar() or 0)

    referrer = None
    if u.referred_by:
        r = (await db.execute(
            select(User).where(User.telegram_id == u.referred_by)
        )).scalar_one_or_none()
        if r:
            referrer = {"id": r.id, "name": _full_name(r), "telegramId": str(r.telegram_id)}

    channel = (await db.execute(
        select(ChannelMember).where(ChannelMember.user_id == u.id)
        .order_by(ChannelMember.invited_at.desc()).limit(1)
    )).scalar_one_or_none()

    data = _user_row(u, active)
    data.update({
        "notifyEnabled": bool(u.notify_enabled),
        "notifyStrength": u.notify_strength or "all",
        "preferredSymbols": list(u.preferred_symbols or []),
        "referralsCount": referrals,
        "referrer": referrer,
        "channelStatus": (channel.status if channel else None),
        "subscriptions": [
            {
                "id": s.id,
                "plan": s.plan,
                "status": s.status,
                "amountUsdt": float(s.amount_usdt) if s.amount_usdt is not None else None,
                "startedAt": _fmt_dt(s.started_at),
                "expiresAt": _fmt_dt(s.expires_at),
                "daysLeft": _days_left(s.expires_at),
            }
            for s in subs
        ],
    })
    return data


class BanBody(BaseModel):
    reason: Optional[str] = ""


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: int,
    body: Optional[BanBody] = None,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
    u.is_banned = True
    u.ban_reason = (body.reason if body else "") or "بدونِ دلیل"
    await db.commit()
    await db.refresh(u)
    logger.info("user_banned", user_id=u.id, admin=admin.username)
    return _user_row(u)


@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: int,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
    u.is_banned = False
    u.ban_reason = None
    await db.commit()
    await db.refresh(u)
    return _user_row(u)


class PlanBody(BaseModel):
    plan: str

    @field_validator("plan")
    @classmethod
    def _validate_plan(cls, v: str) -> str:
        if v not in _VALID_PLANS:
            raise ValueError(f"پلن نامعتبر؛ مقادیر مجاز: {sorted(_VALID_PLANS)}")
        return v


@router.patch("/users/{user_id}/plan")
async def change_plan(
    user_id: int,
    body: PlanBody,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
    u.plan = body.plan
    await db.commit()
    await db.refresh(u)
    return _user_row(u)


class StatusBody(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _v(cls, v: str) -> str:
        if v not in _VALID_STATUS:
            raise ValueError(f"وضعیت نامعتبر؛ مجاز: {sorted(_VALID_STATUS)}")
        return v


@router.patch("/users/{user_id}/status")
async def change_status(
    user_id: int,
    body: StatusBody,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
    u.status = body.status
    await db.commit()
    await db.refresh(u)
    return _user_row(u)


class GrantBody(BaseModel):
    days: int = Field(ge=1, le=3650)
    plan: str = "monthly"

    @field_validator("plan")
    @classmethod
    def _v(cls, v: str) -> str:
        return v if v in _VALID_PLANS else "monthly"


@router.post("/users/{user_id}/grant")
async def grant_subscription(
    user_id: int,
    body: GrantBody,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
    redis=Depends(get_redis),
):
    """اعطا/تمدیدِ اشتراکِ VIP توسط ادمین — رکوردِ اشتراک می‌سازد و لینکِ کانال می‌فرستد."""
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")

    # تمدید از انقضای فعلی (اگر فعال) وگرنه از حالا
    cur = (await db.execute(
        select(Subscription).where(
            Subscription.user_id == u.id, Subscription.status == "active"
        ).order_by(Subscription.expires_at.desc()).limit(1)
    )).scalar_one_or_none()
    base = cur.expires_at if (cur and cur.expires_at and _days_left(cur.expires_at)) else _now()
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    new_expires = base + timedelta(days=body.days)

    if cur and _days_left(cur.expires_at):
        cur.expires_at = new_expires
        cur.plan = body.plan
        cur.expiry_processed = False
    else:
        db.add(Subscription(
            user_id=u.id, telegram_id=int(u.telegram_id), plan=body.plan,
            status="active", started_at=_now(), expires_at=new_expires,
        ))
    u.status = "active"
    u.plan = body.plan
    u.is_banned = False
    await db.commit()

    # ارسالِ لینکِ کانال + پیامِ فعال‌سازی از طریقِ ربات
    try:
        await redis.rpush("telegram:events", json.dumps({
            "action": "subscription_approved",
            "telegram_id": int(u.telegram_id),
            "plan_label": f"{body.days} روزه (اعطای مدیر)",
        }))
    except Exception as exc:
        logger.warning("grant_event_enqueue_failed", error=str(exc))

    await db.refresh(u)
    logger.info("subscription_granted", user_id=u.id, days=body.days, admin=admin.username)
    return {"success": True, "expiresAt": _fmt_dt(new_expires), "daysLeft": _days_left(new_expires)}


class MessageBody(BaseModel):
    message: str


@router.post("/users/{user_id}/message")
async def message_user(
    user_id: int,
    body: MessageBody,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
    redis=Depends(get_redis),
):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
    payload = json.dumps({"telegram_id": int(u.telegram_id), "message": body.message})
    await redis.rpush("telegram:direct_messages", payload)
    return {"success": True, "delivered": True}


# ───────────────────── اتو-ترید (تنظیماتِ EA) ─────────────────────

class EAConfigBody(BaseModel):
    enabled: Optional[bool] = None
    risk_percent: Optional[float] = Field(default=None, ge=0.01, le=20)
    fixed_lots: Optional[float] = Field(default=None, ge=0, le=100)
    max_lot: Optional[float] = Field(default=None, ge=0.01, le=100)
    max_open_trades: Optional[int] = Field(default=None, ge=1, le=100)
    symbol_suffix: Optional[str] = None
    set_tp_tp3: Optional[bool] = None
    breakeven_at_tp1: Optional[bool] = None
    breakeven_buffer_frac: Optional[float] = Field(default=None, ge=0, le=1)
    use_trailing: Optional[bool] = None
    trail_start_frac: Optional[float] = Field(default=None, ge=0, le=5)
    trail_distance_frac: Optional[float] = Field(default=None, ge=0.05, le=5)
    close_on_signal_gone: Optional[bool] = None
    max_spread_points: Optional[int] = Field(default=None, ge=0, le=1000)
    allowed_symbols: Optional[str] = None


@router.get("/ea-config")
async def ea_config_get(admin: Admin = Depends(get_current_admin)):
    from src.api.routes.ea import get_ea_settings
    return await get_ea_settings()


@router.post("/ea-config")
async def ea_config_set(
    body: EAConfigBody,
    admin: Admin = Depends(get_current_admin),
):
    from src.api.routes.ea import set_ea_settings
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = await set_ea_settings(patch)
    logger.info("ea_config_updated", admin=admin.username, enabled=updated.get("enabled"))
    return updated


def _num(v, d=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return d


@router.get("/ea-status")
async def ea_status(admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """وضعیتِ کاملِ اتو-ترید: اتصال به MT5 + حساب + پوزیشن‌های باز + خلاصه."""
    from src.api.routes.ea import get_ea_settings, get_ea_status, get_master_account
    import time

    s = await get_ea_settings()
    # اگر صریحاً logout شده، وضعیتِ کش‌شدهٔ قبلی را نادیده بگیر و «خارج‌شده» نشان بده
    macct = await get_master_account()
    if macct and macct.get("logout"):
        return {
            "enabled": bool(s.get("enabled")), "logged_out": True, "active_signals": 0,
            "connected": False, "ea_running": False, "mt5_connected": False,
            "trade_allowed": False, "account": "", "broker": "", "currency": "",
            "balance": 0, "equity": 0, "margin": 0, "free_margin": 0, "margin_level": 0,
            "floating_pnl": 0, "open_count": 0, "positions": [],
        }
    raw = await get_ea_status()
    active = int((await db.execute(
        select(func.count(Signal.id)).where(Signal.status == "active")
    )).scalar() or 0)

    server_ts = int(raw.get("_server_ts", 0) or 0)
    age = int(time.time()) - server_ts if server_ts else 999999
    connected = bool(raw) and age <= 20      # هارت‌بیت در ۲۰ ثانیهٔ اخیر

    # پارسِ پوزیشن‌ها: "SYM;DIR;LOTS;PROFIT|..."
    positions = []
    praw = raw.get("positions", "")
    if praw:
        for chunk in praw.split("|"):
            parts = chunk.split(";")
            if len(parts) >= 4:
                positions.append({
                    "symbol": parts[0], "direction": parts[1],
                    "lots": _num(parts[2]), "profit": _num(parts[3]),
                })

    return {
        "enabled": bool(s.get("enabled")),
        "active_signals": active,
        "connected": connected,
        "ea_running": bool(raw),
        "last_seen_age": age if server_ts else None,
        "trade_allowed": raw.get("trade_allowed") == "1",
        "term_algo": raw.get("term_algo") == "1",      # دکمهٔ Algo Trading ترمینال
        "ea_algo": raw.get("ea_algo") == "1",          # تیکِ الگو روی خودِ EA
        "acct_trade": raw.get("acct_trade") == "1",    # حساب اجازهٔ ترید دارد (نه investor)
        "acct_expert": raw.get("acct_expert") == "1",  # سرور اجازهٔ EA می‌دهد
        "mt5_connected": raw.get("connected") == "1",
        "account": raw.get("account", ""),
        "broker": raw.get("broker", ""),
        "currency": raw.get("currency", ""),
        "balance": _num(raw.get("balance")),
        "equity": _num(raw.get("equity")),
        "margin": _num(raw.get("margin")),
        "free_margin": _num(raw.get("free_margin")),
        "margin_level": _num(raw.get("margin_level")),
        "floating_pnl": _num(raw.get("profit")),
        "open_count": int(_num(raw.get("open"))),
        "positions": positions,
    }


@router.post("/ea-close-all")
async def ea_close_all(admin: Admin = Depends(get_current_admin)):
    """بستنِ همهٔ معاملاتِ اتو-ترید (افزایشِ close_all_id؛ EA در سیکلِ بعد می‌بندد)."""
    from src.api.routes.ea import get_ea_settings, set_ea_settings
    s = await get_ea_settings()
    new_id = int(s.get("close_all_id", 0)) + 1
    await set_ea_settings({"close_all_id": new_id})
    logger.info("ea_close_all", admin=admin.username, close_all_id=new_id)
    return {"ok": True, "close_all_id": new_id}


# ── حسابِ معاملاتیِ اتو-ترید (ورود/خروج از پنل) ──
class EAAccountBody(BaseModel):
    server: str = Field(min_length=2, max_length=120)
    login: str = Field(min_length=2, max_length=40)
    password: str = Field(min_length=2, max_length=120)


def _mask_login_str(login: str) -> str:
    s = str(login or "")
    return (s[:2] + "•" * max(0, len(s) - 4) + s[-2:]) if len(s) > 4 else "•" * len(s)


@router.get("/ea-account")
async def ea_account_get(admin: Admin = Depends(get_current_admin)):
    """حسابِ معاملاتیِ پیکربندی‌شدهٔ مستر (بدونِ رمز)."""
    from src.api.routes.ea import get_master_account
    acct = await get_master_account()
    if not acct or acct.get("logout"):
        return {"configured": False}
    return {"configured": True, "server": acct.get("server", ""),
            "login_masked": _mask_login_str(acct.get("login", ""))}


@router.post("/ea-account")
async def ea_account_set(body: EAAccountBody, admin: Admin = Depends(get_current_admin)):
    """ورود به حساب: مشخصات رمزنگاری‌شده ذخیره می‌شود؛ مستر خودکار با آن لاگین می‌کند."""
    from src.api.routes.ea import set_master_account
    rev = await set_master_account(body.server, body.login, body.password)
    logger.info("ea_account_login", admin=admin.username, server=body.server,
                login=_mask_login_str(body.login), rev=rev)
    return {"ok": True, "rev": rev, "note": "حساب ثبت شد؛ تا چند لحظه مستر با حسابِ جدید لاگین می‌کند."}


@router.post("/ea-account/logout")
async def ea_account_logout(admin: Admin = Depends(get_current_admin)):
    """خروج از حساب: مشخصات پاک می‌شود و مستر از حساب خارج می‌شود."""
    from src.api.routes.ea import clear_master_account
    rev = await clear_master_account()
    logger.info("ea_account_logout", admin=admin.username, rev=rev)
    return {"ok": True, "rev": rev}


# ───────────────────────── مقالات ─────────────────────────

def _slugify(title: str) -> str:
    base = "".join(c if c.isalnum() else "-" for c in title.lower()).strip("-")
    return (base or "article")[:200]


def _article_panel(a: Article) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "category": a.category or "عمومی",
        "status": "published" if a.is_published else "draft",
        "views": int(a.view_count or 0),
        "createdAt": _fmt_dt(a.created_at),
        "content": a.content or "",
    }


@router.get("/articles")
async def list_articles(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    total = (await db.execute(select(func.count(Article.id)))).scalar() or 0
    rows = (await db.execute(
        select(Article).order_by(Article.created_at.desc())
        .offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return {
        "items": [_article_panel(a) for a in rows],
        "total": int(total),
        "pages": (int(total) + limit - 1) // limit,
    }


@router.get("/articles/{article_id}")
async def get_article(
    article_id: int,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    a = (await db.execute(select(Article).where(Article.id == article_id))).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="مقاله یافت نشد")
    return _article_panel(a)


class ArticleBody(BaseModel):
    title: str
    category: Optional[str] = None
    content: str
    status: Optional[str] = "draft"


@router.post("/articles")
async def create_article(
    body: ArticleBody,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    a = Article(
        title=body.title,
        slug=_slugify(body.title) + f"-{int(datetime.now(timezone.utc).timestamp())}",
        content=sanitize_article_html(body.content),
        category=body.category,
        author_id=admin.id,
        is_published=(body.status == "published"),
        published_at=datetime.now(timezone.utc) if body.status == "published" else None,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    if a.is_published:
        try:
            from src.core.seo_notify import notify_search_engines
            await notify_search_engines([a.slug])
        except Exception:  # noqa: BLE001
            pass
    return _article_panel(a)


@router.put("/articles/{article_id}")
async def update_article(
    article_id: int,
    body: ArticleBody,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    a = (await db.execute(select(Article).where(Article.id == article_id))).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="مقاله یافت نشد")
    a.title = body.title
    a.content = sanitize_article_html(body.content)
    a.category = body.category
    was_pub = a.is_published
    a.is_published = (body.status == "published")
    if a.is_published and not was_pub:
        a.published_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(a)
    return _article_panel(a)


@router.delete("/articles/{article_id}")
async def delete_article(
    article_id: int,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    a = (await db.execute(select(Article).where(Article.id == article_id))).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="مقاله یافت نشد")
    await db.delete(a)
    await db.commit()
    return {"success": True}


# ───────────────────────── پیام‌رسانی همگانی ─────────────────────────

def _broadcast_panel(b: Broadcast) -> dict:
    if b.status in ("sent", "delivered"):
        st = "delivered"
    elif b.status == "sending":
        st = "sending"
    elif b.status == "failed":
        st = "failed"
    elif b.scheduled_at and not b.sent_at:
        st = "scheduled"
    else:
        st = b.status or "scheduled"
    return {
        "id": b.id,
        "message": b.message,
        "targetGroup": "all",
        "status": st,
        "totalRecipients": int(b.total_recipients or 0),
        "delivered": int(b.delivered_count or 0),
        "failed": int(b.failed_count or 0),
        "createdAt": _fmt_dt(b.created_at),
        "deliveredAt": _fmt_dt(b.sent_at),
    }


@router.get("/broadcasts")
async def list_broadcasts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    total = (await db.execute(select(func.count(Broadcast.id)))).scalar() or 0
    rows = (await db.execute(
        select(Broadcast).order_by(Broadcast.created_at.desc())
        .offset((page - 1) * limit).limit(limit)
    )).scalars().all()
    return {
        "items": [_broadcast_panel(b) for b in rows],
        "total": int(total),
        "pages": (int(total) + limit - 1) // limit,
    }


class BroadcastBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    targetGroup: Optional[str] = "all"
    scheduleAt: Optional[str] = None


@router.post("/broadcasts")
async def create_broadcast(
    body: BroadcastBody,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    scheduled = None
    if body.scheduleAt:
        try:
            scheduled = datetime.fromisoformat(body.scheduleAt.replace("Z", "+00:00"))
        except ValueError:
            scheduled = None
    b = Broadcast(
        message=body.message,
        scheduled_at=scheduled,
        status="scheduled" if scheduled else "draft",
        created_by=admin.id,
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return _broadcast_panel(b)


@router.get("/broadcasts/{broadcast_id}/stats")
async def broadcast_stats(
    broadcast_id: int,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    b = (await db.execute(select(Broadcast).where(Broadcast.id == broadcast_id))).scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="پیام یافت نشد")
    return _broadcast_panel(b)


# ───────────────────────── تنظیمات ─────────────────────────

_SETTINGS_KEY = "panel:settings"


def _default_settings() -> dict:
    masked_token = ""
    if settings.TELEGRAM_BOT_TOKEN:
        masked_token = settings.TELEGRAM_BOT_TOKEN[:6] + "***"
    admin_id = ""
    try:
        ids = settings.admin_ids  # property
        if ids:
            admin_id = str(ids[0])
    except Exception:  # noqa: BLE001
        admin_id = ""
    return {
        "signal": {
            "minScore": settings.MIN_SIGNAL_SCORE,
            "maxDailySignals": 20,
            "symbols": list(settings.SYMBOLS),
            "timeframes": list(settings.TIMEFRAMES),
            "autoPublish": settings.TRADING_MODE == "live",
            "requireConfirmation": settings.TRADING_MODE != "live",
        },
        "tpsl": {
            "defaultTpPips": 50,
            "defaultSlPips": 30,
            "riskRewardRatio": 1.66,
            "trailingStop": True,
            "trailingStopPips": 20,
            "tp1Percentage": 50,
            "tp2Percentage": 30,
            "tp3Percentage": 20,
            "breakEvenAfterTp1": True,
        },
        "telegram": {
            "channelId": settings.TELEGRAM_CHANNEL_ID,
            "botToken": masked_token,
            "adminChatId": admin_id,
            "notifyOnNewSignal": True,
            "notifyOnTpHit": True,
            "notifyOnSlHit": True,
            "notifyOnNewUser": False,
        },
    }


def _api_keys() -> list[dict]:
    """کلیدهای واقعیِ پیکربندی‌شده (ماسک‌شده). فقط مواردی که واقعاً ست شده‌اند."""
    out = []
    if settings.TELEGRAM_BOT_TOKEN:
        out.append({
            "id": "telegram_bot",
            "name": "Telegram Bot Token",
            "key": settings.TELEGRAM_BOT_TOKEN[:6] + "••••••",
            "status": "active",
            "lastUsed": "در حال استفاده",
        })
    if settings.PAYMENT_TRC20_ADDRESS:
        addr = settings.PAYMENT_TRC20_ADDRESS
        out.append({
            "id": "trc20",
            "name": "آدرس USDT (TRC20)",
            "key": addr[:6] + "••••" + addr[-4:],
            "status": "active",
            "lastUsed": "—",
        })
    if settings.PAYMENT_BSC_ADDRESS:
        addr = settings.PAYMENT_BSC_ADDRESS
        out.append({
            "id": "bsc",
            "name": "آدرس USDT (BEP20)",
            "key": addr[:6] + "••••" + addr[-4:],
            "status": "active",
            "lastUsed": "—",
        })
    return out


async def _merged_settings(redis) -> dict:
    base = _default_settings()
    try:
        raw = await redis.get(_SETTINGS_KEY)
        if raw:
            override = json.loads(raw)
            for section, vals in override.items():
                if section in base and isinstance(vals, dict):
                    base[section].update(vals)
    except Exception:  # noqa: BLE001
        pass
    base["apiKeys"] = _api_keys()
    return base


@router.get("/settings")
async def get_settings(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    return await _merged_settings(redis)


class _SignalSettings(BaseModel):
    model_config = {"extra": "forbid"}
    minScore: Optional[int] = Field(None, ge=0, le=100)
    maxDailySignals: Optional[int] = Field(None, ge=0, le=1000)
    symbols: Optional[list[str]] = None
    timeframes: Optional[list[str]] = None
    autoPublish: Optional[bool] = None
    requireConfirmation: Optional[bool] = None


class _TpSlSettings(BaseModel):
    model_config = {"extra": "forbid"}
    defaultTpPips: Optional[int] = Field(None, ge=0)
    defaultSlPips: Optional[int] = Field(None, ge=0)
    riskRewardRatio: Optional[float] = Field(None, ge=0)
    trailingStop: Optional[bool] = None
    trailingStopPips: Optional[int] = Field(None, ge=0)
    tp1Percentage: Optional[int] = Field(None, ge=0, le=100)
    tp2Percentage: Optional[int] = Field(None, ge=0, le=100)
    tp3Percentage: Optional[int] = Field(None, ge=0, le=100)
    breakEvenAfterTp1: Optional[bool] = None


class _TelegramSettings(BaseModel):
    model_config = {"extra": "forbid"}
    channelId: Optional[str] = None
    botToken: Optional[str] = None
    adminChatId: Optional[str] = None
    notifyOnNewSignal: Optional[bool] = None
    notifyOnTpHit: Optional[bool] = None
    notifyOnSlHit: Optional[bool] = None
    notifyOnNewUser: Optional[bool] = None


class SettingsBody(BaseModel):
    model_config = {"extra": "forbid"}
    signal: Optional[_SignalSettings] = None
    tpsl: Optional[_TpSlSettings] = None
    telegram: Optional[_TelegramSettings] = None


@router.put("/settings")
async def update_settings(
    body: SettingsBody,
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    try:
        raw = await redis.get(_SETTINGS_KEY)
        current = json.loads(raw) if raw else {}
    except Exception:  # noqa: BLE001
        current = {}
    for section in ("signal", "tpsl", "telegram"):
        sub = getattr(body, section)
        if sub is not None:
            # فقط فیلدهای ست‌شده اعمال می‌شوند (partial update)
            current.setdefault(section, {}).update(
                sub.model_dump(exclude_unset=True)
            )
    await redis.set(_SETTINGS_KEY, json.dumps(current, ensure_ascii=False))
    return await _merged_settings(redis)


@router.get("/settings/api-keys")
async def get_api_keys(
    admin: Admin = Depends(get_current_admin),
):
    return _api_keys()


@router.put("/settings/api-keys/{key_id}")
async def update_api_key(
    key_id: str,
    body: dict,
    admin: Admin = Depends(get_current_admin),
):
    # کلیدها از env می‌آیند و از پنل تغییر نمی‌کنند؛ فقط وضعیت فعلی برگردانده می‌شود.
    for k in _api_keys():
        if k["id"] == key_id:
            return k
    raise HTTPException(status_code=404, detail="کلید یافت نشد")


# ───────────────────────── عملکرد ─────────────────────────

async def _closed_signals(db, days: Optional[int] = None) -> list[Signal]:
    q = select(Signal).where(Signal.status.in_(_CLOSED_STATUSES))
    if days:
        q = q.where(Signal.closed_at >= datetime.now(timezone.utc) - timedelta(days=days))
    return list((await db.execute(q)).scalars().all())


@router.get("/performance/metrics")
async def performance_metrics(
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    sigs = await _closed_signals(db)
    wins = [s for s in sigs if (s.pnl_pips or 0) > 0]
    losses = [s for s in sigs if (s.pnl_pips or 0) <= 0]
    gross_win = sum(float(s.pnl_pips) for s in wins)
    gross_loss = abs(sum(float(s.pnl_pips) for s in losses))
    profit_factor = round(gross_win / gross_loss, 2) if gross_loss else 0.0
    avg_win = round(gross_win / len(wins), 1) if wins else 0.0
    avg_loss = round(gross_loss / len(losses), 1) if losses else 0.0

    # طولانی‌ترین رشته‌های متوالی (به‌ترتیب زمانی)
    ordered = sorted(sigs, key=lambda s: s.closed_at or s.created_at or datetime.min.replace(tzinfo=timezone.utc))
    cw = cl = mw = ml = 0
    for s in ordered:
        if (s.pnl_pips or 0) > 0:
            cw += 1
            cl = 0
        else:
            cl += 1
            cw = 0
        mw = max(mw, cw)
        ml = max(ml, cl)

    return {
        "profitFactor": profit_factor,
        "sharpeRatio": 0.0,
        "maxDrawdown": 0.0,
        "avgWin": avg_win,
        "avgLoss": avg_loss,
        "totalTrades": len(sigs),
        "consecutiveWins": mw,
        "consecutiveLosses": ml,
    }


@router.get("/performance/win-rate")
async def performance_win_rate(
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    sigs = await _closed_signals(db)

    def _rate(items):
        if not items:
            return 0.0
        w = sum(1 for s in items if (s.pnl_pips or 0) > 0)
        return round(w / len(items) * 100, 1)

    by_sym: dict[str, list] = {}
    by_tf: dict[str, list] = {}
    by_day: dict[int, list] = {}
    day_names = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه", "یکشنبه"]
    for s in sigs:
        by_sym.setdefault(s.symbol, []).append(s)
        by_tf.setdefault(s.timeframe or "—", []).append(s)
        d = (s.closed_at or s.created_at)
        if d:
            by_day.setdefault(d.weekday(), []).append(s)

    return {
        "bySymbol": [
            {"name": k, "winRate": _rate(v), "total": len(v)}
            for k, v in sorted(by_sym.items(), key=lambda x: -len(x[1]))
        ],
        "byTimeframe": [
            {"name": k, "winRate": _rate(v), "total": len(v)}
            for k, v in by_tf.items()
        ],
        "byDay": [
            {"name": day_names[d], "winRate": _rate(by_day.get(d, []))}
            for d in range(7)
        ],
    }


@router.get("/performance/heatmap")
async def performance_heatmap(
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    sigs = await _closed_signals(db)
    grid: dict[str, dict[str, list]] = {}
    for s in sigs:
        tf = (s.timeframe or "").upper()
        if tf not in ("H1", "H4", "D1"):
            continue
        grid.setdefault(s.symbol, {"H1": [], "H4": [], "D1": []})[tf].append(s)

    def _rate(items):
        if not items:
            return 0
        return round(sum(1 for s in items if (s.pnl_pips or 0) > 0) / len(items) * 100, 1)

    return [
        {"symbol": sym, "H1": _rate(tfs["H1"]), "H4": _rate(tfs["H4"]), "D1": _rate(tfs["D1"])}
        for sym, tfs in grid.items()
    ]


@router.get("/performance/equity-curve")
async def performance_equity_curve(
    days: int = Query(30, ge=1, le=365),
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    sigs = await _closed_signals(db, days=days)
    sigs = [s for s in sigs if s.closed_at]
    sigs.sort(key=lambda s: s.closed_at)
    out = []
    equity = 10000.0
    daily: dict[str, float] = {}
    for s in sigs:
        equity += float(s.pnl_dollar or 0)
        daily[str(s.closed_at.date())] = equity
    for d, eq in daily.items():
        out.append({"date": d, "equity": round(eq, 2)})
    if not out:
        out = [{"date": str(datetime.now(timezone.utc).date()), "equity": 10000.0}]
    return out


# ───────────────────────── مانیتورینگ ─────────────────────────

@router.get("/monitoring/system")
async def monitoring_system(
    admin: Admin = Depends(get_current_admin),
):
    cpu = psutil.cpu_percent(interval=0.3)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    try:
        load = os.getloadavg()
        load_str = f"{load[0]:.2f}, {load[1]:.2f}, {load[2]:.2f}"
    except OSError:
        load_str = "—"
    boot = datetime.fromtimestamp(psutil.boot_time(), tz=timezone.utc)
    up_days = (datetime.now(timezone.utc) - boot).days
    return {
        "cpu": round(cpu, 1),
        "ram": round(mem.percent, 1),
        "disk": round(disk.percent, 1),
        "cpuCores": psutil.cpu_count() or 0,
        "ramTotal": f"{mem.total / (1024**3):.0f} GB",
        "ramUsed": f"{mem.used / (1024**3):.1f} GB",
        "diskTotal": f"{disk.total / (1024**3):.0f} GB",
        "diskUsed": f"{disk.used / (1024**3):.0f} GB",
        "uptime": f"{up_days} روز",
        "loadAvg": load_str,
    }


# --- داکر از طریق سوکت یونیکس (read-only، fail-soft) ---
_DOCKER_SOCK = "/var/run/docker.sock"


async def _docker_api(path: str) -> Any:
    if not os.path.exists(_DOCKER_SOCK):
        return None
    try:
        import httpx
        transport = httpx.AsyncHTTPTransport(uds=_DOCKER_SOCK)
        async with httpx.AsyncClient(transport=transport, base_url="http://docker", timeout=5) as c:
            r = await c.get(path)
            if r.status_code == 200:
                return r.json()
    except Exception as exc:  # noqa: BLE001
        logger.debug("docker_api_failed", path=path, error=str(exc))
    return None


def _uptime_from_started(started: Any) -> str:
    if not started:
        return "—"
    try:
        if isinstance(started, (int, float)):
            # Docker /containers/json «Created» یک epoch ثانیه‌ای است
            dt = datetime.fromtimestamp(started, tz=timezone.utc)
        else:
            s = str(started).split(".")[0].replace("Z", "")
            dt = datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
        sec = int((datetime.now(timezone.utc) - dt).total_seconds())
        d, rem = divmod(sec, 86400)
        h, _ = divmod(rem, 3600)
        if d:
            return f"{d}d {h}h"
        m = rem // 60
        return f"{h}h {m}m"
    except Exception:  # noqa: BLE001
        return "—"


async def _docker_containers() -> list[dict]:
    data = await _docker_api("/containers/json?all=1")
    if not data:
        return []
    out = []
    for c in data:
        name = (c.get("Names") or ["/?"])[0].lstrip("/")
        state = c.get("State", "")
        out.append({
            "name": name,
            "status": "running" if state == "running" else "stopped",
            "cpu": "—",
            "memory": "—",
            "uptime": _uptime_from_started(c.get("Created")) or "—",
            "_id": c.get("Id"),
            "_started": c.get("Status", ""),
        })
    return out


def _match_container(by_name: dict, svc: str) -> Optional[dict]:
    for n, c in by_name.items():
        if svc in n:
            return c
    return None


@router.get("/monitoring/containers")
async def monitoring_containers(
    admin: Admin = Depends(get_current_admin),
):
    data = await _docker_api("/containers/json?all=1")
    if not data:
        return []

    async def _one(c) -> dict:
        name = (c.get("Names") or ["/?"])[0].lstrip("/")
        state = c.get("State", "")
        cid = c.get("Id")
        cpu_s, mem_s = "—", "—"
        inspect = await _docker_api(f"/containers/{cid}/json")
        started = inspect.get("State", {}).get("StartedAt") if inspect else None
        if state == "running":
            stats = await _docker_api(f"/containers/{cid}/stats?stream=false")
            if stats:
                try:
                    mem_usage = stats["memory_stats"]["usage"]
                    mem_s = f"{mem_usage / (1024**2):.0f} MB"
                    cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
                        stats["precpu_stats"]["cpu_usage"]["total_usage"]
                    sys_delta = stats["cpu_stats"]["system_cpu_usage"] - \
                        stats["precpu_stats"].get("system_cpu_usage", 0)
                    ncpu = stats["cpu_stats"].get("online_cpus") or 1
                    if sys_delta > 0:
                        cpu_s = f"{(cpu_delta / sys_delta) * ncpu * 100:.0f}%"
                except (KeyError, TypeError, ZeroDivisionError):
                    pass
        return {
            "name": name,
            "status": "running" if state == "running" else "stopped",
            "cpu": cpu_s,
            "memory": mem_s,
            "uptime": _uptime_from_started(started),
        }

    return await asyncio.gather(*[_one(c) for c in data])


@router.get("/monitoring/data-feeds")
async def monitoring_data_feeds(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    containers = await _docker_containers()
    by_name = {c["name"]: c for c in containers}
    feed_c = _match_container(by_name, "data-feed")
    feed_running = bool(feed_c and feed_c["status"] == "running")

    # تازگی قیمت‌ها از ردیس (کلیدهای واقعی price:*)
    symbols_count = 0
    last_update = None
    try:
        cur = 0
        keys: list = []
        while True:
            cur, batch = await redis.scan(cursor=cur, match="price:*", count=200)
            keys.extend(batch)
            if int(cur) == 0:
                break
        symbols_count = len(keys)
    except Exception:  # noqa: BLE001
        symbols_count = 0

    return [
        {
            "name": "yfinance (داده بازار)",
            "status": "connected" if feed_running else "offline",
            "latency": "—",
            "lastUpdate": _rel_time(last_update) if last_update else ("به‌روز" if feed_running else "—"),
            "symbols": symbols_count if symbols_count else len(settings.SYMBOLS),
        }
    ]


@router.get("/monitoring/logs")
async def monitoring_logs(
    level: Optional[str] = Query(None),
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    out = []
    try:
        raw_logs = await redis.lrange("logs:all", 0, 199)
        for i, raw in enumerate(raw_logs):
            try:
                e = json.loads(raw.decode() if isinstance(raw, bytes) else raw)
            except (ValueError, AttributeError):
                continue
            lvl = (e.get("level") or "info").lower()
            if level and level != "all" and lvl != level.lower():
                continue
            ts = e.get("timestamp") or e.get("time") or ""
            try:
                ts = datetime.fromisoformat(str(ts)).strftime("%H:%M:%S")
            except (ValueError, TypeError):
                ts = str(ts)[:8]
            out.append({
                "id": i,
                "level": lvl,
                "message": e.get("message") or e.get("event") or "",
                "timestamp": ts,
                "service": e.get("service") or e.get("logger") or "system",
            })
    except Exception:  # noqa: BLE001
        pass
    return out


# ───────────────────────── مدل‌های ML ─────────────────────────

_ML_DIR = os.getenv("ML_MODELS_DIR", "/app/ml_models")
_TYPE_LABEL = {"xgboost": "Gradient Boosting (XGBoost)", "lgbm": "Gradient Boosting (LightGBM)"}
_MODEL_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def _safe_model_path(model_id: str, suffix: str = ".joblib") -> str:
    """مسیر امن فایل مدل؛ جلوگیری از path traversal.

    فقط model_id با کاراکترهای [a-zA-Z0-9_-] پذیرفته می‌شود و مسیر
    حل‌شده باید داخل _ML_DIR بماند، در غیر این صورت 404.
    """
    if not _MODEL_ID_RE.match(model_id or ""):
        raise HTTPException(status_code=404, detail="مدل یافت نشد")
    base = os.path.realpath(_ML_DIR)
    path = os.path.realpath(os.path.join(_ML_DIR, f"{model_id}{suffix}"))
    if not (path == base or path.startswith(base + os.sep)):
        raise HTTPException(status_code=404, detail="مدل یافت نشد")
    return path


def _scan_models() -> list[dict]:
    models = []
    for path in sorted(glob.glob(os.path.join(_ML_DIR, "*.joblib"))):
        base = os.path.basename(path)
        if base.endswith("_meta.joblib"):
            continue
        stem = base[:-len(".joblib")]
        if "_" not in stem:
            continue
        algo, symbol = stem.split("_", 1)
        meta_path = os.path.join(_ML_DIR, f"{algo}_{symbol}_meta.joblib")
        feat_count = None
        if os.path.exists(meta_path):
            try:
                import joblib
                meta = joblib.load(meta_path)
                feat_count = len(meta.get("feature_columns", [])) if isinstance(meta, dict) else None
            except Exception:  # noqa: BLE001
                pass
        mtime = datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc)
        models.append({
            "id": stem,
            "name": f"{algo.upper()} · {symbol}",
            "type": _TYPE_LABEL.get(algo, algo),
            "accuracy": None,
            "precision": None,
            "recall": None,
            "f1Score": None,
            "status": "active",
            "lastTrained": _fmt_dt(mtime),
            "trainingDuration": "—",
            "dataPoints": feat_count or 0,
        })
    return models


@router.get("/ml/models")
async def ml_models(
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    """مدل‌های آموزش‌دیدهٔ واقعی (فایل‌های joblib) + متریک ثبت‌شده در DB در صورت وجود."""
    models = _scan_models()
    # تلاش برای پرکردن متریک از جدول عملکرد در صورت وجود رکورد
    try:
        from src.core.database import MLModelPerformance
        rows = (await db.execute(
            select(MLModelPerformance).order_by(MLModelPerformance.trained_at.desc())
        )).scalars().all()
        latest: dict[str, Any] = {}
        for r in rows:
            latest.setdefault(r.model_name, r)
        for m in models:
            r = latest.get(m["id"]) or latest.get(m["name"])
            if r:
                m["accuracy"] = round(float(r.accuracy) * 100, 1) if r.accuracy is not None else None
                m["precision"] = round(float(r.precision_score) * 100, 1) if r.precision_score is not None else None
                m["recall"] = round(float(r.recall_score) * 100, 1) if r.recall_score is not None else None
                m["f1Score"] = round(float(r.f1_score) * 100, 1) if r.f1_score is not None else None
                if r.training_samples:
                    m["dataPoints"] = int(r.training_samples)
    except Exception:  # noqa: BLE001
        pass
    return models


@router.get("/ml/models/{model_id}/features")
async def ml_model_features(
    model_id: str,
    admin: Admin = Depends(get_current_admin),
):
    """اهمیت فیچرهای واقعی از خود مدل آموزش‌دیده."""
    path = _safe_model_path(model_id, ".joblib")
    meta_path = _safe_model_path(model_id, "_meta.joblib")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="مدل یافت نشد")
    try:
        import joblib
        model = joblib.load(path)
        names = []
        if os.path.exists(meta_path):
            meta = joblib.load(meta_path)
            if isinstance(meta, dict):
                names = meta.get("feature_columns", [])
        importances = getattr(model, "feature_importances_", None)
        if importances is None and hasattr(model, "booster_"):
            importances = model.booster_.feature_importance(importance_type="gain")
        if importances is None:
            return []
        total = float(sum(importances)) or 1.0
        pairs = []
        for i, imp in enumerate(importances):
            nm = names[i] if i < len(names) else f"f{i}"
            pairs.append({"name": nm, "importance": round(float(imp) / total, 4)})
        pairs.sort(key=lambda x: -x["importance"])
        return pairs[:20]
    except Exception as exc:  # noqa: BLE001
        logger.warning("ml_features_failed", model=model_id, error=str(exc))
        return []


@router.post("/ml/models/{model_id}/retrain")
async def ml_retrain(
    model_id: str,
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    # درخواست بازآموزش را در صف می‌گذاریم (آموزش واقعی توسط worker/اسکریپت انجام می‌شود)
    await redis.rpush("ml:retrain_requests", json.dumps({
        "model": model_id,
        "requested_by": admin.id,
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }))
    return {"success": True, "status": "training"}


@router.get("/ml/ensemble-weights")
async def ml_ensemble_weights(
    admin: Admin = Depends(get_current_admin),
):
    # وزن‌های پیش‌فرضِ ترکیبی — inline تا از import سنگینِ src.ml.ensemble
    # (pandas_ta/numba که با NumPy 2.5 ناسازگار است) جلوگیری شود.
    default_weights = {"xgboost": 0.40, "lgbm": 0.35, "lstm": 0.25}
    # اگر override در Redis ثبت شده باشد (از طریق PUT)، همان را برمی‌گردانیم.
    try:
        raw = await redis_client.client.get("ml:ensemble_weights_override")
        if raw:
            override = json.loads(raw)
            if isinstance(override, list) and override:
                return override
    except Exception:  # noqa: BLE001
        pass
    return [{"model": k, "weight": round(float(v), 3)} for k, v in default_weights.items()]


class WeightsBody(BaseModel):
    weights: list[dict]


@router.put("/ml/ensemble-weights")
async def ml_update_weights(
    body: WeightsBody,
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    await redis.set("ml:ensemble_weights_override", json.dumps(body.weights, ensure_ascii=False))
    return body.weights


# ════════════════════════════════════════════════════════════════
#  مدیریتِ کاربرانِ پنلِ کاربری (تأیید/حذف + رصدِ موجودی و فعالیت)
# ════════════════════════════════════════════════════════════════
def _mask(login: str) -> str:
    s = str(login or "")
    return s if len(s) <= 3 else ("•" * (len(s) - 3) + s[-3:])


@router.get("/panel-users")
async def panel_users(
    q: Optional[str] = None,
    admin: Admin = Depends(get_current_admin),
    db=Depends(get_db),
):
    """فهرستِ کاربرانِ پنل (هرکس حسابِ متصل دارد یا اشتراکِ پولی) + رصدِ کامل."""
    accs = (await db.execute(select(TradingAccount).order_by(TradingAccount.id.desc()))).scalars().all()
    acc_by_uid = {a.user_id: a for a in accs}
    uids = set(acc_by_uid.keys())
    # کاربرانِ دارایِ اشتراکِ پولیِ فعال هم اضافه شوند
    paid_rows = (await db.execute(text(
        "SELECT DISTINCT u.id FROM users u JOIN subscriptions s ON s.telegram_id=u.telegram_id "
        "WHERE s.status='active' AND s.expires_at>now() AND s.plan IN ('monthly','quarterly','biannual')"
    ))).all()
    uids |= {r[0] for r in paid_rows}
    if not uids:
        return {"items": [], "total": 0}
    users = (await db.execute(select(User).where(User.id.in_(uids)))).scalars().all()
    cs_rows = (await db.execute(select(CopySettings).where(CopySettings.user_id.in_(uids)))).scalars().all()
    cs_by_uid = {c.user_id: c for c in cs_rows}
    now = datetime.now(timezone.utc)
    items = []
    for u in users:
        if q:
            hay = f"{u.first_name or ''} {u.last_name or ''} {u.username or ''} {u.email or ''} {u.telegram_id}".lower()
            if q.lower() not in hay:
                continue
        a = acc_by_uid.get(u.id)
        cs = cs_by_uid.get(u.id)
        sub = (await db.execute(text(
            "SELECT plan, expires_at FROM subscriptions WHERE telegram_id=:t AND status='active' AND expires_at>now() "
            "AND plan IN ('monthly','quarterly','biannual') ORDER BY expires_at DESC LIMIT 1"
        ), {"t": u.telegram_id})).first()
        days_left = None
        if sub and sub[1]:
            days_left = max(0, int((sub[1] - now).total_seconds() // 86400))
        live = await _live_ea_metrics(u.id)
        items.append({
            "user_id": u.id,
            "telegram_id": u.telegram_id,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username or "کاربر",
            "email": u.email,
            "email_verified": bool(u.email_verified),
            "phone": getattr(u, "phone_number", None),
            "joined_at": u.joined_at.isoformat() if getattr(u, "joined_at", None) else None,
            "plan": sub[0] if sub else (u.plan or "free"),
            "is_paid": sub is not None,
            "days_left": days_left,
            "panel_approved": bool(u.panel_approved),
            "kyc_status": u.kyc_status or "none",
            "kyc_full_name": u.kyc_full_name,
            "kyc_country": getattr(u, "kyc_country", None),
            "skill_level": u.skill_level,
            "account": ({
                "broker": a.broker, "server": a.server, "login_masked": _mask(a.login),
                "is_oneroyal": bool(a.is_oneroyal), "status": a.status,
                # موجودی/اکوییتی: اولویت با دادهٔ زندهٔ EA، در نبودش از DB
                "balance": live.get("balance") if live else (float(a.balance) if a.balance is not None else None),
                "equity": live.get("equity") if live else (float(a.equity) if a.equity is not None else None),
                "margin": live.get("margin"),
                "free_margin": live.get("free_margin"),
                "margin_level": live.get("margin_level"),
                "floating_pnl": live.get("floating_pnl"),
                "open_count": live.get("open_count", 0),
                "currency": live.get("currency") or a.currency,
                "live": bool(live),
                "last_seen_min": (int((now - a.last_seen).total_seconds() // 60) if a.last_seen else None),
                "last_trade_min": (int((now - a.last_trade_at).total_seconds() // 60) if a.last_trade_at else None),
                "warned": a.warned_at is not None,
            } if a else None),
            "copy": ({
                "enabled": bool(cs.enabled), "risk_mode": cs.risk_mode,
                "risk_value": float(cs.risk_value), "max_lot": float(cs.max_lot),
                "max_open_trades": cs.max_open_trades, "max_daily_loss_pct": float(cs.max_daily_loss_pct),
            } if cs else None),
            "copy_enabled": bool(cs.enabled) if cs else False,
        })
    return {"items": items, "total": len(items)}


@router.get("/trailing-monitor")
async def trailing_monitor(admin: Admin = Depends(get_current_admin)):
    """نظارتِ زنده: SLِ واقعیِ هر پوزیشن (مَستر + کاربران) را با trailing_slِ انتظاریِ
    سرور می‌سنجد تا مطمئن شویم سربه‌سر/تریلینگ واقعاً روی حساب اعمال شده."""
    # نقشهٔ سیگنال‌های فعال بر اساسِ id
    by_id: dict[int, dict] = {}
    try:
        for s in (await redis_client.get_all_active_signals()):
            sid = s.get("id")
            if sid is not None:
                by_id[int(sid)] = s
    except Exception:  # noqa: BLE001
        pass

    def _trail(sig: dict):
        v = sig.get("trailing_sl")
        if v in (None, "", "None", "null"):
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    def _check(raw: str, source: str) -> list[dict]:
        out = []
        for chunk in (raw or "").split("|"):
            if not chunk:
                continue
            p = chunk.split(";")
            if len(p) < 6:
                # EAِ قدیمی هنوز SL/id را نمی‌فرستد
                if p and p[0]:
                    out.append({"source": source, "symbol": p[0], "ea_reports_sl": False, "protected": None})
                continue
            try:
                sym, dr = p[0], p[1]
                sl = float(p[4] or 0)
                sid = int(float(p[5] or 0))
            except (ValueError, IndexError):
                continue
            sig = by_id.get(sid)
            trail = _trail(sig) if sig else None
            is_long = bool(sig) and str(sig.get("direction", "")).lower() in ("long", "buy")
            protected = None
            if trail and trail > 0 and sl > 0:
                protected = (sl >= trail - 1e-9) if is_long else (sl <= trail + 1e-9)
            out.append({
                "source": source, "symbol": sym, "id": sid, "direction": dr,
                "actual_sl": round(sl, 5), "expected_trail_sl": round(trail, 5) if trail else None,
                "ea_reports_sl": True, "protected": protected,
            })
        return out

    rows: list[dict] = []
    # مَستر (اتو-تریدِ پنل ادمین)
    try:
        m = await redis_client.client.get("ea:status")
        if m:
            rows += _check(json.loads(m).get("positions", ""), "master")
    except Exception:  # noqa: BLE001
        pass
    # کاربران
    try:
        cur = 0
        while True:
            cur, batch = await redis_client.client.scan(cur, match="ea:status:user:*", count=100)
            for k in batch:
                try:
                    raw = await redis_client.client.get(k)
                    if raw:
                        uid = k.split(":")[-1]
                        rows += _check(json.loads(raw).get("positions", ""), f"user:{uid}")
                except Exception:  # noqa: BLE001
                    continue
            if cur == 0:
                break
    except Exception:  # noqa: BLE001
        pass

    armed = [r for r in rows if r.get("expected_trail_sl")]
    protected_ok = [r for r in armed if r.get("protected")]
    ea_old = any(r.get("ea_reports_sl") is False for r in rows)
    return {
        "positions": rows,
        "total_open": len(rows),
        "armed": len(armed),               # پوزیشن‌هایی که باید محافظت شوند (trail_sl دارند)
        "protected_ok": len(protected_ok), # از آن‌ها چندتا SLِ واقعی‌شان درست جابه‌جا شده
        "unprotected": [r for r in armed if not r.get("protected")],
        "ea_pending_update": ea_old,       # True یعنی هنوز EAِ قدیمی (SL گزارش نمی‌دهد)
        "healthy": (len(armed) == len(protected_ok)) and not ea_old,
    }


@router.get("/panel-users/{telegram_id}")
async def panel_user_detail(telegram_id: int, admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """جزئیاتِ کاملِ یک کاربرِ پنل: حسابِ زنده + پوزیشن‌ها + اشتراک + KYC + تنظیماتِ کپی."""
    u = (await db.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    a = (await db.execute(select(TradingAccount).where(TradingAccount.user_id == u.id)
                          .order_by(TradingAccount.id.desc()))).scalars().first()
    cs = (await db.execute(select(CopySettings).where(CopySettings.user_id == u.id))).scalar_one_or_none()
    live = await _live_ea_metrics(u.id)
    now = datetime.now(timezone.utc)
    subs = (await db.execute(text(
        "SELECT plan, status, started_at, expires_at, amount_usdt FROM subscriptions "
        "WHERE telegram_id=:t ORDER BY created_at DESC LIMIT 8"
    ), {"t": telegram_id})).fetchall()
    sub_list = [{
        "plan": s[0], "status": s[1],
        "started_at": s[2].isoformat() if s[2] else None,
        "expires_at": s[3].isoformat() if s[3] else None,
        "days_left": (max(0, int((s[3] - now).total_seconds() // 86400)) if s[3] and s[1] == "active" and s[3] > now else None),
        "amount_usdt": float(s[4]) if s[4] is not None else None,
    } for s in subs]
    acc_dict = ({
        "broker": a.broker, "server": a.server, "login_masked": _mask(a.login),
        "is_oneroyal": bool(a.is_oneroyal), "status": a.status, "last_error": a.last_error,
        "balance": live.get("balance") if live else (float(a.balance) if a.balance is not None else None),
        "equity": live.get("equity") if live else (float(a.equity) if a.equity is not None else None),
        "margin": live.get("margin"), "free_margin": live.get("free_margin"),
        "margin_level": live.get("margin_level"), "floating_pnl": live.get("floating_pnl"),
        "open_count": live.get("open_count", 0), "currency": live.get("currency") or a.currency,
        "live": bool(live),
    } if a else None)
    return {
        "user_id": u.id, "telegram_id": u.telegram_id,
        "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username or "کاربر",
        "username": u.username, "email": u.email, "email_verified": bool(u.email_verified),
        "phone": getattr(u, "phone_number", None),
        "joined_at": u.joined_at.isoformat() if getattr(u, "joined_at", None) else None,
        "panel_approved": bool(u.panel_approved),
        "skill_level": u.skill_level, "skill_score": u.skill_score,
        "kyc": {
            "status": u.kyc_status or "none", "full_name": u.kyc_full_name,
            "country": getattr(u, "kyc_country", None), "dob": getattr(u, "kyc_dob", None),
            "nationality": getattr(u, "kyc_nationality", None),
        },
        "account": acc_dict,
        "positions": live.get("positions", []),
        "copy": ({
            "enabled": bool(cs.enabled), "risk_mode": cs.risk_mode, "risk_value": float(cs.risk_value),
            "max_lot": float(cs.max_lot), "max_open_trades": cs.max_open_trades,
            "copy_sl_tp": bool(cs.copy_sl_tp), "max_daily_loss_pct": float(cs.max_daily_loss_pct),
        } if cs else None),
        "subscriptions": sub_list,
        "performance": await _copy_perf(u.id),
        "risk_flags": _risk_flags(acc_dict, cs),
    }


@router.post("/panel-users/{telegram_id}/approve")
async def panel_user_approve(telegram_id: int, admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    u = (await db.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    u.panel_approved = True
    u.panel_approved_at = datetime.now(timezone.utc)
    u.panel_approved_by = getattr(admin, "id", None)
    await db.commit()
    return {"approved": True}


@router.post("/panel-users/{telegram_id}/reject")
async def panel_user_reject(telegram_id: int, admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    u = (await db.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    u.panel_approved = False
    await db.commit()
    return {"approved": False}


@router.post("/panel-users/{telegram_id}/remove")
async def panel_user_remove(telegram_id: int, admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """قطعِ اتصال: حذفِ حسابِ متصل + خاموش‌کردنِ کپی + لغوِ تأیید. کاربر می‌تواند دوباره وصل شود."""
    u = (await db.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    for a in (await db.execute(select(TradingAccount).where(TradingAccount.user_id == u.id))).scalars().all():
        await db.delete(a)
    cs = (await db.execute(select(CopySettings).where(CopySettings.user_id == u.id))).scalar_one_or_none()
    if cs:
        cs.enabled = False
    u.panel_approved = False
    await db.commit()
    return {"removed": True}


# ════════════════════════════════════════════════════════════
#  مدیریتِ حرفه‌ایِ کاربر — عملکرد + اکشن‌های کنترلی
# ════════════════════════════════════════════════════════════
async def _copy_perf(uid: int) -> dict:
    """متریک‌های عملکردِ کپیِ کاربر از تاریخچهٔ بسته‌شده (graceful اگر خالی)."""
    out = {"total": 0, "wins": 0, "win_rate": 0.0, "total_profit": 0.0,
           "best": 0.0, "worst": 0.0, "today": 0.0, "week": 0.0, "month": 0.0}
    try:
        raws = await redis_client.client.lrange(f"copy:user:{uid}:history", 0, 499)
    except Exception:  # noqa: BLE001
        return out
    if not raws:
        return out
    now = time.time()
    day, week, month = now - 86400, now - 604800, now - 2592000
    profits = []
    for r in raws:
        try:
            d = json.loads(r)
            p = float(d.get("profit", 0) or 0)
            ts = float(d.get("ts", 0) or 0)
        except Exception:  # noqa: BLE001
            continue
        profits.append(p)
        out["total_profit"] += p
        if p > 0:
            out["wins"] += 1
        if ts >= day:
            out["today"] += p
        if ts >= week:
            out["week"] += p
        if ts >= month:
            out["month"] += p
    if profits:
        out["total"] = len(profits)
        out["win_rate"] = round(out["wins"] / len(profits) * 100, 1)
        out["best"] = round(max(profits), 2)
        out["worst"] = round(min(profits), 2)
        out["total_profit"] = round(out["total_profit"], 2)
        for k in ("today", "week", "month"):
            out[k] = round(out[k], 2)
    return out


def _risk_flags(account: Optional[dict], cs: Optional[CopySettings]) -> list[str]:
    """پرچم‌های ریسک/سلامتِ حساب برای توجهِ مدیریت."""
    flags = []
    if not account:
        return flags
    if account.get("status") == "demo_blocked":
        flags.append("demo")
    ml = account.get("margin_level")
    if ml is not None and 0 < ml < 150:
        flags.append("margin_call")
    elif ml is not None and 0 < ml < 300:
        flags.append("margin_low")
    bal = account.get("balance")
    if bal is not None and bal <= 0:
        flags.append("zero_balance")
    if account.get("status") == "error" or account.get("last_error"):
        flags.append("connection_error")
    fp = account.get("floating_pnl")
    if fp is not None and bal and bal > 0 and fp < -0.1 * bal:
        flags.append("heavy_drawdown")
    return flags


class ExtendBody(BaseModel):
    days: int = Field(ge=1, le=3650)


class MessageBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class ToggleBody(BaseModel):
    enabled: bool


class KycBody(BaseModel):
    approve: bool


async def _get_user_or_404(db, telegram_id: int) -> User:
    u = (await db.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    return u


@router.post("/panel-users/{telegram_id}/extend")
async def panel_user_extend(telegram_id: int, body: ExtendBody, admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """تمدیدِ اشتراکِ فعالِ کاربر به‌اندازهٔ N روز (یا ساختِ اشتراکِ ماهانه اگر نبود)."""
    u = await _get_user_or_404(db, telegram_id)
    now = datetime.now(timezone.utc)
    sub = (await db.execute(
        select(Subscription).where(Subscription.telegram_id == telegram_id, Subscription.status == "active")
        .order_by(Subscription.expires_at.desc())
    )).scalars().first()
    if sub and sub.expires_at:
        base = sub.expires_at if sub.expires_at > now else now
        sub.expires_at = base + timedelta(days=body.days)
    else:
        sub = Subscription(user_id=u.id, telegram_id=telegram_id, plan="monthly", status="active",
                           started_at=now, expires_at=now + timedelta(days=body.days))
        db.add(sub)
    await db.commit()
    logger.info("panel_user_extended", telegram_id=telegram_id, days=body.days, admin=admin.username)
    return {"extended": True, "expires_at": sub.expires_at.isoformat()}


@router.post("/panel-users/{telegram_id}/message")
async def panel_user_message(telegram_id: int, body: MessageBody, admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """ارسالِ پیامِ مستقیمِ تلگرام به کاربر (از طریقِ صفِ bot-worker)."""
    await _get_user_or_404(db, telegram_id)
    try:
        await redis_client.client.rpush("telegram:direct_messages", json.dumps(
            {"telegram_id": telegram_id, "message": body.text}, ensure_ascii=False))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"ارسال ناموفق: {exc}")
    logger.info("panel_user_message_sent", telegram_id=telegram_id, admin=admin.username)
    return {"sent": True}


@router.post("/panel-users/{telegram_id}/copy")
async def panel_user_copy_toggle(telegram_id: int, body: ToggleBody, admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """روشن/خاموش‌کردنِ کپیِ کاربر از سمتِ مدیریت."""
    u = await _get_user_or_404(db, telegram_id)
    cs = (await db.execute(select(CopySettings).where(CopySettings.user_id == u.id))).scalar_one_or_none()
    if not cs:
        cs = CopySettings(user_id=u.id, enabled=body.enabled)
        db.add(cs)
    else:
        cs.enabled = body.enabled
    await db.commit()
    return {"enabled": body.enabled}


@router.post("/panel-users/{telegram_id}/stop")
async def panel_user_stop(telegram_id: int, admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """توقفِ اضطراریِ کپیِ کاربر (خاموش + فرمان به موتور)."""
    u = await _get_user_or_404(db, telegram_id)
    cs = (await db.execute(select(CopySettings).where(CopySettings.user_id == u.id))).scalar_one_or_none()
    if cs:
        cs.enabled = False
        await db.commit()
    try:
        await redis_client.client.rpush(f"copy:user:{u.id}:command", json.dumps({"cmd": "stop", "ts": int(time.time())}))
        await redis_client.client.expire(f"copy:user:{u.id}:command", 3600)
    except Exception:  # noqa: BLE001
        pass
    logger.info("panel_user_stopped", telegram_id=telegram_id, admin=admin.username)
    return {"stopped": True}


@router.post("/panel-users/{telegram_id}/close-all")
async def panel_user_close_all(telegram_id: int, admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """فرمانِ بستنِ همهٔ پوزیشن‌های بازِ کاربر (افزایشِ close_all_idِ per-user → EAِ کاربر می‌بندد)."""
    u = await _get_user_or_404(db, telegram_id)
    try:
        await redis_client.client.incr(f"ea:user:{u.id}:close_all_id")
        await redis_client.client.rpush(f"copy:user:{u.id}:command", json.dumps({"cmd": "close_all", "ts": int(time.time())}))
        await redis_client.client.expire(f"copy:user:{u.id}:command", 3600)
    except Exception:  # noqa: BLE001
        pass
    logger.info("panel_user_close_all", telegram_id=telegram_id, admin=admin.username)
    return {"requested": True}


@router.post("/panel-users/{telegram_id}/kyc")
async def panel_user_kyc(telegram_id: int, body: KycBody, admin: Admin = Depends(get_current_admin), db=Depends(get_db)):
    """تأیید/ردِ احرازِ هویتِ کاربر از سمتِ مدیریت."""
    u = await _get_user_or_404(db, telegram_id)
    u.kyc_status = "approved" if body.approve else "rejected"
    u.kyc_reviewed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"kyc_status": u.kyc_status}
