"""سازندهٔ کاورِ حرفه‌ایِ اینستاگرام.
لایه‌ها (مطابقِ نمونه): پس‌زمینهٔ خام + متنِ محوِ تایل‌شدهٔ پشت + المانِ شفاف (Iconify) +
نوشتهٔ سفید + نوشتهٔ زرد. خروجی PNG در ig_media. رندر با chart-renderer (HTML→PNG)."""
from __future__ import annotations

import base64
import html as _h
import os
import re
import shutil
import uuid

import httpx

from src.core.logger import get_logger

logger = get_logger(__name__)
CHART_HTML = os.environ.get("CHART_RENDERER_HTML_URL", "http://chart-renderer:8086/render-html")
MEDIA_DIR = os.environ.get("IG_MEDIA_DIR", "/app/ig_media")
_DEFAULT_BG = os.path.join(os.path.dirname(__file__), "assets", "cover_bg_orange.jpg")  # نارنجیِ اصل، baked در ایمیج

# self-heal: نارنجیِ اصل را در volume بگذار تا پیش‌نمایشِ پنل (/api/public/ig-media/cover_bg_orange.jpg) همیشه کار کند
try:
    _bg_dst = os.path.join(MEDIA_DIR, "cover_bg_orange.jpg")
    if os.path.exists(_DEFAULT_BG) and not os.path.exists(_bg_dst):
        os.makedirs(MEDIA_DIR, exist_ok=True)
        shutil.copy(_DEFAULT_BG, _bg_dst)
except Exception:
    pass
ICONIFY = "https://api.iconify.design"

RATIOS = {"9:16": (1080, 1920), "4:5": (1080, 1350), "1:1": (1080, 1080)}

# فونت‌های نمایشیِ فارسیِ گوگل (در زمانِ رندر import می‌شوند)
FONTS = {
    "Vazirmatn": "Vazirmatn:wght@600;800;900",
    "Lalezar": "Lalezar",
    "Gulzar": "Gulzar",
    "Markazi Text": "Markazi+Text:wght@600;700",
    "Archivo Black": "Archivo+Black",   # نوشتهٔ پشت = Arial Black (ضخیم، مثلِ TIMEFRAMEِ کاورِ اصلی)
}
# مجموعه‌های رنگی/سه‌بعدی — رنگشان دست‌نخورده می‌ماند (وگرنه رنگِ دلخواه اعمال می‌شود)
COLORFUL = ("fluent-emoji", "fluent-emoji-flat", "noto", "noto-v1", "twemoji", "emojione",
            "openmoji", "fxemoji", "logos", "skill-icons", "cryptocurrency-color",
            "flat-color-icons", "vscode-icons", "devicon", "unjs", "circle-flags")


# دیکشنریِ سریعِ فارسی→انگلیسی برای پرتکرارها (بدونِ رفت‌وبرگشت به LLM)
_FA_EN = {
    "نمودار": "chart", "شمع": "candlestick", "کندل": "candlestick", "طلا": "gold",
    "نفت": "oil", "دلار": "dollar", "یورو": "euro", "پول": "money", "سکه": "coin",
    "موشک": "rocket", "نمودار صعودی": "trend up", "صعودی": "bull trending up",
    "نزولی": "bear trending down", "گاو": "bull", "خرس": "bear", "هشدار": "alarm",
    "ساعت": "clock", "زنگ": "bell", "آتش": "fire", "چراغ": "light bulb idea",
    "هدف": "target", "جام": "trophy", "تقویم": "calendar", "اخبار": "news",
    "بانک": "bank", "کیف پول": "wallet", "ربات": "robot", "مغز": "brain ai",
    "تحلیل": "analytics", "ترازو": "balance scale", "قفل": "lock", "کلید": "key",
    "پرچم": "flag", "ستاره": "star", "قلب": "heart", "چک": "check mark",
    "تلفن": "phone", "لپ تاپ": "laptop", "گوشی": "smartphone", "تایم فریم": "clock time",
}


async def _translate_query(fa: str) -> str | None:
    """عبارتِ فارسیِ جستجوی المان را به کلیدواژهٔ انگلیسی برمی‌گرداند (دیکشنری، سپس LLM)."""
    key = fa.strip()
    if key in _FA_EN:
        return _FA_EN[key]
    for k, v in _FA_EN.items():           # تطبیقِ جزئی
        if k in key:
            return v
    try:
        from src.llm.client import llm_client
        en = await llm_client.complete(
            f"Translate this Persian icon-search phrase into 1-3 simple English keywords for an icon "
            f"search engine (forex/finance context, no crypto). Reply with ONLY the keywords: «{key}»",
            timeout=12)
        en = re.sub(r"[«»\"'\n].*", "", (en or "").strip()).strip()
        return en[:40] or None
    except Exception:
        return None


