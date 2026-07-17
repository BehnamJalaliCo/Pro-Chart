"""تنظیمات Celery — صف وظایف"""

from __future__ import annotations

import os

from celery import Celery
from celery.schedules import crontab

from src.core.config import settings

# ساخت اپلیکیشن Celery
celery_app = Celery(
    "forex_signal",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,
    task_soft_time_limit=300,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
    result_expires=3600,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    include=[
        "src.signals.tracker",
        "src.core.celery_app",
        "src.bot.tasks",
        # src.copy.tasks و src.ml.ensemble حذف شدند: **وجود ندارند**. هر ورکری که از
        # این ریپو بالا می‌آمد با ModuleNotFoundError می‌مرد — یعنی هیچ‌وقت هیچ تسکی
        # اجرا نشده. آلارم‌های کاربران هرگز ارزیابی نمی‌شدند.
        "src.ml.trainer",
        "src.news.ingest",
        "src.news.blog",
        "src.news.academy_seo",
        "src.instagram.tasks",
        "src.publish.tasks",
        "src.seo.tasks",
        "src.bazaarnama.tasks",
    ],
    # ── جداسازیِ صف‌ها (حیاتی برای پایداریِ تریدینگ) ──
    # درس‌گرفته از حادثهٔ ۲۰۲۶-۰۶-۱۹: تسک‌های پرتکرارِ اینستاگرام (هر ۲–۳ ثانیه) که
    # به‌خاطرِ خطای poll_dms هرکدام ۶–۷ ثانیه قفل می‌شدند، صفِ مشترک را به ۲۴۰هزار تسک
    # رساندند و تسک‌های حیاتیِ تریدینگ (بستنِ پوزیشن/پیامِ بازار) را گرسنه و دفن کردند.
    #   • صفِ `ig`        → کلِ تسک‌های اینستاگرام؛ workerِ اختصاصیِ celery-ig-worker.
    #   • صفِ `critical`  → تسک‌های زمان‌حساسِ تریدینگ؛ همیشه فوری اجرا می‌شوند.
    #   • صفِ `ml_training`→ آموزشِ سنگینِ هفتگی.
    #   • صفِ پیش‌فرضِ `celery` → بقیه (کپی، خبر، بلاگ، آکادمی، …).
    task_routes={
        "src.ml.trainer.retrain_all_models": {"queue": "ml_training"},
        "src.ml.ensemble.recalibrate_weights": {"queue": "ml_training"},
        "src.instagram.tasks.*": {"queue": "ig"},
        "src.signals.tracker.close_positions_weekend": {"queue": "critical"},
        "src.bot.tasks.post_market_closed": {"queue": "critical"},
    },
)

