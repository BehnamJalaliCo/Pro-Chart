"""اجرای مایگریشن و ساخت جداول اولیه"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from src.core.config import settings
from src.core.database import engine, init_db
from src.core.logger import setup_logging, get_logger

logger = get_logger(__name__)


async def migrate() -> None:
    """ساخت جداول و hypertable‌ها"""
    setup_logging()

    # ساخت جداول اصلی
    await init_db()
    logger.info("base_tables_created")

    # ساخت جداول TimescaleDB
    async with engine.begin() as conn:
        # جدول کندل‌ها
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS candles (
                symbol VARCHAR(10) NOT NULL,
                timeframe VARCHAR(5) NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL,
                open DECIMAL(20,8),
                high DECIMAL(20,8),
                low DECIMAL(20,8),
                close DECIMAL(20,8),
                volume DECIMAL(20,4),
                source VARCHAR(20),
                PRIMARY KEY (symbol, timeframe, timestamp)
            )
        """))

        # جدول تیک‌ها
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ticks (
                symbol VARCHAR(10) NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL,
                bid DECIMAL(20,8),
                ask DECIMAL(20,8),
                volume DECIMAL(20,4),
                source VARCHAR(20)
            )
        """))

        # تبدیل به hypertable
        try:
            await conn.execute(text("SELECT create_hypertable('candles', 'timestamp', if_not_exists => TRUE)"))
            logger.info("candles_hypertable_created")
        except Exception as e:
            logger.warning("candles_hypertable_exists", error=str(e))

        try:
            await conn.execute(text("SELECT create_hypertable('ticks', 'timestamp', if_not_exists => TRUE)"))
            logger.info("ticks_hypertable_created")
        except Exception as e:
            logger.warning("ticks_hypertable_exists", error=str(e))

        # سیاست نگهداری
        try:
            await conn.execute(text("SELECT add_retention_policy('ticks', INTERVAL '7 days', if_not_exists => TRUE)"))
            await conn.execute(text("SELECT add_retention_policy('candles', INTERVAL '3 months', if_not_exists => TRUE)"))
            logger.info("retention_policies_set")
        except Exception as e:
            logger.warning("retention_policy_error", error=str(e))

        # فشرده‌سازی
        try:
            await conn.execute(text("ALTER TABLE candles SET (timescaledb.compress)"))
            await conn.execute(text("SELECT add_compression_policy('candles', INTERVAL '7 days', if_not_exists => TRUE)"))
            logger.info("compression_policy_set")
        except Exception as e:
            logger.warning("compression_policy_error", error=str(e))

    logger.info("migration_complete")
    print("مایگریشن با موفقیت انجام شد!")


if __name__ == "__main__":
    asyncio.run(migrate())
