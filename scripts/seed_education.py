"""Seeder آکادمی فارکس — رندر دیاگرام هر جلسه + upsert رکورد Article.

اجرا داخل bot-worker (دسترسی به DB و سرویس chart-renderer):
    docker compose exec bot-worker-1 python -m scripts.seed_education
    # فقط یک مرحله:
    docker compose exec bot-worker-1 python -m scripts.seed_education intermediate

Idempotent: بر اساس slug به‌روزرسانی می‌کند (دوبار اجرا ⇽ بدون رکورد تکراری).
دیاگرام‌ها در /app/edu_assets ذخیره می‌شوند (volume مشترک با host).
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from src.bot.education import diagrams
from src.bot.education import lessons as beginner_mod
from src.bot.education import lessons_advanced as advanced_mod
from src.bot.education import lessons_intermediate as intermediate_mod
from src.core.database import Article, async_session_factory
from src.core.logger import get_logger, setup_logging

logger = get_logger("scripts.seed_education")

# مبنای زمانی ثابت تا ترتیب published_at با ترتیب جلسات هم‌راستا بماند
_BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)

# مراحلِ موجود: نام → (category, lessons)
STAGES = {
    "beginner": (beginner_mod.CATEGORY, beginner_mod.LESSONS),
    "intermediate": (intermediate_mod.CATEGORY, intermediate_mod.LESSONS),
    "advanced": (advanced_mod.CATEGORY, advanced_mod.LESSONS),
}


async def seed_stage(session, category: str, lessons: list, base: datetime) -> int:
    ok = 0
    for idx, lesson in enumerate(lessons):
        slug = lesson["slug"]
        # ۱) رندر دیاگرام → فایل (spec قالب‌محور)
        cover = await diagrams.render_spec(lesson["diagram"], slug)
        if cover is None:
            logger.error("seed_diagram_failed", slug=slug)

        # ۲) upsert رکورد Article
        existing = (
            await session.execute(select(Article).where(Article.slug == slug))
        ).scalar_one_or_none()

        published_at = base + timedelta(minutes=idx)
        if existing is None:
            session.add(
                Article(
                    title=lesson["title"],
                    slug=slug,
                    summary=lesson["summary"],
                    content=lesson["content"],
                    category=category,
                    cover_image=cover or "",
                    is_published=True,
                    published_at=published_at,
                    view_count=0,
                )
            )
        else:
            existing.title = lesson["title"]
            existing.summary = lesson["summary"]
            existing.content = lesson["content"]
            existing.category = category
            if cover:
                existing.cover_image = cover
            existing.is_published = True
            existing.published_at = published_at
        ok += 1
        logger.info("seed_lesson_ok", slug=slug, cover=bool(cover))
    return ok


async def seed(stage: str | None = None) -> None:
    # هر مرحله یک پنجرهٔ زمانیِ جدا تا ترتیبِ slug درون مرحله حفظ شود
    offsets = {"beginner": 0, "intermediate": 1000, "advanced": 2000}
    targets = [stage] if stage else list(STAGES.keys())
    total = 0
    async with async_session_factory() as session:
        for name in targets:
            category, lessons = STAGES[name]
            base = _BASE + timedelta(minutes=offsets.get(name, 0))
            n = await seed_stage(session, category, lessons, base)
            total += n
            logger.info("seed_stage_done", stage=name, ok=n)
            print(f"seeded {n} {name} lessons")
        await session.commit()
    logger.info("seed_done", total=total)
    print(f"seeded {total} lessons total")


async def main() -> None:
    setup_logging()
    stage = sys.argv[1] if len(sys.argv) > 1 else None
    if stage and stage not in STAGES:
        print(f"unknown stage '{stage}'. options: {', '.join(STAGES)}")
        return
    await seed(stage)


if __name__ == "__main__":
    asyncio.run(main())
