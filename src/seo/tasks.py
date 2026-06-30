"""
تسک‌های زمان‌بندی‌شدهٔ SEO (Celery beat):
  • mine_search_console  — روزانه: داده‌کاویِ Search Console → seo_metrics_daily + seo_actions
  • run_pagespeed        — هفتگی: QAِ سرعت/سئوی صفحاتِ کلیدی → seo_pagespeed (+اکشن اگر <آستانه)

طبقِ الگوی پروژه: تسکِ sync با event-loopِ تازه که توابعِ async را اجرا می‌کند.
هیچ خطایی نباید workerِ celery را بکشد — همه‌چیز لاگ و در نتیجه برمی‌گردد.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from src.core.config import settings
from src.core.database import (
    SeoAction,
    SeoMetricsDaily,
    SeoMonitoredUrl,
    SeoPagespeed,
    async_session_factory,
)
from src.core.celery_app import celery_app
from src.core.logger import get_logger
from src.seo import analyzer, gsc_client

logger = get_logger(__name__)


def _run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _store_daily_metrics(session, totals: list[dict]) -> int:
    n = 0
    for t in totals:
        day = datetime.fromisoformat(t["day"]).replace(tzinfo=timezone.utc)
        stmt = pg_insert(SeoMetricsDaily).values(
            day=day, clicks=t["clicks"], impressions=t["impressions"],
            ctr=t["ctr"], position=t["position"],
        ).on_conflict_do_update(
            index_elements=["day"],
            set_={"clicks": t["clicks"], "impressions": t["impressions"],
                  "ctr": t["ctr"], "position": t["position"]},
        )
        await session.execute(stmt)
        n += 1
    return n


async def _store_actions(session, actions: list[dict]) -> int:
    """ذخیرهٔ اکشن‌ها با ضدِتکرار: اگر اکشنِ open با همان dedup_key باشد، رد می‌شود."""
    if not actions:
        return 0
    keys = [a["dedup_key"] for a in actions if a.get("dedup_key")]
    existing = set()
    if keys:
        res = await session.execute(
            select(SeoAction.dedup_key).where(
                SeoAction.dedup_key.in_(keys), SeoAction.status == "open"
            )
        )
        existing = {row[0] for row in res.all()}
    created = 0
    for a in actions:
        if a.get("dedup_key") and a["dedup_key"] in existing:
            continue
        session.add(SeoAction(
            category=a["category"], severity=a["severity"], title=a["title"],
            detail=a.get("detail"), target=a.get("target"),
            metrics=a.get("metrics"), dedup_key=a.get("dedup_key"), status="open",
        ))
        created += 1
    return created


async def _mine() -> dict:
    start, end = gsc_client.period_range(28, lag_days=3)
    totals = analyzer.daily_totals(start, end)
    ctr = analyzer.mine_ctr_opportunities(start, end, settings.SEO_MIN_IMPRESSIONS)
    zero = analyzer.mine_zero_click_pages(start, end, settings.SEO_MIN_IMPRESSIONS)
    drops = analyzer.mine_rank_drops(settings.SEO_RANK_DROP_THRESHOLD)
    all_actions = ctr + zero + drops

    async with async_session_factory() as session:
        days = await _store_daily_metrics(session, totals)
        created = await _store_actions(session, all_actions)
        await session.commit()

    # purgeِ کشِ Cloudflare برای صفحاتِ علامت‌خورده (افتِ‌رتبه/بدونِ‌کلیک هدفِ URL دارند؛
    # فرصتِ CTR هدفش «کوئری» است نه URL، پس purge نمی‌شود). تا رباتِ گوگل نسخهٔ تازه ببیند.
    purged = 0
    try:
        from src.seo import cloudflare
        if cloudflare.enabled():
            page_urls = [a["target"] for a in (drops + zero)
                         if a.get("target", "").startswith("http")]
            if page_urls and cloudflare.purge_urls(page_urls):
                purged = len(set(page_urls))
    except Exception as exc:  # noqa: BLE001
        logger.warning("seo_mine_purge_failed", error=str(exc))

    summary = {
        "period": f"{start.isoformat()}..{end.isoformat()}",
        "days_stored": days,
        "ctr_opportunities": len(ctr),
        "zero_click_pages": len(zero),
        "rank_drops": len(drops),
        "actions_created": created,
        "cloudflare_purged": purged,
    }
    logger.info("seo_mine_done", **summary)
    return summary


async def _monitored_urls(session) -> list[str]:
    """URLهای فعالِ تحتِ‌نظر از DB؛ اگر خالی بود، پیش‌فرضِ config."""
    res = await session.execute(
        select(SeoMonitoredUrl.url).where(SeoMonitoredUrl.enabled.is_(True))
        .order_by(SeoMonitoredUrl.id)
    )
    urls = [r[0] for r in res.all()]
    return urls or list(settings.SEO_PAGESPEED_URLS)


async def _store_pagespeed(session, data: dict) -> None:
    session.add(SeoPagespeed(
        url=data["url"], strategy=data["strategy"],
        performance=data["performance"], seo=data["seo"],
        accessibility=data["accessibility"], best_practices=data["best_practices"],
        lcp_ms=data["lcp_ms"], cls=data["cls"], tbt_ms=data["tbt_ms"],
        fcp_ms=data.get("fcp_ms"), si_ms=data.get("si_ms"),
        issues=data["issues"],
    ))
    perf = data["performance"]
    if perf is not None and perf < settings.SEO_PAGESPEED_MIN_SCORE and data["strategy"] == "mobile":
        dk = f"ps:{data['url']}"[:120]
        exists = await session.execute(
            select(SeoAction.id).where(SeoAction.dedup_key == dk, SeoAction.status == "open"))
        if not exists.first():
            session.add(SeoAction(
                category="pagespeed", severity="high" if perf < 60 else "medium",
                title=f"امتیازِ سرعتِ پایین ({perf}) — {data['url']}",
                detail="مشکلاتِ اصلی: " + ("؛ ".join(data["issues"]) or "—"),
                target=data["url"],
                metrics={"performance": perf, "lcp_ms": data["lcp_ms"],
                         "cls": data["cls"], "tbt_ms": data["tbt_ms"]},
                dedup_key=dk, status="open",
            ))


async def _pagespeed() -> dict:
    results = []
    async with async_session_factory() as session:
        urls = await _monitored_urls(session)
        for url in urls:
            for strategy in ("mobile", "desktop"):
                try:
                    data = gsc_client.pagespeed(url, strategy=strategy)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("pagespeed_failed", url=url, strategy=strategy, error=str(exc))
                    continue
                await _store_pagespeed(session, data)
                if strategy == "mobile":
                    results.append({"url": url, "performance": data["performance"]})
        await session.commit()
    logger.info("seo_pagespeed_done", count=len(results))
    return {"checked": len(results), "results": results}


@celery_app.task(name="src.seo.tasks.mine_search_console")
def mine_search_console() -> dict:
    """داده‌کاویِ روزانهٔ Search Console (آمار + تولیدِ اکشن‌ها)."""
    try:
        return _run(_mine())
    except Exception as exc:  # noqa: BLE001
        logger.error("seo_mine_error", error=str(exc))
        return {"error": str(exc)}


@celery_app.task(name="src.seo.tasks.run_pagespeed")
def run_pagespeed() -> dict:
    """QAِ هفتگیِ PageSpeed برای صفحاتِ کلیدی."""
    try:
        return _run(_pagespeed())
    except Exception as exc:  # noqa: BLE001
        logger.error("seo_pagespeed_error", error=str(exc))
        return {"error": str(exc)}


# ─────────────────── مانیتورینگِ روزانهٔ سلامتِ Schema (URL Inspection) ───────────────────

async def _schema_health(sample: int = 15) -> dict:
    """
    سلامتِ structured data و ایندکسِ نمونه‌ای از صفحات را با URL Inspection API چک می‌کند.
    خطاهای schema یا ایندکس‌نشدن → اکشنِ SEO. سهمیهٔ API محدود است؛ نمونهٔ کوچک می‌گیریم.
    """
    from src.core.database import Article
    from src.core.config import settings as _s

    base = f"https://{_s.WEBSITE_DOMAIN}".lower().rstrip("/")
    static = [base + "/", base + "/blog", base + "/academy"]

    async with async_session_factory() as session:
        res = await session.execute(
            select(Article.slug).where(Article.is_published.is_(True))
            .order_by(Article.published_at.desc().nullslast()).limit(sample))
        slugs = [r[0] for r in res.all()]
    urls = static + [f"{base}/article/{s}" for s in slugs if s]

    checked, flagged, actions = 0, 0, []
    for url in urls:
        try:
            r = gsc_client.inspect_url(url)
        except Exception as exc:  # noqa: BLE001
            logger.warning("schema_inspect_failed", url=url, error=str(exc)[:120])
            continue
        checked += 1
        idx = r.get("indexStatusResult", {}) or {}
        rich = r.get("richResultsResult", {}) or {}

        # ۱) مشکلِ structured data
        rich_verdict = rich.get("verdict")
        bad_items = []
        for det in rich.get("detectedItems", []) or []:
            rtype = det.get("richResultType", "?")
            for it in det.get("items", []) or []:
                errs = [i for i in (it.get("issues") or []) if i.get("severity") == "ERROR"]
                if errs:
                    bad_items.append(f"{rtype}: {errs[0].get('issueMessage', 'خطا')}")
        if rich_verdict in ("FAIL", "PARTIAL") or bad_items:
            actions.append({
                "category": "schema", "severity": "high" if rich_verdict == "FAIL" else "medium",
                "title": "مشکل در داده‌های ساختاریافته (Schema)",
                "detail": ("؛ ".join(bad_items[:4]) or f"وضعیتِ Rich Results: {rich_verdict}"),
                "target": url, "metrics": {"rich_verdict": rich_verdict, "errors": bad_items[:6]},
                "dedup_key": f"schema:{url}"[:120],
            })
            flagged += 1

        # ۲) مشکلِ ایندکسِ واقعی (نه «هنوز ایندکس‌نشده»ی عادیِ سایتِ تازه).
        # فقط وضعیت‌های مشکل‌دارِ قابلِ‌اقدام علامت می‌خورند تا داشبورد پر از نویز نشود.
        coverage = (idx.get("coverageState", "") or "")
        cov_l = coverage.lower()
        _PROBLEM = ("noindex", "blocked", "redirect", "duplicate", "not found",
                    "soft 404", "excluded by", "forbidden", "unauthorized", "error", "crawl anomaly")
        if any(p in cov_l for p in _PROBLEM):
            actions.append({
                "category": "index_issue", "severity": "medium",
                "title": "مشکلِ ایندکسِ صفحه",
                "detail": f"وضعیت: {coverage}",
                "target": url, "metrics": {"coverage": coverage, "verdict": idx.get("verdict")},
                "dedup_key": f"index:{url}"[:120],
            })

    created = 0
    if actions:
        async with async_session_factory() as session:
            created = await _store_actions(session, actions)
            await session.commit()

    summary = {"checked": checked, "schema_issues": flagged, "actions_created": created}
    logger.info("seo_schema_health_done", **summary)
    return summary


@celery_app.task(name="src.seo.tasks.monitor_schema_health")
def monitor_schema_health() -> dict:
    """مانیتورینگِ روزانهٔ سلامتِ schema/ایندکسِ صفحات (URL Inspection API)."""
    try:
        return _run(_schema_health())
    except Exception as exc:  # noqa: BLE001
        logger.error("seo_schema_health_error", error=str(exc))
        return {"error": str(exc)}
