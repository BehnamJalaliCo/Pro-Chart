"""تست تولید و اعتبارسنجی کد رفرال."""

from __future__ import annotations

from src.bot.services import referral


def test_generate_default_length_and_charset():
    code = referral.generate()
    assert len(code) == referral.CODE_LENGTH
    assert all(c in referral._ALPHABET for c in code)


def test_generate_custom_length():
    assert len(referral.generate(10)) == 10


def test_generate_unique_enough():
    codes = {referral.generate() for _ in range(200)}
    # احتمال برخورد بسیار کم — انتظار یکتایی کامل
    assert len(codes) == 200


def test_is_valid_accepts_generated():
    assert referral.is_valid(referral.generate()) is True


def test_is_valid_rejects_bad():
    assert referral.is_valid("") is False
    assert referral.is_valid("short") is False
    assert referral.is_valid("toolongcode123") is False
    assert referral.is_valid("ABCDEFG0") is False  # شامل 0 که در الفبا نیست


def test_normalize_uppercases_and_strips():
    assert referral.normalize("  abcdefgh ") == "ABCDEFGH"
