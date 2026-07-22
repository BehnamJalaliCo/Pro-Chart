"""حذفِ ریشه‌ایِ حساب (به‌خواستِ مالک، آیتم ۱۵) — بدونِ حالتِ بازگشت.

`POST /academy/me/delete-permanent` حسابِ کاربرِ جاری را **کاملاً از ریشه** پاک می‌کند:
تمامِ ردیف‌های وابسته در همهٔ جدول‌های دارای `student_id`/`author_id` (به‌جز `articles` که مالِ ادمین است)
+ خودِ ردیفِ `academy_students` + کلیدهای Redisِ کاربر. پس از این، بازیابی ممکن نیست؛ کاربر باید از صفر ثبت‌نام کند.

تفاوت با `POST /academy/me/delete` (که soft است: غیرفعال + مهلتِ ۳۰ روزهٔ بازگشت):
این endpoint فوری و **irreversible** است و به تأییدِ صریحِ متنی نیاز دارد.
"""
from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.academy import current_student
from src.core.database import AcademyStudent
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)
router = APIRouter()

# جدولِ author_id که مالِ کاربر نیست (نویسندهٔ مقاله = ادمین) → هرگز پاک نشود.
_EXCLUDE_TABLES = {"articles"}

# الگوهای کلیدِ Redisِ per-user که با sid پاک می‌شوند.
_REDIS_PATTERNS = [
    "bn:mwatch:{sid}", "bn:mwatch:{sid}:*",
    "bn:copy:{sid}", "bn:copy:{sid}:*",
    "bn:portfolio:{sid}", "bn:portfolio:{sid}:*",
    "bn:watch:{sid}", "bn:sec:{sid}:*",
]


async def _child_tables(db: AsyncSession) -> list[tuple[str, str]]:
    """(table, col) برای همهٔ جدول‌های دارای student_id/author_id (به‌جز مستثناها)."""
    rows = (await db.execute(text(
        "SELECT table_name, column_name FROM information_schema.columns "
        "WHERE column_name IN ('student_id','author_id') AND table_schema='public' "
        "ORDER BY table_name"))).all()
    out = []
    for tbl, col in rows:
        if tbl in _EXCLUDE_TABLES:
            continue
        out.append((tbl, col))
    return out


async def _purge_redis(sid: int) -> int:
    n = 0
    try:
        c = redis_client.client
        for pat in _REDIS_PATTERNS:
            p = pat.format(sid=sid)
            if p.endswith("*"):
                async for k in c.scan_iter(match=p, count=500):
                    try:
                        await c.delete(k)
                        n += 1
                    except Exception:  # noqa: BLE001
                        pass
            else:
                try:
                    if await c.delete(p):
                        n += 1
                except Exception:  # noqa: BLE001
                    pass
    except Exception:  # noqa: BLE001
        pass
    return n


@router.post("/me/delete-permanent")
async def delete_account_permanent(
    confirm: bool = Body(..., embed=True),
    confirm_text: str = Body(..., embed=True),
    reason: Optional[str] = Body(None, embed=True),
    st: AcademyStudent = Depends(current_student),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """حذفِ کاملِ حساب از ریشه. نیازمندِ confirm=true و confirm_text = username یا ایمیلِ کاربر یا کلمهٔ DELETE."""
    if not confirm:
        raise HTTPException(status_code=400, detail="برای حذفِ ریشه‌ای باید confirm=true باشد.")
    valid = {
        (st.username or "").strip().lower(),
        (getattr(st, "email", "") or "").strip().lower(),
        "delete", "حذف",
    }
    if (confirm_text or "").strip().lower() not in valid:
        raise HTTPException(status_code=400,
                            detail="confirm_text باید نامِ‌کاربری/ایمیلِ شما یا کلمهٔ DELETE باشد.")

    sid = int(st.id)
    uname = st.username
    tables = await _child_tables(db)
    purged: dict[str, int] = {}
    for tbl, col in tables:
        try:
            res = await db.execute(text(f"DELETE FROM {tbl} WHERE {col} = :sid"), {"sid": sid})
            if res.rowcount:
                purged[tbl] = int(res.rowcount)
        except Exception as e:  # noqa: BLE001
            # جدولِ گمشده/خطا نباید کلِ حذف را متوقف کند؛ ولی academy_students باید حتماً حذف شود.
            logger.warning("purge_table_failed", table=tbl, error=str(e))
    # درنهایت خودِ ردیفِ کاربر.
    res = await db.execute(text("DELETE FROM academy_students WHERE id = :sid"), {"sid": sid})
    student_deleted = int(res.rowcount or 0)
    await db.commit()

    redis_deleted = await _purge_redis(sid)
    # deny-list دائمی: مانعِ بازساختِ حساب از توکنِ باقی‌مانده در حالتِ standalone/central
    # (بدونِ این، یک JWTِ معتبرِ منقضی‌نشده می‌توانست پوستهٔ خالی بسازد → نقضِ «بدونِ بازگشت»).
    try:
        await redis_client.client.set(f"bn:deleted:{sid}", int(time.time()))
    except Exception:  # noqa: BLE001
        pass
    logger.info("academy_hard_delete", sid=sid, tables=len(purged),
                student_deleted=student_deleted, redis=redis_deleted,
                reason=(reason or "")[:200])
    return {
        "ok": True,
        "permanent": True,
        "recoverable": False,
        "student_deleted": bool(student_deleted),
        "tables_purged": purged,
        "redis_keys_deleted": redis_deleted,
        "message": "حسابِ شما کاملاً حذف شد. برای استفادهٔ دوباره باید از ابتدا ثبت‌نام کنید.",
    }
