"""سیدِ آموزشِ جامعِ متاتریدر ۴ و ۵ در آکادمی VIP (سطحِ پرمیوم).

هر درس: محتوای فارسیِ تخصصی + تصویرِ آنوتیت‌شدهٔ موکاپِ پلتفرم (با شماره/فلش/هایلایت) که
به بخشِ مربوطه اشاره می‌کند. تصاویر با chart-renderer (HTML→PNG) ساخته و در edu_assets ذخیره
می‌شوند. اجرا:  docker compose exec -T api python -m scripts.seed_mt_academy
"""
import asyncio
import os

import httpx
from sqlalchemy import select

from src.core.database import AcademyLesson, async_session_factory

CHART_HTML = os.environ.get("CHART_RENDERER_HTML_URL", "http://chart-renderer:8086/render-html")
# edu_assets در api فقط‌خواندنی است → دیاگرام‌ها را در /tmp می‌سازیم و بعد به edu_assets کپی می‌کنیم
EDU_DIR = os.environ.get("MT_DIAGRAM_DIR", "/tmp/mt_diagrams")

# ─────────────── موکاپِ آنوتیت‌شدهٔ پلتفرم ───────────────
# نواحیِ پلتفرم: marketwatch (دیده‌بانِ بازار)، navigator، chart، terminal، toolbar، neworder
REGIONS = {
    "marketwatch": (18, 70, 215, 360, "دیده‌بانِ بازار"),
    "navigator": (18, 440, 215, 250, "ناوبر"),
    "toolbar": (250, 56, 812, 40, "نوارِ ابزار"),
    "chart": (250, 108, 812, 380, "نمودار"),
    "terminal": (250, 500, 812, 190, "ترمینال / Toolbox"),
    "neworder": (360, 200, 380, 300, "پنجرهٔ سفارش"),
}
COLORS = ["#ef4444", "#f59e0b", "#22d3ee", "#a855f7", "#34d399"]


def _mockup_html(platform: str, highlights: list[str], callouts: list[str]) -> str:
    is5 = platform == "mt5"
    accent = "#1f6feb" if is5 else "#e36209"
    pname = "MetaTrader 5" if is5 else "MetaTrader 4"
    # هایلایت‌ها (مستطیلِ رنگی + شمارهٔ گرد) روی ناحیه‌ها
    boxes = ""
    legend = ""
    for i, key in enumerate(highlights):
        if key not in REGIONS:
            continue
        x, y, w, h, _ = REGIONS[key]
        col = COLORS[i % len(COLORS)]
        boxes += (f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
                  f'border:4px solid {col};border-radius:10px;box-shadow:0 0 0 3px rgba(0,0,0,.25)"></div>'
                  f'<div style="position:absolute;left:{x-18}px;top:{y-18}px;width:38px;height:38px;border-radius:50%;'
                  f'background:{col};color:#fff;font-weight:900;font-size:22px;display:flex;align-items:center;'
                  f'justify-content:center;border:3px solid #fff">{i+1}</div>')
        legend += (f'<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">'
                   f'<span style="width:26px;height:26px;border-radius:50%;background:{col};color:#fff;font-weight:900;'
                   f'display:flex;align-items:center;justify-content:center;font-size:15px">{i+1}</span>'
                   f'<span style="font-size:21px;color:#0a111d">{callouts[i] if i < len(callouts) else REGIONS[key][4]}</span></div>')
    return f"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@600;800;900&display=swap');
