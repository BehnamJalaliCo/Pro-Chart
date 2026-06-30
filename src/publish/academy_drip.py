"""انتشارِ خودکارِ روزانهٔ درس‌های آکادمی در یوتیوب — مقدماتی → حرفه‌ای، روزی یک درس.

هر اجرا: درسِ بعدیِ منتشرنشده (به‌ترتیبِ سطح و شماره) را برمی‌دارد، تامبنیلِ رنگیِ سطح +
توضیحاتِ کامل + لینکِ سایت (CTA) می‌سازد، در یوتیوب آپلود می‌کند و در `lesson_publications`
ثبت می‌کند (ضدِ تکرار).
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone

from sqlalchemy import select

from src.core.config import settings
from src.core.database import AcademyLesson, AcademyVideo, LessonPublication, async_session_factory
from src.core.logger import get_logger
from src.publish import youtube

logger = get_logger(__name__)

EDU_DIR = os.environ.get("EDU_ASSETS_DIR", "/app/edu_assets")
# ترتیبِ سطح‌ها: مقدماتی → متوسط → پیشرفته → حرفه‌ای → هوش مصنوعی → پلتفرم‌ها
_LEVEL_RANK = {"beginner": 1, "intermediate": 2, "advanced": 3, "pro": 4, "ai": 5, "mt4": 6, "mt5": 7}
# نامِ فارسیِ هر سطح برای playlist (فولدر)
ACADEMY_NAME = "آکادمی جامع کوین پرو FX فارکس"
# نکته: درس‌های «حرفه‌ای» (edu-pro) در DB با level="ai" ذخیره شده‌اند (برچسبِ حرفه‌ای).
_LEVEL_FA = {
    "beginner": "مقدماتی", "intermediate": "سطح متوسط", "advanced": "پیشرفته",
    "ai": "حرفه‌ای", "pro": "حرفه‌ای", "mt4": "متاتریدر ۴", "mt5": "متاتریدر ۵",
}


def _playlist_title(level: str) -> str:
    """نامِ playlistِ سطح زیرِ نامِ آکادمی (یوتیوب فولدرِ تو-در-تو ندارد → playlist به‌ازای هر سطح)."""
    return f"{ACADEMY_NAME} | {_LEVEL_FA.get(level, 'دوره')}"
_BASE_TAGS = ["فارکس", "آموزش فارکس", "تحلیل تکنیکال", "پرایس اکشن", "ترید", "طلا", "کوین پرو", "forex"]


def _video_path(slug: str) -> str | None:
    p = os.path.join(EDU_DIR, f"{slug}.mp4")
    return p if os.path.exists(p) else None


def _file_from_hls(hls_url: str | None) -> str | None:
    """نامِ واقعیِ فایلِ mp4 را از hls_url آکادمی استخراج می‌کند (همان ویدیویی که VIP نشان می‌دهد)."""
    if not hls_url:
        return None
    name = os.path.basename(hls_url.split("?")[0])
    if not name.lower().endswith(".mp4"):
        return None
    p = os.path.join(EDU_DIR, name)
    return p if os.path.exists(p) else None


async def _video_map(db) -> dict:
    """lesson_id → مسیرِ فایلِ mp4 از رکوردهای ویدیوی آکادمی (status=ready)."""
    rows = (await db.execute(
        select(AcademyVideo.lesson_id, AcademyVideo.hls_url).where(AcademyVideo.status == "ready")
    )).all()
    out: dict[int, str] = {}
    for lid, hls in rows:
        f = _file_from_hls(hls)
        if f and lid not in out:
            out[lid] = f
    return out


def _resolve_video(lesson, vmap: dict) -> str | None:
    """اول فایلِ واقعیِ آکادمی (hls_url)، بعد فالبک به {slug}.mp4."""
    return vmap.get(lesson.id) or _video_path(lesson.slug)


def _thumb_path(lesson: AcademyLesson) -> str | None:
    di = getattr(lesson, "diagram_image", None)
    if di:
        p = os.path.join(EDU_DIR, os.path.basename(di))
        if os.path.exists(p):
            return p
    return None


def _description(lesson: AcademyLesson) -> str:
    academy = settings.ACADEMY_SITE_URL
    main_site = f"https://{settings.WEBSITE_DOMAIN.lower()}"
    parts = [lesson.title_fa.strip()]
    if getattr(lesson, "summary_fa", None):
        parts.append(lesson.summary_fa.strip())
    # متنِ کاملِ درس (HTML پاک‌شده) — تمام توضیحاتِ همان جلسه
    body = re.sub(r"<[^>]+>", " ", getattr(lesson, "content_fa", "") or "")
    body = re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n\n", body)).strip()
    if body:
        parts.append(body[:3000])
    parts.append("🎓 آکادمی جامع کوین پرو FX — آموزش فارکس از مقدماتی تا حرفه‌ای، قدم‌به‌قدم.")
    parts.append("✅ با ورود به سایت از همهٔ امکانات استفاده کن: تمرینِ شبیه‌ساز، آزمونِ هر درس، "
                 "مربیِ هوش مصنوعی، ژورنالِ معاملاتی و دسترسی به همهٔ درس‌ها.")
    parts.append(f"🎓 آکادمی: {academy}\n🌐 سایت اصلی: {main_site}")
    parts.append("#فارکس #آموزش_فارکس #تحلیل_تکنیکال #پرایس_اکشن #طلا #ترید #کوین_پرو")
    return "\n\n".join(parts)[:4900]


def _tags(lesson: AcademyLesson) -> list[str]:
    extra = [w for w in (lesson.title_fa or "").replace("،", " ").split() if len(w) > 2][:6]
    out: list[str] = []
    for t in _BASE_TAGS + extra:
        if t not in out:
            out.append(t)
    return out[:15]


def _enabled_platforms() -> list[str]:
    return ["youtube"] if youtube.enabled() else []


async def _ordered_lessons(db) -> list[AcademyLesson]:
    rows = (await db.execute(select(AcademyLesson).where(AcademyLesson.is_published.is_(True)))).scalars().all()
    return sorted(rows, key=lambda l: (_LEVEL_RANK.get(l.level, 99), l.order_in_level or 0, l.id))


async def _done_platforms(db, lesson_id: int) -> set[str]:
    rows = (await db.execute(
        select(LessonPublication.platform).where(
            LessonPublication.lesson_id == lesson_id, LessonPublication.status == "uploaded")
    )).scalars().all()
    return set(rows)


async def next_target(db, platforms: list[str]):
    """اولین درسِ دارای فایلِ ویدیو که در همهٔ پلتفرم‌های هدف منتشر نشده."""
    vmap = await _video_map(db)
    for lesson in await _ordered_lessons(db):
        if not _resolve_video(lesson, vmap):
            continue
        done = await _done_platforms(db, lesson.id)
        missing = [p for p in platforms if p not in done]
        if missing:
            return lesson, missing
    return None, []


async def _record(db, lesson_id: int, platform: str, res: dict) -> None:
    """ثبت/به‌روزرسانیِ رکوردِ انتشار (upsert روی unique(lesson,platform))."""
    existing = (await db.execute(
        select(LessonPublication).where(
            LessonPublication.lesson_id == lesson_id, LessonPublication.platform == platform)
    )).scalar_one_or_none()
    ok = bool(res.get("ok"))
    now = datetime.now(timezone.utc)
    if existing:
        existing.status = "uploaded" if ok else "failed"
        existing.external_id = res.get("id") or existing.external_id
        existing.url = res.get("url") or existing.url
        existing.error = None if ok else str(res.get("reason") or res.get("detail") or "")[:500]
        if ok:
            existing.published_at = now
    else:
        db.add(LessonPublication(
            lesson_id=lesson_id, platform=platform,
            status="uploaded" if ok else "failed",
            external_id=res.get("id"), url=res.get("url"),
            error=None if ok else str(res.get("reason") or res.get("detail") or "")[:500],
            published_at=now if ok else None,
        ))


async def drip_once() -> dict:
    if not settings.ACADEMY_DRIP_ENABLED:
        return {"ok": False, "reason": "drip_disabled"}
    platforms = _enabled_platforms()
    if not platforms:
        return {"ok": False, "reason": "no_platform_enabled"}
    async with async_session_factory() as db:
        lesson, missing = await next_target(db, platforms)
        if not lesson:
            return {"ok": False, "reason": "no_pending_lesson"}
        vp = _resolve_video(lesson, await _video_map(db))
        desc = _description(lesson)
        tags = _tags(lesson)
        # تامبنیلِ اختصاصیِ همان جلسه (جلسهٔ X + سطح + عنوان + لوگو) — خودکار
        from src.publish.thumbnail import make_thumbnail
        thumb = await make_thumbnail(
            lesson.order_in_level or 1, _LEVEL_FA.get(lesson.level, "دوره"),
            lesson.title_fa, f"/tmp/thumb_{lesson.slug}.jpg", level_key=lesson.level)
        if not thumb:
            thumb = _thumb_path(lesson)  # فالبک به دیاگرامِ درس
        playlist = _playlist_title(lesson.level)
        results: dict[str, dict] = {}
        for pl in missing:  # فقط یوتیوب
            res = await youtube.upload(vp, lesson.title_fa, desc, tags, thumbnail=thumb, playlist_title=playlist)
            results[pl] = res
            await _record(db, lesson.id, pl, res)
        await db.commit()
    logger.info("academy_drip_done", lesson=lesson.slug, results={k: v.get("ok") for k, v in results.items()})
    return {"ok": True, "lesson": lesson.slug, "level": lesson.level, "results": results}


async def status_summary() -> dict:
    """خلاصهٔ وضعیتِ انتشار برای هر پلتفرم (برای پایش)."""
    async with async_session_factory() as db:
        lessons = await _ordered_lessons(db)
        total = len(lessons)
        vmap = await _video_map(db)
        out = {"total_lessons_with_video": sum(1 for ls in lessons if _resolve_video(ls, vmap)), "platforms": {}}
        rows = (await db.execute(
            select(LessonPublication).where(
                LessonPublication.platform == "youtube", LessonPublication.status == "uploaded"))).scalars().all()
        out["platforms"]["youtube"] = {"enabled": youtube.enabled(), "uploaded": len(rows)}
        out["total_lessons"] = total
    return out
