"""داده اولیه برای تست"""

import asyncio
import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from src.core.database import async_session_factory, init_db
from src.core.logger import setup_logging, get_logger

logger = get_logger(__name__)


async def seed() -> None:
    """درج داده اولیه"""
    setup_logging()
    await init_db()

    async with async_session_factory() as session:
        # مقاله آموزشی نمونه
        await session.execute(text("""
            INSERT INTO articles (title, slug, content, summary, category, is_published, published_at)
            VALUES
            ('آموزش تحلیل تکنیکال فارکس', 'technical-analysis-guide',
             'تحلیل تکنیکال یکی از مهم‌ترین ابزارهای معامله‌گران فارکس است...',
             'راهنمای جامع تحلیل تکنیکال', 'education', true, NOW()),
            ('مدیریت ریسک در فارکس', 'risk-management',
             'مدیریت ریسک مهم‌ترین بخش ترید موفق است...',
             'آموزش مدیریت ریسک', 'education', true, NOW()),
            ('Smart Money Concepts چیست؟', 'smart-money-concepts',
             'مفاهیم پول هوشمند یکی از پیشرفته‌ترین روش‌های تحلیل بازار است...',
             'آشنایی با SMC', 'education', true, NOW())
            ON CONFLICT DO NOTHING
        """))
        await session.commit()

    logger.info("seed_data_inserted")
    print("داده اولیه درج شد!")


if __name__ == "__main__":
    asyncio.run(seed())
