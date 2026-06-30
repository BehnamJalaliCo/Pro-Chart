"""
کلاینتِ Google Search Console + PageSpeed (REST مستقیم با httpx).

عمداً سبک است: فقط `google.oauth2` (که در ایمیج هست) برای گرفتنِ access token،
و httpx برای فراخوانیِ REST — بدونِ نیاز به google-api-python-client.

هیچ تابعی نباید مسیرِ Celery را با استثنا بشکند؛ خطاها لاگ و بالا داده می‌شوند
تا تسک آن‌ها را مدیریت کند. کلیدِ Service Account هرگز چاپ نمی‌شود.
"""

from __future__ import annotations

import threading
from datetime import date, timedelta
from urllib.parse import quote

import httpx

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger(__name__)

# دسترسیِ کامل (شاملِ خواندنِ آمار + بازرسیِ URL + ارسالِ sitemap).
_SCOPES = ["https://www.googleapis.com/auth/webmasters"]

_GSC_BASE = "https://www.googleapis.com/webmasters/v3"
_INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect"
_PAGESPEED_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

_creds = None
_creds_lock = threading.Lock()


def _site() -> str:
    return settings.SEO_GSC_SITE


def _enc_site() -> str:
    """siteUrl باید برای مسیرِ REST کدگذاری شود (`sc-domain:` → `sc-domain%3A`)."""
    return quote(_site(), safe="")


def _get_token() -> str:
    """access tokenِ تازه از Service Account (با کشِ thread-safe و رفرشِ خودکار)."""
    global _creds
    # importِ تنبل تا اگر کتابخانه نبود، فقط همین مسیر خطا بدهد نه کلِ اپ.
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account

    with _creds_lock:
        if _creds is None:
            _creds = service_account.Credentials.from_service_account_file(
                settings.SEO_SA_PATH, scopes=_SCOPES
            )
        if not _creds.valid:
            _creds.refresh(Request())
        return _creds.token


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_get_token()}"}


# ─────────────────────────── Search Analytics ───────────────────────────

def search_analytics(
    *,
    start: date,
    end: date,
    dimensions: list[str],
    row_limit: int = 1000,
    dimension_filters: list[dict] | None = None,
) -> list[dict]:
    """
    کوئریِ Search Analytics → فهرستِ ردیف‌ها با keys/clicks/impressions/ctr/position.

    هر ردیف: {"keys": [...], "clicks": int, "impressions": int,
              "ctr": float, "position": float}
    """
    body: dict = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": dimensions,
        "rowLimit": row_limit,
        "dataState": "all",
    }
    if dimension_filters:
        body["dimensionFilterGroups"] = [{"filters": dimension_filters}]

    url = f"{_GSC_BASE}/sites/{_enc_site()}/searchAnalytics/query"
    with httpx.Client(timeout=60) as c:
        r = c.post(url, headers=_auth_headers(), json=body)
    if r.status_code != 200:
        raise RuntimeError(f"GSC searchAnalytics {r.status_code}: {r.text[:300]}")
    return r.json().get("rows", [])


# ─────────────────────────── URL Inspection ───────────────────────────

def inspect_url(page_url: str) -> dict:
    """
    بازرسیِ وضعیتِ ایندکسِ یک URL (read-only، کوتاِ ۲۰۰۰/روز).

    خروجی: dict خامِ inspectionResult (verdict/coverageState/lastCrawlTime/…).
    """
    body = {"inspectionUrl": page_url, "siteUrl": _site()}
    with httpx.Client(timeout=60) as c:
        r = c.post(_INSPECT_URL, headers=_auth_headers(), json=body)
    if r.status_code != 200:
        raise RuntimeError(f"GSC urlInspection {r.status_code}: {r.text[:300]}")
    return r.json().get("inspectionResult", {})


# ─────────────────────────── Sitemaps ───────────────────────────

def submit_sitemap(feedpath: str) -> bool:
    """ارسال/تازه‌سازیِ یک sitemap به Search Console (PUT، idempotent)."""
    url = f"{_GSC_BASE}/sites/{_enc_site()}/sitemaps/{quote(feedpath, safe='')}"
    with httpx.Client(timeout=60) as c:
        r = c.put(url, headers=_auth_headers())
    ok = r.status_code in (200, 204)
    if not ok:
        logger.warning("GSC submit_sitemap %s -> %s %s", feedpath, r.status_code, r.text[:200])
    return ok


def list_sitemaps() -> list[dict]:
    url = f"{_GSC_BASE}/sites/{_enc_site()}/sitemaps"
    with httpx.Client(timeout=60) as c:
        r = c.get(url, headers=_auth_headers())
    if r.status_code != 200:
        raise RuntimeError(f"GSC sitemaps {r.status_code}: {r.text[:300]}")
    return r.json().get("sitemap", [])


# ─────────────────────────── PageSpeed Insights ───────────────────────────

def _pagespeed_key() -> str:
    try:
        with open(settings.SEO_PAGESPEED_KEY_PATH, encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


def pagespeed(url: str, strategy: str = "mobile") -> dict:
    """
    اجرای PageSpeed Insights برای یک URL → امتیازها + Core Web Vitals + مشکلات.

    خروجیِ نرمال‌شده: {"performance": 0-100, "seo":…, "accessibility":…,
                       "best_practices":…, "lcp_ms":…, "cls":…, "tbt_ms":…,
                       "issues": ["…"]}
    """
    params = [
        ("url", url),
        ("strategy", strategy),
        ("category", "performance"),
        ("category", "seo"),
        ("category", "accessibility"),
        ("category", "best-practices"),
    ]
    key = _pagespeed_key()
    if key:
        params.append(("key", key))
    with httpx.Client(timeout=120) as c:
        r = c.get(_PAGESPEED_URL, params=params)
    if r.status_code != 200:
        raise RuntimeError(f"PageSpeed {r.status_code}: {r.text[:300]}")
    data = r.json()
    lh = data.get("lighthouseResult", {})
    cats = lh.get("categories", {})
    audits = lh.get("audits", {})

    def _score(name: str):
        s = cats.get(name, {}).get("score")
        return round(s * 100) if isinstance(s, (int, float)) else None

    def _num(audit: str):
        return audits.get(audit, {}).get("numericValue")

    # مشکلاتِ مهم: auditهای failedِ با وزن (opportunityها).
    issues: list[str] = []
    for aid, a in audits.items():
        score = a.get("score")
        if score is not None and score < 0.9 and a.get("details", {}).get("type") == "opportunity":
            title = a.get("title", aid)
            saving = a.get("details", {}).get("overallSavingsMs")
            if saving and saving > 100:
                issues.append(f"{title} (~{round(saving)}ms)")
    issues = issues[:8]

    return {
        "url": url,
        "strategy": strategy,
        "performance": _score("performance"),
        "seo": _score("seo"),
        "accessibility": _score("accessibility"),
        "best_practices": _score("best-practices"),
        "lcp_ms": _num("largest-contentful-paint"),
        "cls": _num("cumulative-layout-shift"),
        "tbt_ms": _num("total-blocking-time"),
        "fcp_ms": _num("first-contentful-paint"),
        "si_ms": _num("speed-index"),
        "issues": issues,
    }


# ─────────────────────────── Helpers ───────────────────────────

def period_range(days: int, lag_days: int = 3) -> tuple[date, date]:
    """
    بازهٔ تحلیل با لحاظِ تأخیرِ ۲–۳ روزهٔ دادهٔ Search Console.
    end = امروز - lag_days، start = end - days + 1.
    """
    end = date.today() - timedelta(days=lag_days)
    start = end - timedelta(days=days - 1)
    return start, end