async def search_elements(query: str, limit: int = 36) -> list[dict]:
    """سرچِ اینترنتیِ المان/نماد در Iconify → آیکن‌های شفاف (رنگی/سه‌بعدی در اولویتِ نمایش)."""
    q = (query or "").strip()
    if not q:
        return []
    # Iconify فقط انگلیسی می‌فهمد → اگر فارسی/عربی بود به کلیدواژهٔ انگلیسی ترجمه کن
    if re.search(r"[؀-ۿ]", q):
        q = await _translate_query(q) or q
    async with httpx.AsyncClient(timeout=15) as cl:
        r = await cl.get(f"{ICONIFY}/search", params={"query": q, "limit": limit})
        r.raise_for_status()
        ids = r.json().get("icons", []) or []
    # المان‌های رنگی/سه‌بعدی را اولِ لیست بیاور (شبیه‌ترین به نمونه)
    ids.sort(key=lambda i: 0 if i.split(":")[0] in COLORFUL else 1)
    # preview از پراکسیِ خودمان (نه مستقیم api.iconify.design) تا در مرورگرِ کاربر فیلتر نشود
    return [{"id": i, "preview": f"/api/public/icon?id={i}&h=72"} for i in ids]


async def _fetch_icon_svg(icon_id: str, color: str | None, height: int = 900) -> str:
    prefix = icon_id.split(":")[0]
    params = {"height": str(height)}
    if color and prefix not in COLORFUL:
        params["color"] = color
    async with httpx.AsyncClient(timeout=20) as cl:
        r = await cl.get(f"{ICONIFY}/{icon_id.replace(':', '/')}.svg", params=params)
        r.raise_for_status()
        return r.text


