"""ساخت کاربر ادمین اولیه"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from src.core.config import settings
from src.core.database import Admin, async_session_factory, init_db
from src.core.logger import setup_logging, get_logger
from src.core.security import hash_password

logger = get_logger(__name__)


async def create_admin() -> None:
    """ساخت ادمین پیش‌فرض"""
    setup_logging()
    await init_db()

    async with async_session_factory() as session:
        # بررسی وجود ادمین
        result = await session.execute(
            select(Admin).where(Admin.username == settings.ADMIN_USERNAME)
        )
        existing = result.scalar_one_or_none()

        if existing:
            logger.info("admin_already_exists", username=settings.ADMIN_USERNAME)
            return

        admin = Admin(
            username=settings.ADMIN_USERNAME,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            email="admin@coinepro.com",
            role="superadmin",
            is_active=True,
        )
        session.add(admin)
        await session.commit()
        logger.info("admin_created", username=settings.ADMIN_USERNAME)
        print(f"ادمین ساخته شد: {settings.ADMIN_USERNAME}")


if __name__ == "__main__":
    asyncio.run(create_admin())
