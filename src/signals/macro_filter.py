"""
لایهٔ فاندامنتال/سنتیمنتِ هم‌گرایی (Phase 2).

هدف: «بهتر تصمیم گرفتن»، نه «بلاک‌کردن». این ماژول برای هر نماد یک «سوگیریِ
بنیادی» (bias) از منابعِ رایگانِ تخصصی می‌سازد و به‌صورتِ پاداش/جریمهٔ نرم روی
امتیازِ سیگنال اعمال می‌شود (هم‌جهتِ bias → پاداش؛ خلافِ bias → جریمه). هرگز
سیگنال را هارد-بلاک نمی‌کند و در هر خطا «خنثی» برمی‌گردد (fail-safe).

منابع:
  ۱) CFTC COT (Commitment of Traders) — «رایگان، بدونِ کلید». پوزیشنِ خالصِ
     سفته‌بازانِ بزرگ (large speculators) روی فیوچرزِ ارز/فلز/انرژی. سوگیریِ
     نهادی = هم‌گراییِ قوی. هفتگی منتشر می‌شود (جمعه).
  ۲) FRED (نرخِ بهره/تورم) و سنتیمنتِ خبر (Finnhub/AlphaVantage) — «نیازمندِ کلیدِ
     رایگان»؛ با تنظیمِ کلید در config فعال می‌شوند (هوک‌های آماده پایین).

خروجیِ get_bias(symbol): {"direction": long|short|neutral, "strength": 0..1, "sources": [...]}.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

import httpx

from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)

# نگاشتِ ارز/کالا → نامِ بازارِ COT در داده‌های CFTC (Socrata legacy futures-only).
# کلید = کدِ ۳حرفیِ ارز یا نمادِ کالا؛ مقدار = زیررشته‌ای که در market_and_exchange_names هست.
_COT_MARKET = {
    "EUR": "EURO FX",
    "GBP": "BRITISH POUND",
    "JPY": "JAPANESE YEN",
    "AUD": "AUSTRALIAN DOLLAR",
    "NZD": "NEW ZEALAND DOLLAR",
    "CAD": "CANADIAN DOLLAR",
    "CHF": "SWISS FRANC",
    "USD": "U.S. DOLLAR INDEX",   # شاخصِ دلار (ICE)
    "XAU": "GOLD",
    "XAG": "SILVER",
    "XTI": "CRUDE OIL, LIGHT SWEET",
    "XNG": "NATURAL GAS",
}

# تجزیهٔ نماد به (پایه، مظنه) برای جفت‌ارزها؛ یا کالای تک.
def _decompose(symbol: str) -> tuple[Optional[str], Optional[str]]:
    s = symbol.upper()
    if s.startswith(("XAU", "XAG", "XTI", "XNG")):
        return s[:3], None  # کالا (در برابرِ USD)
    if len(s) == 6:
        return s[:3], s[3:]
    return None, None


class MacroFilter:
    """سوگیریِ بنیادیِ هر نماد از منابعِ رایگان (COT + هوکِ FRED/سنتیمنت)."""

    COT_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json"
    COT_CACHE_KEY = "macro:cot:net"          # dict: market_substr -> net_spec_pct (-1..+1)
    COT_TTL = 6 * 3600                        # COT هفتگی است؛ کشِ ۶ساعته کافی است
    BIAS_CACHE_PREFIX = "macro:bias:"

    def __init__(self) -> None:
        self._http: Optional[httpx.AsyncClient] = None

    async def _client(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=12.0, headers={"User-Agent": "CoineProFX/1.0"})
        return self._http

    async def close(self) -> None:
        if self._http and not self._http.is_closed:
            await self._http.aclose()

    # ── COT: پوزیشنِ خالصِ سفته‌بازانِ بزرگ (نرمال‌شده به -1..+1 بر حسبِ open interest) ──
    async def _load_cot(self) -> dict:
        try:
            cached = await redis_client.client.get(self.COT_CACHE_KEY)
            if cached:
                return json.loads(cached)
        except Exception:  # noqa: BLE001
            pass
        out: dict[str, float] = {}
        try:
            client = await self._client()
            # آخرین گزارش: مرتب بر تاریخ، محدودیتِ کم؛ فقط ستون‌های لازم.
            params = {
                "$select": "market_and_exchange_names,noncomm_positions_long_all,"
                           "noncomm_positions_short_all,open_interest_all,report_date_as_yyyy_mm_dd",
                "$order": "report_date_as_yyyy_mm_dd DESC",
                "$limit": "200",
            }
            r = await client.get(self.COT_URL, params=params)
            r.raise_for_status()
            rows = r.json()
            seen = set()
            for row in rows:
                name = str(row.get("market_and_exchange_names", "")).upper()
                # فقط اولین (تازه‌ترین) رکوردِ هر بازار را نگه دار
                for cur, sub in _COT_MARKET.items():
                    if sub in name and cur not in seen:
                        try:
                            lng = float(row.get("noncomm_positions_long_all", 0) or 0)
                            sht = float(row.get("noncomm_positions_short_all", 0) or 0)
                            oi = float(row.get("open_interest_all", 0) or 0)
                            denom = (lng + sht) or oi or 1.0
                            net = (lng - sht) / denom  # -1..+1
                            out[cur] = max(-1.0, min(1.0, net))
                            seen.add(cur)
                        except Exception:  # noqa: BLE001
                            continue
            if out:
                await redis_client.client.set(self.COT_CACHE_KEY, json.dumps(out), ex=self.COT_TTL)
                logger.info("cot_loaded", markets=len(out))
        except Exception as exc:  # noqa: BLE001 — fail-safe
            logger.warning("cot_fetch_failed", error=str(exc))
        return out

    # ── سنتیمنتِ خبر (Alpha Vantage NEWS_SENTIMENT) — رایگان، با بودجهٔ سختِ نرخ ──
    AV_URL = "https://www.alphavantage.co/query"
    SENT_CACHE_PREFIX = "macro:sent:"     # macro:sent:{CUR} -> score -1..+1
    SENT_TTL = 12 * 3600
    # تیکرهای فارکسِ Alpha Vantage برای هر ارز
    _AV_TICKER = {
        "USD": "FOREX:USD", "EUR": "FOREX:EUR", "GBP": "FOREX:GBP", "JPY": "FOREX:JPY",
        "AUD": "FOREX:AUD", "NZD": "FOREX:NZD", "CAD": "FOREX:CAD", "CHF": "FOREX:CHF",
    }

    async def _av_budget_ok(self) -> bool:
        """سقفِ نرخِ رایگانِ AV: ≤۴ درخواست/دقیقه و ≤۲۰/روز. اتمیک با INCR/EXPIRE."""
        try:
            import time as _t
            # بدونِ Date.now در اسکریپت — اینجا کدِ عادیِ پایتون است، time مجاز است.
            minute = int(_t.time()) // 60
            day = int(_t.time()) // 86400
            mk = f"macro:av:min:{minute}"
            dk = f"macro:av:day:{day}"
            mc = await redis_client.client.incr(mk)
            if mc == 1:
                await redis_client.client.expire(mk, 90)
            dc = await redis_client.client.incr(dk)
            if dc == 1:
                await redis_client.client.expire(dk, 90000)
            if mc > 4 or dc > 20:
                return False
            return True
        except Exception:  # noqa: BLE001
            return False

    async def _sentiment(self, cur: str) -> Optional[float]:
        """سنتیمنتِ یک ارز (-1..+1) از کش؛ اگر کهنه و بودجه اجازه داد، تازه می‌کند."""
        if not cur or not settings.ALPHAVANTAGE_API_KEY or cur not in self._AV_TICKER:
            return None
        key = self.SENT_CACHE_PREFIX + cur
        try:
            c = await redis_client.client.get(key)
            if c is not None:
                return float(c)
        except Exception:  # noqa: BLE001
            pass
        if not await self._av_budget_ok():
            return None
        try:
            client = await self._client()
            r = await client.get(self.AV_URL, params={
                "function": "NEWS_SENTIMENT", "tickers": self._AV_TICKER[cur],
                "apikey": settings.ALPHAVANTAGE_API_KEY, "limit": "50", "sort": "LATEST"})
            r.raise_for_status()
            data = r.json()
            feed = data.get("feed") or []
            scores = []
            for art in feed:
                for ts in (art.get("ticker_sentiment") or []):
                    if ts.get("ticker") == self._AV_TICKER[cur]:
                        try:
                            scores.append(float(ts.get("ticker_sentiment_score", 0)))
                        except (TypeError, ValueError):
                            pass
            if not scores:
                for art in feed:
                    try:
                        scores.append(float(art.get("overall_sentiment_score", 0)))
                    except (TypeError, ValueError):
                        pass
            if not scores:
                await redis_client.client.set(key, "0.0", ex=self.SENT_TTL)
                return 0.0
            avg = sum(scores) / len(scores)
            norm = max(-1.0, min(1.0, avg * 3.0))   # AV ~[-0.35..0.35] → [-1..1]
            await redis_client.client.set(key, str(round(norm, 4)), ex=self.SENT_TTL)
            logger.info("av_sentiment", cur=cur, score=round(norm, 3), articles=len(scores))
            return norm
        except Exception as exc:  # noqa: BLE001 — fail-safe
            logger.warning("av_sentiment_failed", cur=cur, error=str(exc))
            return None

    # ── FRED: ماکروی آمریکا (روندِ نرخِ بهرهٔ فدرال) → قدرتِ USD ──
    FRED_URL = "https://api.stlouisfed.org/fred/series/observations"
    FRED_CACHE_KEY = "macro:fred:usd"
    FRED_TTL = 24 * 3600

    async def _usd_macro(self) -> Optional[float]:
        """قدرتِ USD از روندِ سالانهٔ نرخِ بهرهٔ فدرال (FEDFUNDS): -1..+1. کش ۲۴ساعته."""
        if not settings.FRED_API_KEY:
            return None
        try:
            c = await redis_client.client.get(self.FRED_CACHE_KEY)
            if c is not None:
                return float(c)
        except Exception:  # noqa: BLE001
            pass
        try:
            client = await self._client()
            r = await client.get(self.FRED_URL, params={
                "series_id": "FEDFUNDS", "api_key": settings.FRED_API_KEY,
                "file_type": "json", "sort_order": "desc", "limit": "13"})
            r.raise_for_status()
            obs = [o for o in (r.json().get("observations") or []) if o.get("value") not in (".", None)]
            if len(obs) < 2:
                return None
            now = float(obs[0]["value"])
            year_ago = float(obs[-1]["value"])
            trend = max(-1.0, min(1.0, (now - year_ago) / 1.0))  # ±۱٪ تغییر → ±۱
            await redis_client.client.set(self.FRED_CACHE_KEY, str(round(trend, 4)), ex=self.FRED_TTL)
            logger.info("fred_usd_macro", rate_now=now, rate_year_ago=year_ago, trend=round(trend, 3))
            return trend
        except Exception as exc:  # noqa: BLE001 — fail-safe
            logger.warning("fred_failed", error=str(exc))
            return None

    async def get_bias(self, symbol: str) -> dict:
        """سوگیریِ بنیادیِ نماد: {direction, strength 0..1, sources}. خنثی در هر خطا."""
        neutral = {"direction": "neutral", "strength": 0.0, "sources": []}
        if not settings.MACRO_FILTER_ENABLED:
            return neutral
        base, quote = _decompose(symbol)
        if not base:
            return neutral
        cot = await self._load_cot()
        if not cot:
            return neutral
        # سوگیریِ خالص = COT(پایه) − COT(مظنه). برای کالا، مظنه=USD.
        b = cot.get(base)
        q = cot.get(quote) if quote else cot.get("USD")
        net = (b or 0.0) - (q or 0.0)   # -2..+2
        sources = ["COT"] if (b is not None or q is not None) else []
        # ── لایهٔ سنتیمنتِ خبر (Alpha Vantage) — وزن‌دار به net اضافه می‌شود ──
        sb = await self._sentiment(base)
        sq = await self._sentiment(quote) if quote else await self._sentiment("USD")
        if sb is not None or sq is not None:
            net += settings.MACRO_SENTIMENT_WEIGHT * ((sb or 0.0) - (sq or 0.0))
            sources.append("SENT")
        # ── FRED: قدرتِ ماکروی USD روی پایِ دلاریِ نماد ──
        usd = await self._usd_macro()
        if usd:
            if base == "USD":
                net += settings.MACRO_FRED_WEIGHT * usd
                sources.append("FRED")
            elif quote == "USD" or quote is None:  # مظنه USD یا کالای دلاری
                net -= settings.MACRO_FRED_WEIGHT * usd
                sources.append("FRED")
        if not sources:
            return neutral
        strength = min(1.0, abs(net) / 1.0)  # |net|≥1 → قوی
        if abs(net) < settings.MACRO_BIAS_MIN_NET:
            return {"direction": "neutral", "strength": round(strength, 2), "sources": sources}
        direction = "long" if net > 0 else "short"
        return {"direction": direction, "strength": round(strength, 2), "sources": sources}

    async def score_adjustment(self, symbol: str, signal_direction: str) -> float:
        """پاداش/جریمهٔ نرمِ امتیاز بر اساسِ هم‌جهتیِ سیگنال با سوگیریِ بنیادی.
        هم‌جهت → +bonus×strength؛ خلاف → −penalty×strength؛ خنثی → ۰."""
        if signal_direction not in ("long", "short"):
            return 0.0
        try:
            bias = await self.get_bias(symbol)
        except Exception:  # noqa: BLE001
            return 0.0
        if bias["direction"] == "neutral":
            return 0.0
        s = float(bias["strength"])
        if bias["direction"] == signal_direction:
            return round(settings.MACRO_ALIGNED_BONUS * s, 2)
        return round(-settings.MACRO_OPPOSED_PENALTY * s, 2)
