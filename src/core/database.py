"""مدیریت اتصال دیتابیس — SQLAlchemy 2.0 async + TimescaleDB"""

from __future__ import annotations

from datetime import datetime
from typing import AsyncGenerator

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger(__name__)

# ── موتور async ─────────────────────────────────────────
# سایز pool از تنظیمات قابل override است — افزایش پیش‌فرض برای
# پشتیبانی از API workers + signal-engine + celery + tracker
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=getattr(settings, "DB_POOL_SIZE", 30),
    max_overflow=getattr(settings, "DB_MAX_OVERFLOW", 20),
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_timeout=30,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """دریافت سشن دیتابیس"""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── مدل‌های پایه ─────────────────────────────────────────
class Base(DeclarativeBase):
    """کلاس پایه برای تمام مدل‌های دیتابیس"""


class Signal(Base):
    """مدل سیگنال"""
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(5), nullable=False)
    signal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    entry_price: Mapped[float] = mapped_column(Numeric(20, 8), nullable=True)
    entry_zone_low: Mapped[float] = mapped_column(Numeric(20, 8), nullable=True)
    entry_zone_high: Mapped[float] = mapped_column(Numeric(20, 8), nullable=True)
    sl: Mapped[float] = mapped_column(Numeric(20, 8), nullable=True)
    tp1: Mapped[float] = mapped_column(Numeric(20, 8), nullable=True)
    tp2: Mapped[float] = mapped_column(Numeric(20, 8), nullable=True)
    tp3: Mapped[float] = mapped_column(Numeric(20, 8), nullable=True)
    trailing_sl: Mapped[float] = mapped_column(Numeric(20, 8), nullable=True)
    signal_score: Mapped[int] = mapped_column(Integer, nullable=True)
    technical_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    pattern_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    ml_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    timeframe: Mapped[str] = mapped_column(String(5), nullable=True)
    mtf_confirmation = mapped_column(JSONB, nullable=True)
    analysis_details = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    close_reason: Mapped[str] = mapped_column(String(20), nullable=True)
    pnl_pips: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    pnl_dollar: Mapped[float] = mapped_column(Numeric(15, 2), nullable=True)
    hit_target: Mapped[str] = mapped_column(String(5), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    # برخورد به هر TP در مسیر — یک‌بار True می‌شود و دیگر صفر نمی‌شود (حتی اگر بعداً بازار برگردد).
    # ملاکِ واقعیِ موفقیت: tp1 خورد یعنی سیگنال فرصتِ سودِ واقعی داد. برای نرخِ موفقیتِ پالایش‌شده.
    hit_tp1: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), nullable=False)
    hit_tp2: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), nullable=False)
    hit_tp3: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), nullable=False)
    # بیشینهٔ سودِ در دسترس در مسیر (Max Favorable Excursion) برحسبِ پیپ — حتی اگر بازار برگشت
    mfe_pips: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)


class User(Base):
    """مدل کاربر تلگرام"""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str] = mapped_column(String(100), nullable=True)
    plan: Mapped[str] = mapped_column(String(20), default="free")
    preferred_symbols = mapped_column(ARRAY(Text), default=list)
    notify_strength: Mapped[str] = mapped_column(String(20), default="all")
    notify_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    language: Mapped[str] = mapped_column(String(5), default="fa")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_active: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    ban_reason: Mapped[str] = mapped_column(Text, nullable=True)
    # ── فیلدهای ربات نسخه‌ی ۲ (onboarding / اشتراک / رفرال) ──
    phone_number: Mapped[str] = mapped_column(String(20), nullable=True, index=True)
    registration_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    skill_level: Mapped[str] = mapped_column(String(20), nullable=True)  # beginner/intermediate/advanced/expert
    skill_score: Mapped[int] = mapped_column(Integer, nullable=True)
    # وضعیت چرخه‌ی کاربر در قیف ربات — new/onboarding/trial/active/expired
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")
    referral_code: Mapped[str] = mapped_column(String(12), unique=True, nullable=True, index=True)
    referred_by: Mapped[int] = mapped_column(BigInteger, nullable=True, index=True)  # telegram_id معرف
    # ── پنلِ کاربریِ VIP (ایمیل/OTP + KYC) ──
    email: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    kyc_status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="none")  # none/pending/approved/rejected
    kyc_full_name: Mapped[str] = mapped_column(String(160), nullable=True)
    kyc_country: Mapped[str] = mapped_column(String(80), nullable=True)
    kyc_doc_path: Mapped[str] = mapped_column(String(255), nullable=True)
    kyc_reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    # فیلدهای حرفه‌ایِ KYC (migration 010)
    kyc_dob: Mapped[str] = mapped_column(String(20), nullable=True)
    kyc_nationality: Mapped[str] = mapped_column(String(80), nullable=True)
    kyc_doc_type: Mapped[str] = mapped_column(String(30), nullable=True)
    kyc_doc_number: Mapped[str] = mapped_column(String(60), nullable=True)
    kyc_address: Mapped[str] = mapped_column(String(255), nullable=True)
    kyc_submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    # دسترسیِ پنلِ کاربری — فقط VIPِ پولیِ تأییدشدهٔ مدیریت (نه تریالِ رایگان)
    panel_approved: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    panel_approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    panel_approved_by: Mapped[int] = mapped_column(BigInteger, nullable=True)