def _data_uri(path: str) -> str | None:
    if not os.path.exists(path):
        return None
    p = path.lower()
    mime = "image/jpeg" if p.endswith((".jpg", ".jpeg")) else "image/webp" if p.endswith(".webp") else "image/png"
    with open(path, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode()


def _default_bg(c1: str = "#ffb020", c2: str = "#d97a06") -> str:
    """پس‌زمینهٔ پیش‌فرضِ کپی‌برابرِ‌اصل: نارنجیِ شعاعیِ پرنور + بافتِ لوزی (diamond)."""
    return (f"background-color:{c1};background-image:"
            f"radial-gradient(125% 95% at 50% 16%, {c1} 0%, #f59e0b 40%, {c2} 100%),"
            "repeating-linear-gradient(45deg, rgba(255,255,255,.06) 0 1px, transparent 1px 15px),"
            "repeating-linear-gradient(-45deg, rgba(90,45,0,.10) 0 1px, transparent 1px 15px);"
            "background-blend-mode:normal,screen,multiply;")


def _hex_rgba(hexc: str, a: float) -> str:
    h = (hexc or "#000000").lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    except Exception:
        r, g, b = 0, 0, 0
    return f"rgba({r},{g},{b},{round(a, 3)})"


def _num(o: dict, k: str, d: float) -> float:
    try:
        return float(o.get(k, d))
    except Exception:
        return d


def _compose_html(W: int, H: int, base_uri: str | None, element_html: str, o: dict) -> str:
    """کاورِ کپی‌برابرِ‌اصل + ۳۰ فیچرِ واقعی (همه قابلِ‌تنظیم؛ پیش‌فرض‌ها نمونهٔ اصلی را بازتولید می‌کنند).

    فیچرها: (۱)فونتِ Lalezar نمایشیِ سنگین (۲)آوت‌لاینِ مشکیِ ضخیمِ متن (۳)خطِ سفید+خطِ زرد
    (۴)متنِ پشتِ امبوس/کنده‌کاری (۵)محوشدنِ تدریجیِ ردیف‌های پشت (۶)پس‌زمینهٔ نارنجیِ شعاعیِ پرنور
    (۷)بافتِ لوزی (۸)رنگِ پس‌زمینهٔ تنظیم‌پذیر (۹)کاورِ تصویریِ آپلودی (۱۰)المانِ مرکزی(آیکن/عکس)
    (۱۱)سایهٔ المان (۱۲)چرخشِ المان (۱۳)اندازه/جای المان (۱۴)شفافیتِ المان (۱۵)سایهٔ عمقِ متن
    (۱۶)فیلِ گرادیانیِ متن (طلایی) (۱۷)گلوِ متن (۱۸)وینیتِ گوشه‌ها (۱۹)پرتوِ نورِ بالا
    (۲۰)اسکریمِ تیرهٔ پایین (۲۱)واترمارکِ لوگو (۲۲)بَج/برچسبِ گوشه (۲۳)جای متنِ تنظیم‌پذیر
    (۲۴)اندازهٔ فونت‌ها (۲۵)فاصلهٔ حروفِ پشت (۲۶)تعدادِ ردیفِ پشت (۲۷)خطِ تأکیدِ زیرِ متن
    (۲۸)نویزِ فیلم (۲۹)رنگِ آوت‌لاین (۳۰)شدتِ سایه/کنتراست خودکار."""
    # ۱ — فونت (پیش‌فرض Lalezarِ سنگین، مطابقِ کاورِ اصلی)
    font = o.get("font") if o.get("font") in FONTS else "Lalezar"
    imports = "".join(f"@import url('https://fonts.googleapis.com/css2?family={v}&display=swap');" for v in FONTS.values())
    behind = _h.escape((o.get("behind_text") or "").strip())
    white = _h.escape((o.get("white_text") or "").strip())
    yellow = _h.escape((o.get("yellow_text") or "").strip())
    white_color = o.get("white_color") or "#ffffff"
    yellow_color = o.get("yellow_color") or "#FFF600"   # زردِ خالصِ نمونه‌برداری‌شده از کاورِ اصلی (#FFF902)
    el_scale = max(15, min(300, int(_num(o, "element_scale", 56))))   # المانِ آپلودی تا ۳۰۰٪ بزرگ‌شدنی
    el_top = max(2, min(70, int(_num(o, "element_top", 17))))
    text_top = max(40, min(92, int(_num(o, "text_top", 62))))
    white_size = _num(o, "white_size", 100) / 100
    yellow_size = _num(o, "yellow_size", 100) / 100
    behind_size = _num(o, "behind_size", 100) / 100
    behind_rows_n = max(3, min(10, int(_num(o, "behind_rows", 5))))           # ۲۶ — اصل ۵ ردیف
    behind_ls = max(0, int(_num(o, "behind_letter_spacing", 4)))               # ۲۵
    behind_color = o.get("behind_color") or "#0e0700"                          # رنگِ نوشتهٔ پشت — دیفالت مشکیِ گرمِ اصل
    behind_top = max(0.15, min(1.0, _num(o, "behind_opacity", 95) / 100))      # پررنگیِ ردیفِ اول (توپُر) — دیفالت ۹۵٪
    behind_font = o.get("behind_font") if o.get("behind_font") in FONTS else "Archivo Black"  # فونتِ متنِ پشت — قابلِ انتخاب
    el_rotate = max(-45, min(45, _num(o, "element_rotate", 0)))                # ۱۲
    el_opacity = max(0.1, min(1.0, _num(o, "element_opacity", 100) / 100))     # ۱۴
    el_shadow = "filter:drop-shadow(0 30px 42px rgba(0,0,0,.5));" if o.get("element_shadow", True) else ""  # ۱۱
    sw = max(2, int(_num(o, "stroke_width", 6)))                               # ۲ — آوت‌لاینِ ضخیمِ پیش‌فرض
    sc = o.get("stroke_color") or "#000000"                                    # ۲۹
    stroke = "" if o.get("text_stroke") is False else f"-webkit-text-stroke:{sw}px {sc};paint-order:stroke fill;"
    shadow_k = max(0.0, min(1.0, _num(o, "shadow_strength", 100) / 100))       # ۳۰
    txt_shadow = f"text-shadow:0 {int(6)}px {int(20)}px rgba(0,0,0,{round(0.45 * shadow_k, 2)});"  # ۱۵
    # ۱۶ — فیلِ گرادیانیِ طلاییِ اختیاری روی متنِ زرد
    grad = o.get("text_gradient")
    yellow_fill = (f"background:linear-gradient(180deg,#fff7c2,{yellow_color} 55%,#e69a00);"
                   "-webkit-background-clip:text;background-clip:text;color:transparent;") if grad else f"color:{yellow_color};"
    glow = f"filter:drop-shadow(0 0 {int(_num(o,'glow', 0))}px rgba(255,225,60,.8));" if o.get("glow") else ""  # ۱۷
    underline = '<div class="uacc"></div>' if o.get("underline") else ""       # ۲۷
    # پس‌زمینه: ۹ تصویریِ آپلودی یا ۶+۷+۸ پیش‌فرض
    bg = (f"background:#e9a72e center/cover no-repeat url('{base_uri}');" if base_uri
          else _default_bg(o.get("bg_from") or "#ffb020", o.get("bg_to") or "#d97a06"))
    vignette = "" if o.get("vignette") is False else (
        ".c::before{content:'';position:absolute;inset:0;z-index:4;pointer-events:none;"
        "background:radial-gradient(120% 85% at 50% 42%, transparent 55%, rgba(60,25,0,.42) 100%)}")  # ۱۸
    rays = (".rays{position:absolute;inset:0;z-index:1;pointer-events:none;"
            "background:radial-gradient(60% 38% at 50% 6%, rgba(255,255,255,.34), transparent 70%)}") if o.get("light_rays", True) else ""  # ۱۹
    scrim = (".scrim{position:absolute;left:0;right:0;bottom:0;height:42%;z-index:2;pointer-events:none;"
             "background:linear-gradient(0deg, rgba(60,25,0,.5), transparent)}") if o.get("scrim", True) else ""  # ۲۰
    grain = (".grain{position:absolute;inset:0;z-index:4;opacity:.05;mix-blend-mode:overlay;pointer-events:none;"
             "background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>"
             "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter>"
             "<rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")}") if o.get("grain", True) else ""  # ۲۸
    # ۲۲ — بَج/برچسبِ گوشه
    badge_txt = _h.escape((o.get("badge") or "").strip())
    badge = (f'<div class="badge">{badge_txt}</div>') if badge_txt else ""
    # ۲۱ — واترمارکِ لوگو
    wm = ""
    if o.get("watermark"):
        wm_uri = _data_uri(os.path.join(MEDIA_DIR, "logo.png")) or _data_uri("/work/logo.png")
        if wm_uri:
            wm = f'<img class="wm" src="{wm_uri}"/>'
    # ۴+۵ — متنِ پشتِ امبوس/کنده‌کاری + محوشدنِ تدریجیِ ردیف‌ها
    behind_rows = ""
    if behind:
        rep = behind   # یک کلمه در هر ردیف (راست/چپ خالی می‌ماند، مثلِ اصل)
        rows = ""
        for i in range(behind_rows_n):
            # ردیفِ اول هیچ محوی ندارد (توپُر، =behind_top)؛ محو از ردیفِ دوم شروع و به پایین کم‌رنگ‌تر می‌شود
            op = behind_top if i == 0 else round(behind_top * (0.74 - (i - 1) * (0.62 / max(1, behind_rows_n - 2))), 3)
            rows += f'<div style="opacity:{max(0.04, op)}">{rep}</div>'
        behind_rows = f'<div class="behind">{rows}</div>'
    el_block = f'<div class="el">{element_html}</div>' if element_html else ""
    bsz = int(W * 0.13 * behind_size)   # Archivo Black پهن/ضخیم → اندازه‌ای که یک کلمه با حاشیه جا شود
    return f"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>
{imports}
*{{margin:0;padding:0;box-sizing:border-box;font-family:'{font}','Vazirmatn',sans-serif}}
html,body{{width:{W}px;height:{H}px;overflow:hidden}}
.c{{position:relative;width:{W}px;height:{H}px;overflow:hidden;{bg}}}
{vignette}
{rays}
{scrim}
{grain}
.behind{{position:absolute;left:0;right:0;top:{el_top + 4}%;height:46%;display:flex;flex-direction:column;justify-content:flex-start;gap:{int(H * 0.004)}px;overflow:hidden;z-index:1;padding:0 6%}}
.behind div{{white-space:nowrap;font-family:'{behind_font}','Lalezar',sans-serif;font-weight:900;font-size:{bsz}px;line-height:1;letter-spacing:{behind_ls}px;text-align:center;
  color:{behind_color};
  text-shadow:-1px -1px 0 rgba(255,205,120,.32), 1px 1px 0 rgba(0,0,0,.35), 2px 4px 3px rgba(0,0,0,.45)}}
