"""
داده‌کاویِ Search Console → آیتم‌های «SEO Action Required».

سه سیگنالِ ارزشمند را بیرون می‌کشد:
  ۱) فرصتِ CTR — کوئری‌هایی با impressionِ بالا ولی CTRِ خیلی پایین‌تر از انتظارِ
     رتبه‌شان (یعنی رتبه خوب است اما عنوان/توضیحات کلیک نمی‌گیرد → بازنویسیِ title/meta).
  ۲) افتِ رتبه — صفحاتی که میانگینِ positionِشان نسبت به دورهٔ قبل بدتر شده.
  ۳) صفحاتِ بدونِ کلیک — impression دارند ولی صفر کلیک (محتوای ضعیف/نامرتبط با intent).

خروجیِ هر تابع: فهرستِ dict با کلیدهای category/severity/title/detail/target/
metrics/dedup_key — آمادهٔ ذخیره در جدولِ seo_actions.
"""

from __future__ import annotations

from datetime import date

from src.seo import gsc_client as gsc

# منحنیِ تقریبیِ CTRِ موردانتظار بر اساسِ میانگینِ position (دادهٔ صنعتی).
_EXPECTED_CTR = {
    1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.07,
    6: 0.05, 7: 0.04, 8: 0.032, 9: 0.028, 10: 0.025,
}


def _expected_ctr(position: float) -> float:
    p = int(round(position))
    if p <= 0:
        return 0.28
    if p <= 10:
        return _EXPECTED_CTR[p]
    return 0.015  # صفحهٔ دوم و بعد


def _sev_by_impressions(impr: int) -> str:
    if impr >= 1000:
        return "high"
    if impr >= 300:
        return "medium"
    return "low"


def mine_ctr_opportunities(start: date, end: date, min_impr: int) -> list[dict]:
    """کوئری‌هایی با رتبهٔ خوب ولی CTRِ بسیار پایین‌تر از انتظار."""
    rows = gsc.search_analytics(start=start, end=end, dimensions=["query"], row_limit=5000)
    out: list[dict] = []
    for r in rows:
        impr = int(r.get("impressions", 0))
        pos = float(r.get("position", 99))
        ctr = float(r.get("ctr", 0))
        if impr < min_impr or pos > 20:
            continue
        exp = _expected_ctr(pos)
        # فقط وقتی CTR کمتر از نصفِ انتظار است (فرصتِ واقعی، نه نویز).
        if ctr >= exp * 0.5:
            continue
        query = r.get("keys", ["?"])[0]
        gap = round((exp - ctr) * impr)  # کلیکِ ازدست‌رفتهٔ تخمینی در این بازه
        out.append({
            "category": "ctr_opportunity",
            "severity": _sev_by_impressions(impr),
            "title": f"CTRِ پایین برای «{query}»",
            "detail": (
                f"رتبهٔ میانگین {pos:.1f} (خوب) اما CTR فقط {ctr*100:.1f}٪ "
                f"در برابرِ انتظارِ ~{exp*100:.0f}٪. با بازنویسیِ title/meta برای این کوئری "
                f"حدوداً {gap} کلیکِ بیشتر در ماه ممکن است. "
                f"({impr:,} impression)"
            ),
            "target": query,
            "metrics": {"impressions": impr, "position": round(pos, 1), "ctr": round(ctr, 4),
                        "expected_ctr": exp, "lost_clicks_est": gap},
            "dedup_key": f"ctr:{query}"[:120],
        })
    out.sort(key=lambda a: a["metrics"]["lost_clicks_est"], reverse=True)
    return out[:25]


def mine_zero_click_pages(start: date, end: date, min_impr: int) -> list[dict]:
    """صفحاتی که impression دارند ولی هیچ کلیکی نگرفته‌اند."""
    rows = gsc.search_analytics(start=start, end=end, dimensions=["page"], row_limit=5000)
    out: list[dict] = []
    for r in rows:
        impr = int(r.get("impressions", 0))
        clicks = int(r.get("clicks", 0))
        pos = float(r.get("position", 99))
        if clicks > 0 or impr < min_impr:
            continue
        page = r.get("keys", ["?"])[0]
        out.append({
            "category": "zero_click",
            "severity": _sev_by_impressions(impr),
            "title": "صفحهٔ پر-impression بدونِ کلیک",
            "detail": (
                f"{impr:,} impression اما صفر کلیک (رتبهٔ میانگین {pos:.1f}). "
                f"احتمالاً محتوا با intentِ جستجو هم‌خوان نیست یا snippet ضعیف است."
            ),
            "target": page,
            "metrics": {"impressions": impr, "clicks": 0, "position": round(pos, 1)},
            "dedup_key": f"zero:{page}"[:120],
        })
    out.sort(key=lambda a: a["metrics"]["impressions"], reverse=True)
    return out[:25]


def mine_rank_drops(threshold: float) -> list[dict]:
    """صفحاتی که میانگینِ position‌شان نسبت به دورهٔ قبلِ هم‌طول بدتر شده."""
    cur_start, cur_end = gsc.period_range(14, lag_days=3)
    prev_end = cur_start.replace()  # کپی
    from datetime import timedelta
    prev_end = cur_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=13)

    cur = {r["keys"][0]: r for r in gsc.search_analytics(
        start=cur_start, end=cur_end, dimensions=["page"], row_limit=5000)}
    prev = {r["keys"][0]: r for r in gsc.search_analytics(
        start=prev_start, end=prev_end, dimensions=["page"], row_limit=5000)}

    out: list[dict] = []
    for page, c in cur.items():
        p = prev.get(page)
        if not p:
            continue
        cpos = float(c.get("position", 99))
        ppos = float(p.get("position", 99))
        # فقط صفحاتی که قبلاً در ۲۰تای اول بودند و حالا بدتر شده‌اند.
        if ppos > 20 or (cpos - ppos) < threshold:
            continue
        impr = int(c.get("impressions", 0))
        out.append({
            "category": "rank_drop",
            "severity": "high" if (cpos - ppos) >= 5 else "medium",
            "title": "افتِ رتبهٔ صفحه",
            "detail": (
                f"میانگینِ رتبه از {ppos:.1f} به {cpos:.1f} بدتر شد "
                f"(افتِ {cpos-ppos:.1f} پله) در دو هفتهٔ اخیر. "
                f"رقابتِ تازه یا کاهشِ تازگیِ محتوا را بررسی کنید."
            ),
            "target": page,
            "metrics": {"position_now": round(cpos, 1), "position_prev": round(ppos, 1),
                        "drop": round(cpos - ppos, 1), "impressions": impr},
            "dedup_key": f"drop:{page}"[:120],
        })
    out.sort(key=lambda a: a["metrics"]["drop"], reverse=True)
    return out[:25]


def daily_totals(start: date, end: date) -> list[dict]:
    """معیارهای کل به‌تفکیکِ روز (برای ذخیره در seo_metrics_daily و رسمِ روند)."""
    rows = gsc.search_analytics(start=start, end=end, dimensions=["date"], row_limit=1000)
    return [{
        "day": r["keys"][0],
        "clicks": int(r.get("clicks", 0)),
        "impressions": int(r.get("impressions", 0)),
        "ctr": round(float(r.get("ctr", 0)), 4),
        "position": round(float(r.get("position", 0)), 2),
    } for r in rows]
