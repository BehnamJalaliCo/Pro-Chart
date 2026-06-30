"""تست آزمون سطح‌سنجی — نمره‌دهی و نگاشت سطح."""

from __future__ import annotations

import pytest

from src.bot.services import quiz


def _all_correct() -> dict:
    return {q.key: q.correct for q in quiz.QUESTIONS}


def test_total_questions_is_four():
    assert quiz.TOTAL_QUESTIONS == 4


def test_score_all_correct():
    assert quiz.score(_all_correct()) == 4


def test_score_all_wrong():
    wrong = {}
    for q in quiz.QUESTIONS:
        wrong[q.key] = next(k for k in q.options if k != q.correct)
    assert quiz.score(wrong) == 0


def test_score_partial():
    answers = _all_correct()
    # یک پاسخ را خراب کن
    q0 = quiz.QUESTIONS[0]
    answers[q0.key] = next(k for k in q0.options if k != q0.correct)
    assert quiz.score(answers) == 3


def test_score_missing_answers_counts_zero():
    assert quiz.score({}) == 0


@pytest.mark.parametrize("raw,expected", [
    (0, "beginner"),
    (1, "beginner"),
    (2, "intermediate"),
    (3, "advanced"),
    (4, "expert"),
])
def test_skill_level_boundaries(raw, expected):
    assert quiz.skill_level(raw) == expected


@pytest.mark.parametrize("raw,pct", [(0, 0), (1, 25), (2, 50), (3, 75), (4, 100)])
def test_skill_score_percent(raw, pct):
    assert quiz.skill_score_percent(raw) == pct


def test_skill_label_has_emoji():
    assert "🏆" in quiz.skill_label("expert")
    assert quiz.skill_label("unknown") == "unknown"
