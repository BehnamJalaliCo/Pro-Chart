"""آزمون سطح‌سنجی فارکس — تعریف سوالات، نمره‌دهی و نگاشت به سطح مهارت.

منطق خالص و بدون وابستگی به تلگرام تا به‌راحتی unit-test شود.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Question:
    key: str            # شناسه‌ی سوال، مثل "q1"
    text: str           # متن سوال
    options: dict[str, str]  # {"a": "...", "b": "...", ...}
    correct: str        # کلید گزینه‌ی درست


# ── چهار سوال از آسان به سخت ──
QUESTIONS: tuple[Question, ...] = (
    Question(
        key="q1",
        text="در بازار فارکس، جفت‌ارز EUR/USD به چه معناست؟",
        options={
            "a": "خرید یورو با دلار",
            "b": "خرید دلار با یورو",
            "c": "تبدیل یورو به طلا",
            "d": "نرخ بهره اروپا",
        },
        correct="a",
    ),
    Question(
        key="q2",
        text="اندیکاتور RSI چه زمانی سیگنال اشباع خرید می‌دهد؟",
        options={
            "a": "زیر ۳۰",
            "b": "بالای ۵۰",
            "c": "بالای ۷۰",
            "d": "زیر ۵۰",
        },
        correct="c",
    ),
    Question(
        key="q3",
        text="استراتژی Price Action بر اساس چه اصلی استوار است؟",
        options={
            "a": "استفاده از اندیکاتورهای پیچیده",
            "b": "تحلیل حرکت خالص قیمت بدون اندیکاتور",
            "c": "تحلیل اخبار اقتصادی",
            "d": "محاسبات ریاضی پیشرفته",
        },
        correct="b",
    ),
    Question(
        key="q4",
        text="در استراتژی ICT، مفهوم Order Block به چه ناحیه‌ای اطلاق می‌شود؟",
        options={
            "a": "ناحیه‌ای که بازارسازان سفارش‌های انبوه ثبت کرده‌اند",
            "b": "ناحیه حمایت و مقاومت کلاسیک",
            "c": "محل تقاطع میانگین‌های متحرک",
            "d": "سطح فیبوناچی ۶۱.۸٪",
        },
        correct="a",
    ),
)

TOTAL_QUESTIONS: int = len(QUESTIONS)

# نگاشت سطح مهارت به برچسب فارسی + ایموجی
SKILL_LABELS: dict[str, str] = {
    "beginner": "مبتدی 🌱",
    "intermediate": "متوسط 📈",
    "advanced": "پیشرفته 🎯",
    "expert": "حرفه‌ای 🏆",
}


def get_question(index: int) -> Question:
    """دریافت سوال بر اساس ایندکس (۰ تا TOTAL_QUESTIONS-1)."""
    return QUESTIONS[index]


def score(answers: dict[str, str]) -> int:
    """شمارش پاسخ‌های درست. answers نگاشت {question_key: option_key} است."""
    correct = 0
    for q in QUESTIONS:
        if answers.get(q.key) == q.correct:
            correct += 1
    return correct


def skill_level(quiz_score: int) -> str:
    """نگاشت نمره به سطح: 0-1 مبتدی / 2 متوسط / 3 پیشرفته / 4 حرفه‌ای."""
    if quiz_score <= 1:
        return "beginner"
    if quiz_score == 2:
        return "intermediate"
    if quiz_score == 3:
        return "advanced"
    return "expert"


def skill_score_percent(quiz_score: int) -> int:
    """تبدیل نمره‌ی خام (۰..۴) به امتیاز ۰..۱۰۰ برای ذخیره در User.skill_score."""
    if TOTAL_QUESTIONS == 0:
        return 0
    return round(quiz_score / TOTAL_QUESTIONS * 100)


def skill_label(level: str) -> str:
    """برچسب فارسی + ایموجی برای یک سطح."""
    return SKILL_LABELS.get(level, level)
