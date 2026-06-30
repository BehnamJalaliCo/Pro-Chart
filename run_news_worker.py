"""خبرخوانِ Pro-Chart — RSSِ رایگانِ غیرایرانی → خلاصه/ترجمهٔ فارسی با Claude داخلِ سرور.

فقط مهم‌ترین اخبارِ مؤثر بر بازار (فارکس/طلا/شاخص)، بدونِ عکس.
منابعِ ایرانی به‌هیچ‌عنوان نداریم. متنِ اصلی بازتولید نمی‌شود — Claude خلاصهٔ کوتاهِ
اوریجینالِ فارسی می‌نویسد. خروجی در Redis کلیدِ bn:news.
"""
import asyncio
import html
import json
import re
import time
import urllib.request

import feedparser

from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.llm.client import LLMClient

logger = get_logger(__name__)

# منابعِ رایگانِ بین‌المللی (غیرایرانی). هرکدام شکست بخورد، بقیه ادامه می‌دهند.
FEEDS = [
    ("ForexLive", "https://www.forexlive.com/feed/"),
    ("FXStreet", "https://www.fxstreet.com/rss/news"),
    ("DailyFX", "https://www.dailyfx.com/feeds/market-news"),
    ("MarketWatch", "https://feeds.marketwatch.com/marketwatch/topstories/"),
    ("CNBC", "https://www.cnbc.com/id/20910258/device/rss/rss.html"),
    ("Investing", "https://www.investing.com/rss/news_1.rss"),
    ("Reuters", "https://news.google.com/rss/search?q=forex+OR+%22federal+reserve%22+OR+inflation+when:1d&hl=en-US&gl=US&ceid=US:en"),
]

# وزنِ تأثیر بر بازار — برای انتخابِ مهم‌ترین‌ها
IMPACT = {
    'fed': 5, 'fomc': 5, 'powell': 4, 'rate cut': 5, 'rate hike': 5, 'interest rate': 4,
    'inflation': 5, 'cpi': 5, 'ppi': 3, 'pce': 4, 'nonfarm': 5, 'nfp': 5, 'payroll': 4,
    'jobs report': 4, 'unemployment': 3, 'gdp': 4, 'ecb': 4, 'lagarde': 3, 'boe': 3,
    'boj': 3, 'recession': 4, 'dollar': 3, 'treasury': 3, 'yield': 3, 'oil': 3, 'crude': 2,
    'gold': 4, 'tariff': 4, 'trade war': 4, 'sanction': 2, 'pmi': 2, 'retail sales': 3,
    'opec': 3, 'dovish': 3, 'hawkish': 3, 'central bank': 3,
}

INTERVAL_SEC = 600
MAX_ITEMS = 15


def _clean(s: str) -> str:
    s = re.sub(r'<[^>]+>', '', s or '')
    return html.unescape(s).strip()


def _score(title: str, summ: str) -> int:
    t = (title + ' ' + summ).lower()
    return sum(w for k, w in IMPACT.items() if k in t)


async def fetch_all() -> list[dict]:
    items, seen = [], set()
    for src, url in FEEDS:
        try:
            d = await asyncio.to_thread(feedparser.parse, url)
            for e in d.entries[:25]:
                title = _clean(getattr(e, 'title', ''))
                key = title.lower()[:80]
                if not title or key in seen:
                    continue
                seen.add(key)
                summ = _clean(getattr(e, 'summary', ''))[:400]
                items.append({'src': src, 'title': title, 'summary': summ,
                              'url': getattr(e, 'link', ''), 'sc': _score(title, summ)})
        except Exception as ex:
            logger.warning("rss_fail %s %s", src, ex)
    items.sort(key=lambda x: -x['sc'])
    # حداقل امتیازِ تأثیر؛ اگر کم بود، بهترین‌ها را بردار
    strong = [i for i in items if i['sc'] >= 3]
    return (strong or items)[:MAX_ITEMS]