*{{margin:0;padding:0;box-sizing:border-box;font-family:'Vazirmatn',sans-serif}}
html,body{{width:1080px;height:760px;background:#0a111d}}
.win{{position:absolute;left:8px;top:8px;width:1064px;height:744px;background:#eef1f5;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}}
.title{{height:44px;background:{accent};color:#fff;display:flex;align-items:center;padding:0 16px;font-weight:800;font-size:20px;gap:10px;direction:ltr}}
.tb{{position:absolute;left:250px;top:56px;width:812px;height:40px;background:#dde3ea;border-bottom:1px solid #c3ccd6;display:flex;align-items:center;gap:8px;padding:0 12px}}
.tb i{{width:26px;height:22px;background:#aeb8c4;border-radius:4px;display:inline-block}}
.mw{{position:absolute;left:18px;top:70px;width:215px;height:360px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:6px;font-size:13px;direction:ltr}}
.mw .row{{display:flex;justify-content:space-between;padding:3px 4px;border-bottom:1px solid #eef1f5}}
.mw .row b{{color:#0a111d}} .up{{color:#16a34a}} .dn{{color:#dc2626}}
.nav{{position:absolute;left:18px;top:440px;width:215px;height:250px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font-size:13px}}
.nav div{{padding:4px 2px;color:#334155}}
.ch{{position:absolute;left:250px;top:108px;width:812px;height:380px;background:#0a111d;border-radius:6px;overflow:hidden}}
.term{{position:absolute;left:250px;top:500px;width:812px;height:190px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:8px;font-size:13px;direction:ltr}}
.term .tabs{{display:flex;gap:14px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;color:#475569;font-weight:700}}
.term .tabs .on{{color:{accent}}}
.cap{{position:absolute;right:18px;bottom:14px;width:240px;background:rgba(255,255,255,.96);border-radius:10px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.18)}}
svg{{position:absolute;inset:0;pointer-events:none}}
</style></head><body>
<div class="win">
  <div class="title">{pname} — CoinePro</div>
  <div class="tb"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <div class="mw"><div style="font-weight:800;margin-bottom:4px;color:#0a111d">Market Watch</div>
    <div class="row"><b>EURUSD</b><span class="up">1.0852</span></div>
    <div class="row"><b>XAUUSD</b><span class="dn">2331.4</span></div>
    <div class="row"><b>GBPUSD</b><span class="up">1.2710</span></div>
    <div class="row"><b>USDJPY</b><span class="dn">157.21</span></div>
    <div class="row"><b>BTCUSD</b><span class="up">64120</span></div>
  </div>
  <div class="nav"><div style="font-weight:800;color:#0a111d">Navigator</div>
    <div>📁 Accounts</div><div>📁 Indicators</div><div>📁 Expert Advisors</div><div>📁 Scripts</div>{'<div>📁 Market</div>' if is5 else ''}
  </div>
  <div class="ch">
    <svg viewBox="0 0 812 380"><polyline points="20,300 120,260 200,290 300,180 420,210 540,120 660,160 790,70" fill="none" stroke="#34d399" stroke-width="3"/></svg>
  </div>
  <div class="term"><div class="tabs"><span class="on">Trade</span><span>History</span><span>{'Exposure' if is5 else 'Account'}</span><span>News</span><span>Alerts</span></div>
    <div style="margin-top:8px;color:#16a34a">Balance: 10,000.00 &nbsp; Equity: 10,128.00 &nbsp; Margin: 102.00 &nbsp; Free: 9,898.00</div>
  </div>
  {boxes}
  <div class="cap"><div style="font-weight:900;color:{accent};margin-bottom:8px;font-size:18px">راهنمای تصویر</div>{legend}</div>
</div></body></html>"""


async def render_diagram(slug: str, platform: str, highlights: list[str], callouts: list[str]) -> str | None:
    html = _mockup_html(platform, highlights, callouts)
    try:
        async with httpx.AsyncClient(timeout=60) as cl:
            r = await cl.post(CHART_HTML, json={"html": html, "width": 1080, "height": 760})
            r.raise_for_status()
            png = r.content
    except Exception as e:
        print("diagram failed", slug, str(e)[:120]); return None
    os.makedirs(EDU_DIR, exist_ok=True)
    fname = f"{slug}.png"
    with open(os.path.join(EDU_DIR, fname), "wb") as f:
        f.write(png)
    return fname


# ─────────────── محتوای درس‌ها ───────────────
from scripts.mt_content import MT4_LESSONS, MT5_LESSONS  # noqa: E402


async def main():
    all_lessons = [("mt4", MT4_LESSONS), ("mt5", MT5_LESSONS)]
    async with async_session_factory() as db:
        for level, lessons in all_lessons:
            for i, L in enumerate(lessons, start=1):
                slug = L["slug"]
                img = await render_diagram(slug, level, L["highlights"], L["callouts"])
                existing = (await db.execute(select(AcademyLesson).where(AcademyLesson.slug == slug))).scalar_one_or_none()
                if existing:
                    existing.title_fa = L["title"]; existing.summary_fa = L["summary"]
                    existing.content_fa = L["content"]; existing.diagram_image = img or existing.diagram_image
                    existing.level = level; existing.order_in_level = i; existing.min_tier = "premium"; existing.is_published = True
                else:
                    db.add(AcademyLesson(slug=slug, level=level, order_in_level=i, title_fa=L["title"],
                                         summary_fa=L["summary"], content_fa=L["content"], diagram_image=img,
                                         min_tier="premium", is_published=True))
                await db.commit()
                print(f"seeded {slug} (img={img})")
    print("MT4/MT5 academy seed done.")


if __name__ == "__main__":
    asyncio.run(main())
