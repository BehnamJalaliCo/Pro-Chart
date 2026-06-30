"""هندلر دستیارِ هوش مصنوعیِ بازارِ مالی — چتِ زندهٔ کاربر با مدلِ کم‌مصرف (Haiku).

محدودیت‌ها:
    - فقط پرسش‌های بازارِ مالی (با system prompt محکم).
    - سهمیهٔ روزانه به‌ازای هر کاربر (Redis) برای کنترلِ مصرفِ توکن.
    - سقفِ طولِ ورودی.
    - پاسخ به‌صورتِ plain-text ارسال می‌شود (پایداری در برابرِ خطای parse).
"""

from __future__ import annotations

import os
from contextlib import suppress
from datetime import datetime, timezone

from aiogram import F, Router
from aiogram.filters import StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.types import FSInputFile, Message

from src.bot import keyboards as kb
from src.bot import texts
from src.bot.services.access import get_active_subscription
from src.bot.services.market_data import build_market_snapshot, needs_market_data
from src.bot.states import AIChatStates
from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.llm.client import llm_client

logger = get_logger("bot.handlers.ai")

ai_router = Router(name="ai")

_ASSET_DIR = os.getenv("EDU_ASSET_DIR", "/app/edu_assets")


def _photo(name: str) -> FSInputFile | None:
    path = os.path.join(_ASSET_DIR, f"{name}.png")
    return FSInputFile(path) if os.path.exists(path) else None


def _quota_key(uid: int) -> str:
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"ai:quota:{uid}:{day}"


async def _quota_used(uid: int) -> int:
    try:
        val = await redis_client.client.get(_quota_key(uid))
        return int(val) if val else 0
    except Exception:  # noqa: BLE001 — fail-open (سهمیه مانعِ سرویس نشود)
        return 0


async def _quota_incr(uid: int) -> int:
    """افزایشِ شمارنده پس از پاسخِ موفق؛ انقضای ۲۴ ساعته در اولین افزایش."""
    try:
        key = _quota_key(uid)
        n = await redis_client.client.incr(key)
        if n == 1:
            await redis_client.client.expire(key, 86400)
        return int(n)
    except Exception:  # noqa: BLE001
        return 0


async def _user_quota(uid: int) -> tuple[int, bool]:
    """سهمیهٔ روزانه و وضعیتِ VIP کاربر را برمی‌گرداند.

    VIP = اشتراکِ فعالِ پولی (هر پلنی جز trial). در صورتِ هر خطا، عادی فرض می‌شود.
    """
    try:
        sub = await get_active_subscription(uid)
        is_vip = sub is not None and sub.plan != "trial"
    except Exception:  # noqa: BLE001 — fail-soft به سهمیهٔ عادی
        is_vip = False
    quota = settings.AI_CHAT_DAILY_QUOTA_VIP if is_vip else settings.AI_CHAT_DAILY_QUOTA
    return quota, is_vip


# ── ورود به حالتِ گفت‌وگو ──
@ai_router.message(F.text == texts.BTN_AI)
async def ai_enter(message: Message, state: FSMContext) -> None:
    if not (settings.AI_CHAT_ENABLED and settings.LLM_ENABLED):
        await message.answer(texts.AI_OFF)
        return
    await state.set_state(AIChatStates.chatting)
    photo = _photo("ai-intro")
    if photo is not None:
        with suppress(Exception):
            await message.answer_photo(photo)
    await message.answer(texts.AI_INTRO, reply_markup=kb.ai_chat_keyboard())


# ── پیام‌های داخلِ حالتِ گفت‌وگو ──
@ai_router.message(StateFilter(AIChatStates.chatting), F.text)
async def ai_chat(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()

    # خروج: دکمهٔ پایان یا هر دکمهٔ منوی اصلی
    if text == texts.AI_END_BTN or text in texts.MENU_BUTTONS:
        await state.clear()
        await message.answer(texts.AI_ENDED, reply_markup=kb.main_menu_keyboard())
        return

    if not text:
        await message.answer(texts.AI_EMPTY)
        return
    if len(text) > settings.AI_CHAT_MAX_INPUT_CHARS:
        await message.answer(texts.AI_TOO_LONG)
        return

    uid = message.from_user.id
    quota, is_vip = await _user_quota(uid)
    if await _quota_used(uid) >= quota:
        await message.answer(texts.ai_quota_exceeded(quota, is_vip))
        return

    with suppress(Exception):
        await message.bot.send_chat_action(message.chat.id, "typing")
    thinking = await message.answer(texts.AI_THINKING)

    # تزریقِ snapshot زندهٔ بازار فقط وقتی پرسش به آن نیاز دارد (کنترلِ مصرفِ توکن)
    snapshot = None
    if needs_market_data(text):
        snapshot = await build_market_snapshot()

    answer = await llm_client.complete(
        texts.ai_build_prompt(text, snapshot),
        system=texts.AI_SYSTEM_PROMPT,
        system_replace=True,  # هویتِ Claude Code کامل با نقشِ بازارِ مالی جایگزین شود
        model=settings.AI_CHAT_MODEL,
        timeout=settings.AI_CHAT_TIMEOUT_SECONDS,
    )

    with suppress(Exception):
        await thinking.delete()

    if not answer:
        await message.answer(texts.AI_ERROR)
        return

    used = await _quota_incr(uid)
    footer = f"\n\n———\n{texts.ai_quota_left(used, quota)}"
    # plain-text تا تگ/مارک‌دانِ احتمالیِ پاسخ، خطای parse ایجاد نکند
    await message.answer(
        answer + footer, parse_mode=None, reply_markup=kb.ai_chat_keyboard()
    )
    logger.info("ai_answer_sent", uid=uid, used=used, qlen=len(text))
