"""
مرکزِ فرماندهیِ سئو — پنلِ ادمین.

داده از جدول‌های seo_* (که تسک‌های Celery پر می‌کنند) + کوئریِ زندهٔ Search Console
(کش‌شده در Redis). مدیریتِ صفحاتِ تحتِ‌نظرِ PageSpeed، تستِ تکیِ on-demand، تاریخچه،
جدولِ کوئری‌ها و صفحات، و آیتم‌های اقدام. فقط ادمین.
"""

from __future__ import annotations

import asyncio
import json
from datetime import date, datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_admin, get_db, get_redis
from src.core.database import (
    Admin,
    SeoAction,
    SeoMetricsDaily,
    SeoMonitoredUrl,
    SeoPagespeed,
)
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


def _f(v):
    return float(v) if v is not None else None


# ───────────────────────────── Overview ─────────────────────────────

@router.get("/overview")
async def seo_overview(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(SeoMetricsDaily).order_by(SeoMetricsDaily.day.desc()).limit(28)
    )
    rows = list(res.scalars().all())[::-1]
    trend = [{
        "day": r.day.date().isoformat(),
        "clicks": r.clicks, "impressions": r.impressions,
        "ctr": _f(r.ctr), "position": _f(r.position),
    } for r in rows]

    def _sum(days):
        sub = rows[-days:] if rows else []
        clk = sum(x.clicks for x in sub)
        imp = sum(x.impressions for x in sub)
        return {"clicks": clk, "impressions": imp,
                "ctr": round(clk / imp, 4) if imp else None,
                "avg_position": round(sum(_f(x.position) or 0 for x in sub) / len(sub), 2) if sub else None}

    res2 = await db.execute(
        select(SeoAction.severity, func.count())
        .where(SeoAction.status == "open").group_by(SeoAction.severity))
    sev_counts = {s: c for s, c in res2.all()}
    res3 = await db.execute(
        select(SeoAction.category, func.count())
        .where(SeoAction.status == "open").group_by(SeoAction.category))
    cat_counts = {s: c for s, c in res3.all()}

    # آخرین امتیازِ موبایلِ هر URL (برای میانگینِ سلامت)
    res4 = await db.execute(
        select(SeoPagespeed).where(SeoPagespeed.strategy == "mobile")
        .order_by(SeoPagespeed.created_at.desc()).limit(40))
    seen, perfs = set(), []
    for r in res4.scalars().all():
        if r.url in seen:
            continue
        seen.add(r.url)
        if r.performance is not None:
            perfs.append(r.performance)

    return {
        "trend": trend,
        "last_7d": _sum(7),
        "last_28d": _sum(28),
        "open_actions": {"by_severity": sev_counts, "by_category": cat_counts,
                         "total": sum(sev_counts.values())},
        "avg_performance": round(sum(perfs) / len(perfs)) if perfs else None,
        "monitored_count": len(seen),
        "has_data": bool(trend),
    }


# ───────────────────────── PageSpeed: managed URLs ─────────────────────────

async def _latest_scores(db: AsyncSession, url: str) -> dict:
    """آخرین نتیجهٔ موبایل و دسکتاپ برای یک URL."""
    out = {}
    for st in ("mobile", "desktop"):
        r = (await db.execute(
            select(SeoPagespeed).where(SeoPagespeed.url == url, SeoPagespeed.strategy == st)
            .order_by(SeoPagespeed.created_at.desc()).limit(1)
        )).scalar_one_or_none()
        if r:
            out[st] = {
                "performance": r.performance, "seo": r.seo,
                "accessibility": r.accessibility, "best_practices": r.best_practices,
                "lcp_ms": _f(r.lcp_ms), "cls": _f(r.cls), "tbt_ms": _f(r.tbt_ms),
                "fcp_ms": _f(r.fcp_ms), "si_ms": _f(r.si_ms),
                "issues": r.issues or [],
                "checked_at": r.created_at.isoformat() if r.created_at else None,
            }
    return out


@router.get("/pagespeed/urls")
async def list_monitored(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(SeoMonitoredUrl).order_by(SeoMonitoredUrl.id))
    out = []
    for u in res.scalars().all():
        out.append({
            "id": u.id, "url": u.url, "label": u.label, "enabled": u.enabled,
            "scores": await _latest_scores(db, u.url),
        })
    return out


