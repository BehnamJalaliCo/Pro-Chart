"""کیبوردهای ربات — Reply Keyboard منوی اصلی + inlineهای onboarding/پرداخت/ادمین."""

from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder

from src.bot import texts
from src.bot.services import quiz
from src.core.config import settings


# ── شروع ثبت‌نام ──
def start_onboarding_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🚀 شروع ثبت‌نام", callback_data="ob:start")]]
    )


# ── ارسال شماره تماس ──
def share_contact_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 ارسال شماره من", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
        input_field_placeholder="یا شماره را دستی تایپ کنید…",
    )


# ── آزمون: گزینه‌های یک سوال ──
def quiz_keyboard(index: int) -> InlineKeyboardMarkup:
    q = quiz.get_question(index)
    builder = InlineKeyboardBuilder()
    for opt_key, opt_text in q.options.items():
        builder.button(text=opt_text, callback_data=f"quiz:{index}:{opt_key}")
    builder.adjust(1)
    return builder.as_markup()


def quiz_intro_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="شروع آزمون ✅", callback_data="quiz:begin")]]
    )


# ── منوی اصلی (Reply Keyboard) ──
def main_menu_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            # پنلِ کاربری به‌صورتِ WebApp (مثلِ اپلیکیشن، داخلِ تلگرام باز می‌شود)
            [KeyboardButton(text=texts.BTN_COPY, web_app=WebAppInfo(url=settings.USER_PANEL_URL))],
            [KeyboardButton(text=texts.BTN_SIGNALS), KeyboardButton(text=texts.BTN_VIP)],
            [KeyboardButton(text=texts.BTN_MARKET), KeyboardButton(text=texts.BTN_EDU)],
            [KeyboardButton(text=texts.BTN_AI), KeyboardButton(text=texts.BTN_BROKER)],
            [KeyboardButton(text=texts.BTN_PROFILE), KeyboardButton(text=texts.BTN_REFERRAL)],
            [KeyboardButton(text=texts.BTN_SUPPORT), KeyboardButton(text=texts.BTN_SETTINGS)],
        ],
        resize_keyboard=True,
        input_field_placeholder="از منو انتخاب کنید…",
    )


# ── اشتراک VIP: انتخاب پلن ──
def vip_plans_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=f"🥈 ماهیانه — {settings.SUB_PRICE_MONTHLY}$", callback_data="sub:plan:monthly")
    builder.button(text=f"🥇 سه‌ماهه — {settings.SUB_PRICE_QUARTERLY}$", callback_data="sub:plan:quarterly")
    builder.button(text=f"💎 شش‌ماهه — {settings.SUB_PRICE_BIANNUAL}$", callback_data="sub:plan:biannual")
    builder.button(text="🎁 اشتراکِ رایگانِ همیشگی", callback_data="sub:free")
    builder.adjust(1)
    return builder.as_markup()


# ── اشتراک رایگانِ همیشگی (از طریق بروکر) ──
def free_subscription_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🚀 ثبت‌نام در OneRoyal", url=settings.BROKER_REFERRAL_URL)
    _h = (settings.SUPPORT_HANDLE or "").lstrip("@")
    if _h:
        builder.button(text="💬 ارسال شناسه به پشتیبانی", url=f"https://t.me/{_h}")
    builder.button(text="🔙 بازگشت به پلن‌ها", callback_data="sub:plans")
    builder.adjust(1)
    return builder.as_markup()


# ── پس از انتخاب پلن: «پرداخت کردم» ──
def payment_submit_keyboard(plan: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ پرداخت کردم، ثبت هش", callback_data=f"sub:paid:{plan}")
    builder.button(text="🔙 بازگشت به پلن‌ها", callback_data="sub:plans")
    builder.adjust(1)
    return builder.as_markup()


# ── دکمه‌ی تهیه اشتراک (inline، مثلاً در پیام پایان trial) ──
def buy_subscription_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="💎 تهیه اشتراک", callback_data="sub:plans")]]
    )


