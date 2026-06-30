"""موتور دیاگرام‌های آموزشی اختصاصی (قالب‌محور) — HTML/SVG → PNG.

هر دیاگرام با یک «spec» توصیف می‌شود: {"t": نوع‌قالب, "title", "subtitle", "height", ...params}.
spec به HTML تبدیل و به سرویس chart-renderer (/render-html) فرستاده می‌شود؛ خروجی PNG با
deviceScaleFactor=2 در edu_assets ذخیره می‌شود. متن فارسی با فونت متصل Vazirmatn رندر می‌شود.

استایل یکپارچه: تم تیرهٔ TradingView، برند «CoinePro FX • آکادمی»، RTL.
"""

from __future__ import annotations

import os
from typing import Optional

import httpx

from src.core.logger import get_logger

logger = get_logger("bot.education.diagrams")

_RENDER_URL = os.getenv(
    "CHART_RENDERER_HTML_URL", "http://chart-renderer:8086/render-html"
)
_ASSET_DIR = os.getenv("EDU_ASSET_DIR", "/app/edu_assets")

# پالت تم
_BG = "#0e1117"
_BG2 = "#131722"
_FG = "#e6e8eb"
_MUTED = "#8b95a5"
_CARD = "#0d1422"
_BORDER = "#233047"
GREEN = "#089981"
RED = "#f23645"
BLUE = "#2962ff"
GOLD = "#f0b90b"
PURPLE = "#a855f7"
CYAN = "#26c6da"
_BRAND = "CoinePro FX • آکادمی"

_W = 968  # عرض داخلی کارت (1080 - 2*56)


