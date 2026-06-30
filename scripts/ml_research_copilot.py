#!/usr/bin/env python3
"""هم‌خلبان تحقیق ML — Claude عملکرد مدل‌ها و خطوط لوله را بررسی و بهبود پیشنهاد می‌دهد.

آفلاین/توسعه‌ای. اجرا:
    docker compose run --rm --no-deps -e LLM_ENABLED=true claude-research \
        python scripts/ml_research_copilot.py
یا داخل هر سرویس پایتونی که به claude-llm دسترسی دارد.
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


SYSTEM = (
    "تو یک کوانت ارشد و مهندس ML هستی. خروجی عملکرد مدل‌ها و توضیح خط لوله را بررسی کن و "
    "موارد زیر را به‌صورت فهرست کوتاه و عملی بده: (۱) نشانه‌های نشت/look-ahead یا overfitting، "
    "(۲) ۳ بهبود مشخص فیچر/لیبل/اعتبارسنجی، (۳) نمادهایی که edge ندارند و باید حذف/کم‌وزن شوند. "
    "دقیق و فنی، بدون حرف کلی."
)


async def main() -> None:
    from src.core.config import settings
    if not settings.LLM_ENABLED:
        print("LLM_ENABLED=false — با -e LLM_ENABLED=true اجرا کن.")
        return

    from sqlalchemy import select, desc
    from src.core.database import MLModelPerformance, async_session_factory
    from src.llm.client import llm_client

    async with async_session_factory() as s:
        rows = (
            await s.execute(
                select(MLModelPerformance).order_by(desc(MLModelPerformance.trained_at)).limit(60)
            )
        ).scalars().all()

    perf = [
        {"model": r.model_name, "acc": float(r.accuracy or 0),
         "f1": float(r.f1_score or 0), "samples": r.training_samples}
        for r in rows
    ]
    context = {
        "pipeline": "XGBoost(جهت ۳کلاسه) + LightGBM(قدرت) + ensemble؛ feature_engine 115 فیچر؛ "
                    "PurgedKFold(lookforward=4)؛ داده yfinance 5000 کندل H1؛ LSTM آموزش ندیده.",
        "known_open_issues": ["VWAP بدون session anchor", "Ichimoku repaint", "SMC BOS بدون تأیید close"],
        "recent_model_performance": perf,
    }
    out = await llm_client.complete(
        "این زمینه را تحلیل کن و پیشنهاد بده:\n\n" + json.dumps(context, ensure_ascii=False),
        system=SYSTEM, timeout=180,
    )
    print("\n===== ML RESEARCH COPILOT (Claude) =====\n")
    print(out or "(بدون خروجی — LLM در دسترس نبود)")


if __name__ == "__main__":
    asyncio.run(main())
