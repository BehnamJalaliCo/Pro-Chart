"""فاز ۷ — بخشِ 7C: هوم/داشبوردِ تجمیعی.

قرارداد: `SERVER_HANDOFF_08_...md` §7C. `GET /academy/home` (توکن اختیاری).
بوت‌استرپِ یک‌درخواستی؛ بعد هر بخش از WSِ خودش زنده می‌شود. بازاستفاده از فاز۴(پرتفوی)+
فاز۶(مارکت/global)+7B(سیگنال). مهمان = نسخهٔ سبک (portfolio/subscription خالی).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Header
from sqlalchemy import select

from src.core.database import async_session_factory
from src.core.logger import get_logger
from src.core.security import verify_access_token

logger = get_logger(__name__)
router = APIRouter()


def _days_left(expires) -> Optional[int]:
    if not expires:
        return None
    delta = expires - datetime.now(timezone.utc)
    return max(0, delta.days)


async def _student(authorization: Optional[str]):
    """(student|None, is_guest). توکنِ نامعتبر/نبود/مهمان → (None|guest_student, True)."""
    if not authorization or " " not in authorization:
        return None, True
    p = verify_access_token(authorization.split(" ", 1)[1].strip())
    if not p:
        return None, True
    if p.get("guest"):
        return None, True
    sid = int(p.get("sid", 0) or 0)
    if sid <= 0:
        return None, True
    from src.core.database import AcademyStudent
    async with async_session_factory() as db:
        st = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    return st, (st is None)


async def _movers_and_mood() -> tuple[dict, list, dict]:
    from src.api.routes.markets import _all_tickers, _global
    tickers = await _all_tickers()
    withpc = [m for m in tickers if m.get("price_change_percent") is not None]
    gainers = sorted(withpc, key=lambda m: m["price_change_percent"], reverse=True)[:8]
    losers = sorted(withpc, key=lambda m: m["price_change_percent"])[:8]
    trending = sorted([m for m in tickers if m.get("is_trending")],
                      key=lambda m: m.get("quote_volume_24h") or 0, reverse=True)[:8]
    movers = {"gainers": gainers, "losers": losers, "trending": trending}
    g = await _global() or {}
    mood = {k: g.get(k) for k in ("fear_greed", "btc_dominance") if g.get(k) is not None}
    return movers, sorted(tickers, key=lambda m: m.get("quote_volume_24h") or 0, reverse=True)[:5], mood


async def _signals_block(authorization: Optional[str]) -> list:
    try:
        from src.api.routes.signals_feed import _feed, _auth_state
        is_guest, is_pro = _auth_state(authorization)
        return await _feed("crypto", 5, is_guest, is_pro)
    except Exception:  # noqa: BLE001
        return []


@router.get("/home")
async def home(authorization: Optional[str] = Header(None)) -> dict:
    st, is_guest = await _student(authorization)
    movers, top_by_vol, mood = await _movers_and_mood()
    signals = await _signals_block(authorization)

    # مشترکِ همه (عمومی)
    out: dict[str, Any] = {
        "movers": movers, "signals": signals, "market_mood": mood, "news": [],
    }

    if is_guest or st is None:
        # نسخهٔ سبکِ مهمان: watchlistِ پیش‌فرضِ عمومی، portfolio/subscription خالی
        out.update({
            "greeting": {"name": None, "tier": "guest", "days_left": None},
            "connections": {"exchange": False, "broker": False},
            "portfolio": {}, "watchlist": top_by_vol, "subscription": {},
        })
        return out

    # کاربرِ لاگین
    tier = getattr(st, "tier", "free")
    expires = getattr(st, "expires_at", None)
    out["greeting"] = {"name": getattr(st, "full_name", None) or getattr(st, "username", None),
                       "tier": tier, "days_left": _days_left(expires)}
    out["subscription"] = {"tier": tier, "days_left": _days_left(expires),
                           "expires_at": int(expires.timestamp() * 1000) if expires else None}

    # connections + portfolio + watchlist (fail-soft هرکدام)
    exchange = broker = False
    portfolio_block: dict = {}
    watchlist: list = []
    try:
        async with async_session_factory() as db:
            from src.core.database import BnExchangeAccount
            accs = (await db.execute(select(BnExchangeAccount).where(
                BnExchangeAccount.student_id == st.id))).scalars().all()
            exchange = any(a.kind == "lbank" and a.status == "active" for a in accs)
            broker = any(a.kind == "mt5" for a in accs)  # MT5 referral-only؛ معمولاً false
            # portfolio (فاز۴)
            try:
                from src.api.routes.portfolio import build_portfolio
                pf = await build_portfolio(st, db)
                ov = pf.get("overview", {})
                portfolio_block = {k: v for k, v in {
                    "total_value": ov.get("total_value"),
                    "daily_pnl": ov.get("unrealized_pnl"),
                    "daily_pnl_percent": None, "weekly_pnl_percent": None, "monthly_pnl_percent": None,
                }.items() if v is not None or k == "total_value"}
            except Exception:  # noqa: BLE001
                portfolio_block = {}
            # watchlist (فاز۶): نمادهای Favorites → تیکر
            try:
                from src.api.routes.markets import _wl_get, _all_tickers
                lists = await _wl_get(st.id)
                syms = set()
                for lst in lists:
                    for s in (lst.get("symbols") or []):
                        syms.add(str(s).upper())
                if syms:
                    tickers = await _all_tickers()
                    watchlist = [m for m in tickers if m["symbol"] in syms]
            except Exception:  # noqa: BLE001
                watchlist = []
    except Exception as e:  # noqa: BLE001
        logger.warning("home_user_block_failed", error=str(e))

    out["connections"] = {"exchange": exchange, "broker": broker}
    out["portfolio"] = portfolio_block
    out["watchlist"] = watchlist if watchlist else top_by_vol  # اگر Favorites خالی، تیکرِ پرحجم
    return out
