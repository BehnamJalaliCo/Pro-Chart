"""آموزش مدل‌های ML"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.config import settings
from src.core.database import init_db
from src.core.logger import setup_logging, get_logger
from src.data.feed_manager import feed_manager
from src.ml.trainer import ModelTrainer

logger = get_logger(__name__)


async def train_all() -> None:
    """آموزش تمام مدل‌ها"""
    setup_logging()
    await init_db()
    # حیاتی: بدونِ اتصالِ منابعِ فید، get_training_data به DBِ پراکنده (~۴۰۰ ردیف)
    # fallback می‌کرد و کلِ آموزش (شاملِ LSTM که ≥۵۰۰ لازم دارد) رد می‌شد.
    await feed_manager.connect_sources()

    trainer = ModelTrainer()

    for symbol in settings.SYMBOLS:
        logger.info("training_symbol", symbol=symbol)
        try:
            results = await trainer.train_all(symbol)
            for model_name, metrics in results.items():
                if "error" in metrics:
                    logger.warning("training_failed", symbol=symbol, model=model_name, error=metrics["error"])
                else:
                    acc = metrics.get("accuracy", metrics.get("mape", "N/A"))
                    logger.info("training_complete", symbol=symbol, model=model_name, accuracy=acc)
        except Exception as e:
            logger.error("training_error", symbol=symbol, error=str(e))

    print("آموزش تمام شد!")


if __name__ == "__main__":
    asyncio.run(train_all())
