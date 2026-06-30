"""Seedِ اولین کاربرِ پنلِ اینستاگرام (ادمین = بهنام جلالی) و تخصیصِ اکانتِ coineprofx به او.

اجرا: docker compose exec celery-worker python -m scripts.seed_ig_admin
idempotent است — چندبار اجرا مشکلی ندارد.
"""
from __future__ import annotations

import asyncio
import os

from sqlalchemy import select

from src.core.database import IGUser, IgAccount, async_session_factory
from src.core.security import hash_password

USERNAME = os.environ.get("IG_SEED_USERNAME", "BehnamJalali")
PASSWORD = os.environ.get("IG_SEED_PASSWORD", "Behnam1367@#")
IG_USERNAME = os.environ.get("IG_SEED_ACCOUNT", "coineprofx")


async def main() -> None:
    async with async_session_factory() as db:
        u = (await db.execute(select(IGUser).where(IGUser.username == USERNAME))).scalar_one_or_none()
        if not u:
            u = IGUser(username=USERNAME, password_hash=hash_password(PASSWORD),
                       display_name="بهنام جلالی", is_admin_seed=True, max_accounts=3)
            db.add(u)
            await db.flush()
            print(f"created ig_user {USERNAME} id={u.id}")
        else:
            u.password_hash = hash_password(PASSWORD)   # هم‌گام‌سازیِ رمز
            u.is_admin_seed = True
            print(f"ig_user exists id={u.id} (password synced)")

        acc = (await db.execute(select(IgAccount).where(IgAccount.username == IG_USERNAME))).scalar_one_or_none()
        if not acc:
            acc = IgAccount(username=IG_USERNAME, owner_id=u.id, status="offline")
            db.add(acc)
            print(f"created ig_account {IG_USERNAME} -> owner {u.id}")
        else:
            acc.owner_id = u.id
            print(f"assigned ig_account {IG_USERNAME} (id={acc.id}) -> owner {u.id}")

        await db.commit()
        print("SEED_DONE")


if __name__ == "__main__":
    asyncio.run(main())
