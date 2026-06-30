"""منابعِ معتبرِ خبری/تحلیلیِ فارکس و بازارهای مالی (RSS).

همگی تست‌شده و در دسترس‌اند. عکس از RSS یا از og:imageِ صفحهٔ خبر استخراج می‌شود.
"""

from __future__ import annotations

RSS_SOURCES: list[dict] = [
    # ── اخبار (news) ──
    {"name": "Investing.com", "url": "https://www.investing.com/rss/news_1.rss", "category": "news"},
    {"name": "Investing — فارکس", "url": "https://www.investing.com/rss/news_285.rss", "category": "news"},
    {"name": "Investing — کالا/طلا/نفت", "url": "https://www.investing.com/rss/news_11.rss", "category": "news"},
    {"name": "Investing — اقتصاد", "url": "https://www.investing.com/rss/news_95.rss", "category": "news"},
    {"name": "Investing — بورس", "url": "https://www.investing.com/rss/news_25.rss", "category": "news"},
    {"name": "ForexLive", "url": "https://www.forexlive.com/feed/news/", "category": "news"},
    {"name": "FXEmpire", "url": "https://www.fxempire.com/api/v1/en/articles/rss/news", "category": "news"},

    # ── تحلیل (analysis) ──
    {"name": "Investing — تحلیل بنیادی", "url": "https://www.investing.com/rss/market_overview_Fundamental.rss", "category": "analysis"},
    {"name": "Investing — تحلیل تکنیکال", "url": "https://www.investing.com/rss/market_overview_Technical.rss", "category": "analysis"},
    {"name": "Investing — تحلیل فارکس", "url": "https://www.investing.com/rss/289.rss", "category": "analysis"},
    {"name": "ForexLive — تحلیل/آموزش", "url": "https://www.forexlive.com/feed/education/", "category": "analysis"},

    # ── منابعِ ایرانی (اقتصاد/طلا/ارز) — فارسی، بدونِ نیاز به ترجمه ──
    # origin=iran و lang=fa؛ سقفِ روزانه‌شان جداگانه و محدود است (≤۲۰٪ کل).
    {"name": "اقتصاد آنلاین", "url": "https://www.eghtesadonline.com/rss", "category": "news", "origin": "iran", "lang": "fa"},
    {"name": "مهر — اقتصاد", "url": "https://www.mehrnews.com/rss/tp/25", "category": "news", "origin": "iran", "lang": "fa"},
]

# ── سیاست: «جدیدترین‌ها هرچی آمد» بدونِ سقفِ روزانه، با throttleِ هر-اجرا ──
# بدونِ سقفِ روزانه: هر چیزِ تازه‌ای که بیاید (و از فیلترها رد شود) پست می‌شود.
# throttleِ هر-اجرا (هر ۲۰ دقیقه) خودش محتوا را در ۲۴ ساعت پخش می‌کند و مانعِ سیل
# می‌شود — نه burst، نه بیات‌شدنِ خبر.
# سقف‌ها سخاوتمندتر شدند چون حالا انتشار از طریقِ بافرِ drip تدریجی است (نه دسته‌ای):
# هرچه بیشتر در بافر باشد، جریانِ یکنواخت‌ترِ کانال در طولِ روز.
PER_RUN_INTL = 6      # خبرِ بین‌المللیِ تازه در هر اجرا
PER_RUN_IRAN = 3      # خبرِ ایرانیِ تازه در هر اجرا
PER_RUN_MAX = 6       # تحلیلِ تازه در هر اجرا (هرچی تازه بود، تا این سقف)

# گیتِ کیفیت: خبرِ نازک (کم‌محتوا) پست نشود.
MIN_BODY_CHARS = 250          # حداقلِ طولِ متنِ خبر (بعد از enrich)
REQUIRE_IMAGE_FOR_CHANNEL = False  # خبرِ بی‌عکس هم به کانال برود (consumer متنِ بدونِ‌عکس می‌فرستد) — وگرنه اکثرِ خبرها (RSS بی‌عکس) هرگز پست نمی‌شدند
