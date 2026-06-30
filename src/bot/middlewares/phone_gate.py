"""گیتِ شماره — تا کاربر شماره ندهد، اجازهٔ استفاده از ربات را ندارد.

روی message و callback_query (inner middleware) سوار می‌شود تا به FSMِ کاربر دسترسی
داشته باشد. منطق:
  • ادمین‌ها و کاربرانِ دارای شماره → آزاد (کشِ Redis برای جلوگیری از کوئریِ هر پیام).
  • کاربری که در حالِ onboarding است (waiting_name/phone/quiz) → دست‌نخورده.
  • کاربرِ بدونِ شماره و خارج از onboarding → فقط /start، ارسالِ مخاطب، شمارهٔ متنیِ معتبر،
    و کال‌بک‌های ob:/quiz: مجازند؛ بقیه مسدود و به مرحلهٔ شماره هدایت می‌شوند.

علتِ وجود: ۸۱۳ کاربر بدونِ شماره onboarding را نیمه‌کاره رها کرده بودند.
"""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject
from sqlalchemy import select

from src.bot import keyboards as kb
from src.bot import texts
from src.bot.states import OnboardingStates
from src.core.config import settings
from src.core.database import User, async_session_factory
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger("bot.middleware.phone_gate")

_ALLOW_CB = ("ob:", "quiz:")
_ONBOARDING_STATES = {
    OnboardingStates.waiting_name.state,
    OnboardingStates.waiting_phone.state,
    OnboardingStates.quiz.state,
}


async def _has_phone(uid: int) -> bool:
    """آیا کاربر شماره دارد؟ با کشِ Redis (۷ روز) برای کم‌کردنِ فشارِ DB."""
    try:
        if await redis_client.client.get(f"bot:phone_ok:{uid}"):
            return True
    except Exception:  # noqa: BLE001
        pass
    async with async_session_factory() as s:
        ph = (await s.execute(
            select(User.phone_number).where(User.telegram_id == uid)
        )).scalar_one_or_none()
    ok = bool(ph and str(ph).strip())
    if ok:
        try:
            await redis_client.client.set(f"bot:phone_ok:{uid}", "1", ex=7 * 24 * 3600)
        except Exception:  # noqa: BLE001
            pass
    return ok


class PhoneGateMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user = getattr(event, "from_user", None)
        uid = user.id if user else None
        if uid is None or uid in set(settings.admin_ids):
            return await handler(event, data)

        # در حالِ onboarding؟ دست نزن.
        state = data.get("state")
        cur = None
        if state is not None:
            try:
                cur = await state.get_state()
            except Exception:  # noqa: BLE001
                cur = None
        if cur in _ONBOARDING_STATES:
            return await handler(event, data)

        # شماره دارد؟ آزاد.
        try:
            if await _has_phone(uid):
                return await handler(event, data)
        except Exception:  # noqa: BLE001 — fail-open تا ربات قفل نشود
            return await handler(event, data)

        # بدونِ شماره و خارج از onboarding → فقط مسیرِ ثبتِ شماره مجاز است.
        if isinstance(event, Message):
            txt = event.text or ""
            if event.contact or txt.startswith("/start"):
                if event.contact and state is not None:
                    try:
                        await state.set_state(OnboardingStates.waiting_phone)
                    except Exception:  # noqa: BLE001
                        pass
                return await handler(event, data)
            from src.bot.services import phone as phone_svc
            if phone_svc.normalize_iran(txt):
                if state is not None:
                    try:
                        await state.set_state(OnboardingStates.waiting_phone)
                    except Exception:  # noqa: BLE001
                        pass
                return await handler(event, data)
            if state is not None:
                try:
                    await state.set_state(OnboardingStates.waiting_phone)
                except Exception:  # noqa: BLE001
                    pass
            try:
                await event.answer(texts.PHONE_REQUIRED_GATE, reply_markup=kb.share_contact_keyboard())
            except Exception:  # noqa: BLE001
                pass
            return None

        if isinstance(event, CallbackQuery):
            if event.data and event.data.startswith(_ALLOW_CB):
                return await handler(event, data)
            try:
                await event.answer("ابتدا شمارهٔ موبایلت را ثبت کن.", show_alert=True)
                if event.message:
                    await event.message.answer(
                        texts.PHONE_REQUIRED_GATE, reply_markup=kb.share_contact_keyboard()
                    )
            except Exception:  # noqa: BLE001
                pass
            return None

        return await handler(event, data)