@router.post("/pagespeed/urls")
async def add_monitored(
    payload: dict = Body(...),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    url = (payload.get("url") or "").strip()
    label = (payload.get("label") or "").strip() or None
    if not url.startswith("http"):
        raise HTTPException(400, "URL باید با http(s) شروع شود.")
    exists = (await db.execute(select(SeoMonitoredUrl).where(SeoMonitoredUrl.url == url))).scalar_one_or_none()
    if exists:
        raise HTTPException(409, "این URL از قبل هست.")
    u = SeoMonitoredUrl(url=url, label=label, enabled=True)
    db.add(u)
    await db.commit()
    return {"ok": True, "id": u.id}


@router.patch("/pagespeed/urls/{url_id}")
async def toggle_monitored(
    url_id: int,
    payload: dict = Body(...),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    u = await db.get(SeoMonitoredUrl, url_id)
    if not u:
        raise HTTPException(404, "یافت نشد")
    if "enabled" in payload:
        u.enabled = bool(payload["enabled"])
    if "label" in payload:
        u.label = (payload["label"] or "").strip() or None
    await db.commit()
    return {"ok": True}


@router.delete("/pagespeed/urls/{url_id}")
async def delete_monitored(
    url_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    u = await db.get(SeoMonitoredUrl, url_id)
    if not u:
        raise HTTPException(404, "یافت نشد")
    await db.delete(u)
    await db.commit()
    return {"ok": True}


@router.post("/pagespeed/test")
async def test_url_now(
    payload: dict = Body(...),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """تستِ فوریِ یک URL (موبایل+دسکتاپ)، ذخیره و بازگرداندنِ نتیجه."""
    from src.seo import gsc_client

    url = (payload.get("url") or "").strip()
    if not url.startswith("http"):
        raise HTTPException(400, "URL نامعتبر")
    result = {}
    for st in ("mobile", "desktop"):
        try:
            data = await asyncio.to_thread(gsc_client.pagespeed, url, st)
        except Exception as exc:  # noqa: BLE001
            result[st] = {"error": str(exc)[:160]}
            continue
        db.add(SeoPagespeed(
            url=url, strategy=st, performance=data["performance"], seo=data["seo"],
            accessibility=data["accessibility"], best_practices=data["best_practices"],
            lcp_ms=data["lcp_ms"], cls=data["cls"], tbt_ms=data["tbt_ms"],
            fcp_ms=data.get("fcp_ms"), si_ms=data.get("si_ms"), issues=data["issues"],
        ))
        result[st] = {k: data[k] for k in ("performance", "seo", "accessibility",
                      "best_practices", "lcp_ms", "cls", "tbt_ms", "fcp_ms", "si_ms", "issues")}
    await db.commit()
    return {"url": url, "scores": result}


@router.get("/pagespeed/history")
async def pagespeed_history(
    url: str = Query(...),
    strategy: str = Query("mobile", pattern="^(mobile|desktop)$"),
    limit: int = Query(30, le=90),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(SeoPagespeed).where(SeoPagespeed.url == url, SeoPagespeed.strategy == strategy)
        .order_by(SeoPagespeed.created_at.desc()).limit(limit))
    rows = list(res.scalars().all())[::-1]
    return [{
        "at": r.created_at.isoformat() if r.created_at else None,
        "performance": r.performance, "seo": r.seo,
        "lcp_ms": _f(r.lcp_ms), "cls": _f(r.cls), "tbt_ms": _f(r.tbt_ms),
    } for r in rows]


# ───────────────────── Search Console: queries & pages ─────────────────────

async def _gsc_table(dimension: str, redis, days: int = 28, limit: int = 100) -> list[dict]:
    """جدولِ کوئری/صفحه از Search Console (کش‌شده ۶ ساعت در Redis)."""
    cache_key = f"seo:gsc:{dimension}:{days}"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:  # noqa: BLE001
        pass

    from src.seo import gsc_client
    start, end = gsc_client.period_range(days, lag_days=3)
    rows = await asyncio.to_thread(
        gsc_client.search_analytics, start=start, end=end,
        dimensions=[dimension], row_limit=limit)
    out = [{
        "key": r.get("keys", ["?"])[0],
        "clicks": int(r.get("clicks", 0)),
        "impressions": int(r.get("impressions", 0)),
        "ctr": round(float(r.get("ctr", 0)), 4),
        "position": round(float(r.get("position", 0)), 1),
    } for r in rows]
    out.sort(key=lambda x: x["clicks"], reverse=True)
    try:
        await redis.set(cache_key, json.dumps(out), ex=6 * 3600)
    except Exception:  # noqa: BLE001
        pass
    return out


@router.get("/queries")
async def top_queries(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    try:
        return await _gsc_table("query", redis)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"خطا در دریافت از Search Console: {str(exc)[:120]}")


@router.get("/pages")
async def top_pages(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    try:
        return await _gsc_table("page", redis)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"خطا در دریافت از Search Console: {str(exc)[:120]}")


# ───────────────────────────── Actions ─────────────────────────────

@router.get("/actions")
async def seo_actions(
    status: str = Query("open", pattern="^(open|resolved|dismissed|all)$"),
    category: str | None = None,
    limit: int = Query(200, le=500),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(SeoAction)
    if status != "all":
        q = q.where(SeoAction.status == status)
    if category:
        q = q.where(SeoAction.category == category)
    _sev = case({"high": 0, "medium": 1, "low": 2, "info": 3}, value=SeoAction.severity, else_=9)
    q = q.order_by(_sev.asc(), SeoAction.created_at.desc()).limit(limit)
    res = await db.execute(q)
    return [{
        "id": a.id, "category": a.category, "severity": a.severity,
        "title": a.title, "detail": a.detail, "target": a.target,
        "metrics": a.metrics, "status": a.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in res.scalars().all()]


@router.post("/actions/{action_id}/resolve")
async def resolve_action(action_id: int, admin: Admin = Depends(get_current_admin),
                         db: AsyncSession = Depends(get_db)):
    a = await db.get(SeoAction, action_id)
    if not a:
        raise HTTPException(404, "اکشن یافت نشد")
    a.status = "resolved"
    a.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.post("/actions/{action_id}/dismiss")
async def dismiss_action(action_id: int, admin: Admin = Depends(get_current_admin),
                         db: AsyncSession = Depends(get_db)):
    a = await db.get(SeoAction, action_id)
    if not a:
        raise HTTPException(404, "اکشن یافت نشد")
    a.status = "dismissed"
    a.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


# ───────────────────────────── Manual runs ─────────────────────────────

@router.post("/run-now")
async def run_mining_now(admin: Admin = Depends(get_current_admin)):
    from src.seo.tasks import mine_search_console
    r = mine_search_console.delay()
    return {"ok": True, "task_id": r.id}


@router.post("/pagespeed/run-now")
async def run_pagespeed_now(admin: Admin = Depends(get_current_admin)):
    from src.seo.tasks import run_pagespeed
    r = run_pagespeed.delay()
    return {"ok": True, "task_id": r.id}