# ── ادمین: تأیید/رد یک درخواست پرداخت ──
def admin_payment_review_keyboard(payment_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ تأیید", callback_data=f"adm:pay:approve:{payment_id}")
    builder.button(text="❌ رد", callback_data=f"adm:pay:reject:{payment_id}")
    builder.adjust(2)
    return builder.as_markup()


# ── آموزش: دسته‌بندی ──
def education_categories_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🟢 مقدماتی", callback_data="edu:cat:beginner")
    builder.button(text="🟡 متوسط", callback_data="edu:cat:intermediate")
    builder.button(text="🔴 پیشرفته", callback_data="edu:cat:advanced")
    builder.adjust(1)
    return builder.as_markup()


# ── آموزش: لیست جلسات یک دسته ──
def education_lessons_keyboard(lessons: list[tuple[str, str]]) -> InlineKeyboardMarkup:
    """lessons: لیست (title, slug) به‌ترتیب نمایش."""
    builder = InlineKeyboardBuilder()
    for title, slug in lessons:
        builder.button(text=title, callback_data=f"edu:lesson:{slug}")
    builder.button(text="🔙 بازگشت به مرحله‌ها", callback_data="edu:home")
    builder.adjust(1)
    return builder.as_markup()


# ── آموزش: ناوبری داخل یک جلسه ──
def education_lesson_nav_keyboard(
    cat: str, prev_slug: str | None, next_slug: str | None
) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    row = 0
    if prev_slug:
        builder.button(text="◀️ جلسهٔ قبل", callback_data=f"edu:lesson:{prev_slug}")
        row += 1
    if next_slug:
        builder.button(text="جلسهٔ بعد ▶️", callback_data=f"edu:lesson:{next_slug}")
        row += 1
    builder.button(text="📋 فهرست جلسات", callback_data=f"edu:cat:{cat}")
    if row == 2:
        builder.adjust(2, 1)
    else:
        builder.adjust(1)
    return builder.as_markup()


# ── پشتیبانی ──
def _support_handle_url() -> str:
    handle = (settings.SUPPORT_HANDLE or "").lstrip("@")
    return f"https://t.me/{handle}" if handle else "https://t.me/"


def support_home_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="💳 پرداخت و اشتراک", callback_data="sup:cat:payment")
    builder.button(text="📊 سیگنال‌ها و کانال", callback_data="sup:cat:signals")
    builder.button(text="🎁 دورهٔ آزمایشی", callback_data="sup:cat:trial")
    builder.button(text="🔐 حساب و امنیت", callback_data="sup:cat:account")
    builder.button(text="💬 گفت‌وگو با کارشناس", url=_support_handle_url())
    builder.adjust(2, 2, 1)
    return builder.as_markup()


def support_section_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="💬 گفت‌وگو با کارشناس", url=_support_handle_url())
    builder.button(text="🔙 بازگشت به پشتیبانی", callback_data="sup:home")
    builder.adjust(1)
    return builder.as_markup()


# ── تنظیمات ──
def settings_keyboard(notify_enabled: bool, language: str = "fa") -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    bell = "🔔 اعلان‌ها: روشن" if notify_enabled else "🔕 اعلان‌ها: خاموش"
    builder.button(text=bell, callback_data="set:notif:toggle")
    # دکمهٔ زبان حذف شد: ربات تک‌زبانه (فارسی) است و انگلیسی پشتیبانی نمی‌شد،
    # پس دکمه هیچ اثری نداشت و گمراه‌کننده بود. به‌جایش دکمهٔ پشتیبانی.
    _h = (settings.SUPPORT_HANDLE or "").lstrip("@")
    if _h:
        builder.button(text="🆘 پشتیبانی", url=f"https://t.me/{_h}")
    builder.adjust(1)
    return builder.as_markup()


# ── بروکر OneRoyal ──
def broker_home_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🚀 ثبت‌نام در OneRoyal", url=settings.BROKER_REFERRAL_URL)
    builder.button(text="📋 راهنمای ثبت‌نام", callback_data="broker:guide")
    builder.button(text="💳 واریز و برداشت", callback_data="broker:funding")
    builder.button(text="⭐ امکانات و اعتبار", callback_data="broker:why")
    builder.button(text="🌐 سایت فارسی بروکر", url=settings.BROKER_SITE_FA_URL)
    _h = (settings.SUPPORT_HANDLE or "").lstrip("@")
    if _h:
        builder.button(text="🆘 پشتیبانی ما", url=f"https://t.me/{_h}")
    # ردیف‌ها: ثبت‌نام (تمام‌عرض) → دو دکمه → دو دکمه → پشتیبانی
    builder.adjust(1, 2, 2, 1)
    return builder.as_markup()


def broker_section_keyboard() -> InlineKeyboardMarkup:
    """زیرصفحه‌های بروکر: دکمهٔ ثبت‌نام + بازگشت."""
    builder = InlineKeyboardBuilder()
    builder.button(text="🚀 ثبت‌نام در OneRoyal", url=settings.BROKER_REFERRAL_URL)
    builder.button(text="🔙 بازگشت به معرفی بروکر", callback_data="broker:home")
    builder.adjust(1)
    return builder.as_markup()


# ── هوش مصنوعی: کیبورد حینِ گفت‌وگو (فقط دکمهٔ خروج) ──
def ai_chat_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=texts.AI_END_BTN)]],
        resize_keyboard=True,
        input_field_placeholder="سؤال بازارِ مالی‌ات را بنویس…",
    )