class TradingAccount(Base):
    """حسابِ MT5 لینک‌شدهٔ کاربر برای کپی‌ترید — همه زیرِ سرورِ اصلیِ ما (بدونِ ترمینالِ جداگانه)."""
    __tablename__ = "trading_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    telegram_id: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False)
    broker: Mapped[str] = mapped_column(String(80), nullable=False)
    server: Mapped[str] = mapped_column(String(120), nullable=False)
    login: Mapped[str] = mapped_column(String(40), nullable=False)
    password_enc: Mapped[str] = mapped_column(Text, nullable=False)  # رمزِ معاملاتی — رمزنگاری‌شده (Fernet)
    is_oneroyal: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")  # pending/connected/error/disabled
    last_error: Mapped[str] = mapped_column(Text, nullable=True)
    balance: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    equity: Mapped[float] = mapped_column(Numeric(18, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=True)
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    last_trade_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)  # آخرین فعالیتِ معاملاتی
    warned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)       # هشدارِ بی‌فعالیتی/موجودیِ صفر
    # سرورِ ویندوزی که این حساب رویش اجرا می‌شود (sharding پایدار؛ هر حساب فقط روی یک سرور).
    server_id: Mapped[int] = mapped_column(ForeignKey("copy_servers.id", ondelete="SET NULL"), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CopyServer(Base):
    """سرورِ ویندوزِ کپی‌ترید — رجیستریِ خودکار با IP، برای sharding و مقیاس.
    هر سرور با IP خودش ثبت می‌شود و فقط کاربرانِ assign‌شده به خودش را اجرا می‌کند."""
    __tablename__ = "copy_servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ip: Mapped[str] = mapped_column(String(45), unique=True, index=True, nullable=False)
    hetzner_id: Mapped[int] = mapped_column(BigInteger, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=True)
    hostname: Mapped[str] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")  # active/draining/down
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="24")
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CopySettings(Base):
    """تنظیماتِ کپی‌تریدِ هر کاربر."""
    __tablename__ = "copy_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    risk_mode: Mapped[str] = mapped_column(String(20), nullable=False, server_default="proportional")  # proportional/fixed_lot/risk_percent
    risk_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, server_default="1.0")
    max_lot: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, server_default="1.0")
    max_open_trades: Mapped[int] = mapped_column(Integer, nullable=False, server_default="10")
    copy_sl_tp: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    max_daily_loss_pct: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, server_default="5.0")
    # نمادهای انتخابیِ کاربر برای کپی — NULL/خالی = همهٔ نمادها؛ لیست = فقط همان‌ها باز شوند
    symbols: Mapped[list] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DisclaimerAcceptance(Base):
    """ثبتِ مکتوبِ پذیرشِ سلبِ مسئولیت — متنِ کامل + نسخه + زمان + IP."""
    __tablename__ = "disclaimer_acceptances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    telegram_id: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    text_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=True)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=True)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SignalPerformance(Base):
    """مدل عملکرد سیگنال‌ها"""
    __tablename__ = "signal_performance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    period_type: Mapped[str] = mapped_column(String(10), nullable=False)
    period_start = mapped_column(Date, nullable=False)
    period_end = mapped_column(Date, nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), nullable=True)
    total_signals: Mapped[int] = mapped_column(Integer, default=0)
    win_count: Mapped[int] = mapped_column(Integer, default=0)
    loss_count: Mapped[int] = mapped_column(Integer, default=0)
    win_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    total_pips: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    avg_pips: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    max_win_pips: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    max_loss_pips: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    profit_factor: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    avg_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MLModelPerformance(Base):
    """مدل عملکرد مدل‌های ML"""
    __tablename__ = "ml_model_performance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model_name: Mapped[str] = mapped_column(String(50), nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=True)
    accuracy: Mapped[float] = mapped_column(Numeric(5, 4), nullable=True)
    precision_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=True)
    recall_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=True)
    f1_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=True)
    current_weight: Mapped[float] = mapped_column(Numeric(3, 2), nullable=True)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    training_samples: Mapped[int] = mapped_column(Integer, nullable=True)
    features_used = mapped_column(ARRAY(Text), nullable=True)


class Admin(Base):
    """مدل ادمین"""
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="admin")
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    # ── کارمندان (role="employee") — کنترلِ دسترسیِ بخش‌ها ──
    # permissions: نگاشتِ {section_key: bool}؛ NULL یعنی همهٔ بخش‌ها (ادمین/سوپرادمین).
    permissions: Mapped[dict] = mapped_column(JSONB, nullable=True)
    # رمزِ ورودِ کارمند به‌صورتِ رمزنگاری‌شده (Fernet) برای نمایشِ مجددِ سوپرادمین.
    enc_login_password: Mapped[str] = mapped_column(String(500), nullable=True)
    created_by_admin_id: Mapped[int] = mapped_column(Integer, nullable=True)
    articles = relationship("Article", back_populates="author")


class CrmContact(Base):
    """وضعیتِ CRM برای هر «سرنخ» (کاربرِ هنوز-تبدیل‌نشده). یک ردیف به‌ازای هر کاربر.
    کاربرانِ تبدیل‌شده (VIP/گرنت) به‌صورتِ پویا از فهرستِ CRM حذف می‌شوند."""
    __tablename__ = "crm_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    # new/contacted/interested/callback/no_answer/not_interested/converted/dnc
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="new", index=True)
    temperature: Mapped[str] = mapped_column(String(10), nullable=False, server_default="cold")  # hot/warm/cold
    assigned_admin_id: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    note: Mapped[str] = mapped_column(Text, nullable=True)
    callback_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_contacted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CrmActivity(Base):
    """تاریخچهٔ تماس/یادداشت برای هر سرنخ (لاگِ فعالیتِ فروش)."""
    __tablename__ = "crm_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    admin_id: Mapped[int] = mapped_column(Integer, nullable=True)  # کدام کارمند/ادمین ثبت کرد
    admin_name: Mapped[str] = mapped_column(String(100), nullable=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False, server_default="note")  # call/note/status/whatsapp/sms
    outcome: Mapped[str] = mapped_column(String(20), nullable=True)  # answered/no_answer/interested/...
    note: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class Article(Base):
    """مدل مقالات آموزشی"""
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=True)
    cover_image: Mapped[str] = mapped_column(String(500), nullable=True)
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey("admins.id"), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    # ── فیلدهای سئو (افزایشی) ──
    tags: Mapped[list] = mapped_column(JSONB, nullable=True)                  # برچسب‌ها (صفحاتِ tag + مرتبط)
    meta_description: Mapped[str] = mapped_column(String(320), nullable=True)   # متادسکریپشنِ اختصاصی
    word_count: Mapped[int] = mapped_column(Integer, nullable=True)           # تعدادِ کلمات (گیتِ کیفیت)
    content_hash: Mapped[str] = mapped_column(String(32), nullable=True, index=True)   # اثرانگشتِ ضدِ تکرار
    pillar_slug: Mapped[str] = mapped_column(String(255), nullable=True, index=True)   # خوشهٔ موضوعی → صفحهٔ مادر
    is_pillar: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)  # صفحهٔ مادر؟
    video_yt_id: Mapped[str] = mapped_column(String(32), nullable=True, index=True)   # ویدیوی بلاگِ یوتیوب
    short_yt_id: Mapped[str] = mapped_column(String(32), nullable=True)               # شورتِ یوتیوب
    video_published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    author = relationship("Admin", back_populates="articles")