async def translate(items: list[dict], llm: LLMClient) -> list[dict] | None:
    numbered = "\n".join(
        f"{i+1}. [{it['src']}] {it['title']} — {it['summary'][:240]}"
        for i, it in enumerate(items)
    )
    system = (
        "تو مترجم و تحلیلگرِ خبرِ مالی هستی. برای هر خبرِ انگلیسیِ شماره‌دارِ زیر، یک عنوانِ فارسیِ کوتاه "
        "و یک خلاصهٔ یک‌جمله‌ایِ فارسی بنویس که تأثیرش بر بازارِ فارکس/طلا/شاخص را برساند. "
        "متنِ اصلی را بازتولید یا کپی نکن؛ خلاصهٔ کاملاً اوریجینالِ خودت را به فارسیِ روان بنویس. "
        "خروجی فقط یک آرایهٔ JSON با همان ترتیب و تعداد: "
        '[{"t":"عنوانِ فارسی","s":"خلاصهٔ فارسی"}]'
    )
    out = await llm.complete(numbered, system=system, system_replace=True, timeout=150)
    if not out:
        return None
    m = re.search(r'\[.*\]', out, re.S)
    try:
        arr = json.loads(m.group(0) if m else out)
    except Exception as ex:
        logger.warning("news_translate_parse_fail %s", ex)
        return None
    res = []
    for i, it in enumerate(items):
        fa = arr[i] if i < len(arr) and isinstance(arr[i], dict) else {}
        res.append({
            'title': (fa.get('t') or '').strip() or it['title'],
            'summary': (fa.get('s') or '').strip(),
            'source': it['src'], 'url': it['url'],
            'impact': it['sc'], 'ts': int(time.time()),
        })
    return res


# ─────────────────────────── تقویمِ اقتصادی ───────────────────────────
# فیدِ رایگانِ هفتگی (faireconomy/ForexFactory) — دادهٔ واقعی، غیرایرانی. فقط حقایق (تاریخ/عدد).
CAL_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
_IMPMAP = {"High": "high", "Medium": "medium", "Low": "low", "Holiday": "holiday"}


async def fetch_calendar() -> list[dict]:
    def _get():
        req = urllib.request.Request(CAL_URL, headers={"User-Agent": "Mozilla/5.0"})
        return json.load(urllib.request.urlopen(req, timeout=25))
    try:
        data = await asyncio.to_thread(_get)
    except Exception as ex:
        logger.warning("calendar_fetch_fail %s", ex)
        return []
    out = []
    for e in data:
        imp = _IMPMAP.get(e.get("impact", ""), "low")
        if imp not in ("high", "medium"):  # فقط رویدادهای مؤثر بر بازار
            continue
        out.append({
            "title_en": (e.get("title") or "").strip(),
            "country": (e.get("country") or "").strip(),
            "date": e.get("date") or "",
            "impact": imp,
            "forecast": e.get("forecast") or "",
            "previous": e.get("previous") or "",
        })
    return out


async def translate_calendar(events: list[dict], llm: LLMClient) -> list[dict]:
    titles = sorted({e["title_en"] for e in events if e["title_en"]})
    fa_map = {}
    if titles:
        numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(titles))
        system = (
            "تو مترجمِ اصطلاحاتِ اقتصادی هستی. هر عنوانِ رویدادِ اقتصادیِ انگلیسیِ زیر را به فارسیِ کوتاه و دقیق "
            "(اصطلاحِ رایجِ مالی) ترجمه کن. خروجی فقط یک آرایهٔ JSON از رشته‌ها با همان ترتیب و تعداد: "
            '["ترجمهٔ فارسی", ...]'
        )
        out = await llm.complete(numbered, system=system, system_replace=True, timeout=120)
        if out:
            m = re.search(r'\[.*\]', out, re.S)
            try:
                arr = json.loads(m.group(0) if m else out)
                for i, t in enumerate(titles):
                    if i < len(arr) and isinstance(arr[i], str):
                        fa_map[t] = arr[i].strip()
            except Exception as ex:
                logger.warning("cal_translate_parse_fail %s", ex)
    for e in events:
        e["title"] = fa_map.get(e["title_en"]) or e["title_en"]
        e.pop("title_en", None)
    return events


async def main():
    await redis_client.connect()
    llm = LLMClient()
    logger.info("news_worker_started feeds=%d", len(FEEDS))
    while True:
        try:
            items = await fetch_all()
            if items:
                translated = await translate(items, llm)
                if translated:
                    await redis_client.set_json("bn:news", translated, expire=7200)
                    logger.info("news_updated count=%d", len(translated))
                else:
                    # ترجمه شکست خورد → کشِ قبلیِ فارسی را دست‌نخورده نگه می‌داریم (فارسی‌بودن حفظ شود).
                    logger.warning("news_translate_failed_keep_previous")
        except Exception as ex:
            logger.error("news_loop_err %s", ex)
        # تقویم: فقط وقتی کش منقضی شده دوباره می‌سازیم (دادهٔ هفتگی؛ صرفه‌جوییِ LLM)
        try:
            if not await redis_client.exists("bn:calendar"):
                cal = await fetch_calendar()
                if cal:
                    cal = await translate_calendar(cal, llm)
                    await redis_client.set_json("bn:calendar", cal, expire=21600)  # ۶ ساعت
                    logger.info("calendar_updated count=%d", len(cal))
        except Exception as ex:
            logger.error("calendar_loop_err %s", ex)
        await asyncio.sleep(INTERVAL_SEC)


if __name__ == "__main__":
    asyncio.run(main())
