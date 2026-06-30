"""
سیدِ ۱۲۰ درسِ آکادمی از dictهای موجودِ src/bot/education به جدولِ academy_lessons.

idempotent: بر اساسِ slug upsert می‌کند. هر بار اجرا، محتوای متن را به‌روز می‌کند
(برای ویرایش/اصلاحِ دروس) بدونِ ساختِ ردیفِ تکراری. ویدیو/تیر دست‌نخورده می‌ماند.
"""

from __future__ import annotations

from sqlalchemy import select

from src.bot.education.lessons import LESSONS as _BEGINNER
from src.bot.education.lessons_advanced import LESSONS as _ADVANCED
from src.bot.education.lessons_intermediate import LESSONS as _INTERMEDIATE
from src.core.database import AcademyLesson, async_session_factory
from src.core.logger import get_logger

logger = get_logger(__name__)

# اولین N درسِ مبتدی رایگان (طعمه)؛ بقیه VIP.
_FREE_BEGINNER_COUNT = 5


def _level_of(slug: str) -> str:
    if "beginner" in slug:
        return "beginner"
    if "intermediate" in slug:
        return "intermediate"
    if "advanced" in slug:
        return "advanced"
    return "beginner"


def _order_of(slug: str) -> int:
    try:
        return int(slug.rsplit("-", 1)[1])
    except (ValueError, IndexError):
        return 0


def _tier_of(level: str, order: int) -> str:
    if level == "beginner" and order <= _FREE_BEGINNER_COUNT:
        return "free"
    return "vip"


async def seed_lessons() -> dict:
    """سیدِ همهٔ دروس. خروجی: {inserted, updated, total}."""
    all_lessons = list(_BEGINNER) + list(_INTERMEDIATE) + list(_ADVANCED)
    inserted = updated = 0
    async with async_session_factory() as s:
        for les in all_lessons:
            slug = les["slug"]
            level = _level_of(slug)
            order = _order_of(slug)
            existing = (await s.execute(
                select(AcademyLesson).where(AcademyLesson.slug == slug))).scalar_one_or_none()
            if existing is None:
                s.add(AcademyLesson(
                    slug=slug, level=level, order_in_level=order,
                    title_fa=les.get("title", "")[:255],
                    summary_fa=les.get("summary"),
                    content_fa=les.get("content", ""),
                    diagram_image=f"{slug}.png",
                    min_tier=_tier_of(level, order),
                    is_published=True,
                ))
                inserted += 1
            else:
                # فقط متن را به‌روز کن؛ تیر/ویدیو را دست نزن (ممکن است دستی تنظیم شده باشد)
                existing.title_fa = les.get("title", "")[:255]
                existing.summary_fa = les.get("summary")
                existing.content_fa = les.get("content", "")
                existing.level = level
                existing.order_in_level = order
                updated += 1
        await s.commit()
    result = {"inserted": inserted, "updated": updated, "total": len(all_lessons)}
    logger.info("academy_lessons_seeded", **result)
    return result


if __name__ == "__main__":
    import asyncio
    print(asyncio.run(seed_lessons()))
