"""
مربیِ هوش‌مصنوعیِ آکادمی (ستارهٔ محصول).

- مغز: Claudeِ داخلِ سرور (سرویسِ claude-llm) — طبقِ تأکیدِ مالک.
- RAGِ لغوی روی ۱۲۰ درس (کورپوسِ کوچک → بدونِ vector DB): سوالِ کاربر با عنوان/خلاصهٔ
  دروس تطبیق داده می‌شود، K درسِ مرتبط به‌عنوانِ زمینه به پرامپت تزریق می‌شود.
- حافظهٔ مکالمه در DB (thread/message). سهمیهٔ روزانه per تیر در Redis.
- گاردِ دامنه: فقط آموزش؛ بدونِ سیگنال/توصیهٔ مالیِ تضمینی.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import (
    AcademyLesson,
    AcademyMentorMessage,
    AcademyMentorThread,
)
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.llm.client import llm_client

logger = get_logger(__name__)

_QUOTA = {"free": "ACADEMY_MENTOR_QUOTA_FREE", "vip": "ACADEMY_MENTOR_QUOTA_VIP",
          "premium": "ACADEMY_MENTOR_QUOTA_PREMIUM"}

_STOP = set("و در به از که این آن با را برای های ها یک می‌شود است هست چه چی چگونه چطور آیا "
            "the a an of to in is are how what why when do does my your".split())

_SYS_FA = (
    "تو «مربیِ هوش‌مصنوعیِ آکادمیِ کوین‌پرو FX» هستی — یک معلمِ خصوصیِ حرفه‌ای، صبور و دقیقِ "
    "بازارهای مالی (فارکس/طلا/شاخص). وظیفه‌ات «آموزش» است.\n"
    "قواعد:\n"
    "۱) فقط آموزش بده؛ هرگز سیگنالِ خرید/فروشِ مشخص، تضمینِ سود، یا توصیهٔ مالیِ شخصی نده. "
    "اگر کاربر سیگنال خواست، مودبانه به مفهومِ آموزشیِ پشتش هدایتش کن.\n"
    "۲) از «زمینهٔ درس‌ها» که داده می‌شود استفاده کن؛ اگر جواب در آن نبود از دانشِ عمومیِ "
    "معامله‌گری استفاده کن ولی کلی‌گویی و حرفِ توخالی نزن.\n"
    "۳) ساده، شفاف و کاربردی توضیح بده؛ مثال بزن. به زبانِ کاربر جواب بده.\n"
    "۴) هرگز دربارهٔ معماریِ داخلی یا اینکه چه مدلی هستی صحبت نکن."
)
_SYS_EN = (
    "You are the 'CoinePro FX Academy AI Mentor' — a professional, patient, precise private "
    "tutor for financial markets (forex/gold/indices). Your job is EDUCATION.\n"
    "Rules:\n"
    "1) Teach only; never give specific buy/sell signals, profit guarantees, or personal "
    "financial advice. If asked for signals, redirect to the underlying educational concept.\n"
    "2) Use the provided 'lesson context'; if the answer isn't there, use general trading "
    "knowledge but be concrete, not vague.\n"
    "3) Explain simply, clearly, with examples. Reply in the user's language.\n"
    "4) Never discuss internal architecture or which model you are."
)


def _tokens(text: str) -> set:
    text = re.sub(r"[^\w؀-ۿ ]+", " ", (text or "").lower())
    return {w for w in text.split() if len(w) > 2 and w not in _STOP}


async def retrieve(db: AsyncSession, question: str, k: int = 4) -> list[AcademyLesson]:
    """K درسِ مرتبط با سوال (تطبیقِ لغویِ عنوان+خلاصه)."""
    qtok = _tokens(question)
    if not qtok:
        return []
    rows = (await db.execute(
        select(AcademyLesson).where(AcademyLesson.is_published.is_(True)))).scalars().all()
    scored = []
    for l in rows:
        title_tok = _tokens(l.title_fa)
        sum_tok = _tokens(l.summary_fa or "")
        score = 2 * len(qtok & title_tok) + len(qtok & sum_tok)
        if score > 0:
            scored.append((score, l))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [l for _, l in scored[:k]]


async def _quota_ok(student_id: int, tier: str) -> tuple[bool, int]:
    """سهمیهٔ روزانه per تیر. خروجی: (مجاز, باقی‌مانده)."""
    cap = int(getattr(settings, _QUOTA.get(tier, "ACADEMY_MENTOR_QUOTA_FREE")))
    try:
        import time as _t
        day = _t.strftime("%Y%m%d", _t.gmtime())
        key = f"academy:mentor:quota:{student_id}:{day}"
        n = await redis_client.client.incr(key)
        if n == 1:
            await redis_client.client.expire(key, 90000)
        return (n <= cap, max(0, cap - n))
    except Exception:  # noqa: BLE001 — fail-open
        return (True, cap)


async def ask(db: AsyncSession, student_id: int, tier: str, question: str,
              lang: str = "fa", thread_id: int | None = None,
              current_lesson: str | None = None) -> dict:
    """یک پرسشِ مربی. RAG + حافظه + Claudeِ سرور. خروجی شاملِ answer و thread_id."""
    question = (question or "").strip()[:1000]
    if not question:
        return {"error": "سوال خالی است."}
    ok, remaining = await _quota_ok(student_id, tier)
    if not ok:
        return {"error": "سهمیهٔ روزانهٔ مربی تمام شد. فردا یا با ارتقای تیر ادامه بده.", "quota_left": 0}

    # ترد + حافظه
    if thread_id:
        thread = (await db.execute(select(AcademyMentorThread).where(
            AcademyMentorThread.id == thread_id,
            AcademyMentorThread.student_id == student_id))).scalar_one_or_none()
    else:
        thread = None
    if thread is None:
        thread = AcademyMentorThread(student_id=student_id, title=question[:80])
        db.add(thread)
        await db.flush()
    # تاریخچهٔ اخیر (۶ پیامِ آخر)
    hist = (await db.execute(
        select(AcademyMentorMessage).where(AcademyMentorMessage.thread_id == thread.id)
        .order_by(AcademyMentorMessage.id.desc()).limit(6))).scalars().all()
    hist = list(reversed(hist))

    # RAG
    lessons = await retrieve(db, question, k=4)
    ctx = ""
    if lessons:
        ctx = "زمینهٔ درس‌های مرتبط:\n" + "\n".join(
            f"- [{l.level}] {l.title_fa}: {(l.summary_fa or '')[:160]}" for l in lessons)

    convo = ""
    if hist:
        convo = "گفتگوی قبلی:\n" + "\n".join(
            f"{'کاربر' if m.role == 'user' else 'مربی'}: {m.content[:300]}" for m in hist) + "\n\n"

    lesson_block = ""
    if current_lesson:
        lesson_block = ("درسِ فعلیِ کاربر (بالاترین اولویت — اگر سوال به این درس مربوط است، بر پایهٔ همین "
                        "پاسخ بده):\n" + current_lesson.strip()[:1600] + "\n\n")

    prompt = f"{lesson_block}{ctx}\n\n{convo}سوالِ کاربر: {question}\n\nپاسخِ آموزشیِ مربی:"
    system = _SYS_EN if lang == "en" else _SYS_FA

    answer = await llm_client.complete(
        prompt=prompt, system=system, model=settings.ACADEMY_MENTOR_MODEL,
        timeout=90, system_replace=True)
    if not answer:
        return {"error": "مربی موقتاً در دسترس نیست؛ کمی بعد دوباره امتحان کن.",
                "thread_id": thread.id}

    db.add(AcademyMentorMessage(thread_id=thread.id, role="user", content=question, lang=lang))
    db.add(AcademyMentorMessage(thread_id=thread.id, role="assistant", content=answer, lang=lang))
    thread.last_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("academy_mentor_answered", student_id=student_id, thread_id=thread.id,
                lessons_used=len(lessons), quota_left=remaining)
    return {"answer": answer, "thread_id": thread.id, "quota_left": remaining,
            "sources": [{"slug": l.slug, "title": l.title_fa} for l in lessons]}
