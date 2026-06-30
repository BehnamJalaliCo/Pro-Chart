"""تست سرویس کانال — ساخت لینک دعوت و حذف عضو (با Bot ماک‌شده، بدون شبکه)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError

from src.bot.services import channel


def _bad_request(msg: str = "user not found") -> TelegramBadRequest:
    return TelegramBadRequest(method=MagicMock(), message=msg)


def _forbidden(msg: str = "bot is not admin") -> TelegramForbiddenError:
    return TelegramForbiddenError(method=MagicMock(), message=msg)


@pytest.mark.asyncio
async def test_create_invite_uses_single_use_and_expiry():
    bot = AsyncMock()
    link_obj = MagicMock()
    link_obj.invite_link = "https://t.me/+abc123"
    bot.create_chat_invite_link.return_value = link_obj

    result = await channel.create_invite(bot, ttl_hours=24, name="trial:42")

    assert result == "https://t.me/+abc123"
    kwargs = bot.create_chat_invite_link.call_args.kwargs
    assert kwargs["member_limit"] == 1
    assert kwargs["expire_date"] is not None


@pytest.mark.asyncio
async def test_create_invite_returns_none_when_forbidden():
    bot = AsyncMock()
    bot.create_chat_invite_link.side_effect = _forbidden()
    assert await channel.create_invite(bot) is None


@pytest.mark.asyncio
async def test_remove_member_bans_then_unbans():
    bot = AsyncMock()
    ok = await channel.remove_member(bot, 12345)
    assert ok is True
    bot.ban_chat_member.assert_awaited_once()
    bot.unban_chat_member.assert_awaited_once()


@pytest.mark.asyncio
async def test_remove_member_treats_not_member_as_success():
    bot = AsyncMock()
    bot.ban_chat_member.side_effect = _bad_request("user not found")
    assert await channel.remove_member(bot, 999) is True


@pytest.mark.asyncio
async def test_remove_member_fails_when_forbidden():
    bot = AsyncMock()
    bot.ban_chat_member.side_effect = _forbidden()
    assert await channel.remove_member(bot, 999) is False
