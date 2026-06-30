"""وضعیت‌های FSM ربات — onboarding و پرداخت."""

from __future__ import annotations

from aiogram.fsm.state import State, StatesGroup


class OnboardingStates(StatesGroup):
    """مراحل ثبت‌نام کاربر جدید."""
    waiting_name = State()
    waiting_phone = State()
    quiz = State()          # داده‌ی FSM: index سوال جاری + پاسخ‌ها


class PaymentStates(StatesGroup):
    """مراحل ثبت پرداخت اشتراک."""
    waiting_tx_hash = State()  # داده‌ی FSM: plan + network انتخاب‌شده


class AIChatStates(StatesGroup):
    """گفت‌وگوی زندهٔ کاربر با دستیارِ هوش مصنوعیِ بازارِ مالی."""
    chatting = State()
