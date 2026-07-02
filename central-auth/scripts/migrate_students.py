"""مهاجرتِ academy_students (مبدأ: DB فارکس) → identities مرکزی.

- Idempotent: بر پایهٔ legacy_student_id؛ اجرای دوباره کاربرِ موجود را به‌روزرسانی می‌کند نه تکراری.
- ورودی: فایلِ JSON که با SELECT فقط-خواندنی از مبدأ ساخته شده (هیچ نوشتنی روی مبدأ).
- هشِ رمز عیناً منتقل می‌شود تا لاگینِ کاربران بدونِ ریست کار کند.

اجرا (داخلِ کانتینرِ central-auth):
    docker exec -i central-auth-central-auth-1 python /app/scripts/migrate_students.py < students.json
یا با مسیرِ فایل:
    python migrate_students.py --file students.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime

from sqlalchemy import select

from app.db import async_session
from app.models import Identity


def _parse_dt(v):
    if not v:
        return None
    if isinstance(v, datetime):
        return v
    try:
        return datetime.fromisoformat(v)
    except ValueError:
        return None


async def migrate(rows: list[dict]) -> dict:
    created = updated = skipped = 0
    async with async_session() as s:
        for r in rows:
            legacy_id = r.get("id")
            if legacy_id is None or not r.get("username"):
                skipped += 1
                continue
            res = await s.execute(select(Identity).where(Identity.legacy_student_id == legacy_id))
            idn = res.scalar_one_or_none()
            fields = dict(
                kind="student",
                username=r.get("username"),
                email=r.get("email"),
                phone_number=r.get("phone_number"),
                password_hash=r.get("password_hash"),
                full_name=r.get("full_name"),
                tier=r.get("tier") or "free",
                status=r.get("status") or "active",
                expires_at=_parse_dt(r.get("expires_at")),
                phone_verified=bool(r.get("phone_verified")),
                account_type=r.get("account_type"),
                legacy_student_id=legacy_id,
            )
            if idn:
                for k, v in fields.items():
                    setattr(idn, k, v)
                updated += 1
            else:
                s.add(Identity(**fields))
                created += 1
        await s.commit()
    return {"created": created, "updated": updated, "skipped": skipped, "total": len(rows)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", help="مسیرِ students.json؛ نبودش یعنی از stdin")
    args = ap.parse_args()
    raw = open(args.file, encoding="utf-8").read() if args.file else sys.stdin.read()
    rows = json.loads(raw)
    result = asyncio.run(migrate(rows))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
