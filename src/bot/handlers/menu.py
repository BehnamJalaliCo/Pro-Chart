"""هندلر منوی اصلی — سیگنال‌ها، وضعیت بازار، آموزش، و تأیید عضویت کانال."""

from __future__ import annotations

import html
import os
from datetime import datetime, timezone

from aiogram import Bot, F, Router
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, ChatMemberUpdated, FSInputFile, Message
from sqlalchemy import select

from src.bot import keyboards as kb
from src.bot import texts
from src.bot.services import subscription as sub_svc, users
from src.bot.services.access import get_active_subscription
from src.core.config import settings
from src.core.database import Article, ChannelMember, async_session_factory
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger("bot.handlers.menu")

menu_router = Router(name="menu")

_CATEGORY_LABELS = {"beginner": "مقدماتی", "intermediate": "متوسط", "advanced": "پیشرفته"}


@menu_router.message(Command("menu"))
async def cmd_menu(message: Message, state: FSMContext) -> None:
    await state.clear()
    user = await users.get_user(message.from_user.id)
    if user is None or user.registration_date is None:
        await message.answer(texts.NEED_ONBOARDING)
        return
    await message.answer("منوی اصلی 👇", reply_markup=kb.main_menu_keyboard())


# ── 📊 سیگنال‌های من ──
@menu_router.message(F.text == texts.BTN_SIGNALS)
async def my_signals(message: Message, state: FSMContext) -> None:
    await state.clear()
    user = await users.get_user(message.from_user.id)
    if user is None or user.registration_date is None:
        await message.answer(texts.NEED_ONBOARDING)
        return

    sub = await get_active_subscription(user.telegram_id)
    if sub is None:
        await message.answer(
            "دسترسی فعالی ندارید. برای دریافت سیگنال‌های VIP اشتراک تهیه کنید 👇",
            reply_markup=kb.buy_subscription_keyboard(),
        )
        return

    # لینک کانال از رکورد عضویت
    async with async_session_factory() as s:
        cm = (
            await s.execute(
                select(ChannelMember)
                .where(
                    ChannelMember.telegram_id == user.telegram_id,
                    ChannelMember.is_active.is_(True),
                )
                .order_by(ChannelMember.id.desc())
            )
        ).scalars().first()

    remaining = sub.expires_at - datetime.now(timezone.utc)
    hours = int(remaining.total_seconds() // 3600)
    link_line = f"\n🔗 لینک کانال:\n{cm.invite_link}" if (cm and cm.invite_link) else ""
    kind = "دوره‌ی آزمایشی" if sub.plan == "trial" else f"اشتراک {sub_svc.plan_label(sub.plan)}"
    await message.answer(
        "📊 <b>سیگنال‌های من</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"وضعیت: <b>{kind}</b> فعال ✅\n"
        f"⏳ زمان باقی‌مانده: حدود {hours} ساعت\n"
        f"{link_line}\n\n"
        "سیگنال‌های لحظه‌ای در کانال VIP منتشر می‌شوند."
    )


# ── 🔁 کپی‌ترید (پنل کاربری) ──
@menu_router.message(F.text == texts.BTN_COPY)
async def copy_trade(message: Message, state: FSMContext) -> None:
    await state.clear()
    from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
    user = await users.get_user(message.from_user.id)
    if user is None or user.registration_date is None:
        await message.answer(texts.NEED_ONBOARDING)
        return
    sub = await get_active_subscription(user.telegram_id)
    if sub is None:
        await message.answer(
            "🔁 <b>کپی‌ترید ویژهٔ اعضای VIP است</b>\n\n"
            "با کپی‌ترید، معاملاتِ سیستم به‌صورتِ خودکار و زنده روی حسابِ متاتریدرِ شما اجرا می‌شود.\n"
            "برای استفاده، ابتدا اشتراک VIP تهیه کنید 👇",
            reply_markup=kb.buy_subscription_keyboard(),
        )
        return
    kbd = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🚀 بازکردنِ پنلِ کاربری", web_app=WebAppInfo(url=settings.USER_PANEL_URL))
    ]])
    await message.answer(
        "🔁 <b>کپی‌ترید — پنلِ کاربری</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "پنل مثلِ یک اپلیکیشن داخلِ تلگرام باز می‌شود. در آنجا می‌توانید:\n"
        "• حساب متاتریدرِ خود را وصل کنید\n"
        "• کپی‌ترید را روشن/خاموش و ریسک را تنظیم کنید\n"
        "• معاملاتِ زنده و وضعیتِ حساب را ببینید\n\n"
        "🔒 ورود امن با همین حساب تلگرام انجام می‌شود؛ نیازی به رمز نیست.\n"
        "روی دکمهٔ زیر بزنید 👇",
        reply_markup=kbd,
    )


# ── 📈 وضعیت بازار ──
@menu_router.message(F.text == texts.BTN_MARKET)
async def market_status(message: Message, state: FSMContext) -> None:
    await state.clear()
    try:
        prices = await redis_client.get_all_prices()
    except Exception:  # noqa: BLE001
        prices = {}

    majors = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "US30"]
    names = settings.symbol_names_fa
    lines = []
    for sym in majors:
        data = prices.get(sym)
        if not data:
            continue
        raw_px = (
            data.get("last") or data.get("bid") or data.get("ask")
            or data.get("price") or data.get("close")
        )
        if raw_px is None:
            continue
        try:
            px = f"{float(raw_px):.2f}"  # دقیقاً دو رقم اعشار
        except (TypeError, ValueError):
            px = str(raw_px)
        label = names.get(sym, sym)
        lines.append(f"• {label} (<code>{sym}</code>): <b>{px}</b>")

    if not lines:
        body = "در حال حاضر داده‌ی قیمت لحظه‌ای در دسترس نیست. کمی بعد دوباره تلاش کنید."
    else:
        body = "\n".join(lines)

    await message.answer(
        "📈 <b>وضعیت بازار</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"{body}"
    )