class ActivityLog(Base):
    """مدل لاگ فعالیت‌ها"""
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=True)
    details = mapped_column(JSONB, nullable=True)
    admin_id: Mapped[int] = mapped_column(Integer, ForeignKey("admins.id"), nullable=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Broadcast(Base):
    """مدل پیام‌های انبوه"""
    __tablename__ = "broadcasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=True)
    media_url: Mapped[str] = mapped_column(String(500), nullable=True)        # رسانهٔ پیام (عکس/فایل)
    message_type: Mapped[str] = mapped_column(String(20), default="text")     # text/photo/document
    target_plan: Mapped[str] = mapped_column(String(40), nullable=True)       # all/free/gift_trial/...
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    total_recipients: Mapped[int] = mapped_column(Integer, default=0)
    delivered_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("admins.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BacktestRun(Base):
    """نتیجه‌ی یک run بک‌تست — برای ذخیره و نمایش در داشبورد."""
    __tablename__ = "backtest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="replay")
    # ↑ "replay" (سیگنال‌های ثبت‌شده) یا "walk_forward"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    # ↑ "pending" | "running" | "completed" | "failed"
    symbol: Mapped[str] = mapped_column(String(10), nullable=True, index=True)
    timeframe: Mapped[str] = mapped_column(String(5), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    initial_balance: Mapped[float] = mapped_column(Numeric(15, 2), nullable=True)
    final_balance: Mapped[float] = mapped_column(Numeric(15, 2), nullable=True)
    total_signals: Mapped[int] = mapped_column(Integer, nullable=True)
    trades_executed: Mapped[int] = mapped_column(Integer, nullable=True)
    win_rate: Mapped[float] = mapped_column(Numeric(5, 4), nullable=True)
    profit_factor: Mapped[float] = mapped_column(Numeric(8, 3), nullable=True)
    sharpe_ratio: Mapped[float] = mapped_column(Numeric(8, 3), nullable=True)
    max_drawdown_pct: Mapped[float] = mapped_column(Numeric(6, 4), nullable=True)
    metrics_full = mapped_column(JSONB, nullable=True)
    attribution = mapped_column(JSONB, nullable=True)
    config = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class BacktestTrade(Base):
    """یک معامله‌ی شبیه‌سازی‌شده در یک backtest run."""
    __tablename__ = "backtest_trades"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("backtest_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(5), nullable=False)
    entry_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    entry_price: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    exit_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exit_price: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    exit_reason: Mapped[str] = mapped_column(String(20), nullable=False)
    lot_size: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    gross_pips: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    net_pips: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    gross_pnl_dollar: Mapped[float] = mapped_column(Numeric(15, 2), nullable=True)
    commission_dollar: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    swap_dollar: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    net_pnl_dollar: Mapped[float] = mapped_column(Numeric(15, 2), nullable=True)
    r_multiple: Mapped[float] = mapped_column(Numeric(8, 3), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=True)
    tags = mapped_column(JSONB, nullable=True)


# ── مدل‌های ربات نسخه‌ی ۲ ────────────────────────────────
class OnboardingSession(Base):
    """رکورد ماندگار مراحل ثبت‌نام — state زنده‌ی FSM در Redis است؛
    این جدول برای audit و امکان resume نگه‌داری می‌شود."""
    __tablename__ = "onboarding_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    step: Mapped[str] = mapped_column(String(30), nullable=False, default="welcome")
    # welcome/name/phone/quiz/completed
    temp_name: Mapped[str] = mapped_column(String(200), nullable=True)
    temp_phone: Mapped[str] = mapped_column(String(20), nullable=True)
    quiz_answers = mapped_column(JSONB, nullable=True)  # {"q1": "a", ...}
    quiz_score: Mapped[int] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class PaymentRequest(Base):
    """درخواست پرداخت اشتراک — کاربر هش تراکنش را ثبت و ادمین دستی تأیید می‌کند."""
    __tablename__ = "payment_requests"
    __table_args__ = (UniqueConstraint("tx_hash", name="uq_payment_requests_tx_hash"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    plan: Mapped[str] = mapped_column(String(20), nullable=False)  # monthly/quarterly/biannual
    amount_usdt: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    network: Mapped[str] = mapped_column(String(10), nullable=True)  # TRC20/BSC
    tx_hash: Mapped[str] = mapped_column(String(120), nullable=True, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    # pending/approved/rejected
    admin_id: Mapped[int] = mapped_column(Integer, ForeignKey("admins.id"), nullable=True)
    admin_note: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class Subscription(Base):
    """اشتراک کاربر — trial یا پلن پولی. فلگ‌های idempotency برای تسک‌های Celery."""
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    plan: Mapped[str] = mapped_column(String(20), nullable=False)  # trial/monthly/quarterly/biannual
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    # active/expired/cancelled
    amount_usdt: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    payment_request_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("payment_requests.id"), nullable=True
    )
    reminder_3d_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    reminder_1d_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    expiry_processed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())  # idempotency
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChannelMember(Base):
    """عضویت کاربر در کانال VIP — ربات لینک دعوت می‌سازد و با ban/unban حذف می‌کند."""
    __tablename__ = "channel_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    channel_id: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="invited", index=True)
    # invited/active/removed
    invite_link: Mapped[str] = mapped_column(Text, nullable=True)
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    removed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)


class BotMessage(Base):
    """لاگ تمام تعاملات ربات — حجم بالا، پس PK از نوع BigInteger."""
    __tablename__ = "bot_messages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(3), nullable=False)  # in/out
    message_type: Mapped[str] = mapped_column(String(20), nullable=True)  # text/callback/contact/command
    content: Mapped[str] = mapped_column(Text, nullable=True)
    handler: Mapped[str] = mapped_column(String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class VisitEvent(Base):
    """
    رویدادِ بازدیدِ سایت — آنالیتیکسِ دقیقِ ترافیک (حجم بالا، PKِ BigInteger).

    برای هر بازدیدِ صفحه یک ردیف ثبت می‌شود تا بدانیم چه کسی، از کجا (سرچ/اینستا/
    تلگرام/مستقیم)، با چه دستگاهی و از چه کشوری آمده — برای تصمیم‌گیریِ بهترِ مدیریت.
    IP فقط به‌صورتِ هش ذخیره می‌شود (حریمِ خصوصی).
    """
    __tablename__ = "visit_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    # هویتِ ناشناسِ بازدیدکننده (کوکیِ کلاینت) + نشستِ مرورگر
    visitor_id: Mapped[str] = mapped_column(String(40), nullable=True, index=True)
    session_id: Mapped[str] = mapped_column(String(40), nullable=True, index=True)
    is_new_visitor: Mapped[bool] = mapped_column(Boolean, default=False)
    # صفحه
    path: Mapped[str] = mapped_column(String(500), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=True)
    # منبعِ ورود
    referrer: Mapped[str] = mapped_column(String(500), nullable=True)
    referrer_host: Mapped[str] = mapped_column(String(180), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(30), nullable=True, index=True)  # search/instagram/telegram/social/referral/direct/bot
    source_detail: Mapped[str] = mapped_column(String(80), nullable=True)        # google/bing/instagram/t.me/…
    utm_source: Mapped[str] = mapped_column(String(120), nullable=True)
    utm_medium: Mapped[str] = mapped_column(String(120), nullable=True)
    utm_campaign: Mapped[str] = mapped_column(String(120), nullable=True)
    landing: Mapped[bool] = mapped_column(Boolean, default=False)  # اولین بازدیدِ نشست
    # دستگاه / کلاینت
    device: Mapped[str] = mapped_column(String(12), nullable=True, index=True)  # mobile/desktop/tablet
    browser: Mapped[str] = mapped_column(String(40), nullable=True)
    os: Mapped[str] = mapped_column(String(40), nullable=True)
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    lang: Mapped[str] = mapped_column(String(20), nullable=True)
    screen: Mapped[str] = mapped_column(String(20), nullable=True)
    # موقعیت (best-effort از IP)
    country: Mapped[str] = mapped_column(String(60), nullable=True, index=True)
    country_code: Mapped[str] = mapped_column(String(4), nullable=True)
    city: Mapped[str] = mapped_column(String(80), nullable=True)
    ip_hash: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    user_agent: Mapped[str] = mapped_column(String(400), nullable=True)


class TradeHistory(Base):
    """
    تاریخچهٔ معاملاتِ واقعیِ بسته‌شده — از دیلِ واقعیِ MT5 (نه تخمین).

    هر ردیف = یک پوزیشنِ بسته‌شده با سود ناخالص، کمیسیون، سواپِ شبانه، اسپرد و
    سود/زیانِ خالص. برای حسابِ مَستر (account_uid=0) و هر کاربرِ کپی (uid=N).
    idempotent بر اساسِ (account_uid, deal_id) تا گزارشِ تکراریِ EA دوبار ثبت نشود.
    """
    __tablename__ = "trade_history"
    __table_args__ = (UniqueConstraint("account_uid", "deal_id", name="uq_trade_account_deal"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    account_uid: Mapped[int] = mapped_column(Integer, nullable=False, index=True)  # 0=master, N=copy
    deal_id: Mapped[int] = mapped_column(BigInteger, nullable=False)               # تیکتِ دیلِ MT5
    position_ticket: Mapped[int] = mapped_column(BigInteger, nullable=True)
    signal_id: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    symbol: Mapped[str] = mapped_column(String(30), nullable=True, index=True)
    direction: Mapped[str] = mapped_column(String(5), nullable=True)               # buy/sell
    volume: Mapped[float] = mapped_column(Numeric(12, 2), nullable=True)
    entry_price: Mapped[float] = mapped_column(Numeric(18, 6), nullable=True)
    exit_price: Mapped[float] = mapped_column(Numeric(18, 6), nullable=True)
    open_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    close_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    duration_sec: Mapped[int] = mapped_column(Integer, nullable=True)
    # ── اجزای مالی (واحد: ارزِ حساب) ──
    gross_profit: Mapped[float] = mapped_column(Numeric(14, 2), nullable=True)     # DEAL_PROFIT
    commission: Mapped[float] = mapped_column(Numeric(14, 2), nullable=True)       # DEAL_COMMISSION (منفی)
    swap: Mapped[float] = mapped_column(Numeric(14, 2), nullable=True)             # DEAL_SWAP (شبانه)
    spread_cost: Mapped[float] = mapped_column(Numeric(14, 2), nullable=True)      # تخمینِ هزینهٔ اسپرد
    net_profit: Mapped[float] = mapped_column(Numeric(14, 2), nullable=True, index=True)  # gross+commission+swap
    pips: Mapped[float] = mapped_column(Numeric(12, 1), nullable=True)
    close_reason: Mapped[str] = mapped_column(String(20), nullable=True)           # sl/tp/breakeven/manual/...
    balance_after: Mapped[float] = mapped_column(Numeric(16, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ════════════════════════════════════════════════════════════
#  آکادمیِ VIP (محصولِ مجزا روی academy.fx.trade-future.ir)
#  آموزشِ ویدیویی + مربیِ هوش‌مصنوعی. تحتِ کنترلِ کاملِ ادمین:
#  دانش‌آموز با نام‌کاربری/رمز (ادمین می‌سازد یا ثبت‌نامِ ایمیلی). بدونِ تلگرام.
# ════════════════════════════════════════════════════════════
class AcademyStudent(Base):
    """دانش‌آموزِ آکادمی — هویتِ مستقل (نام‌کاربری/رمز)، ساخته‌شده توسطِ ادمین یا ثبت‌نامِ ایمیلی."""
    __tablename__ = "academy_students"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=True)
    tier: Mapped[str] = mapped_column(String(20), default="free")        # free/vip/premium — ادمین تعیین می‌کند
    status: Mapped[str] = mapped_column(String(20), default="active")    # active/disabled
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)  # null = نامحدود
    notes: Mapped[str] = mapped_column(Text, nullable=True)              # یادداشتِ ادمین
    created_by: Mapped[int] = mapped_column(Integer, nullable=True)      # admin.id (null = ثبت‌نامِ خودسرویس)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    assessment_level: Mapped[str] = mapped_column(String(20), nullable=True)   # سطحِ تشخیص‌دادهٔ آزمونِ ورودی
    assessment_score: Mapped[int] = mapped_column(Integer, nullable=True)
    bootcamp: Mapped[str] = mapped_column(String(40), nullable=True)            # بوت‌کمپِ ثبت‌نام‌شده
    bootcamp_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=True, index=True)  # اجباری برای vip/premium
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # بازارنما (Pro-Chart): نوعِ حساب از بدوِ ثبت‌نام — crypto (LBank) یا broker (وان‌رویال). جدا و بدونِ تداخل.
    account_type: Mapped[str] = mapped_column(String(20), nullable=True)
    # اشتراک‌های محصولِ مجزا (گزینهٔ A — همه به یک کیفِ کانترکت واریز)
    prochart_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)   # اشتراکِ پرو-چارت (VIP)
    forex_copy_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True) # اشتراکِ کپی‌تریدِ فارکس
    copy_crypto: Mapped[bool] = mapped_column(Boolean, default=False)       # سوییچِ کپیِ کریپتو
    copy_crypto_risk: Mapped[float] = mapped_column(Float, default=1.0)     # ٪ریسکِ کپیِ کریپتو
    copy_forex: Mapped[bool] = mapped_column(Boolean, default=False)        # سوییچِ کپیِ فارکس
    copy_forex_risk: Mapped[float] = mapped_column(Float, default=1.0)      # ٪ریسکِ کپیِ فارکس


class AcademyDevice(Base):
    """دستگاهِ ثبت‌شدهٔ یک دانش‌آموز — سقفِ ۲ دستگاهِ هم‌زمان. حذفِ دستگاه = خروجِ آن دستگاه."""
    __tablename__ = "academy_devices"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)   # اثرانگشتِ مرورگر/دستگاه
    device_name: Mapped[str] = mapped_column(String(180), nullable=True)             # «Chrome روی Windows»
    user_agent: Mapped[str] = mapped_column(String(400), nullable=True)
    ip: Mapped[str] = mapped_column(String(45), nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("student_id", "device_id", name="uq_academy_device"),)


class AcademyCertificate(Base):
    """گواهیِ معتبرِ صادرشده (قابلِ راستی‌آزماییِ عمومی)."""
    __tablename__ = "academy_certificates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id"), nullable=False, index=True)
    level: Mapped[str] = mapped_column(String(20), nullable=False)
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcademyLesson(Base):
    """درسِ آکادمی — سیدشده از dictهای موجودِ src/bot/education + فیلدهای ویدیو/تیر."""
    __tablename__ = "academy_lessons"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    level: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # beginner/intermediate/advanced/ai
    order_in_level: Mapped[int] = mapped_column(Integer, default=0)
    title_fa: Mapped[str] = mapped_column(String(255), nullable=False)
    title_en: Mapped[str] = mapped_column(String(255), nullable=True)
    summary_fa: Mapped[str] = mapped_column(Text, nullable=True)
    summary_en: Mapped[str] = mapped_column(Text, nullable=True)
    content_fa: Mapped[str] = mapped_column(Text, nullable=False)
    content_en: Mapped[str] = mapped_column(Text, nullable=True)
    diagram_image: Mapped[str] = mapped_column(String(500), nullable=True)  # کاورِ PNGِ موجود
    min_tier: Mapped[str] = mapped_column(String(20), default="vip")  # free/vip/premium
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AcademyVideo(Base):
    """ویدیوی یک درس (HLSِ امن). status: pending/encoding/ready."""
    __tablename__ = "academy_videos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_lessons.id"), nullable=False, index=True)
    lang: Mapped[str] = mapped_column(String(5), default="fa")  # fa/en
    hls_url: Mapped[str] = mapped_column(String(1000), nullable=True)
    duration_sec: Mapped[int] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LessonPublication(Base):
    """انتشارِ یک درس در یوتیوب — ردگیری + جلوگیری از آپلودِ تکراری."""
    __tablename__ = "lesson_publications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_lessons.id"), nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # youtube
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending/uploaded/failed
    external_id: Mapped[str] = mapped_column(String(64), nullable=True)
    url: Mapped[str] = mapped_column(String(500), nullable=True)
    error: Mapped[str] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("lesson_id", "platform", name="uq_lesson_platform"),)