.rays,.scrim,.grain{{}}
.el{{position:absolute;left:50%;transform:translateX(-50%) rotate({el_rotate}deg);top:{el_top}%;width:{el_scale}%;opacity:{el_opacity};z-index:3;{el_shadow}}}
.el svg{{width:100%!important;height:auto!important;display:block}}
.el img{{width:100%;height:auto;display:block}}
.txt{{position:absolute;left:0;right:0;top:{text_top}%;z-index:5;display:flex;flex-direction:column;align-items:center;gap:{int(H * 0.006)}px;padding:0 56px;text-align:center;{glow}}}
.white{{color:{white_color};font-weight:900;font-size:{int(W * 0.125 * white_size)}px;line-height:1.12;{txt_shadow}{stroke}}}
.yellow{{{yellow_fill}font-weight:900;font-size:{int(W * 0.14 * yellow_size)}px;line-height:1.1;{txt_shadow}{stroke}}}
.uacc{{height:{int(H*0.009)}px;width:42%;border-radius:99px;margin-top:{int(H*0.012)}px;background:linear-gradient(90deg,#ffd000,#ff8a00)}}
.badge{{position:absolute;top:4.5%;left:6%;z-index:6;background:linear-gradient(160deg,#ff3b30,#b3001b);color:#fff;font-weight:900;
  font-size:{int(W*0.05)}px;padding:{int(H*0.008)}px {int(W*0.05)}px;border-radius:18px;transform:rotate(-7deg);box-shadow:0 10px 26px rgba(0,0,0,.4);-webkit-text-stroke:2px rgba(0,0,0,.35)}}
.wm{{position:absolute;bottom:3.5%;left:50%;transform:translateX(-50%);width:30%;z-index:6;opacity:.92;filter:drop-shadow(0 6px 16px rgba(0,0,0,.4))}}
</style></head><body>
<div class="c">
  {('<div class="rays"></div>' if rays else '')}
  {behind_rows}
  {el_block}
  {('<div class="scrim"></div>' if scrim else '')}
  <div class="txt">
    {f'<div class="white">{white}</div>' if white else ''}
    {f'<div class="yellow">{yellow}</div>' if yellow else ''}
    {underline}
  </div>
  {badge}
  {wm}
  {('<div class="grain"></div>' if grain else '')}
</div></body></html>"""


async def render_cover(opts: dict) -> dict:
    ratio = opts.get("ratio", "9:16")
    W, H = RATIOS.get(ratio, RATIOS["9:16"])
    base_uri = None
    bf = opts.get("base_filename")
    if bf and bf != "gradient":
        base_uri = _data_uri(os.path.join(MEDIA_DIR, os.path.basename(bf)))
    if base_uri is None and bf != "gradient":
        # پیش‌فرضِ قفل‌شده = پس‌زمینهٔ نارنجیِ اصلِ CoinePro (در ایمیج bake شده — مستقل از volume)
        base_uri = _data_uri(_DEFAULT_BG)
    element_html = ""
    if opts.get("element_icon"):
        try:
            element_html = await _fetch_icon_svg(opts["element_icon"], opts.get("element_color"))
        except Exception as e:
            logger.warning("cover_icon_failed", error=str(e)[:150])
    elif opts.get("element_filename"):
        uri = _data_uri(os.path.join(MEDIA_DIR, os.path.basename(opts["element_filename"])))
        if uri:
            element_html = f'<img src="{uri}"/>'
    html = _compose_html(W, H, base_uri, element_html, opts)
    async with httpx.AsyncClient(timeout=60) as cl:
        r = await cl.post(CHART_HTML, json={"html": html, "width": W, "height": H})
        r.raise_for_status()
        png = r.content
    os.makedirs(MEDIA_DIR, exist_ok=True)
    fname = f"cover_{uuid.uuid4().hex[:12]}.png"
    with open(os.path.join(MEDIA_DIR, fname), "wb") as f:
        f.write(png)
    _prune_covers()   # پیش‌نمایشِ زندهٔ پنل انبوهِ کاور می‌سازد → فقط آخرین‌ها بمانند
    logger.info("ig_cover_rendered", file=fname, element=opts.get("element_icon") or opts.get("element_filename"))
    return {"filename": fname, "url": f"/api/public/ig-media/{fname}", "fonts": list(FONTS.keys())}


def _prune_covers(keep: int = 50) -> None:
    """فایل‌های cover_*.png را به جدیدترین‌ها محدود می‌کند (نه bg و نه آپلودی‌ها)."""
    try:
        import glob
        files = sorted(glob.glob(os.path.join(MEDIA_DIR, "cover_*.png")), key=os.path.getmtime, reverse=True)
        for p in files[keep:]:
            try:
                os.remove(p)
            except OSError:
                pass
    except Exception:
        pass
