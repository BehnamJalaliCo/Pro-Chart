"""تولیدِ واژه‌نامه + چیت‌شیتِ هر سطح با کلودِ داخلِ سرور → JSON در edu_assets.

اجرا: python -m src.academy.extras_seed
خروجی:
    edu_assets/glossary.json          → [{"term","def"}]
    edu_assets/cheatsheet-<level>.json → {"title","points":[...]}
"""
from __future__ import annotations

import asyncio
import json
import os
import re

from sqlalchemy import select

from src.core.database import AcademyLesson, async_session_factory
from src.llm.client import llm_client

OUT = os.environ.get("EDU_ASSETS_DIR", "/app/edu_assets")
_LEVELS = [("beginner", "مقدماتی"), ("intermediate", "متوسط"),
           ("advanced", "پیشرفته"), ("ai", "حرفه‌ای")]


def _json(raw: str):
    raw = re.sub(r"```(json)?", "", raw or "").strip()
    a, b = raw.find("["), raw.rfind("]")
    o1, o2 = raw.find("{"), raw.rfind("}")
    seg = raw[a:b + 1] if (a != -1 and (o1 == -1 or a < o1)) else raw[o1:o2 + 1]
    try:
        return json.loads(seg)
    except Exception:  # noqa: BLE001
        return None


_GLOSSARY_CATS = [
    ("مبانی", "مفاهیمِ پایه: پیپ، اسپرد، لات، لوریج، مارجین، جفت‌ارز، بید/اَسک"),
    ("تحلیلِ تکنیکال", "کندل، حمایت/مقاومت، روند، اندیکاتورها، الگوها، فیبوناچی"),
    ("تحلیلِ فاندامنتال", "نرخِ بهره، تورم، NFP، بانکِ مرکزی، رویدادهای کلان"),
    ("مدیریتِ ریسک", "حدِ ضرر، ریسک‌به‌ریوارد، اندازهٔ پوزیشن، دراوداون، مارجین‌کال"),
    ("حرفه‌ای/نهادی", "اوردرفلو، نقدینگی، پولِ هوشمند، عمقِ بازار، بک‌تست، الگوریتمی"),
]


async def glossary():
    terms = []
    for cat, hint in _GLOSSARY_CATS:
        p = (f"۲۵ اصطلاحِ مهمِ «{cat}»ی معامله‌گریِ فارکس (مثل: {hint}) با تعریفِ یک‌خطیِ ساده و دقیق بساز.\n"
             'فقط JSON: [{"term":"اصطلاح (English)","def":"تعریفِ کوتاه"}] — بدونِ متنِ اضافه.')
        raw = await llm_client.complete(p, system="تو فرهنگ‌نویسِ بازارهای مالی هستی.",
                                        system_replace=True, timeout=120)
        data = _json(raw)
        if data:
            for x in data:
                if x.get("term") and x.get("def"):
                    terms.append({"term": str(x["term"])[:120], "def": str(x["def"])[:400], "cat": cat})
            print(f"glossary {cat}: +{len([x for x in data if x.get('term')])}")
        else:
            print(f"glossary {cat}: parse failed")
    if terms:
        json.dump(terms, open(f"{OUT}/glossary.json", "w"), ensure_ascii=False, indent=1)
        print(f"glossary total: {len(terms)} terms")


async def cheatsheet(db, key, fa):
    titles = (await db.execute(select(AcademyLesson.title_fa).where(
        AcademyLesson.level == key, AcademyLesson.is_published.is_(True))
        .order_by(AcademyLesson.order_in_level))).scalars().all()
    p = (f"برای سطحِ «{fa}»ی یک دورهٔ فارکس، یک چیت‌شیتِ مرورِ سریع بساز: "
         f"۱۲ تا ۱۸ نکتهٔ کلیدیِ کوتاه و کاربردی که جانِ کلامِ این سطح است.\n"
         f"عناوینِ درس‌ها: {', '.join(titles[:40])}\n"
         'فقط JSON: {"points":["نکتهٔ ۱","نکتهٔ ۲", ...]} — بدونِ متنِ اضافه.')
    raw = await llm_client.complete(p, system="تو مدرسِ بازارهای مالی هستی.",
                                    system_replace=True, timeout=120)
    data = _json(raw)
    pts = [str(x)[:300] for x in (data or {}).get("points", [])] if isinstance(data, dict) else None
    if pts:
        json.dump({"title": fa, "points": pts}, open(f"{OUT}/cheatsheet-{key}.json", "w"),
                  ensure_ascii=False, indent=1)
        print(f"cheatsheet {key}: {len(pts)} points")
    else:
        print(f"cheatsheet {key}: parse failed")


async def main():
    await glossary()
    async with async_session_factory() as db:
        for key, fa in _LEVELS:
            await cheatsheet(db, key, fa)
    print("DONE")


if __name__ == "__main__":
    asyncio.new_event_loop().run_until_complete(main())