class AcademySubscription(Base):
    """رکوردِ پرداختِ اشتراکِ آکادمی (اختیاری — ادمین می‌تواند تیر را مستقیم هم تنظیم کند)."""
    __tablename__ = "academy_subscriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id"), nullable=False, index=True)
    tier: Mapped[str] = mapped_column(String(20), default="free")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active/expired/cancelled
    amount_usdt: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    payment_request_id: Mapped[int] = mapped_column(Integer, ForeignKey("payment_requests.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcademyProgress(Base):
    """پیشرفتِ دانش‌آموز در هر درس + نمرهٔ کوییز."""
    __tablename__ = "academy_progress"
    __table_args__ = (UniqueConstraint("student_id", "lesson_id", name="uq_academy_progress_student_lesson"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id"), nullable=False, index=True)
    lesson_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_lessons.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="started")  # started/completed
    quiz_score: Mapped[int] = mapped_column(Integer, nullable=True)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class AcademyLessonRating(Base):
    """امتیاز/نظرِ دانش‌آموز به یک درس (۱..۵)."""
    __tablename__ = "academy_lesson_ratings"
    __table_args__ = (UniqueConstraint("student_id", "lesson_id", name="uq_academy_rating"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    lesson_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_lessons.id", ondelete="CASCADE"), index=True, nullable=False)
    stars: Mapped[int] = mapped_column(Integer, nullable=False)  # 1..5
    review: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcademyLessonComment(Base):
    """بحث/پرسشِ زیرِ هر درس (با مودراسیون مثلِ انجمن)."""
    __tablename__ = "academy_lesson_comments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_lessons.id", ondelete="CASCADE"), index=True, nullable=False)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="published")  # published/pending/rejected
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcademyLessonNote(Base):
    """یادداشتِ شخصیِ سمت‌سرورِ هر درس (سینک بین دستگاه‌ها)."""
    __tablename__ = "academy_lesson_notes"
    __table_args__ = (UniqueConstraint("student_id", "lesson_id", name="uq_academy_note"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    lesson_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_lessons.id", ondelete="CASCADE"), index=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcademyAchievement(Base):
    """نشانِ کسب‌شدهٔ دانش‌آموز (گیمیفیکیشن)."""
    __tablename__ = "academy_achievements"
    __table_args__ = (UniqueConstraint("student_id", "badge", name="uq_academy_achievement"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    badge: Mapped[str] = mapped_column(String(40), nullable=False)
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcademyStreak(Base):
    """استریکِ روزهای پیاپیِ فعالیتِ دانش‌آموز."""
    __tablename__ = "academy_streaks"
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), primary_key=True)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_active_date: Mapped[datetime] = mapped_column(Date, nullable=True)


class AcademyTerminalWorkspace(Base):
    """چیدمانِ ترمینالِ هر دانش‌آموز (نماد/تایم‌فریم/اندیکاتورها/رسم‌ها) — سینکِ بین‌دستگاه."""
    __tablename__ = "academy_terminal_workspaces"
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), primary_key=True)
    layout = mapped_column(JSONB, nullable=True)   # {symbol, tf, overlays:[], subs:[], drawings:{...}}
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcademyStudyPlan(Base):
    """برنامهٔ مطالعهٔ تولیدشدهٔ AI برای دانش‌آموز (فاز ۲ مربی)."""
    __tablename__ = "academy_study_plans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    goal: Mapped[str] = mapped_column(String(300), nullable=True)
    days: Mapped[int] = mapped_column(Integer, default=30)
    plan = mapped_column(JSONB, nullable=True)   # [{day, title, lesson_slugs:[], task, done}]
    status: Mapped[str] = mapped_column(String(12), default="active")  # active/archived
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcademyQuiz(Base):
    """سوالِ کوییزِ یک درس (چندگزینه‌ای)."""
    __tablename__ = "academy_quizzes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lesson_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_lessons.id"), nullable=False, index=True)
    question_fa: Mapped[str] = mapped_column(Text, nullable=False)
    question_en: Mapped[str] = mapped_column(Text, nullable=True)
    options: Mapped[list] = mapped_column(JSONB, nullable=False)  # ["گزینه ۱", ...]
    correct_index: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation_fa: Mapped[str] = mapped_column(Text, nullable=True)


