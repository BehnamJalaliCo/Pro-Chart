"""تنظیمات اصلی سیستم — خواندن از .env"""

from __future__ import annotations

from typing import ClassVar, List
from urllib.parse import quote

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

# ── مقادیر ناامن که حتماً باید در production جایگزین شوند ─────
_INSECURE_PASSWORDS: set[str] = {
    "changeme",
    "change-me",
    "admin",
    "password",
    "123456",
    "12345678",
    "",
}

_INSECURE_JWT_SECRETS: set[str] = {
    "change-me-very-long-random-string",
    "CHANGE_ME_VERY_LONG_RANDOM_STRING",
    "secret",
    "your-secret-key",
}


class Settings(BaseSettings):
    """تنظیمات کامل اپلیکیشن"""

    # ── عمومی ───────────────────────────────────────────
    DEBUG: bool = False

    # ── دیتابیس ──────────────────────────────────────────
    DB_NAME: str = "forex_signal"
    DB_USER: str = "coinepro"
    DB_PASSWORD: str = "changeme"
    DB_HOST: str = "timescaledb"
    DB_PORT: int = 5432

    @property
    def DATABASE_URL(self) -> str:
        # پسورد URL-encode می‌شود تا کاراکترهای خاص (+ / @ : …) URL را نشکنند
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{quote(self.DB_PASSWORD, safe='')}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return (
            f"postgresql+psycopg2://{self.DB_USER}:{quote(self.DB_PASSWORD, safe='')}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    # ── ردیس ─────────────────────────────────────────────
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = "changeme"
    REDIS_MAX_CONNECTIONS: int = 150

    # ── Pool دیتابیس ─────────────────────────────────────
    DB_POOL_SIZE: int = 30
    DB_MAX_OVERFLOW: int = 20

    # ── CORS ─────────────────────────────────────────────
    CORS_ORIGINS: str = ""  # comma-separated list — خالی = استفاده از پیش‌فرض

    @property
    def REDIS_URL(self) -> str:
        # پسورد URL-encode می‌شود تا کاراکترهای خاص (+ / @ : …) URL را نشکنند
        return f"redis://:{quote(self.REDIS_PASSWORD, safe='')}@{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    # ── تلگرام ───────────────────────────────────────────
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHANNEL_ID: str = "@CoinePro_FX"
    TELEGRAM_ADMIN_IDS: str = ""
    # یوزرنیمِ ربات (بدونِ @) — برای ویجتِ ورود تلگرام در وب‌سایت (احرازِ VIP)
    TELEGRAM_BOT_USERNAME: str = "CoineProFxBot"
    # کانالِ عمومیِ اخبار/محتوا (@CoineproFX) — جدا از کانالِ VIPِ سیگنال‌ها
    NEWS_CHANNEL_ID: str = "-1002495160080"
    NEWS_CHANNEL_TAG: str = "@CoineproFX"
    NEWS_CHANNEL_NAME: str = "کوین پرو FX"
    NEWS_BOT_URL: str = "https://t.me/CoineProFxBot"
    NEWS_SITE_URL: str = "https://fx.trade-future.ir"

    @field_validator("TELEGRAM_ADMIN_IDS", mode="before")
    @classmethod
    def _parse_admin_ids(cls, v: str) -> str:
        return v

    @property
    def admin_ids(self) -> List[int]:
        if not self.TELEGRAM_ADMIN_IDS:
            return []
        return [int(x.strip()) for x in self.TELEGRAM_ADMIN_IDS.split(",") if x.strip()]

    # ── ربات نسخه‌ی ۲: پشتیبانی، پرداخت و اشتراک ──
    # هندل ادمین/پشتیبانی که هش تراکنش به آن فوروارد و کاربران به آن ارجاع می‌شوند
    SUPPORT_HANDLE: str = "@CoinePro_Admin"
    # ── بروکر معرفی‌شده (OneRoyal) — لینک رفرال و سایت رسمی فارسی ──
    BROKER_NAME: str = "OneRoyal"
    # سازگاری با envهای قدیمی: این ورودی همچنان parse می‌شود اما هیچ UI نباید
    # آن را مستقیماً مصرف کند؛ مقصد نهایی فقط در api.routes.referrals ثابت است.
    BROKER_REFERRAL_URL: str = ""
    ONEROYAL_REFERRAL_REDIRECT_URL: ClassVar[str] = "https://pro-chart.ir/go/oneroyal"
    BROKER_SITE_FA_URL: str = "https://www.oneroyal.com/fa/"
    # حداقل شارژِ حساب برای دریافتِ اشتراکِ رایگانِ همیشگیِ VIP (دلار)
    BROKER_FREE_VIP_DEPOSIT_USD: int = 500

    # ── لایو ترید (WebRTC + چت) ──
    LIVE_PUBLIC_IP: str = "91.107.160.235"       # IP عمومی سرور برای ICE/TURN
    LIVE_TURN_USER: str = "coinepro"
    LIVE_TURN_PASSWORD: str = ""                  # = TURN_SECRET (از env)
    LIVE_PUBLISH_USER: str = "broadcaster"        # احراز انتشار MediaMTX
    LIVE_PUBLISH_PASSWORD: str = ""               # = PUBLISH_PASS (از env)
    LIVE_HOST_NAME: str = "بهنام جلالی (مدیر)"    # نام نمایشی میزبان در چت
    LIVE_DESKTOP_USER: str = "admin"              # ورودِ دسکتاپِ MT5 (از env)
    LIVE_DESKTOP_PASSWORD: str = ""               # رمزِ دسکتاپِ MT5 (از env؛ هرگز در سورس)
    EA_TOKEN: str = ""                            # توکنِ احرازِ EAِ اتو-تریدر (از env)
    # ── پنلِ کاربریِ VIP (user.fx.trade-future.ir) ──
    RESEND_API_KEY: str = ""                       # کلیدِ Resend برای ایمیلِ OTP (از env)
    RESEND_FROM_EMAIL: str = "CoinePro FX <onboarding@resend.dev>"
    USER_PANEL_TOKEN_DAYS: int = 14                # عمرِ توکنِ ورودِ پنلِ کاربر
    USER_CREDS_ENC_KEY: str = ""                   # کلیدِ Fernet برای رمزنگاریِ کردنشالِ MT5 کاربر (از env)
    DISCLAIMER_VERSION: str = "1.0"                # نسخهٔ سلبِ مسئولیت
    ONEROYAL_SERVER_KEYWORD: str = "royal"         # تشخیصِ سرورِ OneRoyal برای قانونِ پلنِ رایگان
    COPY_ENGINE_TOKEN: str = ""                    # توکنِ احرازِ کپی‌انجین (از env)
    USER_PANEL_URL: str = "https://user.fx.trade-future.ir"  # آدرسِ پنلِ کاربری (WebApp)
    # ── کپیِ زنده: ترمینالِ MT5 جدا per-user روی سرورِ خودمان ──
    COPY_LIVE_ENABLED: bool = False                # OneRoyal تا API رسمی فقط referral-only است

    @field_validator("COPY_LIVE_ENABLED", mode="before")
    @classmethod
    def _lock_copy_live_off(cls, _value) -> bool:
        """Legacy env values must never reopen the OneRoyal execution adapter."""
        return False
    MT5_USERS_DIR: str = "/mt5_users"              # محلِ نسخه‌های portable per-user
    COPY_MAX_USERS: int = 20                       # سقفِ ترمینال‌های هم‌زمان (محدودیتِ RAM)
    PANEL_FEE_MONTHLY: int = 30                     # هزینهٔ ماهانهٔ پنلِ کاربری ($) — رایگان برای OneRoyal
    PANEL_IDLE_WARN_HOURS: int = 48                 # بی‌فعالیتی/موجودیِ صفر → هشدار
    PANEL_IDLE_REMOVE_HOURS: int = 24              # مهلت پس از هشدار تا حذفِ اتصال
    # ── Hetzner (سرورهای ویندوزِ کاربران برای کپیِ زنده) ──
    HETZNER_API_TOKEN: str = ""                     # توکنِ Hetzner Cloud (از env)
    HETZNER_SNAPSHOT_ID: str = ""                   # id اسنپ‌شاتِ ویندوز+MT5+agent (پس از ساختِ دستیِ اولیه)
    HETZNER_SERVER_TYPE: str = "cx53"             # ۳۲GB ~۲۴ کاربر (موجود hel1/nbg1/fsn1)
    HETZNER_LOCATION: str = "hel1"                # لوکیشن (نزدیک به سرورِ اصلی)
    COPY_USERS_PER_SERVER: int = 24                # سقفِ کاربر در هر سرورِ ویندوز
    # آدرس‌های کیف پول دریافت USDT
    PAYMENT_TRC20_ADDRESS: str = ""
    PAYMENT_BSC_ADDRESS: str = ""
    # مدت دوره‌ی آزمایشی رایگان (ساعت)
    TRIAL_HOURS: int = 48
    # ── پاداشِ معرفی به دوستان: با N دعوتِ موفق، M روز اشتراکِ رایگان ──
    REFERRAL_REWARD_THRESHOLD: int = 10   # تعداد دعوتِ موفق برای دریافتِ پاداش
    REFERRAL_REWARD_DAYS: int = 90        # طولِ اشتراکِ رایگانِ پاداش (۳ ماه)
    # انتشار خودکار سیگنال‌های موتور روی کانال VIP (new_signals → کانال تلگرام)
    PUBLISH_SIGNALS_TO_CHANNEL: bool = False
    # بستنِ خودکارِ همهٔ پوزیشن‌ها در آخرین ساعتِ بازارِ جمعه (ریسکِ گپِ آخرهفته)
    WEEKEND_AUTO_CLOSE_ENABLED: bool = True
    # نردبانِ خروجِ حرفه‌ای: با تاچِ TP1 استاپ به سربه‌سر (بعد از TP1 هرگز ضرر نمی‌خوریم)،
    # با تاچِ TP2 استاپ تا TP1 بالا می‌آید (قفلِ سودِ TP1). EXIT_CLOSE_AT_TP1=True یعنی
    # به‌جای نردبان، پوزیشن دقیقاً در TP1 بسته شود (محافظه‌کارتر، ولی بردِ بزرگ را از دست می‌دهد).
    EXIT_CLOSE_AT_TP1: bool = False

    # ── آکادمیِ VIP (academy.fx.trade-future.ir) — آموزش + مربیِ AI ──
    ACADEMY_ENABLED: bool = True
    ACADEMY_SELF_REGISTER: bool = False      # False = فقط ادمین دانش‌آموز می‌سازد؛ True = ثبت‌نامِ ایمیلیِ خودسرویس
    ACADEMY_BEP20_ADDRESS: str = ""          # کیفِ‌پولِ USDT شبکهٔ BEP-20 برای پرداختِ آکادمی (از env)
    ACADEMY_PRICE_VIP_MONTHLY: int = 25      # USDT/ماه — تیرِ VIP
    ACADEMY_PRICE_PREMIUM_MONTHLY: int = 60  # USDT/ماه — تیرِ پرمیوم
    ACADEMY_MENTOR_MODEL: str = "sonnet"     # مدلِ مربی (Claudeِ داخلِ سرور)
    ACADEMY_MENTOR_QUOTA_FREE: int = 10      # پیام/۲۴ساعت — تیرِ رایگان
    ACADEMY_MENTOR_QUOTA_VIP: int = 80       # پیام/۲۴ساعت — VIP
    ACADEMY_MENTOR_QUOTA_PREMIUM: int = 300  # پیام/۲۴ساعت — پرمیوم

    # ── لایه‌ی Claude (سرویس claude-llm، اشتراک Max، Sonnet) ──
    LLM_ENABLED: bool = False
    LLM_SERVICE_URL: str = "http://claude-llm:8085"
    LLM_MODEL: str = "sonnet"
    LLM_TIMEOUT_SECONDS: int = 120
    # فلگ‌های per-feature (پیش‌فرض off — فعال‌سازی آگاهانه)
    LLM_NARRATOR_ENABLED: bool = False
    LLM_NEWS_ENABLED: bool = False
    LLM_SANITY_GATE_ENABLED: bool = False
    # ── دستیارِ هوش مصنوعیِ بازارِ مالی (چت کاربر) ──
    # تحلیلِ کارشناسیِ Claude زیرِ هر سیگنال در کانال — خاموش برای صرفه‌جوییِ توکن
    SIGNAL_NARRATION_ENABLED: bool = False
    AI_CHAT_ENABLED: bool = True
    AI_CHAT_MODEL: str = "haiku"          # مدلِ کم‌مصرف برای کنترلِ هزینه
    AI_CHAT_DAILY_QUOTA: int = 25         # حداکثر پرسش در هر ۲۴ ساعت — کاربر عادی/trial
    AI_CHAT_DAILY_QUOTA_VIP: int = 100    # سهمیهٔ بالاترِ کاربرانِ VIP (اشتراکِ پولیِ فعال)
    AI_CHAT_MAX_INPUT_CHARS: int = 600    # سقفِ طولِ ورودیِ کاربر
    AI_CHAT_TIMEOUT_SECONDS: int = 90
    # ── مدارشکنِ زیانِ روزانه (circuit breaker) — سقف‌های منطقی برای سرویسِ سیگنالِ فعال ──
    # کیفیت در ساختارِ سیگنال است، نه در خاموش‌کردنِ فید → مدارشکن ارسال را قطع نمی‌کند
    # (فقط برای آگاهی ثبت می‌شود). برای محافظتِ سختِ اتو-تریدِ مَستر True کن.
    DAILY_LOSS_BLOCKS_EMISSION: bool = False
    # همبستگی هم فید را قطع نکند (محدودیتِ سبدِ تک‌حساب، نه فیدِ سیگنال)
    CORRELATION_BLOCKS_EMISSION: bool = False
    MAX_DAILY_LOSS_DOLLAR: float = 1500.0   # سقفِ زیانِ مطلقِ روزانه (دلار)
    MAX_DAILY_LOSS_PCT: float = 10.0        # سقفِ زیانِ روزانه (٪ موجودی)
    MAX_CONSECUTIVE_LOSSES: int = 6         # باختِ متوالی پیش از مکثِ موقت (با اولین برد آزاد)
    MAX_SIGNALS_PER_DAY: int = 120          # سقفِ تعدادِ سیگنال در روز
    # ── دستیارِ پشتیبانِ پنلِ VIP (Sonnet) ──
    PANEL_AI_ENABLED: bool = True
    PANEL_AI_MODEL: str = "sonnet"        # آخرین Sonnet — پاسخ‌گوییِ حرفه‌ایِ پشتیبانی
    PANEL_AI_DAILY_QUOTA: int = 60        # سقفِ پیام در ۲۴ ساعت برای هر کاربرِ VIP
    # هشدارِ سلامتِ حساب: زیرِ این سطحِ مارجین (٪) اعلان فرستاده می‌شود
    PANEL_MARGIN_ALERT_LEVEL: float = 200.0
    # قیمت پلن‌های اشتراک (USDT)
    SUB_PRICE_MONTHLY: int = 60
    SUB_PRICE_QUARTERLY: int = 140
    SUB_PRICE_BIANNUAL: int = 240

    # ── متاتریدر ۵ ───────────────────────────────────────
    MT5_LOGIN: str = ""
    MT5_PASSWORD: str = ""
    MT5_SERVER: str = "MetaQuotes-Demo"

    # ── اواندا ───────────────────────────────────────────
    OANDA_API_KEY: str = ""
    OANDA_ACCOUNT_ID: str = ""
    OANDA_ENVIRONMENT: str = "practice"

    # ── توِلو دیتا ───────────────────────────────────────
    TWELVEDATA_API_KEY: str = ""
    # سقف سختِ credit روزانه (پلن رایگان = ۸۰۰/روز)؛ کانکتور هرگز از این بیشتر مصرف نمی‌کند
    TWELVEDATA_DAILY_CREDIT_LIMIT: int = 750

    # ── JWT ───────────────────────────────────────────────
    JWT_SECRET_KEY: str = "change-me-very-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Auth مرکزی (M2 — SSO با RS256) ────────────────────
    # تا CENTRAL_AUTH_ENABLED=1 نشود هیچ اثری ندارد؛ HS256 فعلی دست‌نخورده می‌ماند.
    CENTRAL_AUTH_ENABLED: int = 0
    CENTRAL_JWT_PUBLIC_KEY: str = ""  # PEM کلیدِ عمومیِ سرویسِ auth مرکزی (kid=central-2026-07)
    CENTRAL_JWT_ISSUER: str = "https://auth.pro-chart.internal"

    # ── ادمین ────────────────────────────────────────────
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"

    # ── گرافانا ──────────────────────────────────────────
    GRAFANA_PASSWORD: str = "changeme"

    # ── تنظیمات سیگنال ───────────────────────────────────
    # کالیبراسیونِ داده‌محور (۲۰۲۶-۰۶، تحلیلِ ۶۶ سیگنالِ بسته‌شده):
    #   امتیازِ ۵۵-۵۹ = ۲۰٪ برد، -1.74R (فاجعه) → کفِ امتیاز ۵۵→۶۰
    #   H1 در هر امتیازی ضررده (-0.5 تا -1.4R) → آستانهٔ سخت‌ترِ H1
    #   ml_score تمایزدهنده (برنده ۶۶ vs بازنده ۵۶) → کفِ ML
    # کالیبراسیونِ ۲۰۲۶-۰۶ (دیتای ۲۱۱ سیگنالِ بسته): فقط باندِ ۷۰–۷۹ سودده بود → کفِ ۷۰
    MIN_SIGNAL_SCORE: int = 70
    STRONG_SIGNAL_SCORE: int = 85
    H1_MIN_SCORE: int = 70            # داده نشان داد H1 سودده است → بدونِ جریمهٔ اضافه (= کف)
    SIGNAL_ML_MIN: float = 50.0       # کفِ ml_score (زیرِ این = رد)
    # ── فاز ۱: انتخابِ کیفیت‌محور (ضدِ اوورتریدینگ، بالا بردنِ نرخِ برد) ──
    # cooldownِ هر (نماد، جهت): پس از صدورِ یک سیگنال، تا N دقیقه سیگنالِ هم‌نماد/هم‌جهت
    # صادر نشود. ریشهٔ churn (۷۲ سیگنال/روز، زنجیرهٔ ۴۹تایی باخت): پس از بسته‌شدنِ یک
    # سیگنال، چرخهٔ بعدی فوراً همان را دوباره می‌زد.
    SIGNAL_COOLDOWN_MINUTES: int = 45
    # الزامِ کانفلوئنس برای سیگنال‌های «کم‌امتیاز»: سیگنالی با final_score زیرِ این آستانه
    # باید حداقل یک تأییدِ هم‌گرایی داشته باشد (MTF یا حجم). سیگنال‌های قوی (≥ آستانه)
    # بدونِ نیاز عبور می‌کنند. «کمتر ولی باکیفیت‌تر» بدونِ بلاکِ خام.
    SIGNAL_REQUIRE_CONFLUENCE: bool = True
    SIGNAL_CONFLUENCE_FREE_SCORE: float = 75.0
    # ── فاز ۲: لایهٔ فاندامنتال/سنتیمنت (هم‌گرایی، نه بلاک) ──
    # سوگیریِ بنیادی از CFTC COT (رایگان) به‌صورتِ پاداش/جریمهٔ نرمِ امتیاز اعمال می‌شود:
    # هم‌جهتِ سیگنال → +bonus×strength؛ خلاف → −penalty×strength. هرگز هارد-بلاک نمی‌کند.
    MACRO_FILTER_ENABLED: bool = True
    MACRO_BIAS_MIN_NET: float = 0.15   # حداقل واگراییِ خالصِ COT برای ثبتِ سوگیری
    MACRO_ALIGNED_BONUS: float = 5.0   # پاداشِ هم‌جهتی (× strength)
    MACRO_OPPOSED_PENALTY: float = 8.0 # جریمهٔ خلاف‌جهتی (× strength)
    MACRO_SENTIMENT_WEIGHT: float = 0.5  # وزنِ سنتیمنتِ خبر نسبت به COT در net
    MACRO_FRED_WEIGHT: float = 0.5       # وزنِ ماکروی USD (FRED) روی پایِ دلاری
    # ── فاز ۳: رفعِ بیش‌اطمینانِ ML ──
    # امتیازِ جهتِ ensemble به ۰/۱۰۰ اشباع می‌شد (مدل‌های اورفیت). این ضریب آن را به‌سمتِ
    # ۵۰ جمع می‌کند تا اطمینان واقع‌بینانه شود (مکملِ کالیبراتورهای per-symbolِ XGBoost).
    ML_SCORE_SHRINK: float = 0.6
    # ── فاز ۴: حجمِ تطبیقی (ریسک متناسب با اطمینان + کاهش برای همبستگی) ──
    # هر سیگنال یک risk_mult می‌گیرد که EA در محاسبهٔ لات اعمال می‌کند:
    #  - اطمینان: امتیازِ بالاتر → سایزِ بزرگ‌تر (تا سقف).
    #  - همبستگی: هر پوزیشنِ فعالِ هم‌ارز → سایزِ کوچک‌تر (۶ شورتِ ین = یک شرطِ بزرگ نشود).
    ADAPTIVE_SIZING_ENABLED: bool = True
    SIZE_MIN_MULT: float = 0.3
    SIZE_MAX_MULT: float = 1.3
    SIZE_CORR_PENALTY: float = 0.25   # کاهشِ سایز به‌ازای هر پوزیشنِ هم‌ارزِ فعال
    SIZE_CORR_FLOOR: float = 0.4      # کفِ ضریبِ همبستگی
    # ── فاز ۵: دروازهٔ اعتبارسنجی + محافظتِ کاربر (سپرِ حقوقی) ──
    # کپیِ کاربران با پولِ واقعی فقط وقتی فعال شود که مَسترِ «حسابِ واقعی» در پنجرهٔ اخیر
    # سوددهیِ مثبت ثابت کرده باشد (انتظارِ مثبت + profit factor + حداقل نمونه). تا قبلِ آن
    # کاربر روی پولِ واقعی کپی نمی‌کند — جلوگیری از شکایتِ «رباتِ ضررده».
    COPY_VALIDATION_ENABLED: bool = True
    COPY_VAL_WINDOW_DAYS: int = 14
    COPY_VAL_MIN_TRADES: int = 30
    COPY_VAL_MIN_PF: float = 1.2
    # محافظتِ دراوداونِ هر کاربر: اگر افتِ سرمایه از سقف بیشتر شد، کپیِ او خودکار pause شود.
    USER_MAX_DRAWDOWN_PCT: float = 20.0
    # کلیدهای رایگانِ منابعِ کلیددار (خالی = غیرفعال؛ با تنظیم فعال می‌شوند)
    FRED_API_KEY: str = ""
    FINNHUB_API_KEY: str = ""
    ALPHAVANTAGE_API_KEY: str = ""
    # نمادهای بلاک‌شده (داده‌محورِ ۲۰۲۶-۰۶، ۲۱۱ سیگنال): شاخص‌ها و کراس‌های ینِ بازنده.
    # DE40 −2178$ · GBPJPY −1328$ · EURJPY −1404$ · US500 −1132$ · USDCHF −1012$ · USDJPY −571$ · US30.
    # برنده‌ها (XTIUSD/XAUUSD/USDCAD/EURUSD) آزادند. قابلِ بازبینی با دادهٔ بیشتر.
    SIGNAL_SYMBOL_BLOCKLIST: List[str] = ["US30", "US500", "DE40", "GBPJPY", "EURJPY", "USDCHF", "USDJPY"]
    ANALYSIS_INTERVAL_SECONDS: int = 300

    # ── اسکلپ-سوینگِ نوسان‌محور (دداپِ تطبیقی) ──
    # نوسانِ عادی: ۱ سیگنالِ فعال به‌ازای (نماد،TF،جهت). نوسانِ بالا + روند: تا N پوزیشن،
    # ولی فقط با scale-in روی بریک‌ایون + فاصله‌گذاری + هم‌جهتِ روند (pyramiding امن).
    SCALP_ENABLED: bool = True
    SCALP_VOL_RANK_T1: float = 0.80   # atr_rank ≥ این + روند → سقفِ ۲
    SCALP_ADX_T1: float = 25.0
    SCALP_MAX_T1: int = 2
    SCALP_VOL_RANK_T2: float = 0.95   # اسپایک + روندِ قوی → سقفِ ۳
    SCALP_ADX_T2: float = 30.0
    SCALP_MAX_T2: int = 3
    SCALP_REENTRY_ATR_FRAC: float = 0.7   # حداقل فاصلهٔ ورودِ جدید از ورودهای فعال (×ATR)
    TRACKING_INTERVAL_SECONDS: int = 10

    # ── فواصل polling منابع داده (ثانیه) — کنترل مصرف API ─
    PRICE_UPDATE_INTERVAL_SECONDS: int = 30   # ←۳۰۰ بود؛ قیمتِ زنده هر ۳۰ثانیه (TTL=۱۸۰ → همیشه موجود)
    CANDLE_UPDATE_INTERVAL_SECONDS: int = 300
    HEALTH_CHECK_INTERVAL_SECONDS: int = 300

    # ── حالت معاملاتی (فاز ۶) ────────────────────────────
    # "paper" = forward-test (پیش‌فرض امن)، "live" = انتشار به کاربر، "disabled" = توقف
    TRADING_MODE: str = "paper"
    # موجودی حساب paper برای فعال‌شدن گیتِ درصدِ افتِ روزانه (مدارشکن سرمایه)
    PAPER_ACCOUNT_BALANCE: float = 10000.0
    # ریسکِ ثابتِ هر معامله (٪ اکانت) برای PositionSizer — مبنای محاسبهٔ حجم/دلار
    RISK_PER_TRADE_PCT: float = 2.0
    # کانال beta-test محدود (در حالت paper سیگنال‌ها به آنجا ارسال می‌شوند)
    BETA_CHANNEL_ID: str = ""

    # ── دامنه‌ها ─────────────────────────────────────────
    WEBSITE_DOMAIN: str = "FX.trade-future.ir"
    ADMIN_DOMAIN: str = "Panel.FX.trade-future.ir"
    API_DOMAIN: str = "api.FX.trade-future.ir"

    # کلیدِ IndexNow (Bing/Yandex) — اگر تنظیم شود، مقالهٔ جدید فوری ping می‌شود.
    # یک رشتهٔ hex دلخواه (۸ تا ۱۲۸ کاراکتر)؛ همان مقدار در /indexnow-key.txt سرو می‌شود.
    INDEXNOW_KEY: str = ""

    # ── اکوسیستمِ SEO (Google Search Console + PageSpeed) — رایگان و رسمی ──
    # مسیرِ کلیدِ Service Account (JSON) برای Search Console API. فایل خارج از گیت است
    # و فقط به‌صورتِ read-only داخلِ کانتینرهای api/celery mount می‌شود.
    SEO_SA_PATH: str = "/app/secrets/seo/service_account.json"
    # propertyِ Search Console (نوعِ Domain → پیشوندِ sc-domain:).
    SEO_GSC_SITE: str = "sc-domain:fx.trade-future.ir"
    # مسیرِ کلیدِ PageSpeed Insights API (متنِ ساده، یک خط).
    SEO_PAGESPEED_KEY_PATH: str = "/app/secrets/seo/pagespeed_api_key.txt"
    # صفحاتی که در QAِ هفتگیِ PageSpeed سنجیده می‌شوند (نسبت به ریشهٔ دامنه).
    SEO_PAGESPEED_URLS: list[str] = [
        "https://fx.trade-future.ir/",
        "https://fx.trade-future.ir/blog",
        "https://fx.trade-future.ir/academy",
    ]
    # آستانهٔ هشدارِ PageSpeed (امتیازِ کمتر از این → اکشنِ SEO).
    SEO_PAGESPEED_MIN_SCORE: int = 80
    # داده‌کاویِ Search Console: حداقل impression برای کاندیدِ «فرصتِ CTR».
    SEO_MIN_IMPRESSIONS: int = 100
    # افتِ رتبهٔ معنادار (بدترشدنِ میانگینِ position نسبت به دورهٔ قبل).
    SEO_RANK_DROP_THRESHOLD: float = 2.0

    # ── Cloudflare (purge هوشمندِ کش برای تازگیِ سئو) ──
    # اگر هر دو ست باشند، purge فعال می‌شود؛ وگرنه no-op (سیستم بدونِ CF هم کار می‌کند).
    CLOUDFLARE_API_TOKEN: str = ""
    CLOUDFLARE_ZONE_ID: str = ""

    # ── انتشارِ خودکارِ ویدیوی آکادمی در یوتیوب/آپارات (روزی یک درس، مقدماتی→حرفه‌ای) ──
    ACADEMY_DRIP_ENABLED: bool = False
    ACADEMY_SITE_URL: str = "https://fx.trade-future.ir/academy"  # لینکِ CTA داخلِ توضیحات
    # یوتیوب (Data API v3 — OAuth2 با refresh token؛ یک‌بار مالک Authorize می‌کند)
    YOUTUBE_ENABLED: bool = False
    YOUTUBE_CLIENT_ID: str = ""
    YOUTUBE_CLIENT_SECRET: str = ""
    YOUTUBE_REFRESH_TOKEN: str = ""
    YOUTUBE_PLAYLIST_TITLE: str = "آموزش جامع آکادمی فارکس از مقدماتی تا حرفه‌ای"
    YOUTUBE_PRIVACY: str = "public"  # public/unlisted/private
    BLOG_VIDEO_ENABLED: bool = False   # بلاگ→ویدیوی یوتیوب + شورت (روزی ۲ بار)

    # ── نمادها ───────────────────────────────────────────
    SYMBOLS: List[str] = [
        "XAUUSD", "XAGUSD",
        "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD",
        "EURGBP", "EURJPY", "GBPJPY", "AUDJPY", "EURAUD",
        "XTIUSD",
        "US30", "US500", "NAS100", "DE40",
    ]
    # نگاشتِ نامِ نمادِ داخلی → نامِ واقعیِ بروکر (OneRoyal). انجین/دیتا با نامِ استاندارد
    # کار می‌کند، ولی EA برای اجرا باید نامِ بروکر را بفرستد (وگرنه «نماد یافت نشد»).
    # تأییدشده از لیستِ ۲۰۷۴ نمادِ OneRoyal: نزدک=USTEC، نفتِ WTI=WTI.
    # (XNGUSD حذف شد چون OneRoyal گازِ کشِ تمیز ندارد — فقط فیوچرزِ منقضی‌شونده.)
    BROKER_SYMBOL_MAP: dict = {"NAS100": "USTEC", "XTIUSD": "WTI"}

    # تایم‌فریم‌هایی که کندلشان گرفته می‌شود (M5/M15 برای سیگنال؛ H1/H4/D1 فقط برای تأییدِ روندِ MTF)
    TIMEFRAMES: List[str] = ["M5", "M15", "H1", "H4", "D1"]
    # تایم‌فریم‌هایی که روی آن‌ها سیگنال منتشر می‌شود (اسکلپ) — به‌ترتیبِ اولویت
    SIGNAL_TIMEFRAMES: List[str] = ["M15", "M5"]

    # ضریبِ پهن‌سازیِ فاصلهٔ حد ضرر بر حسب تایم‌فریم.
    # ۱.۵ یعنی حد ضرر ۵۰٪ بازتر از پایه (ATR×ضریبِ نماد) تا با نویز/استاپ‌هانتِ
    # تایم‌فریمِ کوتاه زود استاپ نخورد. استانداردِ اسکلپ: تایم‌فریمِ کوتاه‌تر نویزی‌تر
    # است و به فاصلهٔ بیشتری نسبت به ATR نیاز دارد. TPها هم به همان نسبت دورتر می‌شوند.
    # بک‌تستِ ۳۹ سیگنالِ واقعی: ۵۴٪ SL خورده بودند → استاپ‌ها تنگ بودند.
    # M15: ۱.۵→۱.۹۵ (~۳۰٪ گشادتر، به‌درخواست) · M5: ۱.۶→۱.۸۵ (شواهدِ بک‌تست؛ M5 نویزی‌تر).
    # نکته: SLِ گشادتر = لاتِ کوچک‌تر (position sizer ریسکِ٪ ثابت)، پس فقط فضای بیشتر و
    # استاپ‌خوردنِ کمتر؛ R/R حفظ می‌شود چون TPها هم به همان نسبت دور می‌شوند.
    SL_ATR_WIDEN_BY_TF: dict = {"M5": 1.85, "M15": 1.95}

    # ── نام‌های فارسی نمادها ─────────────────────────────
    @property
    def symbol_names_fa(self) -> dict[str, str]:
        return {
            "XAUUSD": "طلا", "XAGUSD": "نقره",
            "EURUSD": "یورو/دلار", "GBPUSD": "پوند/دلار",
            "USDJPY": "دلار/ین", "USDCHF": "دلار/فرانک",
            "AUDUSD": "استرالیا/دلار", "NZDUSD": "نیوزیلند/دلار",
            "USDCAD": "دلار/کانادا", "EURGBP": "یورو/پوند",
            "EURJPY": "یورو/ین", "GBPJPY": "پوند/ین",
            "AUDJPY": "استرالیا/ین", "EURAUD": "یورو/استرالیا",
            "XTIUSD": "نفت WTI", "XNGUSD": "گاز طبیعی",
            "US30": "داوجونز", "US500": "اس‌اندپی ۵۰۰",
            "NAS100": "نزدک", "DE40": "داکس آلمان",
        }

    # ── پیپ ولیو هر نماد ─────────────────────────────────
    @property
    def pip_values(self) -> dict[str, float]:
        return {
            "XAUUSD": 0.1, "XAGUSD": 0.01,
            "EURUSD": 0.0001, "GBPUSD": 0.0001,
            "USDJPY": 0.01, "USDCHF": 0.0001,
            "AUDUSD": 0.0001, "NZDUSD": 0.0001,
            "USDCAD": 0.0001, "EURGBP": 0.0001,
            "EURJPY": 0.01, "GBPJPY": 0.01,
            "AUDJPY": 0.01, "EURAUD": 0.0001,
            "XTIUSD": 0.01, "XNGUSD": 0.001,
            "US30": 1.0, "US500": 0.1,
            "NAS100": 0.1, "DE40": 0.1,
        }

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    # ── اعتبارسنجی امنیتی — جلوگیری از راه‌اندازی با پسورد پیش‌فرض ──
    @model_validator(mode="after")
    def _enforce_secure_secrets_in_production(self) -> "Settings":
        """
        در حالت production (DEBUG=False) از راه‌اندازی با پسورد یا
        کلید پیش‌فرض جلوگیری می‌کند. در حالت DEBUG فقط هشدار می‌دهد.
        """
        issues: list[str] = []

        if self.DB_PASSWORD in _INSECURE_PASSWORDS:
            issues.append("DB_PASSWORD")
        if self.REDIS_PASSWORD in _INSECURE_PASSWORDS:
            issues.append("REDIS_PASSWORD")
        if self.ADMIN_PASSWORD in _INSECURE_PASSWORDS:
            issues.append("ADMIN_PASSWORD")
        if self.GRAFANA_PASSWORD in _INSECURE_PASSWORDS:
            issues.append("GRAFANA_PASSWORD")
        if self.JWT_SECRET_KEY in _INSECURE_JWT_SECRETS or len(self.JWT_SECRET_KEY) < 32:
            issues.append("JWT_SECRET_KEY")

        if not issues:
            return self

        message = (
            "❌ تنظیمات امنیتی ناامن: "
            + ", ".join(issues)
            + " مقدار پیش‌فرض دارند یا بسیار کوتاه هستند. "
            "لطفاً .env را با مقادیر تصادفی قوی پر کنید "
            "(برای JWT_SECRET_KEY حداقل ۳۲ کاراکتر؛ "
            "می‌توانید با `openssl rand -hex 32` تولید کنید)."
        )

        if self.DEBUG:
            # در توسعه فقط هشدار می‌دهیم تا کار محلی متوقف نشود
            import warnings
            warnings.warn(message, RuntimeWarning, stacklevel=2)
            return self

        raise ValueError(message)


# سینگلتون تنظیمات
settings = Settings()
