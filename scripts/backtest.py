"""بک‌تست سیستم سیگنال‌دهی"""

import asyncio
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd

from src.core.config import settings
from src.core.database import async_session_factory, init_db
from src.core.logger import setup_logging, get_logger
from src.analysis.technical import TechnicalAnalyzer
from src.analysis.candlestick_patterns import CandlestickAnalyzer
from src.analysis.smart_money import SmartMoneyAnalyzer
from src.analysis.support_resistance import SupportResistanceAnalyzer
from src.data.candle_builder import CandleBuilder

logger = get_logger(__name__)


class Backtester:
    """بک‌تست سیستم سیگنال‌دهی"""

    def __init__(self) -> None:
        self.tech = TechnicalAnalyzer()
        self.candle = CandlestickAnalyzer()
        self.smc = SmartMoneyAnalyzer()
        self.sr = SupportResistanceAnalyzer()
        self.results: list[dict] = []

    async def run(self, symbol: str, timeframe: str = "H1", lookback: int = 1000) -> dict:
        """اجرای بک‌تست"""
        logger.info("backtest_start", symbol=symbol, timeframe=timeframe)

        async with async_session_factory() as session:
            df = await CandleBuilder.get_candles(session, symbol, timeframe, count=lookback)

        if df is None or len(df) < 200:
            logger.error("insufficient_data", symbol=symbol)
            return {"error": "داده کافی نیست"}

        wins = 0
        losses = 0
        total_pips = 0.0

        # شبیه‌سازی
        for i in range(200, len(df) - 10):
            window = df.iloc[:i].copy()
            future = df.iloc[i:i + 10]

            # تحلیل
            tech_result = self.tech.analyze(window)
            score = tech_result.get("technical_score", 50)

            if score < 70:
                continue

            # ورود
            entry = float(window["close"].iloc[-1])
            direction = "long" if score > 60 else "short"

            # بررسی نتیجه در ۱۰ کندل آینده
            atr = float((window["high"] - window["low"]).tail(14).mean())
            sl_dist = atr * 2
            tp_dist = atr * 3

            if direction == "long":
                sl = entry - sl_dist
                tp = entry + tp_dist
                max_price = float(future["high"].max())
                min_price = float(future["low"].min())

                if min_price <= sl:
                    losses += 1
                    total_pips -= sl_dist
                elif max_price >= tp:
                    wins += 1
                    total_pips += tp_dist
            else:
                sl = entry + sl_dist
                tp = entry - tp_dist
                max_price = float(future["high"].max())
                min_price = float(future["low"].min())

                if max_price >= sl:
                    losses += 1
                    total_pips -= sl_dist
                elif min_price <= tp:
                    wins += 1
                    total_pips += tp_dist

        total = wins + losses
        win_rate = wins / total * 100 if total > 0 else 0

        result = {
            "symbol": symbol,
            "timeframe": timeframe,
            "total_signals": total,
            "wins": wins,
            "losses": losses,
            "win_rate": round(win_rate, 2),
            "total_pips": round(total_pips, 2),
            "avg_pips": round(total_pips / total, 2) if total > 0 else 0,
        }

        logger.info("backtest_complete", **result)
        return result


async def main() -> None:
    setup_logging()
    await init_db()

    bt = Backtester()
    all_results = []

    for symbol in settings.SYMBOLS[:5]:  # اول ۵ نماد
        result = await bt.run(symbol)
        all_results.append(result)
        print(f"{symbol}: Win Rate={result.get('win_rate', 0)}% | Pips={result.get('total_pips', 0)}")

    print("\n--- خلاصه بک‌تست ---")
    for r in all_results:
        print(f"  {r.get('symbol', '?')}: {r.get('win_rate', 0)}% win rate, {r.get('total_signals', 0)} signals")


if __name__ == "__main__":
    asyncio.run(main())