class AcademyJournalEntry(Base):
    """ژورنالِ معاملاتیِ دانش‌آموز (تمرینِ ثبت و تحلیلِ معاملات)."""
    __tablename__ = "academy_journal"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id"), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(30), nullable=True)
    direction: Mapped[str] = mapped_column(String(8), nullable=True)   # buy/sell
    entry: Mapped[float] = mapped_column(Numeric(18, 5), nullable=True)
    exit: Mapped[float] = mapped_column(Numeric(18, 5), nullable=True)
    size: Mapped[float] = mapped_column(Numeric(12, 2), nullable=True)
    pnl: Mapped[float] = mapped_column(Numeric(14, 2), nullable=True)
    emotion: Mapped[str] = mapped_column(String(20), nullable=True)    # calm/fear/greed/...
    note: Mapped[str] = mapped_column(Text, nullable=True)
    lesson_learned: Mapped[str] = mapped_column(Text, nullable=True)
    tags = mapped_column(JSONB, nullable=True)                # ["breakout","retest",...] (فاز ۵)
    screenshot_url: Mapped[str] = mapped_column(String(1000), nullable=True)
    ai_review: Mapped[str] = mapped_column(Text, nullable=True)   # بازبینیِ AIِ معامله
    traded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcademyPracticeTrade(Base):
    """معاملهٔ شبیه‌سازِ تمرین (حسابِ مجازی)."""
    __tablename__ = "academy_practice"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id"), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(30), nullable=True)
    direction: Mapped[str] = mapped_column(String(8), nullable=True)
    entry: Mapped[float] = mapped_column(Numeric(18, 5), nullable=True)
    exit: Mapped[float] = mapped_column(Numeric(18, 5), nullable=True)
    pnl_r: Mapped[float] = mapped_column(Numeric(8, 2), nullable=True)   # نتیجه به واحدِ R
    outcome: Mapped[str] = mapped_column(String(12), nullable=True)      # tp/sl/manual/time
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class AcademyPaperPosition(Base):
    """پوزیشنِ معاملهٔ کاغذیِ (Paper-Trading) روی قیمتِ زنده."""
    __tablename__ = "academy_paper"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id"), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(30), nullable=False)
    direction: Mapped[str] = mapped_column(String(8), nullable=False)   # buy/sell
    entry: Mapped[float] = mapped_column(Numeric(18, 5), nullable=False)
    sl: Mapped[float] = mapped_column(Numeric(18, 5), nullable=True)
    tp: Mapped[float] = mapped_column(Numeric(18, 5), nullable=True)
    size: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)  # واحد (units)
    risk_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="open", index=True)  # open/closed
    exit: Mapped[float] = mapped_column(Numeric(18, 5), nullable=True)
    pnl_usd: Mapped[float] = mapped_column(Numeric(14, 2), nullable=True)
    outcome: Mapped[str] = mapped_column(String(12), nullable=True)
    order_type: Mapped[str] = mapped_column(String(12), default="market", nullable=True)  # market/limit/stop
    limit_price: Mapped[float] = mapped_column(Numeric(18, 5), nullable=True)   # برای سفارشِ معلق
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class AcademyPost(Base):
    """پستِ انجمنِ آکادمی (با مودراسیون)."""
    __tablename__ = "academy_posts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=True, index=True)  # تحلیل/سوال/تجربه/اخبار
    status: Mapped[str] = mapped_column(String(12), default="published", index=True)  # published/pending/rejected
    flag_reason: Mapped[str] = mapped_column(String(200), nullable=True)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    replies_count: Mapped[int] = mapped_column(Integer, default=0)
    reports: Mapped[int] = mapped_column(Integer, default=0)
    reactions = mapped_column(JSONB, nullable=True)           # {"🔥":3,"👍":5,...} (فاز ۵)
    best_reply_id: Mapped[int] = mapped_column(Integer, nullable=True)  # پاسخِ برگزیده
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class AcademySavedStrategy(Base):
    """استراتژیِ ذخیره‌شدهٔ دانش‌آموز (آزمایشگاه/الگو) — فاز ۴."""
    __tablename__ = "academy_saved_strategies"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(12), default="lab")   # lab/algo
    params = mapped_column(JSONB, nullable=True)
    metrics = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcademyPostReply(Base):
    """پاسخِ یک پستِ انجمن."""
    __tablename__ = "academy_post_replies"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_posts.id"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="published", index=True)
    parent_id: Mapped[int] = mapped_column(Integer, nullable=True)   # تردِ تو در تو (فاز ۵)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcademyMentorThread(Base):
    """تردِ مکالمهٔ مربیِ AI (حافظهٔ مکالمه)."""
    __tablename__ = "academy_mentor_threads"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AcademyMentorMessage(Base):
    """پیامِ یک ترد (نقش: user/assistant)."""
    __tablename__ = "academy_mentor_messages"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    thread_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_mentor_threads.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(12), nullable=False)  # user/assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    lang: Mapped[str] = mapped_column(String(5), default="fa")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────── ماژولِ اینستاگرام (پنلِ مستقلِ Multi-Tenant) ───────────────────────────