# ── 🎓 آموزش فارکس ──
@menu_router.message(F.text == texts.BTN_EDU)
async def education_menu(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer(texts.EDU_INTRO, reply_markup=kb.education_categories_keyboard())


@menu_router.callback_query(F.data == "edu:home")
async def education_home(callback: CallbackQuery) -> None:
    await callback.message.answer(
        texts.EDU_INTRO, reply_markup=kb.education_categories_keyboard()
    )
    await callback.answer()


@menu_router.callback_query(F.data.startswith("edu:cat:"))
async def education_category(callback: CallbackQuery) -> None:
    cat = callback.data.split(":")[-1]
    async with async_session_factory() as s:
        rows = (
            await s.execute(
                select(Article.title, Article.slug)
                .where(Article.category == cat, Article.is_published.is_(True))
                .order_by(Article.slug.asc())
                .limit(60)
            )
        ).all()

    label = _CATEGORY_LABELS.get(cat, cat)
    if not rows:
        await callback.message.answer(f"🎓 <b>{label}</b>\n\n{texts.EDU_EMPTY}")
    else:
        lessons = [(title or "بدون عنوان", slug) for title, slug in rows]
        await callback.message.answer(
            f"🎓 <b>مرحلهٔ {label}</b> — {len(lessons)} جلسه\n"
            "یک جلسه را انتخاب کنید 👇",
            reply_markup=kb.education_lessons_keyboard(lessons),
        )
    await callback.answer()


@menu_router.callback_query(F.data.startswith("edu:lesson:"))
async def education_lesson(callback: CallbackQuery) -> None:
    slug = callback.data.split(":", 2)[-1]
    async with async_session_factory() as s:
        art = (
            await s.execute(select(Article).where(Article.slug == slug))
        ).scalar_one_or_none()
        if art is None:
            await callback.answer("جلسه یافت نشد.", show_alert=True)
            return
        cat = art.category
        slugs = [
            r[0]
            for r in (
                await s.execute(
                    select(Article.slug)
                    .where(Article.category == cat, Article.is_published.is_(True))
                    .order_by(Article.slug.asc())
                )
            ).all()
        ]
        title = art.title or ""
        summary = art.summary or ""
        content = art.content or summary or title
        cover = art.cover_image or ""
        try:
            art.view_count = (art.view_count or 0) + 1
            await s.commit()
        except Exception:  # noqa: BLE001
            await s.rollback()

    i = slugs.index(slug) if slug in slugs else -1
    prev_slug = slugs[i - 1] if i > 0 else None
    next_slug = slugs[i + 1] if (0 <= i < len(slugs) - 1) else None
    nav = kb.education_lesson_nav_keyboard(cat, prev_slug, next_slug)

    # عکس دیاگرام (اگر موجود) جدا، سپس متن کامل با دکمه‌های ناوبری
    if cover and os.path.exists(cover):
        try:
            await callback.message.answer_photo(
                FSInputFile(cover),
                caption=f"🎓 <b>{html.escape(title)}</b>\n{html.escape(summary)}",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("edu_photo_failed", slug=slug, error=str(exc))

    await callback.message.answer(content, reply_markup=nav)
    await callback.answer()


# ── تأیید عضویت کانال (chat_member update) ──
def _is_vip_chat(event: ChatMemberUpdated) -> bool:
    """آیا این آپدیت مربوط به کانال VIP پیکربندی‌شده است؟"""
    cid = settings.TELEGRAM_CHANNEL_ID
    if str(event.chat.id) == str(cid):
        return True
    if event.chat.username and f"@{event.chat.username}" == cid:
        return True
    return False


@menu_router.chat_member()
async def on_chat_member(event: ChatMemberUpdated) -> None:
    if not _is_vip_chat(event):
        return
    new_status = event.new_chat_member.status if event.new_chat_member else None
    tid = event.new_chat_member.user.id if (event.new_chat_member and event.new_chat_member.user) else None
    if tid is None:
        return

    async with async_session_factory() as s:
        cm = (
            await s.execute(
                select(ChannelMember)
                .where(ChannelMember.telegram_id == tid, ChannelMember.is_active.is_(True))
                .order_by(ChannelMember.id.desc())
            )
        ).scalars().first()
        if cm is None:
            return
        if new_status in ("member", "administrator", "creator", "restricted"):
            cm.status = "active"
            cm.joined_at = datetime.now(timezone.utc)
            await s.commit()
            logger.info("channel_member_joined", telegram_id=tid)
        elif new_status in ("left", "kicked"):
            cm.status = "removed"
            cm.is_active = False
            cm.removed_at = datetime.now(timezone.utc)
            await s.commit()


# ── fallback: هر متن دیگری که با دکمه‌ای تطابق نداشت — فقط وقتی در هیچ state نیستیم ──
@menu_router.message(StateFilter(None), F.text & ~F.text.startswith("/"))
async def fallback(message: Message, state: FSMContext) -> None:
    user = await users.get_user(message.from_user.id)
    if user is None or user.registration_date is None:
        await message.answer(texts.NEED_ONBOARDING)
        return
    await message.answer("از منوی زیر انتخاب کنید 👇", reply_markup=kb.main_menu_keyboard())