def _frame(title: str, subtitle: str, body: str, height: int = 760) -> str:
    """قاب برنددار مشترک همهٔ دیاگرام‌ها."""
    return f"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<style>
  *{{box-sizing:border-box;margin:0;padding:0;
     font-family:'Vazirmatn',Tahoma,'Segoe UI',Arial,sans-serif;}}
  text,tspan{{font-family:'Vazirmatn',Tahoma,Arial,sans-serif;}}
  html,body{{background:{_BG};}}
  .card{{width:1080px;height:{height}px;position:relative;overflow:hidden;
     background:radial-gradient(120% 120% at 80% 0%, #182030 0%, {_BG2} 45%, {_BG} 100%);
     color:{_FG};padding:46px 56px 64px;}}
  .accent{{position:absolute;top:0;left:0;width:100%;height:6px;
     background:linear-gradient(90deg,{GREEN},{BLUE});}}
  .title{{font-size:42px;font-weight:800;color:#ffffff;text-align:center;letter-spacing:.2px;}}
  .sub{{font-size:21px;color:{_MUTED};text-align:center;margin-top:12px;line-height:1.6;}}
  .body{{margin-top:32px;}}
  .note{{margin-top:24px;background:{_CARD};border:1px solid {_BORDER};border-radius:16px;
     padding:22px;font-size:20px;color:{_FG};text-align:center;line-height:1.9;}}
  .brand{{position:absolute;bottom:20px;right:44px;color:#5b6675;font-size:18px;font-weight:700;opacity:.9;}}
  .dot{{position:absolute;bottom:24px;left:44px;width:13px;height:13px;border-radius:50%;
     background:{GREEN};box-shadow:0 0 14px {GREEN};}}
</style></head><body>
  <div class="card">
    <div class="accent"></div>
    <div class="title">{title}</div>
    <div class="sub">{subtitle}</div>
    <div class="body">{body}</div>
    <div class="dot"></div>
    <div class="brand">{_BRAND}</div>
  </div>
</body></html>"""


def _note(html: str) -> str:
    return f'<div class="note">{html}</div>' if html else ""


# ─────────────────────────── قالب‌ها (هر کدام body برمی‌گرداند) ───────────────────────────


def tpl_infographic(center: str = "", stats: Optional[list] = None, lead: str = "",
                    note: str = "") -> str:
    stats = stats or []

    def card(num: str, lbl: str, color: str) -> str:
        return (
            f'<div style="flex:1;background:{_CARD};border:1px solid {_BORDER};border-radius:18px;'
            f'padding:26px 16px;text-align:center;"><div style="font-size:34px;font-weight:800;'
            f'color:{color};">{num}</div><div style="font-size:18px;color:{_MUTED};margin-top:8px;'
            f'line-height:1.5;">{lbl}</div></div>'
        )

    center_html = f'<div style="margin:6px 0 30px;">{center}</div>' if center else ""
    lead_html = (
        f'<div style="font-size:20px;color:{_FG};text-align:center;margin-bottom:30px;'
        f'line-height:1.8;">{lead}</div>'
        if lead
        else ""
    )
    cards = "".join(card(*s) for s in stats)
    return (
        center_html + lead_html
        + f'<div style="display:flex;gap:18px;">{cards}</div>'
        + _note(note)
    )


def tpl_two_box(left: dict, right: dict, arrow: str = "⇄", big: str = "",
                note: str = "") -> str:
    def box(b: dict) -> str:
        return (
            f'<div style="background:{b.get("bg","#13233b")};border:2px solid {b["color"]};'
            f'border-radius:20px;padding:24px 30px;text-align:center;min-width:230px;">'
            f'<div style="font-size:28px;font-weight:800;color:#fff;">{b["title"]}</div>'
            f'<div style="font-size:17px;color:{_MUTED};margin-top:8px;line-height:1.5;">{b["sub"]}</div></div>'
        )

    big_html = (
        f'<div style="text-align:center;font-size:60px;font-weight:800;margin:4px 0 26px;">{big}</div>'
        if big
        else ""
    )
    return (
        big_html
        + '<div style="display:flex;justify-content:center;align-items:center;gap:26px;margin-bottom:10px;">'
        + box(right)
        + f'<div style="font-size:44px;color:{GREEN};">{arrow}</div>'
        + box(left)
        + "</div>"
        + _note(note)
    )


def tpl_table(headers: list, rows: list, note: str = "", foot: str = "") -> str:
    head = "".join(
        f'<td style="font-size:19px;color:{_MUTED};padding:0 16px;'
        f'{"text-align:center;" if i else ""}">{h}</td>'
        for i, h in enumerate(headers)
    )
    body_rows = ""
    for r in rows:
        c1, c2, c3, color, bg = r
        body_rows += (
            f'<tr style="background:{bg};">'
            f'<td style="padding:18px 16px;font-size:22px;font-weight:800;color:{color};">{c1}</td>'
            f'<td style="padding:18px 16px;font-size:20px;color:{_FG};text-align:center;">{c2}</td>'
            f'<td style="padding:18px 16px;font-size:20px;color:#fff;text-align:center;font-weight:700;">{c3}</td>'
            "</tr>"
        )
    foot_html = (
        f'<div style="margin-top:12px;font-size:15px;color:{_MUTED};text-align:center;">{foot}</div>'
        if foot
        else ""
    )
    return (
        '<table style="width:100%;border-collapse:separate;border-spacing:0 12px;">'
        f"<tr>{head}</tr>{body_rows}</table>" + _note(note) + foot_html
    )


def tpl_cards(cards: list, cols: int = 2, note: str = "") -> str:
    pct = 100 / cols - 2
    items = ""
    for c in cards:
        icon, head, text, color = c
        items += (
            f'<div style="width:{pct}%;background:{_CARD};border:1px solid {_BORDER};'
            f'border-top:4px solid {color};border-radius:16px;padding:22px 20px;">'
            f'<div style="font-size:30px;">{icon}</div>'
            f'<div style="font-size:22px;font-weight:800;color:{color};margin-top:8px;">{head}</div>'
            f'<div style="font-size:18px;color:{_FG};margin-top:8px;line-height:1.7;">{text}</div></div>'
        )
    return (
        f'<div style="display:flex;flex-wrap:wrap;gap:18px;justify-content:center;">{items}</div>'
        + _note(note)
    )


def tpl_panels(panels: list, note: str = "") -> str:
    n = len(panels)
    pw = (_W - (n - 1) * 20) / n
    inner = ""
    x = 0.0
    for title, color, points in panels:
        inner += (
            f'<svg x="{x:.0f}" y="0" width="{pw:.0f}" height="240" viewBox="0 0 {pw:.0f} 240">'
            f'<rect x="4" y="4" width="{pw-8:.0f}" height="200" rx="14" fill="{_CARD}" stroke="{_BORDER}"/>'
            f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="5" '
            f'stroke-linecap="round" stroke-linejoin="round"/>'
            f'<text x="{pw/2:.0f}" y="232" fill="{color}" font-size="22" font-weight="800" '
            f'text-anchor="middle">{title}</text></svg>'
        )
        x += pw + 20
    return (
        f'<svg width="{_W}" height="250" viewBox="0 0 {_W} 250">{inner}</svg>' + _note(note)
    )


def tpl_compare(left: dict, right: dict, note: str = "") -> str:
    def col(c: dict) -> str:
        items = "".join(
            f'<li style="margin:10px 0;font-size:19px;color:{_FG};line-height:1.6;">{x}</li>'
            for x in c["items"]
        )
        return (
            f'<div style="flex:1;background:{_CARD};border:1px solid {_BORDER};'
            f'border-top:4px solid {c["color"]};border-radius:16px;padding:22px 26px;">'
            f'<div style="font-size:24px;font-weight:800;color:{c["color"]};text-align:center;'
            f'margin-bottom:8px;">{c["title"]}</div>'
            f'<ul style="list-style:none;padding:0;">{items}</ul></div>'
        )

    return (
        f'<div style="display:flex;gap:20px;">{col(right)}{col(left)}</div>' + _note(note)
    )


def tpl_steps(steps: list, color: str = BLUE, note: str = "") -> str:
    items = ""
    for i, s in enumerate(steps, 1):
        head, text = s
        items += (
            '<div style="display:flex;align-items:flex-start;gap:18px;margin:14px 0;">'
            f'<div style="flex:none;width:48px;height:48px;border-radius:50%;background:{color};'
            f'color:#fff;font-size:24px;font-weight:800;display:flex;align-items:center;'
            f'justify-content:center;">{i}</div>'
            f'<div style="background:{_CARD};border:1px solid {_BORDER};border-radius:14px;'
            f'padding:14px 20px;flex:1;"><div style="font-size:21px;font-weight:800;color:#fff;">{head}</div>'
            f'<div style="font-size:18px;color:{_MUTED};margin-top:4px;line-height:1.6;">{text}</div></div></div>'
        )
    return items + _note(note)


def _candle(cx: float, wick_top: float, body_top: float, body_bot: float,
            wick_bot: float, color: str, w: float = 64) -> str:
    h = max(body_bot - body_top, 4)
    return (
        f'<line x1="{cx}" y1="{wick_top}" x2="{cx}" y2="{wick_bot}" stroke="{color}" stroke-width="4"/>'
        f'<rect x="{cx-w/2:.0f}" y="{body_top}" width="{w}" height="{h}" rx="5" fill="{color}"/>'
    )


def tpl_candles(candles: list, labels: Optional[list] = None, caption: str = "",
                h: int = 420) -> str:
    """candles: [[cx, wick_top, body_top, body_bot, wick_bot, color, (w)]]؛ مختصات پیکسلی (y از بالا)."""
    labels = labels or []
    body = ""
    for c in candles:
        body += _candle(*c)  # type: ignore[arg-type]
    for lb in labels:
        x, y, text, color, anchor = lb
        body += (
            f'<text x="{x}" y="{y}" fill="{color}" font-size="20" font-weight="700" '
            f'text-anchor="{anchor}">{text}</text>'
        )
    cap = (
        f'<div class="note">{caption}</div>' if caption else ""
    )
    return f'<div style="text-align:center;"><svg width="{_W}" height="{h}" viewBox="0 0 {_W} {h}">{body}</svg></div>' + cap


def tpl_chart(polylines: Optional[list] = None, hlines: Optional[list] = None,
              tlines: Optional[list] = None, markers: Optional[list] = None,
              zones: Optional[list] = None, caption: str = "",
              lower: Optional[dict] = None) -> str:
    """نمودار خطیِ منعطف.

    polylines: [[points, color, width, dash]]  (points='x,y x,y ...'، y در 0..H)
    hlines:    [[y, label, color]]              خط افقی چین + برچسب سمت چپ
    tlines:    [[x1,y1,x2,y2,color,dash]]       خط دلخواه (روند/کانال)
    markers:   [[x,y,text,color,anchor]]
    zones:     [[y1,y2,color,label]]            ناحیهٔ سایه‌دار افقی (عرضه/تقاضا، اوردربلاک، FVG)
    lower:     {"polylines":[...], "hlines":[...], "label":str}  پنل پایین (RSI/MACD/واگرایی)
    """
    polylines = polylines or []
    hlines = hlines or []
    tlines = tlines or []
    markers = markers or []
    zones = zones or []
    main_h = 250 if lower else 340
    total_h = main_h + (150 if lower else 0) + 20

    def pane(x0: int, y0: int, h: int, polys, hls, tls, mks, zns=None, label=""):
        s = (
            f'<rect x="2" y="{y0}" width="{_W-4}" height="{h}" rx="14" '
            f'fill="{_CARD}" stroke="{_BORDER}"/>'
        )
        for zn in (zns or []):
            zy1, zy2, zcol, zlab = (list(zn) + [""])[:4]
            zh = abs(zy2 - zy1)
            zt = min(zy1, zy2)
            s += (
                f'<rect x="6" y="{zt}" width="{_W-16}" height="{zh}" rx="6" '
                f'fill="{zcol}" fill-opacity="0.15" stroke="{zcol}" stroke-opacity="0.55"/>'
            )
            if zlab:
                cy = zt + zh / 2
                s += (
                    f'<rect x="12" y="{cy-17:.0f}" width="200" height="32" rx="8" '
                    f'fill="#0d1422" stroke="{zcol}" stroke-width="1.5"/>'
                    f'<text x="112" y="{cy+5:.0f}" fill="{zcol}" font-size="16" font-weight="700" '
                    f'text-anchor="middle">{zlab}</text>'
                )
        for hl in hls:
            y, lab, col = hl
            # خطِ افقیِ چین در کل عرض + «چیپِ» برچسب در سمت چپ (پسِ زمینهٔ تیره تا روی خط
            # خوانا بماند و از بریده‌شدنِ متنِ RTL در لبهٔ راست جلوگیری شود)
            s += (
                f'<line x1="210" y1="{y}" x2="{_W-14}" y2="{y}" stroke="{col}" '
                f'stroke-width="2" stroke-dasharray="7 5"/>'
                f'<rect x="12" y="{y-19}" width="190" height="34" rx="9" '
                f'fill="#0d1422" stroke="{col}" stroke-width="1.5"/>'
                f'<text x="107" y="{y+5}" fill="{col}" font-size="17" font-weight="700" '
                f'text-anchor="middle">{lab}</text>'
            )
        for tl in tls:
            x1, y1, x2, y2, col, dash = (tl + [""])[:6]
            da = f'stroke-dasharray="{dash}"' if dash else ""
            s += f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="3" {da}/>'
        for pl in polys:
            pts, col, wdt, dash = (list(pl) + [4, ""])[:4]
            da = f'stroke-dasharray="{dash}"' if dash else ""
            s += (
                f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="{wdt}" '
                f'stroke-linecap="round" stroke-linejoin="round" {da}/>'
            )
        for mk in mks:
            x, y, text, col, anchor = mk
            s += (
                f'<circle cx="{x}" cy="{y}" r="7" fill="{col}"/>'
                f'<text x="{x}" y="{y-16}" fill="{col}" font-size="18" font-weight="800" '
                f'text-anchor="{anchor}">{text}</text>'
            )
        if label:
            # direction=ltr تا برچسبِ لاتین (Delta/ATR/…) از لبهٔ چپ بریده نشود (در RTL،
            # anchorِ پیش‌فرض راست‌چین می‌شود و چند حرفِ اول از کادر بیرون می‌زند)
            s += (
                f'<text x="20" y="{y0+26}" fill="{_MUTED}" font-size="17" font-weight="700" '
                f'direction="ltr" text-anchor="start">{label}</text>'
            )
        return s

    svg = pane(0, 0, main_h, polylines, hlines, tlines, markers, zones)
    if lower:
        svg += pane(
            0, main_h + 18, 132,
            lower.get("polylines", []), lower.get("hlines", []), [], lower.get("markers", []),
            None, lower.get("label", ""),
        )
    cap = f'<div class="note">{caption}</div>' if caption else ""
    return f'<div style="text-align:center;"><svg width="{_W}" height="{total_h}" viewBox="0 0 {_W} {total_h}">{svg}</svg></div>' + cap


def tpl_gauge_rr(risk: int = 1, reward: int = 3, note: str = "") -> str:
    total = risk + reward
    risk_w = _W * risk / total
    reward_w = _W * reward / total
    body = (
        f'<svg width="{_W}" height="180" viewBox="0 0 {_W} 180">'
        f'<rect x="0" y="60" width="{risk_w:.0f}" height="70" rx="10" fill="{RED}"/>'
        f'<rect x="{risk_w:.0f}" y="60" width="{reward_w:.0f}" height="70" rx="10" fill="{GREEN}"/>'
        f'<text x="{risk_w/2:.0f}" y="105" fill="#fff" font-size="26" font-weight="800" text-anchor="middle">ریسک {risk}</text>'
        f'<text x="{risk_w+reward_w/2:.0f}" y="105" fill="#fff" font-size="26" font-weight="800" text-anchor="middle">سود {reward}</text>'
        f'<text x="{risk_w/2:.0f}" y="40" fill="{RED}" font-size="20" font-weight="700" text-anchor="middle">حد ضرر</text>'
        f'<text x="{risk_w+reward_w/2:.0f}" y="40" fill="{GREEN}" font-size="20" font-weight="700" text-anchor="middle">حد سود</text>'
        f'<text x="{_W/2:.0f}" y="165" fill="{_FG}" font-size="22" font-weight="800" text-anchor="middle">'
        f'نسبت ریسک به ریوارد = ۱ به {reward}</text></svg>'
    )
    return body + _note(note)


def tpl_anatomy(caption: str = "") -> str:
    """آناتومی کندل‌استیک (کندل صعودی/نزولی با برچسب)."""
    svg = f"""
    <svg width="{_W}" height="430" viewBox="0 0 {_W} 430">
      <line x1="300" y1="20" x2="300" y2="410" stroke="{GREEN}" stroke-width="4"/>
      <rect x="250" y="150" width="100" height="180" rx="6" fill="{GREEN}"/>
      <text x="300" y="405" fill="{GREEN}" font-size="24" font-weight="800" text-anchor="middle">کندل صعودی</text>
      <text x="368" y="30" fill="#fff" font-size="20" font-weight="700" text-anchor="start">بالاترین</text>
      <text x="368" y="150" fill="#fff" font-size="20" font-weight="700" text-anchor="start">بسته</text>
      <text x="368" y="335" fill="#fff" font-size="20" font-weight="700" text-anchor="start">باز</text>
      <text x="240" y="248" fill="#fff" font-size="20" font-weight="800" text-anchor="end">بدنه</text>
      <line x1="668" y1="20" x2="668" y2="410" stroke="{RED}" stroke-width="4"/>
      <rect x="618" y="150" width="100" height="180" rx="6" fill="{RED}"/>
      <text x="668" y="405" fill="{RED}" font-size="24" font-weight="800" text-anchor="middle">کندل نزولی</text>
      <text x="600" y="150" fill="#fff" font-size="20" font-weight="700" text-anchor="end">باز</text>
      <text x="600" y="335" fill="#fff" font-size="20" font-weight="700" text-anchor="end">بسته</text>
    </svg>"""
    cap = f'<div class="note">{caption}</div>' if caption else ""
    return f'<div style="text-align:center;">{svg}</div>' + cap


def tpl_pip_spread(caption: str = "") -> str:
    svg = f"""
    <svg width="{_W}" height="360" viewBox="0 0 {_W} 360">
      <line x1="60" y1="180" x2="908" y2="180" stroke="#2a3344" stroke-width="2"/>
      <line x1="320" y1="90" x2="320" y2="270" stroke="{RED}" stroke-width="4"/>
      <text x="320" y="70" fill="{RED}" font-size="26" font-weight="700" text-anchor="middle">فروش (Bid)</text>
      <text x="320" y="305" fill="#fff" font-size="30" font-weight="800" text-anchor="middle">1.08480</text>
      <line x1="648" y1="90" x2="648" y2="270" stroke="{GREEN}" stroke-width="4"/>
      <text x="648" y="70" fill="{GREEN}" font-size="26" font-weight="700" text-anchor="middle">خرید (Ask)</text>
      <text x="648" y="305" fill="#fff" font-size="30" font-weight="800" text-anchor="middle">1.08500</text>
      <line x1="320" y1="150" x2="648" y2="150" stroke="{GOLD}" stroke-width="3" stroke-dasharray="7 5"/>
      <text x="484" y="138" fill="{GOLD}" font-size="25" font-weight="800" text-anchor="middle">اسپرد = ۲ پیپ</text>
    </svg>"""
    cap = f'<div class="note">{caption}</div>' if caption else ""
    return f'<div style="text-align:center;">{svg}</div>' + cap


def tpl_vprofile(bars: Optional[list] = None, levels: Optional[list] = None,
                 caption: str = "") -> str:
    """پروفایل حجمی — هیستوگرامِ افقیِ «حجم در هر قیمت».

    bars:   [[y, frac, color]]   frac در 0..1 (نسبتِ پهنای میله)
    levels: [[y, label, color]]  خطِ افقی + «چیپِ» برچسب در سمت راست (POC/VAH/VAL)
    """
    bars = bars or []
    levels = levels or []
    h = 340
    maxw = 560
    s = f'<rect x="2" y="2" width="{_W-4}" height="{h-4}" rx="14" fill="{_CARD}" stroke="{_BORDER}"/>'
    for b in bars:
        y, frac, col = b
        w = max(10, float(frac) * maxw)
        s += (
            f'<rect x="18" y="{y-12:.0f}" width="{w:.0f}" height="24" rx="5" '
            f'fill="{col}" fill-opacity="0.85"/>'
        )
    for lv in levels:
        y, lab, col = lv
        s += (
            f'<line x1="18" y1="{y}" x2="{_W-14}" y2="{y}" stroke="{col}" '
            f'stroke-width="2" stroke-dasharray="6 5"/>'
            f'<rect x="{_W-208}" y="{y-17:.0f}" width="194" height="32" rx="8" '
            f'fill="#0d1422" stroke="{col}" stroke-width="1.5"/>'
            f'<text x="{_W-111}" y="{y+5:.0f}" fill="{col}" font-size="16" font-weight="700" '
            f'text-anchor="middle">{lab}</text>'
        )
    cap = f'<div class="note">{caption}</div>' if caption else ""
    return (
        f'<div style="text-align:center;"><svg width="{_W}" height="{h}" '
        f'viewBox="0 0 {_W} {h}">{s}</svg></div>' + cap
    )


TEMPLATES = {
    "infographic": tpl_infographic,
    "two_box": tpl_two_box,
    "table": tpl_table,
    "cards": tpl_cards,
    "panels": tpl_panels,
    "compare": tpl_compare,
    "steps": tpl_steps,
    "candles": tpl_candles,
    "chart": tpl_chart,
    "gauge_rr": tpl_gauge_rr,
    "anatomy": tpl_anatomy,
    "pip_spread": tpl_pip_spread,
    "vprofile": tpl_vprofile,
}


async def render_spec(spec: dict, out_name: str) -> Optional[str]:
    """spec را به PNG رندر و در edu_assets/<out_name>.png ذخیره می‌کند؛ مسیر یا None."""
    t = spec.get("t")
    fn = TEMPLATES.get(t)
    if fn is None:
        logger.error("edu_template_unknown", t=t)
        return None
    title = spec.get("title", "")
    subtitle = spec.get("subtitle", "")
    height = int(spec.get("height", 760))
    params = {k: v for k, v in spec.items() if k not in ("t", "title", "subtitle", "height")}
    try:
        body = fn(**params)
    except Exception as exc:  # noqa: BLE001
        logger.error("edu_template_build_error", t=t, error=str(exc))
        return None
    html = _frame(title, subtitle, body, height)

    os.makedirs(_ASSET_DIR, exist_ok=True)
    path = os.path.join(_ASSET_DIR, f"{out_name}.png")
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                _RENDER_URL, json={"html": html, "width": 1080, "height": height}
            )
        if resp.status_code != 200:
            logger.error("edu_render_failed", t=t, status=resp.status_code)
            return None
        with open(path, "wb") as f:
            f.write(resp.content)
        logger.info("edu_diagram_saved", out=out_name, bytes=len(resp.content))
        return path
    except Exception as exc:  # noqa: BLE001
        logger.error("edu_render_error", t=t, error=str(exc))
        return None