class IGUser(Base):
    """کاربرِ پنلِ اینستاگرام (مستأجر) — ورود با یوزرنیم/پسوردِ خودش، تا max_accounts اکانت."""
    __tablename__ = "ig_users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=True)
    max_accounts: Mapped[int] = mapped_column(Integer, default=3)           # سقفِ اکانتِ اینستاگرام
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin_seed: Mapped[bool] = mapped_column(Boolean, default=False)     # کاربرِ ادمینِ seed‌شده
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_admin_id: Mapped[int] = mapped_column(Integer, ForeignKey("admins.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # نظارت/ادمین
    enc_login_password: Mapped[str] = mapped_column(String(500), nullable=True)  # رمزِ پنل (Fernet) — برای نمایش به ادمین
    permissions = mapped_column(JSONB, nullable=True)        # قفلِ فیچرها {accounts,smart_reply,content,autopilot,forms,inbox,ai:true/false}؛ null=همه باز
    notes: Mapped[str] = mapped_column(Text, nullable=True)  # یادداشتِ ادمین دربارهٔ کاربر
    login_count: Mapped[int] = mapped_column(Integer, default=0)
    last_login_ip: Mapped[str] = mapped_column(String(45), nullable=True)


class IgAccount(Base):
    """اکانتِ اینستاگرامِ متصل (لاگین با instagrapi، sessionِ ذخیره‌شده)."""
    __tablename__ = "ig_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("ig_users.id", ondelete="CASCADE"), index=True, nullable=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    ig_pk: Mapped[str] = mapped_column(String(40), nullable=True)           # عددیِ اکانت
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="offline")     # online/offline/challenge/error
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    smart_enabled: Mapped[bool] = mapped_column(Boolean, default=True)      # تاگلِ پاسخِ هوشمندِ این اکانت
    enc_password: Mapped[str] = mapped_column(String(500), nullable=True)   # رمزِ IG (Fernet)
    enc_totp: Mapped[str] = mapped_column(String(500), nullable=True)       # سکرتِ ۲FA (Fernet)
    session_path: Mapped[str] = mapped_column(String(255), nullable=True)   # sessions/{id}.json
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IgMessage(Base):
    """پیامِ قابلِ‌استفادهٔ مجدد (متن/دکمه/فایل/ویترینِ محصولات) برای پاسخِ هوشمند."""
    __tablename__ = "ig_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("ig_accounts.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    msg_type: Mapped[str] = mapped_column(String(20), default="text")      # text/button/file/products
    text: Mapped[str] = mapped_column(Text, nullable=True)
    buttons = mapped_column(JSONB, nullable=True)        # [{label, kind:message|link|form, target}]
    file_url: Mapped[str] = mapped_column(String(1000), nullable=True)
    file_kind: Mapped[str] = mapped_column(String(12), nullable=True)      # image/voice/video
    products = mapped_column(JSONB, nullable=True)       # [{title, subtitle, image, link}]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IgAutoReply(Base):
    """دستورِ پاسخِ خودکار (جزئیاتِ دستور)."""
    __tablename__ = "ig_auto_replies"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("ig_accounts.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=True)
    on_direct: Mapped[bool] = mapped_column(Boolean, default=False)
    on_comment: Mapped[bool] = mapped_column(Boolean, default=True)        # کامنت (پست و لایو)
    match_mode: Mapped[str] = mapped_column(String(12), default="contains")  # equal/contains/any
    keywords = mapped_column(JSONB, nullable=True)       # ["کلمه۱", ...] (در حالتِ any خالی)
    message_id: Mapped[int] = mapped_column(Integer, ForeignKey("ig_messages.id"), nullable=True)
    message_ids = mapped_column(JSONB, nullable=True)    # چند پیامِ پشت‌سرِهم [id1, id2,...] (مقدم بر message_id)
    # گزینه‌ها
    require_follow: Mapped[bool] = mapped_column(Boolean, default=False)
    follow_message: Mapped[str] = mapped_column(Text, nullable=True)        # پیامِ «صفحه را فالو کن»
    follow_button_text: Mapped[str] = mapped_column(String(100), nullable=True)  # متنِ دکمهٔ «فالو دارم»
    specific_media: Mapped[str] = mapped_column(String(120), nullable=True)  # media_pk خاص یا 'next'
    reminder: Mapped[bool] = mapped_column(Boolean, default=False)
    reminder_hours: Mapped[int] = mapped_column(Integer, nullable=True)     # بعد از چند ساعت
    reminder_message_id: Mapped[int] = mapped_column(Integer, nullable=True)  # پیامِ یادآوری
    comment_after_dm: Mapped[bool] = mapped_column(Boolean, default=False)
    max_replies: Mapped[int] = mapped_column(Integer, nullable=True)       # ارسالِ پاسخ با تعدادِ محدود
    like_dm: Mapped[bool] = mapped_column(Boolean, default=False)
    use_ai: Mapped[bool] = mapped_column(Boolean, default=False)           # پاسخِ هوشمندِ Claude
    ai_prompt: Mapped[str] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IgForm(Base):
    """فرم‌سازِ دایرکت."""
    __tablename__ = "ig_forms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("ig_accounts.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    start_trigger: Mapped[str] = mapped_column(String(255), nullable=True)
    questions = mapped_column(JSONB, nullable=True)      # ["متنِ سوال", ...]
    cancel_trigger: Mapped[str] = mapped_column(String(255), nullable=True)
    cancel_message: Mapped[str] = mapped_column(Text, nullable=True)
    end_message: Mapped[str] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IgContent(Base):
    """محتوای انتشار (پست/ریلز) — دستی، AI، یا از خبر/بلاگ؛ تکی یا زمان‌بندی."""
    __tablename__ = "ig_contents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_ids = mapped_column(JSONB, nullable=True)    # [1,2] چنداکانتی
    post_type: Mapped[str] = mapped_column(String(12), default="post")  # post/reel/story/album
    title: Mapped[str] = mapped_column(String(255), nullable=True)
    caption: Mapped[str] = mapped_column(Text, nullable=True)
    captions_custom = mapped_column(JSONB, nullable=True)  # {account_id: caption} سفارشی per-account
    media_urls = mapped_column(JSONB, nullable=True)     # [url,...]
    cover_url: Mapped[str] = mapped_column(String(1000), nullable=True)
    hashtags: Mapped[str] = mapped_column(Text, nullable=True)
    first_comment: Mapped[str] = mapped_column(Text, nullable=True)
    x_thread: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_delete_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    # تولیدِ AI / کاور
    ai_prompt: Mapped[str] = mapped_column(Text, nullable=True)
    cover_spec = mapped_column(JSONB, nullable=True)     # {title, subtitle, template}
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual/ai/news/blog
    # زمان‌بندی/وضعیت
    mode: Mapped[str] = mapped_column(String(12), default="now")       # now/schedule/draft
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")   # draft/scheduled/publishing/published/failed
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    result = mapped_column(JSONB, nullable=True)         # {account_id: {media_pk, code, error}}
    # تولیدِ خودکارِ ویدیو با ElevenLabs (فاز اتوماسیون)
    gen_video: Mapped[bool] = mapped_column(Boolean, default=False)     # ساختِ خودکارِ ویدیو؟
    video_prompt: Mapped[str] = mapped_column(Text, nullable=True)      # پرامپتِ سناریوی ویدیو
    video_status: Mapped[str] = mapped_column(String(20), nullable=True)  # pending/generating/ready/failed
    video_spec = mapped_column(JSONB, nullable=True)    # {style, ratio, voice, music, subtitles, scenes}
    # اتصالِ خودکارِ دایرکتِ هوشمند بعد از انتشار (کلیدواژه → لینک)
    auto_reply_keyword: Mapped[str] = mapped_column(String(120), nullable=True)
    auto_reply_link: Mapped[str] = mapped_column(String(1000), nullable=True)
    auto_reply_text: Mapped[str] = mapped_column(Text, nullable=True)
    auto_reply_done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IgAutopilot(Base):
    """خلبانِ خودکار — مغزِ ارسالِ اتوماتیک: خودش موضوع را برمی‌دارد، ویدیو/کپشن می‌سازد و منتشر می‌کند."""
    __tablename__ = "ig_autopilots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=True)
    account_ids = mapped_column(JSONB, nullable=True)            # [1,2]
    topics = mapped_column(JSONB, nullable=True)                 # (قدیمی) ["موضوع", ...]
    # کمپین‌ها — هر مورد: {topic, keyword, link, cta:"dm"|"comment"} → ویدیو دربارهٔ موضوع، پایانش CTAِ همان کلیدواژه
    campaigns = mapped_column(JSONB, nullable=True)
    post_types = mapped_column(JSONB, nullable=True)             # ["reel","post"] (چرخشی)
    gen_video: Mapped[bool] = mapped_column(Boolean, default=True)
    video_spec = mapped_column(JSONB, nullable=True)            # {voice, music, ratio}
    caption_ai: Mapped[bool] = mapped_column(Boolean, default=True)
    times = mapped_column(JSONB, nullable=True)                  # ساعت‌های انتشار در روز [10,18]
    auto_keyword: Mapped[str] = mapped_column(String(120), nullable=True)
    auto_link: Mapped[str] = mapped_column(String(1000), nullable=True)
    auto_reply_text: Mapped[str] = mapped_column(Text, nullable=True)
    first_comment_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    topic_cursor: Mapped[int] = mapped_column(Integer, default=0)
    type_cursor: Mapped[int] = mapped_column(Integer, default=0)
    made_count: Mapped[int] = mapped_column(Integer, default=0)
    last_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IgInbox(Base):
    """لاگِ پیام‌ها/نظراتِ ورودی و پاسخِ ارسالی (برای صندوق + آمار)."""
    __tablename__ = "ig_inbox"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("ig_accounts.id"), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(12), nullable=False)      # direct/comment
    from_username: Mapped[str] = mapped_column(String(80), nullable=True)
    media_code: Mapped[str] = mapped_column(String(40), nullable=True)
    text_in: Mapped[str] = mapped_column(Text, nullable=True)
    text_out: Mapped[str] = mapped_column(Text, nullable=True)         # پاسخِ ارسالی (در صورتِ خودکار)
    auto_reply_id: Mapped[int] = mapped_column(Integer, nullable=True)
    handled: Mapped[bool] = mapped_column(Boolean, default=False)
    ext_id: Mapped[str] = mapped_column(String(80), index=True, nullable=True)  # شناسهٔ یکتای کامنت/پیام (ضدِ تکرار)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ───────────────────────────── SEO ecosystem ─────────────────────────────

class SeoMetricsDaily(Base):
    """عکسِ روزانهٔ کلِ معیارهای Search Console (برای رسمِ روند و تشخیصِ افت)."""

    __tablename__ = "seo_metrics_daily"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    day: Mapped[datetime] = mapped_column(DateTime(timezone=True), unique=True, index=True, nullable=False)
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    ctr: Mapped[float] = mapped_column(Numeric(6, 4), nullable=True)        # 0..1
    position: Mapped[float] = mapped_column(Numeric(6, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SeoAction(Base):
    """آیتمِ «SEO Action Required» — یک مشکل/فرصتِ قابلِ‌اقدام که داده‌کاوی پیدا کرده."""

    __tablename__ = "seo_actions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(30), index=True, nullable=False)  # ctr_opportunity/rank_drop/zero_click/pagespeed/index_issue
    severity: Mapped[str] = mapped_column(String(10), default="info", index=True)  # high/medium/low/info
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=True)
    target: Mapped[str] = mapped_column(Text, nullable=True)                       # URL یا کوئری
    metrics = mapped_column(JSONB, nullable=True)                                  # اعداد پشتیبان
    dedup_key: Mapped[str] = mapped_column(String(120), index=True, nullable=True) # ضدِ تکرارِ روزانه
    status: Mapped[str] = mapped_column(String(12), default="open", index=True)    # open/resolved/dismissed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class SeoPagespeed(Base):
    """نتیجهٔ یک اجرای PageSpeed Insights برای یک URL/استراتژی."""

    __tablename__ = "seo_pagespeed"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    strategy: Mapped[str] = mapped_column(String(10), default="mobile")            # mobile/desktop
    performance: Mapped[int] = mapped_column(Integer, nullable=True)
    seo: Mapped[int] = mapped_column(Integer, nullable=True)
    accessibility: Mapped[int] = mapped_column(Integer, nullable=True)
    best_practices: Mapped[int] = mapped_column(Integer, nullable=True)
    lcp_ms: Mapped[float] = mapped_column(Numeric(10, 1), nullable=True)
    cls: Mapped[float] = mapped_column(Numeric(6, 4), nullable=True)
    tbt_ms: Mapped[float] = mapped_column(Numeric(10, 1), nullable=True)
    fcp_ms: Mapped[float] = mapped_column(Numeric(10, 1), nullable=True)
    si_ms: Mapped[float] = mapped_column(Numeric(10, 1), nullable=True)
    issues = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class SeoMonitoredUrl(Base):
    """صفحاتی که در QAِ PageSpeed تحتِ‌نظرند (قابلِ مدیریت از پنلِ ادمین)."""

    __tablename__ = "seo_monitored_urls"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(120), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, server_default="true", default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────── بازارنما (TradingView-clone در آکادمی) ───────────────────────

class BnLayout(Base):
    """چیدمانِ ذخیره‌شدهٔ چارت (نماد/تایم‌فریم/اندیکاتور/ترسیم) برای هر دانشجو."""

    __tablename__ = "bn_layouts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    data = mapped_column(JSONB, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BnScript(Base):
    """اسکریپتِ «نمااسکریپت»ِ کاربر (اندیکاتور/استراتژیِ سفارشی)."""

    __tablename__ = "bn_scripts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), server_default="indicator", default="indicator")
    source: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, server_default="true", default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BnAlert(Base):
    """آلارمِ کاربر روی قیمت/اندیکاتور/اسکریپت."""

    __tablename__ = "bn_alerts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    tf: Mapped[str] = mapped_column(String(8), server_default="H1", default="H1")
    name: Mapped[str] = mapped_column(String(160), nullable=True)
    condition = mapped_column(JSONB, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, server_default="true", default=True)
    last_triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BnWatchlist(Base):
    """واچ‌لیستِ نمادهای دانشجو."""

    __tablename__ = "bn_watchlists"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), server_default="پیش‌فرض", default="پیش‌فرض")
    symbols = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BnAiSignal(Base):
    """سیگنالِ لحظه‌ایِ AI — ستاپِ کامل با SL/TP و ردیابیِ برخورد."""

    __tablename__ = "bn_ai_signals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    tf: Mapped[str] = mapped_column(String(8), nullable=False)
    direction: Mapped[str] = mapped_column(String(4), nullable=False)
    entry: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    sl: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    tp1: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    tp2: Mapped[float] = mapped_column(Numeric(20, 8), nullable=True)
    tp3: Mapped[float] = mapped_column(Numeric(20, 8), nullable=True)
    confidence: Mapped[int] = mapped_column(Integer, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(12), server_default="active", default="active", index=True)
    hit: Mapped[str] = mapped_column(String(12), nullable=True)
    last_price: Mapped[float] = mapped_column(Numeric(20, 8), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class BnExchangeAccount(Base):
    """اتصالِ حسابِ واقعیِ کاربر — کریپتو (LBank) یا فارکس (MT5/وان‌رویال).
    کردنشال‌ها با Fernet (crypto.py) رمزنگاری می‌شوند؛ DB هرگز plaintext ندارد.
    تریدِ واقعیِ روی چارت فقط با referral_verified=True و status=active مجاز است."""
    __tablename__ = "bn_exchange_accounts"
    __table_args__ = (UniqueConstraint("student_id", "kind", name="uq_bn_exch_student_kind"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)         # lbank | mt5
    # LBank: enc_key + enc_secret + uid ؛ MT5: enc_login + enc_password + server
    enc_key: Mapped[str] = mapped_column(Text, nullable=True)
    enc_secret: Mapped[str] = mapped_column(Text, nullable=True)
    account_ref: Mapped[str] = mapped_column(String(64), nullable=True)   # LBank uid / MT5 login
    server: Mapped[str] = mapped_column(String(64), nullable=True)        # MT5 server
    referral_verified: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False)
    status: Mapped[str] = mapped_column(String(12), server_default="active", default="active")
    last_check_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BnOrder(Base):
    """صفِ سفارشِ تریدِ واقعیِ بازارنما (مستقلِ pro-chart). کریپتو فوری روی LBankِ کاربر
    اجرا و ثبت می‌شود؛ فارکس (MT5/وان‌رویال) اینجا pending می‌نشیند و سرورِ اجرا (همان سرورِ
    کپیِ پنل) آن را poll می‌کند — هرگز روی حسابِ مَستر اجرا نمی‌شود (ایزولاسیونِ per-user)."""
    __tablename__ = "bn_orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False)
    market: Mapped[str] = mapped_column(String(10), nullable=False)        # crypto | forex
    broker: Mapped[str] = mapped_column(String(16), nullable=True)         # LBank | OneRoyal
    account_ref: Mapped[str] = mapped_column(String(64), nullable=True)    # MT5 login / LBank uid (مقصدِ per-user)
    server: Mapped[str] = mapped_column(String(64), nullable=True)         # MT5 server
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    side: Mapped[str] = mapped_column(String(4), nullable=False)           # buy | sell
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=True)             # 0/None = market
    sl: Mapped[float] = mapped_column(Float, nullable=True)
    tp: Mapped[float] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(12), server_default="pending", default="pending", index=True)  # pending|sent|filled|failed|canceled
    broker_order_id: Mapped[str] = mapped_column(String(64), nullable=True)
    error: Mapped[str] = mapped_column(String(255), nullable=True)
    picked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


async def init_db() -> None:
    """ساخت جداول اولیه"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("database_initialized")


async def close_db() -> None:
    """بستن اتصال دیتابیس"""
    await engine.dispose()
    logger.info("database_connection_closed")
