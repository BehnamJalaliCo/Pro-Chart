"""متریک‌های Prometheus"""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

# ── سیگنال‌ها ────────────────────────────────────────────
signals_generated = Counter(
    "forex_signals_generated_total",
    "تعداد کل سیگنال‌های تولید شده",
    ["symbol", "direction", "signal_type"],
)

signals_active = Gauge(
    "forex_signals_active",
    "تعداد سیگنال‌های فعال",
)

signal_score_histogram = Histogram(
    "forex_signal_score",
    "توزیع امتیاز سیگنال‌ها",
    buckets=[50, 60, 70, 75, 80, 85, 90, 95, 100],
)

# ── عملکرد ───────────────────────────────────────────────
signal_pnl_pips = Histogram(
    "forex_signal_pnl_pips",
    "سود/زیان سیگنال به پیپ",
    buckets=[-100, -50, -20, 0, 20, 50, 100, 200, 500],
)

win_rate_gauge = Gauge(
    "forex_win_rate",
    "وین ریت فعلی",
    ["period"],
)

# ── داده‌ها ──────────────────────────────────────────────
data_feed_status = Gauge(
    "forex_data_feed_status",
    "وضعیت منبع داده (1=فعال، 0=غیرفعال)",
    ["source"],
)

data_feed_latency = Histogram(
    "forex_data_feed_latency_seconds",
    "تأخیر دریافت داده",
    ["source"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
)

data_feed_errors = Counter(
    "forex_data_feed_errors_total",
    "تعداد خطاهای منبع داده",
    ["source"],
)

# ── ML ───────────────────────────────────────────────────
ml_inference_duration = Histogram(
    "forex_ml_inference_seconds",
    "مدت زمان inference مدل ML",
    ["model"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0],
)

# fallbackِ خنثیِ ML (مدل نبود/خطا) → ml_score=50 بی‌صدا. این شمارنده آن را آشکار می‌کند.
ml_fallback_total = Counter(
    "forex_ml_fallback_total",
    "تعداد دفعاتی که ML به مقدارِ خنثی (۵۰) برگشت — مدل لود نشد یا خطا داد",
    ["symbol", "reason"],
)

# مشکلاتِ کیفیتِ کندل (Pandera، warn-only)
candle_quality_issues = Counter(
    "forex_candle_quality_issues_total",
    "تعداد دفعاتی که دادهٔ کندل اعتبارسنجیِ Pandera را رد کرد (warn-only)",
    ["symbol"],
)

ml_model_accuracy = Gauge(
    "forex_ml_model_accuracy",
    "دقت مدل ML",
    ["model"],
)

# ── ربات تلگرام ─────────────────────────────────────────
bot_messages_sent = Counter(
    "forex_bot_messages_sent_total",
    "تعداد پیام‌های ارسالی",
    ["type"],
)

bot_users_total = Gauge(
    "forex_bot_users_total",
    "تعداد کل کاربران",
)

bot_active_users = Gauge(
    "forex_bot_active_users",
    "تعداد کاربران فعال",
)

# ── API ──────────────────────────────────────────────────
api_request_duration = Histogram(
    "forex_api_request_duration_seconds",
    "مدت زمان پاسخ API",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ── تحلیل تکنیکال ───────────────────────────────────────
analysis_duration = Histogram(
    "forex_analysis_duration_seconds",
    "مدت زمان تحلیل هر نماد",
    ["symbol"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
)

# ── مدیریت ریسک (فاز ۲) ───────────────────────────────────
risk_rejections_total = Counter(
    "forex_risk_rejections_total",
    "تعداد سیگنال‌های رد شده توسط RiskGuard",
    ["symbol", "reason"],
)

daily_pnl_dollar = Gauge(
    "forex_daily_pnl_dollar",
    "P&L تحقق‌یافته‌ی روز جاری (دلار)",
)

daily_consecutive_losses = Gauge(
    "forex_daily_consecutive_losses",
    "زیان‌های متوالی روز جاری",
)

system_locked = Gauge(
    "forex_system_locked",
    "آیا سیستم برای امروز قفل است (1) یا خیر (0)",
)

market_regime = Gauge(
    "forex_market_regime",
    "رژیم بازار per نماد (-2 trending down, -1 transitional, 0 ranging, 1 transitional, 2 trending up)",
    ["symbol"],
)

# ── Paper Trading vs Live (فاز ۶) ──────────────────────────
trading_mode = Gauge(
    "forex_trading_mode",
    "حالت معاملاتی (0=paper، 1=live)",
)

paper_signals_generated = Counter(
    "forex_paper_signals_generated_total",
    "تعداد سیگنال‌های paper (forward-test)",
    ["symbol", "direction"],
)

paper_vs_live_divergence = Gauge(
    "forex_paper_vs_live_divergence",
    "اختلاف متریک paper با backtest (مقادیر مثبت = degradation)",
    ["metric"],
)
