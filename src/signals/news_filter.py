"""
فیلتر اخبار اقتصادی پرتاثیر — بررسی تقویم اقتصادی فارکس.

این ماژول اخبار اقتصادی پرتاثیر (High Impact) را از منابع آزاد
مانند ForexFactory و Investing.com دریافت کرده و بررسی می‌کند
آیا در یک ساعت آینده خبر مهمی برای ارز مورد نظر وجود دارد یا خیر.

در صورت وجود خبر پرتاثیر، جریمه‌ای به امتیاز سیگنال اعمال می‌شود.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# ثابت‌ها
# ---------------------------------------------------------------------------

# جریمه بر اساس تاثیر خبر
IMPACT_PENALTIES: Dict[str, float] = {
    "high": -15.0,
    "medium": -5.0,
    "low": 0.0,
}

# پنجره زمانی بررسی اخبار (به دقیقه)
NEWS_WINDOW_MINUTES: int = 60

# مدت زمان کش اخبار (به ثانیه) — هر ۳۰ دقیقه بروزرسانی
NEWS_CACHE_TTL: int = 1800

# نگاشت نماد به ارزهای مرتبط
SYMBOL_CURRENCIES: Dict[str, List[str]] = {
    "EURUSD": ["EUR", "USD"],
    "GBPUSD": ["GBP", "USD"],
    "USDJPY": ["USD", "JPY"],
    "USDCHF": ["USD", "CHF"],
    "AUDUSD": ["AUD", "USD"],
    "NZDUSD": ["NZD", "USD"],
    "USDCAD": ["USD", "CAD"],
    "EURGBP": ["EUR", "GBP"],
    "EURJPY": ["EUR", "JPY"],
    "GBPJPY": ["GBP", "JPY"],
    "AUDJPY": ["AUD", "JPY"],
    "EURAUD": ["EUR", "AUD"],
    "XAUUSD": ["XAU", "USD"],
    "XAGUSD": ["XAG", "USD"],
    "XTIUSD": ["OIL", "USD"],
    "XNGUSD": ["GAS", "USD"],
    "US30": ["USD"],
    "US500": ["USD"],
    "NAS100": ["USD"],
    "DE40": ["EUR"],
}

# آدرس‌های API
FOREX_FACTORY_CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
FALLBACK_CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_nextweek.json"


class NewsEvent:
    """نمایانگر یک رویداد خبری اقتصادی.

    هر رویداد شامل عنوان، ارز مرتبط، زمان، سطح تاثیر و پیش‌بینی
    """

    __slots__ = ("title", "country", "currency", "impact", "event_time", "forecast", "previous", "actual")

    def __init__(
        self,
        title: str,
        country: str,
        currency: str,
        impact: str,
        event_time: datetime,
        forecast: str = "",
        previous: str = "",
        actual: str = "",
    ) -> None:
        """ساخت رویداد خبری.

        پارامترها:
            title: عنوان رویداد
            country: کشور
            currency: ارز مرتبط
            impact: سطح تاثیر ('high' / 'medium' / 'low')
            event_time: زمان رویداد (UTC)
            forecast: پیش‌بینی
            previous: مقدار قبلی
            actual: مقدار واقعی
        """
        self.title = title
        self.country = country
        self.currency = currency
        self.impact = impact.lower()
        self.event_time = event_time
        self.forecast = forecast
        self.previous = previous
        self.actual = actual

    def to_dict(self) -> Dict[str, Any]:
        """تبدیل به دیکشنری"""
        return {
            "title": self.title,
            "country": self.country,
            "currency": self.currency,
            "impact": self.impact,
            "event_time": self.event_time.isoformat(),
            "forecast": self.forecast,
            "previous": self.previous,
            "actual": self.actual,
        }


class NewsFilter:
    """
    فیلتر اخبار اقتصادی برای جلوگیری از سیگنال‌دهی قبل از اخبار مهم.

    اخبار از API رایگان ForexFactory دریافت شده و در Redis کش
    می‌شوند. برای هر نماد بررسی می‌شود آیا ارزهای مرتبط اخبار
    پرتاثیری در یک ساعت آینده دارند یا خیر.
    """

    def __init__(self, window_minutes: int = NEWS_WINDOW_MINUTES) -> None:
        """ساخت فیلتر اخبار.

        پارامترها:
            window_minutes: پنجره زمانی بررسی اخبار به دقیقه (پیش‌فرض ۶۰)
        """
        self._window = timedelta(minutes=window_minutes)
        self._http_client: Optional[httpx.AsyncClient] = None
        self._events_cache: List[NewsEvent] = []
        self._cache_expires_at: datetime = datetime.min.replace(tzinfo=timezone.utc)

    async def _get_http_client(self) -> httpx.AsyncClient:
        """دریافت یا ساخت HTTP کلاینت"""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(15.0),
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; ForexSignalBot/1.0)",
                    "Accept": "application/json",
                },
            )
        return self._http_client

    async def close(self) -> None:
        """بستن HTTP کلاینت"""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

    # ------------------------------------------------------------------
    # API اصلی
    # ------------------------------------------------------------------

    async def check_news_for_symbol(
        self,
        symbol: str,
        window_minutes: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        بررسی اخبار پرتاثیر برای یک نماد.

        پارامترها:
            symbol: نماد معاملاتی (مثلاً EURUSD)
            window_minutes: پنجره زمانی سفارشی به دقیقه

        خروجی:
            دیکشنری شامل:
                - has_high_impact: آیا خبر پرتاثیری وجود دارد
                - penalty: مقدار جریمه
                - events: لیست اخبار مرتبط
                - nearest_event_minutes: فاصله تا نزدیک‌ترین خبر پرتاثیر
        """
        window = timedelta(minutes=window_minutes) if window_minutes else self._window
        now = datetime.now(timezone.utc)

        # دریافت ارزهای مرتبط
        currencies = SYMBOL_CURRENCIES.get(symbol, [])
        if not currencies:
            # استخراج ارز از نماد
            currencies = [symbol[:3], symbol[3:]]

        # دریافت اخبار (از کش یا API)
        events = await self._get_events()

        # فیلتر اخبار مرتبط در پنجره زمانی
        relevant_events: List[NewsEvent] = []
        for event in events:
            # بررسی ارز
            if event.currency not in currencies:
                continue

            # بازه زمانی — هم قبل از رویداد (window) و هم تا ۳۰ دقیقه پس از آن.
            # قبلاً فقط forward بود؛ رویدادی که همین الان رخ داده جریمه نمی‌گرفت،
            # درحالی‌که طلا/شاخص تا ۱۵-۳۰ دقیقه پس از خبر شدیداً نوسانی و استاپ‌خور است.
            time_diff = event.event_time - now
            if -timedelta(minutes=30) <= time_diff <= window:
                relevant_events.append(event)

        # محاسبه جریمه
        has_high_impact = False
        penalty = 0.0
        nearest_minutes: Optional[float] = None

        for event in relevant_events:
            event_penalty = IMPACT_PENALTIES.get(event.impact, 0.0)
            if event_penalty < penalty:
                penalty = event_penalty

            if event.impact == "high":
                has_high_impact = True
                minutes_to_event = (event.event_time - now).total_seconds() / 60
                if nearest_minutes is None or minutes_to_event < nearest_minutes:
                    nearest_minutes = minutes_to_event

        result = {
            "has_high_impact": has_high_impact,
            "penalty": penalty,
            "events": [e.to_dict() for e in relevant_events],
            "events_count": len(relevant_events),
            "nearest_event_minutes": round(nearest_minutes, 1) if nearest_minutes else None,
            "currencies_checked": currencies,
        }

        if has_high_impact:
            logger.warning(
                "high_impact_news_detected",
                symbol=symbol,
                events_count=len(relevant_events),
                nearest_minutes=nearest_minutes,
                penalty=penalty,
            )

        return result

    async def get_penalty_score(
        self,
        symbol: str,
        window_minutes: Optional[int] = None,
    ) -> float:
        """
        دریافت امتیاز جریمه اخبار برای یک نماد.

        متد ساده‌شده برای استفاده مستقیم در SignalScorer.

        پارامترها:
            symbol: نماد معاملاتی
            window_minutes: پنجره زمانی

        خروجی:
            مقدار جریمه (عدد منفی یا صفر)
        """
        result = await self.check_news_for_symbol(symbol, window_minutes)
        return result["penalty"]

    async def is_safe_to_signal(
        self,
        symbol: str,
        window_minutes: Optional[int] = None,
    ) -> bool:
        """
        بررسی اینکه آیا صدور سیگنال برای نماد امن است.

        پارامترها:
            symbol: نماد معاملاتی
            window_minutes: پنجره زمانی

        خروجی:
            True اگر خبر پرتاثیری در پنجره زمانی نباشد
        """
        result = await self.check_news_for_symbol(symbol, window_minutes)
        return not result["has_high_impact"]

    # ------------------------------------------------------------------
    # دریافت اخبار
    # ------------------------------------------------------------------

    async def _get_events(self) -> List[NewsEvent]:
        """
        دریافت لیست رویدادهای خبری (از کش یا API).

        ابتدا کش Redis بررسی می‌شود. در صورت عدم وجود یا منقضی شدن،
        از API جدید دریافت شده و کش بروزرسانی می‌شود.

        خروجی:
            لیست رویدادهای خبری
        """
        now = datetime.now(timezone.utc)

        # بررسی کش حافظه‌ای
        if self._events_cache and now < self._cache_expires_at:
            return self._events_cache

        # بررسی کش Redis
        cached = await redis_client.get_json("news:calendar")
        if cached:
            events = self._parse_cached_events(cached)
            if events:
                self._events_cache = events
                self._cache_expires_at = now + timedelta(seconds=NEWS_CACHE_TTL)
                return events

        # دریافت از API
        events = await self._fetch_from_api()
        if events:
            self._events_cache = events
            self._cache_expires_at = now + timedelta(seconds=NEWS_CACHE_TTL)

            # ذخیره در Redis
            cached_data = [e.to_dict() for e in events]
            await redis_client.set_json("news:calendar", cached_data, expire=NEWS_CACHE_TTL)

        return events

    async def _fetch_from_api(self) -> List[NewsEvent]:
        """
        دریافت اخبار از API رایگان ForexFactory.

        ابتدا تقویم هفته جاری و سپس هفته آینده بررسی می‌شود.
        در صورت خطا، لیست خالی برگردانده می‌شود.

        خروجی:
            لیست رویدادهای خبری
        """
        events: List[NewsEvent] = []

        for url in [FOREX_FACTORY_CALENDAR_URL, FALLBACK_CALENDAR_URL]:
            try:
                client = await self._get_http_client()
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

                parsed = self._parse_ff_response(data)
                events.extend(parsed)

                logger.info(
                    "news_fetched",
                    url=url,
                    events_count=len(parsed),
                )
            except httpx.HTTPStatusError as e:
                logger.error(
                    "news_fetch_http_error",
                    url=url,
                    status=e.response.status_code,
                )
            except httpx.RequestError as e:
                logger.error("news_fetch_request_error", url=url, error=str(e))
            except Exception as e:
                logger.error("news_fetch_error", url=url, error=str(e))

        # حذف تکراری‌ها
        seen = set()
        unique_events: List[NewsEvent] = []
        for event in events:
            key = (event.title, event.currency, event.event_time.isoformat())
            if key not in seen:
                seen.add(key)
                unique_events.append(event)

        return unique_events

    def _parse_ff_response(self, data: List[Dict[str, Any]]) -> List[NewsEvent]:
        """
        تجزیه پاسخ API تقویم ForexFactory.

        هر آیتم شامل فیلدهای title, country, date, time, impact,
        forecast, previous و actual است.

        پارامترها:
            data: لیست دیکشنری‌های دریافتی از API

        خروجی:
            لیست رویدادهای تجزیه‌شده
        """
        events: List[NewsEvent] = []

        for item in data:
            try:
                title = item.get("title", "")
                country = item.get("country", "")
                currency = self._country_to_currency(country)
                impact_raw = item.get("impact", "").lower()

                # تبدیل impact
                impact = self._normalize_impact(impact_raw)

                # تجزیه زمان
                event_time = self._parse_event_time(item)
                if event_time is None:
                    continue

                event = NewsEvent(
                    title=title,
                    country=country,
                    currency=currency,
                    impact=impact,
                    event_time=event_time,
                    forecast=str(item.get("forecast", "")),
                    previous=str(item.get("previous", "")),
                    actual=str(item.get("actual", "")),
                )
                events.append(event)

            except Exception as e:
                logger.debug("news_parse_item_error", error=str(e), item=item)
                continue

        return events

    def _parse_event_time(self, item: Dict[str, Any]) -> Optional[datetime]:
        """
        تجزیه زمان رویداد از آیتم API.

        فرمت‌های مختلف زمان پشتیبانی می‌شوند:
            - date + time ترکیبی
            - فیلد datetime مستقل

        پارامترها:
            item: دیکشنری آیتم

        خروجی:
            شیء datetime با timezone UTC یا None
        """
        # تلاش اول: فیلد date ترکیبی
        date_str = item.get("date", "")
        time_str = item.get("time", "")

        if date_str and time_str:
            # فرمت: "01-06-2026" و "8:30am"
            for fmt in [
                "%m-%d-%Y %I:%M%p",
                "%m-%d-%Y %H:%M",
                "%Y-%m-%d %I:%M%p",
                "%Y-%m-%d %H:%M",
                "%Y-%m-%dT%H:%M:%S",
            ]:
                try:
                    dt_str = f"{date_str} {time_str}".strip()
                    dt = datetime.strptime(dt_str, fmt)
                    return dt.replace(tzinfo=timezone.utc)
                except ValueError:
                    continue

        # تلاش دوم: فیلد date به تنهایی (ISO format)
        if date_str:
            try:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                logger.debug("news_date_parse_failed", raw_date=date_str)

        return None

    @staticmethod
    def _country_to_currency(country: str) -> str:
        """
        تبدیل نام کشور به کد ارز.

        پارامترها:
            country: نام کشور (مثلاً 'United States')

        خروجی:
            کد ارز (مثلاً 'USD')
        """
        mapping = {
            "USD": "USD", "US": "USD", "United States": "USD",
            "EUR": "EUR", "EU": "EUR", "European Union": "EUR",
            "Eurozone": "EUR",
            "GBP": "GBP", "GB": "GBP", "United Kingdom": "GBP", "UK": "GBP",
            "JPY": "JPY", "JP": "JPY", "Japan": "JPY",
            "CHF": "CHF", "CH": "CHF", "Switzerland": "CHF",
            "AUD": "AUD", "AU": "AUD", "Australia": "AUD",
            "NZD": "NZD", "NZ": "NZD", "New Zealand": "NZD",
            "CAD": "CAD", "CA": "CAD", "Canada": "CAD",
            "CNY": "CNY", "CN": "CNY", "China": "CNY",
        }
        return mapping.get(country, country.upper()[:3])

    @staticmethod
    def _normalize_impact(impact: str) -> str:
        """
        نرمال‌سازی سطح تاثیر خبر.

        پارامترها:
            impact: سطح تاثیر خام

        خروجی:
            سطح نرمال‌شده ('high' / 'medium' / 'low')
        """
        impact_lower = impact.lower().strip()
        if impact_lower in ("high", "red", "3", "holiday"):
            return "high"
        if impact_lower in ("medium", "orange", "2", "moderate"):
            return "medium"
        return "low"

    @staticmethod
    def _parse_cached_events(cached: List[Dict[str, Any]]) -> List[NewsEvent]:
        """
        تبدیل رویدادهای کش‌شده به لیست NewsEvent.

        پارامترها:
            cached: لیست دیکشنری‌ها از Redis

        خروجی:
            لیست رویدادهای بازسازی‌شده
        """
        events: List[NewsEvent] = []
        for item in cached:
            try:
                event_time_str = item.get("event_time", "")
                event_time = datetime.fromisoformat(event_time_str)
                if event_time.tzinfo is None:
                    event_time = event_time.replace(tzinfo=timezone.utc)

                events.append(
                    NewsEvent(
                        title=item.get("title", ""),
                        country=item.get("country", ""),
                        currency=item.get("currency", ""),
                        impact=item.get("impact", "low"),
                        event_time=event_time,
                        forecast=item.get("forecast", ""),
                        previous=item.get("previous", ""),
                        actual=item.get("actual", ""),
                    )
                )
            except (ValueError, KeyError, TypeError):
                continue

        return events

    # ------------------------------------------------------------------
    # ابزارهای کلاس
    # ------------------------------------------------------------------

    async def get_upcoming_events(
        self,
        hours_ahead: int = 24,
        impact_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        دریافت لیست اخبار آتی.

        پارامترها:
            hours_ahead: تعداد ساعت پیش‌رو برای بررسی
            impact_filter: فیلتر سطح تاثیر (اختیاری)

        خروجی:
            لیست دیکشنری‌های رویداد مرتب بر اساس زمان
        """
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(hours=hours_ahead)
        events = await self._get_events()

        upcoming = []
        for event in events:
            if event.event_time < now or event.event_time > cutoff:
                continue
            if impact_filter and event.impact != impact_filter:
                continue
            upcoming.append(event.to_dict())

        upcoming.sort(key=lambda e: e["event_time"])
        return upcoming

    async def get_today_high_impact(self) -> List[Dict[str, Any]]:
        """
        دریافت اخبار پرتاثیر امروز.

        خروجی:
            لیست اخبار پرتاثیر امروز مرتب بر اساس زمان
        """
        now = datetime.now(timezone.utc)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)

        events = await self._get_events()

        today_high = []
        for event in events:
            if (
                event.impact == "high"
                and start_of_day <= event.event_time < end_of_day
            ):
                today_high.append(event.to_dict())

        today_high.sort(key=lambda e: e["event_time"])
        return today_high