# ── وظایف زمان‌بندی شده ─────────────────────────────────
celery_app.conf.beat_schedule = {
    # محاسبه عملکرد روزانه — هر روز ساعت ۰۰:۰۵ UTC
    "calculate-daily-performance": {
        "task": "src.signals.tracker.calculate_performance",
        "schedule": crontab(minute=5, hour=0),
        "args": ("daily",),
    },
    # محاسبه عملکرد هفتگی — هر یکشنبه ساعت ۰۰:۱۰ UTC
    "calculate-weekly-performance": {
        "task": "src.signals.tracker.calculate_performance",
        "schedule": crontab(minute=10, hour=0, day_of_week="sunday"),
        "args": ("weekly",),
    },
    # محاسبه عملکرد ماهانه — اول هر ماه
    "calculate-monthly-performance": {
        "task": "src.signals.tracker.calculate_performance",
        "schedule": crontab(minute=15, hour=0, day_of_month=1),
        "args": ("monthly",),
    },
    # بازآموزی مدل‌های ML — هر یکشنبه ساعت ۲ صبح
    "retrain-ml-models": {
        "task": "src.ml.trainer.retrain_all_models",
        "schedule": crontab(minute=0, hour=2, day_of_week="sunday"),
    },
    # تنظیم وزن‌های ensemble — هر یکشنبه ساعت ۳ صبح
    "recalibrate-ensemble": {
        "task": "src.ml.ensemble.recalibrate_weights",
        "schedule": crontab(minute=0, hour=3, day_of_week="sunday"),
    },
    # بررسی سلامت سرویس‌ها — هر ۵ دقیقه
    "health-check": {
        "task": "src.core.celery_app.health_check_task",
        "schedule": 300.0,
    },
    # خبرخوان/تحلیل (RSS → ترجمهٔ Claude → سایت + پستِ کانال) — هر ۲۰ دقیقه؛
    # جدیدترین‌ها، بدونِ تکراری، سقفِ ۱۰/روز و ۲/اجرا در هر بخش.
    "ingest-news": {
        "task": "src.news.ingest.ingest_news",
        "schedule": crontab(minute="*/15"),
    },
    # انتشارِ تدریجیِ خبر از بافر به کانال — هر ۱۰ دقیقه یکی (فاصلهٔ تضمینی، پخش در کلِ روز)
    "drip-news": {
        "task": "src.news.ingest.drip_news",
        "schedule": crontab(minute="*/10"),
    },
    # تولیدِ مقالهٔ بلاگِ اصیل (Claude) — هر ۲ ساعت (سقفِ ۱۰/روز، بدونِ تکرارِ موضوع)
    "generate-blog": {
        "task": "src.news.blog.generate_blog_post",
        "schedule": crontab(minute=15, hour="*/2"),
    },
    # سویپ اشتراک‌ها — شبکه‌ی ایمنی انقضا + یادآوری تمدید (هر ۱۵ دقیقه)
    "subscription-sweep": {
        "task": "src.bot.tasks.sweep_subscriptions",
        "schedule": crontab(minute="*/15"),
    },
    # اینستاگرام — مسیرِ سریعِ دایرکت: poll + ارسالِ فوری (هر ۲ ثانیه → پاسخِ کاربر در ۲–۳ ثانیه)
    "ig-dm": {
        "task": "src.instagram.tasks.ig_dm",
        "schedule": 2.0,
        "options": {"expires": 8},   # اگر تا ۸ث اجرا نشد، حذف شود (ضدِ تلنبارِ صف)
    },
    # اینستاگرام — آشکارسازِ کامنت → ارسالِ فوری (هر ۳ ثانیه؛ poll حالا فقط روی پستِ مرتبط و سریع است)
    "ig-detect": {
        "task": "src.instagram.tasks.ig_detect",
        "schedule": 3.0,
        "options": {"expires": 10},
    },
    # اینستاگرام — فرستندهٔ نرخ‌دارِ صفِ کامنت (هر ۲ ثانیه)
    "ig-drain": {
        "task": "src.instagram.tasks.ig_drain",
        "schedule": 2.0,
        "options": {"expires": 8},
    },
    # اینستاگرام — حلقهٔ یادگیریِ روزانه (عملکردِ پست‌ها → سبک‌های برنده، ۱:۳۰ بامداد)
    "ig-learn": {
        "task": "src.instagram.tasks.ig_learn",
        "schedule": crontab(minute=30, hour=1),
    },
    # اینستاگرام — خلبانِ خودکار: ساختِ محتوای جدید طبقِ زمان‌بندی (هر ۲ دقیقه چک می‌کند)
    "ig-autopilot": {
        "task": "src.instagram.tasks.ig_autopilot",
        "schedule": 120.0,
    },
    # اینستاگرام — ساختِ خودکارِ ویدیوی محتواهای در انتظار (هر ۶۰ ثانیه)
    "ig-generate-video": {
        "task": "src.instagram.tasks.ig_generate_video",
        "schedule": 60.0,
    },
    # اینستاگرام — انتشارِ محتوای زمان‌بندی‌شده (هر دقیقه)
    "ig-publish-due": {
        "task": "src.instagram.tasks.ig_publish_due",
        "schedule": 60.0,
    },
    # اینستاگرام — ارسالِ پیام‌های یادآوریِ سررسیده (هر دقیقه)
    "ig-reminders": {
        "task": "src.instagram.tasks.ig_reminders",
        "schedule": 60.0,
    },
    # هماهنگ‌سازیِ کپی‌تریدِ کاربران — آینه‌کردنِ معاملاتِ مَستر (هر دقیقه)
    "copy-sync": {
        "task": "src.copy.tasks.copy_sync",
        "schedule": crontab(minute="*"),
    },
    # رصدِ منابعِ پنل — هشدار + حذفِ حساب‌های بی‌فعالیت/موجودیِ صفر (هر ۶ ساعت)
    "panel-resource-sweep": {
        "task": "src.bot.tasks.panel_resource_sweep",
        "schedule": crontab(minute=20, hour="*/6"),
    },
    # مقیاسِ خودکارِ سرورهای ویندوزِ کپی (هر ۲۰ دقیقه؛ فقط اگر زنده + snapshot)
    "scale-servers": {
        "task": "src.copy.tasks.scale_servers",
        "schedule": crontab(minute="*/20"),
    },
    # بستنِ همهٔ پوزیشن‌ها در آخرین ساعتِ جمعه — ۲۰:۳۱ UTC، «بلافاصله» پس از پیامِ
    # بسته‌شدنِ بازار (۲۰:۳۰). EAِ مَستر و کاربران را close-all می‌کند تا پوزیشن‌های
    # واقعی همان لحظه بسته شوند. سیگنالِ تازه هم از ۲۰:۰۰ بسته است (فیلترِ آخرهفته).
    "weekend-close-positions": {
        "task": "src.signals.tracker.close_positions_weekend",
        "schedule": crontab(minute=31, hour=20, day_of_week="friday"),
    },
    # پیام بسته‌شدن بازار — جمعه ۲۰:۳۰ UTC (= ۱۲ شب جمعه به وقت تهران)
    "market-closed-friday": {
        "task": "src.bot.tasks.post_market_closed",
        "schedule": crontab(minute=30, hour=20, day_of_week="friday"),
    },
    # گزارش هفتگی عملکرد (Claude) — یکشنبه ۱۷:۰۰ UTC (فقط اگر LLM فعال باشد)
    "weekly-report": {
        "task": "src.bot.tasks.post_weekly_report",
        "schedule": crontab(minute=0, hour=17, day_of_week="sunday"),
    },
    # ارزیابی ریسک خبری (Claude) — هر ۳ ساعت (فقط اگر LLM+news فعال باشد)
    "assess-news": {
        "task": "src.bot.tasks.assess_news",
        "schedule": crontab(minute=5, hour="*/3"),
    },
    # انتشارِ خودکارِ روزانهٔ یک درسِ آکادمی در یوتیوب/آپارات — راس ۱۵:۰۰ تهران (= ۱۱:۳۰ UTC، ایران UTC+3:30)
    # فقط اگر ACADEMY_DRIP_ENABLED و حداقل یک پلتفرم فعال باشد (وگرنه no-op).
    "academy-video-drip": {
        "task": "src.publish.tasks.academy_video_drip",
        "schedule": crontab(minute=30, hour=11),
    },
    # بلاگ → ویدیوی یوتیوب (۳-۸ دقیقه) + شورت — روزی ۲ بار: ۹:۰۰ و ۲۰:۰۰ تهران (= ۵:۳۰ و ۱۶:۳۰ UTC)
    "blog-video-morning": {
        "task": "src.publish.tasks.blog_to_video",
        "schedule": crontab(minute=30, hour=5),
    },
    "blog-video-evening": {
        "task": "src.publish.tasks.blog_to_video",
        "schedule": crontab(minute=30, hour=16),
    },
    # ── SEO ──────────────────────────────────────────────
    # داده‌کاویِ روزانهٔ Search Console — ۰۶:۰۰ UTC (دادهٔ ۲–۳ روزِ قبل تثبیت شده)
    # → آمارِ روند + آیتم‌های «SEO Action Required» در داشبوردِ ادمین.
    "seo-mine-search-console": {
        "task": "src.seo.tasks.mine_search_console",
        "schedule": crontab(minute=0, hour=6),
    },
    # QAِ هفتگیِ PageSpeed برای صفحاتِ کلیدی — دوشنبه ۰۴:۳۰ UTC (هشدار اگر امتیاز < آستانه)
    "seo-pagespeed-weekly": {
        "task": "src.seo.tasks.run_pagespeed",
        "schedule": crontab(minute=30, hour=4, day_of_week="monday"),
    },
    # مانیتورینگِ روزانهٔ سلامتِ Schema/ایندکس (URL Inspection API) — ۰۶:۱۵ UTC
    "seo-schema-health": {
        "task": "src.seo.tasks.monitor_schema_health",
        "schedule": crontab(minute=15, hour=6),
    },
    # بازارنما — ارزیابیِ آلارم‌های کاربران روی قیمتِ زنده (هر دقیقه، مستقل از مرورگر)
    "bn-check-alerts": {
        "task": "src.bazaarnama.tasks.check_alerts",
        "schedule": 60.0,
    },
    # بازارنما — ردیابیِ برخوردِ TP/SL سیگنال‌های AI (هر دقیقه)
    "bn-check-ai-signals": {
        "task": "src.bazaarnama.tasks.check_ai_signals",
        "schedule": 60.0,
    },
    # سئوی روزانهٔ آکادمی — یک مقالهٔ معرفیِ آکادمی در روز (۰۸:۰۰ UTC، بدونِ تکرار)
    "academy-seo-daily": {
        "task": "src.news.academy_seo.generate_academy_spotlight",
        "schedule": crontab(minute=0, hour=8),
    },
}


