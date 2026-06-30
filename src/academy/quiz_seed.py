"""تولیدِ آزمونِ چهارگزینه‌ای برای دروسِ آکادمی با کلودِ داخلِ سرور.

برای هر درسِ منتشرشده که هنوز آزمون ندارد، ۴ سوالِ چهارگزینه‌ای از روی محتوای درس
تولید و در academy_quizzes ذخیره می‌کند. اجرا:
    python -m src.academy.quiz_seed            # همهٔ دروسِ بدونِ آزمون
    python -m src.academy.quiz_seed 20         # فقط ۲۰ درسِ اول
ایدمپوتنت: دروسی که آزمون دارند رد می‌شوند.
"""
from __future__ import annotations

import asyncio
import json
import re
import sys

from sqlalchemy import func, select

from src.core.database import AcademyLesson, AcademyQuiz, async_session_factory
from src.llm.client import llm_client
from src.core.logger import get_logger

logger = get_logger(__name__)

_SYS = (
    "تو یک طراحِ آزمونِ آموزشیِ بازارهای مالی هستی. از روی متنِ درس، سوالِ چهارگزینه‌ایِ "
    "دقیق و آموزنده به فارسی می‌سازی. فقط JSON خروجی بده، بدونِ هیچ متنِ اضافه."
)


def _prompt(title: str, content: str) -> str:
    return (
        f"از روی این درس، دقیقاً ۴ سوالِ چهارگزینه‌ای بساز.\n"
        f"عنوان: {title}\nمتن:\n{content[:2500]}\n\n"
        "خروجی فقط یک آرایهٔ JSON با این ساختار (بدونِ توضیحِ اضافه، بدونِ ```):\n"
        '[{"question":"...","options":["...","...","...","..."],"correct_index":0,"explanation":"چرا این گزینه درست است"}]\n'
        "نکته: گزینه‌ها کوتاه و متمایز؛ correct_index عددِ ۰ تا ۳؛ سوال‌ها از مفاهیمِ کلیدیِ همین درس."
    )


def _parse(raw: str):
    raw = raw.strip()
    if "```" in raw:
        raw = re.sub(r"```(json)?", "", raw).strip()
    start, end = raw.find("["), raw.rfind("]")
    if start == -1 or end == -1:
        return None
    try:
        data = json.loads(raw[start:end + 1])
    except json.JSONDecodeError:
        return None
    out = []
    for q in data:
        opts = q.get("options") or []
        ci = q.get("correct_index")
        if (isinstance(opts, list) and len(opts) == 4 and isinstance(ci, int) and 0 <= ci <= 3
                and q.get("question")):
            out.append({"question": str(q["question"])[:500], "options": [str(o)[:200] for o in opts],
                        "correct_index": ci, "explanation": str(q.get("explanation") or "")[:600]})
    return out or None


async def generate(limit: int | None) -> None:
    done = 0
    async with async_session_factory() as db:
        rows = (await db.execute(select(AcademyLesson).where(AcademyLesson.is_published.is_(True))
                .order_by(AcademyLesson.level, AcademyLesson.order_in_level))).scalars().all()
        for l in rows:
            if limit and done >= limit:
                break
            has = (await db.execute(select(func.count()).select_from(AcademyQuiz)
                   .where(AcademyQuiz.lesson_id == l.id))).scalar() or 0
            if has:
                continue
            if not l.content_fa:
                continue
            raw = await llm_client.complete(_prompt(l.title_fa, l.content_fa), system=_SYS,
                                            system_replace=True, timeout=120)
            qs = _parse(raw or "")
            if not qs:
                print(f"[skip] {l.slug} — no parseable quiz", flush=True)
                continue
            for q in qs:
                db.add(AcademyQuiz(lesson_id=l.id, question_fa=q["question"], options=q["options"],
                                   correct_index=q["correct_index"], explanation_fa=q["explanation"]))
            await db.commit()
            done += 1
            print(f"[{done}] {l.slug} — {len(qs)} questions", flush=True)
    print(f"\nDONE — generated quizzes for {done} lessons.", flush=True)


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else None
    asyncio.new_event_loop().run_until_complete(generate(n))
