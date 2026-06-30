"""ساختِ تامبنیلِ اختصاصیِ هر جلسه (۱۲۸۰×۷۲۰) با HTML→PNG از chart-renderer.

روی تامبنیل: «جلسهٔ X» + نامِ سطح + عنوانِ درس + لوگوی آکادمی. هیچ‌گاه throw نمی‌کند.
"""
from __future__ import annotations

import base64
import html as _html
import os

import httpx

from src.core.logger import get_logger

logger = get_logger(__name__)

CHART_HTML = os.environ.get("CHART_RENDERER_HTML_URL", "http://chart-renderer:8086/render-html")
EDU_DIR = os.environ.get("EDU_ASSETS_DIR", "/app/edu_assets")
_FA = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


# تمِ رنگیِ هر سطح: bg گرادیان، badge رنگِ نشانِ سطح، bar نوارِ پایین
_THEME = {
    "beginner":     {"bg": "radial-gradient(circle at 82% 12%,#ff9b1f 0%,#e2780c 42%,#5a2c00 100%)", "bbg": "#13110c", "bfg": "#ffd24d", "bar": "linear-gradient(90deg,#ffd000,#ff7a00)"},   # نارنجی
    "intermediate": {"bg": "radial-gradient(circle at 82% 12%,#ff4242 0%,#bf1515 45%,#3a0000 100%)", "bbg": "#1a0000", "bfg": "#ffd6d6", "bar": "linear-gradient(90deg,#ff5b5b,#b30000)"},   # قرمز
    "advanced":     {"bg": "radial-gradient(circle at 82% 12%,#3a93ff 0%,#1657c0 45%,#001a3a 100%)", "bbg": "#00132a", "bfg": "#d4e7ff", "bar": "linear-gradient(90deg,#5aa6ff,#0a4da0)"},   # آبی
    "ai":           {"bg": "radial-gradient(circle at 82% 12%,#ffdf80 0%,#c79a2a 45%,#3a2900 100%)", "bbg": "#1a1400", "bfg": "#fff4c8", "bar": "linear-gradient(90deg,#ffe680,#c79a17)"},   # طلایی (حرفه‌ای)
    "mt4":          {"bg": "radial-gradient(circle at 82% 12%,#2c2c2c 0%,#161616 45%,#000 100%)",    "bbg": "#000000", "bfg": "#ffffff", "bar": "linear-gradient(90deg,#9a9a9a,#222)"},     # مشکی
    "mt5":          {"bg": "radial-gradient(circle at 82% 12%,#2c2c2c 0%,#161616 45%,#000 100%)",    "bbg": "#000000", "bfg": "#ffffff", "bar": "linear-gradient(90deg,#9a9a9a,#222)"},     # مشکی
}


def _logo_uri() -> str:
    p = os.path.join(EDU_DIR, "academy_logo.png")
    if os.path.exists(p):
        try:
            return "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()
        except Exception:  # noqa: BLE001
            return ""
    return ""


def _html_doc(number: int, level_fa: str, title: str, level_key: str = "beginner") -> str:
    fa = str(number).translate(_FA)
    th = _THEME.get(level_key, _THEME["beginner"])
    logo = _logo_uri()
    logo_html = f'<img src="{logo}" class="logo"/>' if logo else ""
    t = _html.escape(title or "")
    return f"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@700;900&display=swap');
*{{margin:0;padding:0;box-sizing:border-box;font-family:'Vazirmatn',sans-serif}}
html,body{{width:1280px;height:720px;overflow:hidden}}
.c{{position:relative;width:1280px;height:720px;background:{th['bg']}}}
.grid{{position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.06) 0 2px,transparent 2px 24px),repeating-linear-gradient(-45deg,rgba(0,0,0,.05) 0 2px,transparent 2px 24px)}}
.scrim{{position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(40,18,0,.55) 100%)}}
.logo{{position:absolute;top:46px;right:54px;height:104px;border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,.35)}}
.brand{{position:absolute;top:74px;right:178px;color:#fff;font-weight:900;font-size:32px;letter-spacing:-1px;text-shadow:0 2px 8px rgba(0,0,0,.4)}}
.lvl{{position:absolute;top:250px;right:74px;background:{th['bbg']};color:{th['bfg']};font-weight:900;font-size:42px;padding:12px 40px;border-radius:999px;box-shadow:0 8px 20px rgba(0,0,0,.35)}}
.num{{position:absolute;top:300px;right:64px;color:#fff;font-family:'Lalezar',sans-serif;font-size:210px;line-height:1;text-shadow:0 10px 34px rgba(0,0,0,.45)}}
.ttl{{position:absolute;bottom:78px;right:74px;left:74px;color:#fff;font-weight:900;font-size:62px;line-height:1.28;text-shadow:0 4px 18px rgba(0,0,0,.55);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
.bar{{position:absolute;bottom:0;right:0;left:0;height:16px;background:{th['bar']}}}
</style></head><body><div class="c"><div class="grid"></div><div class="scrim"></div>
{logo_html}<div class="brand">آکادمی جامع کوین پرو FX</div>
<div class="lvl">{_html.escape(level_fa)}</div>
<div class="num">جلسهٔ {fa}</div>
<div class="ttl">{t}</div>
<div class="bar"></div></div></body></html>"""


async def make_thumbnail(number: int, level_fa: str, title: str, out_path: str, level_key: str = "beginner") -> str | None:
    try:
        async with httpx.AsyncClient(timeout=90) as cx:
            r = await cx.post(CHART_HTML, json={
                "html": _html_doc(number, level_fa, title, level_key), "width": 1280, "height": 720,
                "scale": 1, "format": "jpeg", "quality": 90,  # JPEGِ ۱۲۸۰×۷۲۰ < ۲MB (حدِ یوتیوب)
            })
            r.raise_for_status()
            with open(out_path, "wb") as f:
                f.write(r.content)
        return out_path if os.path.exists(out_path) and os.path.getsize(out_path) > 1000 else None
    except Exception as e:  # noqa: BLE001
        logger.warning("thumbnail_render_failed", error=str(e)[:200])
        return None