@celery_app.task(name="src.core.celery_app.health_check_task")
def health_check_task() -> dict:
    """بررسی سلامت سیستم"""
    import psutil

    return {
        "cpu_percent": psutil.cpu_percent(interval=1),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage("/").percent,
    }


# ─────────────────────────────────────────────────────────────────────────────
# حالتِ «فقط بازارنما» — BN_CELERY_PROCHART_ONLY=1
#
# چرا لازم است: زمان‌بندیِ بالا ۳۴ ورودی دارد که مالِ استکِ قدیمیِ CoinePro FX است
# (اینستاگرام، SEO، ML، کپی‌ترید). استکِ prochart هیچ‌کدام را ندارد و ۸ تای آن‌ها
# به توابعِ ناموجود ارجاع می‌دهند — یعنی beat هر بار خطا می‌دهد.
#
# مهم‌تر: کامنتِ جداسازیِ صف در همین فایل حادثهٔ ۲۰۲۶-۰۶-۱۹ را ثبت کرده — تسک‌های
# اینستاگرام با تکرارِ ۲–۳ ثانیه صف را به ۲۴۰هزار تسک رساندند و تریدینگ را گرسنه
# کردند. بالاآوردنِ کورِ کلِ زمان‌بندی روی prochart همان تله است.
#
# پس در این حالت فقط دو تسکِ بازارنما زمان‌بندی می‌شوند: ارزیابیِ آلارمِ کاربران و
# ردیابیِ TP/SL سیگنال‌های AI. هر دو فقط به Redis (قیمتِ زنده) و DB نیاز دارند.
if os.getenv("BN_CELERY_PROCHART_ONLY", "").strip() in {"1", "true", "True"}:
    celery_app.conf.beat_schedule = {
        "bn-check-alerts": {
            "task": "src.bazaarnama.tasks.check_alerts",
            "schedule": 60.0,
        },
        "bn-check-ai-signals": {
            "task": "src.bazaarnama.tasks.check_ai_signals",
            "schedule": 60.0,
        },
    }
    # فقط ماژول‌هایی که این دو تسک لازم دارند — بدونِ بار کردنِ بات/اینستاگرام/SEO/ML.
    celery_app.conf.include = ["src.core.celery_app", "src.bazaarnama.tasks"]
