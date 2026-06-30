"""
آنالیتیکسِ بازدید (ادمین) — داشبوردِ دقیقِ ترافیکِ سایت.

نمای کلی، تفکیکِ منبع (سرچ/اینستا/تلگرام/…)، صفحاتِ پربازدید، کشورها، دستگاه‌ها،
ارجاع‌دهنده‌ها و فهرستِ زندهٔ آخرین بازدیدها — همگی از جدولِ visit_events.
فقط ادمین. متریک‌های اصلی انسان‌محورند (ربات‌ها جدا شمرده می‌شوند).
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_admin, get_db
from src.core.database import Admin, VisitEvent

router = APIRouter()


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=max(1, days))


async def _scalar(db: AsyncSession, q) -> int:
    return int((await db.execute(q)).scalar() or 0)


@router.get("/overview")
async def analytics_overview(
    days: int = Query(7, ge=1, le=90),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """خلاصهٔ ترافیک در بازهٔ انتخابی + تفکیک‌ها."""
    since = _since(days)
    human = and_(VisitEvent.ts >= since, VisitEvent.is_bot.is_(False))

    # ── کارت‌های کلیدی ──
    pageviews = await _scalar(db, select(func.count()).where(human))
    visitors = await _scalar(db, select(func.count(func.distinct(VisitEvent.visitor_id))).where(human))
    sessions = await _scalar(db, select(func.count(func.distinct(VisitEvent.session_id))).where(human))
    new_visitors = await _scalar(
        db, select(func.count(func.distinct(VisitEvent.visitor_id))).where(
            and_(human, VisitEvent.is_new_visitor.is_(True))
        )
    )
    bots = await _scalar(db, select(func.count()).where(
        and_(VisitEvent.ts >= since, VisitEvent.is_bot.is_(True))
    ))
    # امروز (۲۴ ساعت)
    today_since = datetime.now(timezone.utc) - timedelta(hours=24)
    today_views = await _scalar(db, select(func.count()).where(
        and_(VisitEvent.ts >= today_since, VisitEvent.is_bot.is_(False))
    ))
    today_visitors = await _scalar(db, select(func.count(func.distinct(VisitEvent.visitor_id))).where(
        and_(VisitEvent.ts >= today_since, VisitEvent.is_bot.is_(False))
    ))

    def _group(col, limit=12, cond=None):
        q = (
            select(col, func.count().label("c"))
            .where(cond if cond is not None else human)
            .group_by(col)
            .order_by(desc("c"))
            .limit(limit)
        )
        return q

    async def _rows(col, limit=12, cond=None, label="name"):
        res = await db.execute(_group(col, limit, cond))
        return [{label: (r[0] if r[0] is not None else "نامشخص"), "count": int(r[1])} for r in res.all()]

    sources = await _rows(VisitEvent.source, 12, label="source")
    source_detail = await _rows(VisitEvent.source_detail, 12, label="name")
    top_pages = await _rows(VisitEvent.path, 15, label="path")
    countries = await _rows(VisitEvent.country, 12, label="country")
    devices = await _rows(VisitEvent.device, 6, label="device")
    browsers = await _rows(VisitEvent.browser, 8, label="browser")
    os_rows = await _rows(VisitEvent.os, 8, label="os")
    referrers = await _rows(
        VisitEvent.referrer_host, 12,
        cond=and_(human, VisitEvent.referrer_host.isnot(None), VisitEvent.referrer_host != ""),
        label="host",
    )

    # ── تایم‌لاین (روزانه برای >۱ روز، ساعتی برای ۱ روز) ──
    if days <= 1:
        bucket = func.date_trunc("hour", VisitEvent.ts)
    else:
        bucket = func.date_trunc("day", VisitEvent.ts)
    tl = await db.execute(
        select(
            bucket.label("b"),
            func.count().label("views"),
            func.count(func.distinct(VisitEvent.visitor_id)).label("visitors"),
        ).where(human).group_by("b").order_by("b")
    )
    timeline = [
        {
            "t": r[0].isoformat() if hasattr(r[0], "isoformat") else str(r[0]),
            "views": int(r[1]),
            "visitors": int(r[2]),
        }
        for r in tl.all()
    ]

    return {
        "range_days": days,
        "cards": {
            "pageviews": pageviews,
            "visitors": visitors,
            "sessions": sessions,
            "new_visitors": new_visitors,
            "returning_visitors": max(0, visitors - new_visitors),
            "bots": bots,
            "today_views": today_views,
            "today_visitors": today_visitors,
        },
        "sources": sources,
        "source_detail": source_detail,
        "top_pages": top_pages,
        "countries": countries,
        "devices": devices,
        "browsers": browsers,
        "os": os_rows,
        "referrers": referrers,
        "timeline": timeline,
    }


@router.get("/live")
async def analytics_live(
    limit: int = Query(50, ge=1, le=200),
    include_bots: bool = Query(False),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """آخرین بازدیدها (فهرستِ زنده)."""
    q = select(VisitEvent).order_by(desc(VisitEvent.ts)).limit(limit)
    if not include_bots:
        q = q.where(VisitEvent.is_bot.is_(False))
    res = await db.execute(q)
    rows = res.scalars().all()
    return {
        "items": [
            {
                "ts": v.ts.isoformat() if v.ts else None,
                "path": v.path,
                "source": v.source,
                "source_detail": v.source_detail,
                "referrer_host": v.referrer_host,
                "device": v.device,
                "browser": v.browser,
                "os": v.os,
                "country": v.country,
                "country_code": v.country_code,
                "city": v.city,
                "is_bot": v.is_bot,
                "is_new_visitor": v.is_new_visitor,
                "visitor_id": (v.visitor_id or "")[:8],
            }
            for v in rows
        ]
    }


@router.get("/online")
async def analytics_online(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """تعدادِ کاربرانِ آنلاین (بازدید در ۵ دقیقهٔ اخیر)."""
    since = datetime.now(timezone.utc) - timedelta(minutes=5)
    online = await _scalar(
        db, select(func.count(func.distinct(VisitEvent.visitor_id))).where(
            and_(VisitEvent.ts >= since, VisitEvent.is_bot.is_(False))
        )
    )
    return {"online": online}
