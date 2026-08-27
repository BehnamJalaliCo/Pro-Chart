"""روترِ عمومیِ وب‌سایت — دادهٔ واقعیِ read-only بدونِ auth (برای سایتِ عمومی).

سیگنال‌ها/آمار/قیمت‌های لایو که در کانال هم عمومی‌اند، اینجا برای وب‌سایت سرو می‌شوند
بدونِ اینکه به API ادمین (که auth دارد) دست بزنیم. فقط فیلدهای غیرحساس.
"""

from __future__ import annotations

import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import html as _html
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.live import _is_vip, _verify_telegram_login
from src.core.config import settings
from src.core.redis_client import redis_client
from src.core.database import Signal, VisitEvent, async_session_factory
from src.core.security import create_access_token, verify_access_token
from src.core.visitor_analytics import classify_source, geo_lookup, hash_ip, parse_ua
from src.core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


# ════════════════════════════════════════════════════════════════
#  احرازِ هویتِ وب‌سایت با تلگرام — گِیتِ VIP برای بخشِ سیگنال‌ها
#  (آمار/عملکرد عمومی می‌ماند؛ فقط جزئیاتِ سیگنال نیازمندِ ورودِ VIP است)
# ════════════════════════════════════════════════════════════════
class WebsiteTelegramAuth(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


@router.get("/auth/config")
async def website_auth_config() -> dict:
    """پیکربندیِ ویجتِ ورودِ تلگرام برای وب‌سایت."""
    return {"bot_username": settings.TELEGRAM_BOT_USERNAME}


@router.post("/auth/telegram")
async def website_auth_telegram(body: WebsiteTelegramAuth, db: AsyncSession = Depends(get_db)) -> dict:
    """تأییدِ ورودِ تلگرام + بررسیِ VIP و صدورِ توکنِ وب‌سایت (۷ روزه)."""
    data = body.model_dump(exclude_none=True)
    if not _verify_telegram_login(data):
        raise HTTPException(status_code=401, detail="اعتبارسنجی ورود تلگرام ناموفق بود.")
    if time.time() - body.auth_date > 86400:
        raise HTTPException(status_code=401, detail="نشست ورود منقضی شده است. دوباره وارد شوید.")
    is_vip = await _is_vip(db, body.id)
    name = body.first_name or body.username or f"کاربر{body.id % 10000}"
    token = create_access_token(
        data={"sub": f"web:{body.id}", "scope": "website", "tg": body.id, "vip": is_vip},
        expires_delta=timedelta(days=7),
    )
    return {"token": token, "name": name, "is_vip": is_vip, "telegram_id": body.id}


def _website_payload(authorization: Optional[str]) -> Optional[dict]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    payload = verify_access_token(token)
    if not payload or payload.get("scope") != "website":
        return None
    return payload


async def require_vip(
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """دسترسیِ بخشِ سیگنال — توکنِ معتبرِ وب‌سایت + اشتراکِ فعالِ VIP (چکِ زندهٔ DB)."""
    payload = _website_payload(authorization)
    if not payload:
        raise HTTPException(status_code=401, detail="برای مشاهدهٔ سیگنال‌ها ابتدا با تلگرام وارد شوید.")
    tg = int(payload.get("tg", 0) or 0)
    if not tg or not await _is_vip(db, tg):
        raise HTTPException(
            status_code=403,
            detail="این بخش ویژهٔ اعضای VIP است. برای دسترسی، از ربات تلگرام اشتراک تهیه کنید.",
        )
    return payload

# دایرکتوریِ تصاویرِ آموزش (دیاگرام‌های آکادمی)
_EDU_DIR = os.environ.get("EDU_ASSETS_DIR", "/app/edu_assets")
_SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]+\.(png|jpg|jpeg|webp|svg)$")


_WINAGENT_DIR = os.environ.get("WINAGENT_DIR", "/app/winagent")
_WIN_SAFE = re.compile(r"^(bootstrap\.ps1|harden_windows\.ps1|coinepro_agent\.py|CoineProAutoTrader\.(ex5|mq5)|version\.txt|servers\.dat)$")


@router.get("/winagent/run/{code}")
async def public_winagent_run(code: str):
    """اسکریپتِ راه‌اندازیِ یک‌بارمصرف برای سرورِ ویندوز — با کدِ معتبر، توکن را امن
    تحویل می‌دهد (توکن در چت/URL عمومی نمی‌آید)."""
    from fastapi.responses import PlainTextResponse
    if not re.match(r"^[A-Za-z0-9]{8,40}$", code or ""):
        raise HTTPException(status_code=404, detail="not found")
    try:
        ok = await redis_client.client.get(f"winsetup:{code}")
    except Exception:  # noqa: BLE001
        ok = None
    if not ok:
        raise HTTPException(status_code=404, detail="invalid or expired code")
    api_base = "https://fx.trade-future.ir/api"
    token = settings.EA_TOKEN
    ps = (
        f"$Api='{api_base}'\n"
        f"$Token='{token}'\n"
        "iwr -UseBasicParsing \"$Api/public/winagent/bootstrap.ps1\" -OutFile C:\\bootstrap.ps1\n"
        "powershell -ExecutionPolicy Bypass -File C:\\bootstrap.ps1 -Api $Api -Token $Token\n"
    )
    return PlainTextResponse(ps)


@router.get("/winagent/{filename}")
async def public_winagent(filename: str):
    """سروِ فایل‌های راه‌اندازیِ سرورِ ویندوزِ کپی (bootstrap/agent/EA) برای bootstrap."""
    if not _WIN_SAFE.match(filename):
        raise HTTPException(status_code=404, detail="not found")
    path = os.path.join(_WINAGENT_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(path)


@router.get("/edu-asset/{filename}")
async def public_edu_asset(filename: str):
    """سروِ تصویرِ یک درسِ آموزشی (فقط نامِ امن، فقط از edu_assets)."""
    if not _SAFE_NAME.match(filename):
        raise HTTPException(status_code=400, detail="نام فایل نامعتبر است.")
    path = os.path.join(_EDU_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="تصویر یافت نشد.")
    return FileResponse(path, headers={"Cache-Control": "public, max-age=86400"})


_VIDEO_SAFE = re.compile(r"^[A-Za-z0-9._-]+\.(mp4|m3u8|ts|webm)$")


@router.get("/edu-video/{filename}")
async def public_edu_video(filename: str):
    """سروِ ویدیوی درس (از edu_assets). FileResponse از Range/seek پشتیبانی می‌کند."""
    if not _VIDEO_SAFE.match(filename):
        raise HTTPException(status_code=400, detail="نام فایل نامعتبر است.")
    path = os.path.join(_EDU_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="ویدیو یافت نشد.")
    return FileResponse(path, headers={"Cache-Control": "private, max-age=3600"})


_IG_DIR = os.environ.get("IG_MEDIA_DIR", "/app/ig_media")
_IG_SAFE = re.compile(r"^[A-Za-z0-9._-]+\.(png|jpg|jpeg|webp|mp4)$")


@router.get("/ig-media/{filename}")
async def public_ig_media(filename: str):
    """سروِ رسانهٔ اینستاگرام (کاور/تصویرِ آپلودی) — نامِ امن، فقط از ig_media."""
    if not _IG_SAFE.match(filename):
        raise HTTPException(status_code=400, detail="نام فایل نامعتبر است.")
    path = os.path.join(_IG_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="یافت نشد.")
    return FileResponse(path, headers={"Cache-Control": "private, max-age=3600"})


_ICON_COLORFUL = ("fluent-emoji", "fluent-emoji-flat", "noto", "noto-v1", "twemoji", "emojione",
                  "openmoji", "fxemoji", "logos", "skill-icons", "cryptocurrency-color",
                  "flat-color-icons", "vscode-icons", "devicon", "circle-flags", "unjs")
_ICON_ID = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?:[a-z0-9]([a-z0-9-]*[a-z0-9])?$")


@router.get("/icon")
async def public_icon(id: str = Query(...), h: int = Query(72), color: str = Query(None)):
    """پراکسیِ آیکنِ Iconify (شفاف) — تا مرورگرِ کاربر مستقیم به api.iconify.design نزند (دورزدنِ فیلترینگ)."""
    if not _ICON_ID.match(id or ""):
        raise HTTPException(status_code=400, detail="آیکن نامعتبر است.")
    h = min(max(int(h), 16), 1200)
    ckey = f"ig:icon:{id}:{h}:{color or ''}"
    cached = await redis_client.get_json(ckey)
    if cached and cached.get("svg"):
        return Response(content=cached["svg"], media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=86400"})
    params = {"height": str(h)}
    if color and id.split(":")[0] not in _ICON_COLORFUL:
        params["color"] = color
    try:
        async with httpx.AsyncClient(timeout=15) as cl:
            r = await cl.get(f"https://api.iconify.design/{id.replace(':', '/')}.svg", params=params)
            r.raise_for_status()
            svg = r.text
    except Exception:
        raise HTTPException(status_code=502, detail="دریافتِ آیکن ناموفق بود.")
    try:
        await redis_client.set_json(ckey, {"svg": svg}, expire=86400)
    except Exception:
        pass
    return Response(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=86400"})


_SYMLOGO_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9/_-]{0,80}$")


@router.get("/symbol-logo")
async def public_symbol_logo(id: str = Query(...)):
    """پراکسی+کشِ لوگوی برندِ نماد (لایهٔ ۲) — لوگوی سهام/ETF/شاخص/کریپتو را از CDN عمومیِ نمادها
    می‌گیرد و روی سرورِ خودمان کش می‌کند تا مرورگر مستقیم به CDN نزند و پایدار/بی‌فیلترینگ بماند.
    لوگوها علامتِ تجاریِ خودِ شرکت/دارایی‌اند و برای شناساییِ نماد استفاده می‌شوند (استفادهٔ اسمی)."""
    if not _SYMLOGO_ID.match(id or "") or ".." in id:
        raise HTTPException(status_code=400, detail="شناسهٔ لوگو نامعتبر است.")
    ckey = f"pc:symlogo:{id}"
    cached = await redis_client.get_json(ckey)
    if cached and cached.get("svg"):
        return Response(content=cached["svg"], media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=604800"})
    svg = None
    try:
        async with httpx.AsyncClient(timeout=15) as cl:
            for variant in (f"{id}--big.svg", f"{id}.svg"):
                r = await cl.get(f"https://s3-symbol-logo.tradingview.com/{variant}")
                if r.status_code == 200 and "svg" in r.headers.get("content-type", ""):
                    svg = r.text
                    break
    except Exception:
        svg = None
    if not svg:
        raise HTTPException(status_code=404, detail="لوگوی نماد یافت نشد.")
    try:
        await redis_client.set_json(ckey, {"svg": svg}, expire=604800)
    except Exception:
        pass
    return Response(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=604800"})


@router.get("/symbol-catalog")
async def public_symbol_catalog():
    """نگاشتِ نمادِ کریپتو → logoidِ TradingView (برای فرانت تا لوگوی برندِ هر کوین را نشان دهد).
    منبع: کاتالوگِ کش‌شدهٔ TV در Redis (که workerِ کریپتو خودبه‌خود با نمادهای جدید سینک می‌کند)."""
    try:
        from src.api.routes._tv_catalog import logoid_map
        m = await logoid_map()
    except Exception:  # noqa: BLE001
        m = {}
    from fastapi.responses import JSONResponse
    return JSONResponse({"crypto": m}, headers={"Cache-Control": "public, max-age=3600"})


@router.get("/go/{code}")
async def go_link(code: str):
    """صفحهٔ واسطِ دکمهٔ دایرکت — اینستاگرام تگِ OG را می‌خواند و کارتِ کلیک‌شونده با «عنوانِ دکمه»
    نشان می‌دهد؛ کاربر که ضربه زد، به لینکِ اصلی هدایت می‌شود."""
    if not re.match(r"^[A-Za-z0-9]{6,20}$", code or ""):
        return RedirectResponse("https://fx.trade-future.ir")
    data = await redis_client.get_json(f"ig:go:{code}")
    if not data or not data.get("url"):
        return RedirectResponse("https://fx.trade-future.ir")
    label = _html.escape((data.get("label") or "CoinePro FX")[:80])
    url = str(data["url"])
    url_attr = _html.escape(url, quote=True)
    import json as _json
    page = (f'<!doctype html><html lang="fa"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<meta property="og:title" content="{label}">'
            f'<meta property="og:description" content="برای ورود ضربه بزنید 👆">'
            f'<meta property="og:type" content="website">'
            f'<meta property="og:site_name" content="CoinePro FX">'
            f'<meta name="twitter:card" content="summary">'
            f'<title>{label}</title>'
            f'<meta http-equiv="refresh" content="0;url={url_attr}">'
            f'<script>location.replace({_json.dumps(url)})</script></head>'
            f'<body style="font-family:sans-serif;text-align:center;padding-top:40px">'
            f'<p>در حالِ انتقال به «{label}»…</p>'
            f'<p><a href="{url_attr}">اگر منتقل نشدید، اینجا بزنید</a></p></body></html>')
    return HTMLResponse(page)


def _pub_signal(s: Signal) -> dict:
    """فقط فیلدهای عمومیِ یک سیگنال."""
    return {
        "id": s.id,
        "symbol": s.symbol,
        "direction": s.direction,
        "signal_type": s.signal_type,
        "entry_price": s.entry_price,
        "sl": s.sl,
        "tp1": s.tp1,
        "tp2": s.tp2,
        "tp3": s.tp3,
        "signal_score": s.signal_score,
        "timeframe": s.timeframe,
        "status": s.status,
        "close_reason": s.close_reason,
        "pnl_pips": float(s.pnl_pips) if s.pnl_pips is not None else None,
        "hit_target": s.hit_target,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "closed_at": s.closed_at.isoformat() if s.closed_at else None,
    }


def _dir_sign(direction: str | None) -> int:
    return -1 if (direction or "").lower() in ("sell", "short") else 1


async def _live_price_map(db: AsyncSession, symbols: list[str]) -> dict[str, float]:
    """آخرین قیمتِ هر نماد — اول از redis (تیک)، در نبودش از آخرین کندلِ M15."""
    out: dict[str, float] = {}
    for sym in symbols:
        try:
            p = await redis_client.get_price(sym)
        except Exception:
            p = None
        if p:
            if p.get("bid") is not None and p.get("ask") is not None:
                out[sym] = (float(p["bid"]) + float(p["ask"])) / 2.0
            elif p.get("price") is not None:
                out[sym] = float(p["price"])
    missing = [s for s in symbols if s not in out]
    if missing:
        try:
            rows = (await db.execute(
                text(
                    "SELECT DISTINCT ON (symbol) symbol, close FROM candles "
                    "WHERE timeframe='M15' AND symbol = ANY(:s) ORDER BY symbol, time DESC"
                ),
                {"s": missing},
            )).all()
            for sym, close in rows:
                if close is not None:
                    out[sym] = float(close)
        except Exception:
            pass
    return out


@router.get("/signals/active")
async def public_active_signals(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    vip: dict = Depends(require_vip),
):
    """سیگنال‌های فعالِ فعلی + قیمتِ زنده و سود/زیانِ لحظه‌ای — فقط VIP."""
    rows = (
        await db.execute(
            select(Signal)
            .where(Signal.status == "active")
            .order_by(desc(Signal.created_at))
            .limit(limit)
        )
    ).scalars().all()
    prices = await _live_price_map(db, list({s.symbol for s in rows}))
    items = []
    for s in rows:
        item = _pub_signal(s)
        item["current_price"] = None
        item["pnl_percent"] = None
        item["pnl_pips_live"] = item.get("pnl_pips")
        cur = prices.get(s.symbol)
        entry = item.get("entry_price")
        if cur is not None and entry:
            entry = float(entry)
            item["current_price"] = round(cur, 6)
            if entry:
                item["pnl_percent"] = round((cur - entry) / entry * 100.0 * _dir_sign(item.get("direction")), 3)
        items.append(item)
    return {"items": items, "count": len(rows)}


@router.get("/signals/recent")
async def public_recent_signals(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    vip: dict = Depends(require_vip),
):
    """آخرین سیگنال‌ها (فعال + بسته‌شده) به‌ترتیبِ زمان — فقط VIP."""
    rows = (
        await db.execute(
            select(Signal).order_by(desc(Signal.created_at)).limit(limit)
        )
    ).scalars().all()
    return {"items": [_pub_signal(s) for s in rows], "count": len(rows)}


@router.get("/signals/stats")
async def public_signal_stats(db: AsyncSession = Depends(get_db)):
    """آمارِ واقعیِ عملکردِ سیگنال‌ها (از جدول signals)."""
    total = (await db.execute(select(func.count(Signal.id)))).scalar() or 0
    active = (
        await db.execute(select(func.count(Signal.id)).where(Signal.status == "active"))
    ).scalar() or 0
    closed = (
        await db.execute(
            select(func.count(Signal.id)).where(Signal.status == "closed")
        )
    ).scalar() or 0
    wins = (
        await db.execute(
            select(func.count(Signal.id)).where(Signal.pnl_pips > 0)
        )
    ).scalar() or 0
    losses = (
        await db.execute(
            select(func.count(Signal.id)).where(Signal.pnl_pips <= 0)
        )
    ).scalar() or 0
    total_pips = (
        await db.execute(select(func.coalesce(func.sum(Signal.pnl_pips), 0)))
    ).scalar() or 0
    decided = wins + losses
    win_rate = round(wins / decided * 100, 1) if decided else 0.0
    return {
        "total_signals": total,
        "active": active,
        "closed": closed,
        "wins": wins,
        "losses": losses,
        "win_rate": win_rate,
        "total_pips": round(float(total_pips), 1),
        "symbols_covered": len(settings.SYMBOLS),
    }


# نگاشتِ نمادِ داخلی → نمایش وب
_DISPLAY = {
    "XAUUSD": "XAU/USD", "XAGUSD": "XAG/USD", "EURUSD": "EUR/USD", "GBPUSD": "GBP/USD",
    "USDJPY": "USD/JPY", "USDCHF": "USD/CHF", "AUDUSD": "AUD/USD", "NZDUSD": "NZD/USD",
    "USDCAD": "USD/CAD", "EURGBP": "EUR/GBP", "EURJPY": "EUR/JPY", "GBPJPY": "GBP/JPY",
    "AUDJPY": "AUD/JPY", "EURAUD": "EUR/AUD", "XTIUSD": "WTI Oil", "XNGUSD": "NatGas",
    "US30": "US30", "US500": "US500", "NAS100": "NAS100", "DE40": "GER40",
}


# ════════════════════════════════════════════════════════════════
#  بک‌تستِ عمومی — «اگر با این سرمایه از سیگنال‌های ما پیروی می‌کردی»
#  بازپخشِ سیگنال‌های بسته‌شده با R-multipleِ واقعی و سرمایهٔ مرکب.
# ════════════════════════════════════════════════════════════════
class BacktestRequest(BaseModel):
    capital: float = Field(default=1000.0, ge=100, le=10_000_000)
    risk_pct: float = Field(default=2.0, ge=0.25, le=10.0)
    symbol: Optional[str] = None  # نمادِ خاص یا None برای همه


@router.post("/backtest/simulate")
async def public_backtest_simulate(body: BacktestRequest, db: AsyncSession = Depends(get_db)):
    """شبیه‌سازیِ سود/زیانِ سرمایهٔ کاربر اگر تمامِ سیگنال‌های بسته‌شدهٔ ما را
    با درصدِ ریسکِ ثابت در هر معامله دنبال می‌کرد. از نتیجهٔ واقعیِ هر سیگنال
    (pnl_pips) و فاصلهٔ ریسک (|ورود − حد ضرر|) برای محاسبهٔ R استفاده می‌شود."""
    from src.backtest.cost_model import CostModel

    # نمادِ ورودی باید از فهرستِ مجاز باشد (جلوگیری از سوءاستفاده/کوئریِ دلخواه)
    sym = (body.symbol or "").strip().upper() or None
    if sym and sym not in {s.upper() for s in settings.SYMBOLS}:
        raise HTTPException(status_code=400, detail="نماد نامعتبر است.")

    q = (
        select(Signal)
        .where(Signal.status == "closed", Signal.pnl_pips.isnot(None),
               Signal.entry_price.isnot(None), Signal.sl.isnot(None))
        .order_by(Signal.closed_at.asc().nullslast(), Signal.created_at.asc())
        .limit(5000)
    )
    if sym:
        q = q.where(Signal.symbol == sym)
    rows = (await db.execute(q)).scalars().all()

    cost = CostModel.default()
    start_cap = float(body.capital)
    cap = start_cap
    peak = start_cap
    max_dd = 0.0
    wins = 0
    losses = 0
    gross_profit = 0.0
    gross_loss = 0.0
    equity: list[dict] = [{"i": 0, "balance": round(cap, 2), "date": None}]
    trades: list[dict] = []
    blown = False

    for idx, s in enumerate(rows, start=1):
        pip_size = cost.profile(s.symbol).pip_size or 0.0001
        risk_price = abs(float(s.entry_price) - float(s.sl))
        if risk_price <= 0:
            continue
        r_mult = (float(s.pnl_pips) * pip_size) / risk_price
        # سقفِ منطقی روی R تا دادهٔ پرت نتیجه را منفجر نکند
        r_mult = max(-1.5, min(r_mult, 8.0))
        risk_amount = cap * (body.risk_pct / 100.0)
        pnl = risk_amount * r_mult
        cap += pnl
        if pnl >= 0:
            wins += 1
            gross_profit += pnl
        else:
            losses += 1
            gross_loss += -pnl
        if cap > peak:
            peak = cap
        dd = (peak - cap) / peak * 100.0 if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd
        d = s.closed_at or s.created_at
        equity.append({"i": idx, "balance": round(cap, 2),
                       "date": d.isoformat() if d else None})
        if len(trades) < 200:
            trades.append({
                "symbol": _DISPLAY.get(s.symbol, s.symbol),
                "direction": s.direction,
                "r_multiple": round(r_mult, 2),
                "pnl": round(pnl, 2),
                "balance": round(cap, 2),
                "pnl_pips": round(float(s.pnl_pips), 1),
                "date": d.isoformat() if d else None,
            })
        if cap <= 0:
            cap = 0.0
            blown = True
            break

    decided = wins + losses
    total = len(equity) - 1
    return {
        "initial_capital": round(start_cap, 2),
        "final_capital": round(cap, 2),
        "total_return_pct": round((cap - start_cap) / start_cap * 100.0, 2) if start_cap else 0.0,
        "profit": round(cap - start_cap, 2),
        "total_trades": total,
        "wins": wins,
        "losses": losses,
        "win_rate": round(wins / decided * 100.0, 1) if decided else 0.0,
        "max_drawdown_pct": round(max_dd, 2),
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else None,
        "risk_pct": body.risk_pct,
        "blown": blown,
        "equity_curve": equity,
        "trades": trades,
    }


@router.get("/prices/live")
async def public_live_prices(db: AsyncSession = Depends(get_db)):
    """قیمتِ لایوِ واقعی هر نماد (آخرین کندلِ M15) + تغییرِ روزانه (از فید CoinePro)."""
    syms = list(settings.SYMBOLS)
    cur = {
        r[0]: (float(r[1]), r[2])
        for r in (
            await db.execute(
                text(
                    "SELECT DISTINCT ON (symbol) symbol, close, time FROM candles "
                    "WHERE timeframe='M15' AND symbol = ANY(:s) ORDER BY symbol, time DESC"
                ),
                {"s": syms},
            )
        ).all()
    }
    prev = {
        r[0]: float(r[1])
        for r in (
            await db.execute(
                text(
                    "SELECT DISTINCT ON (symbol) symbol, close FROM candles "
                    "WHERE timeframe='D1' AND symbol = ANY(:s) "
                    "AND time < date_trunc('day', now()) ORDER BY symbol, time DESC"
                ),
                {"s": syms},
            )
        ).all()
    }
    asof = max((t for _, t in cur.values()), default=datetime.now(timezone.utc))
    items = []
    for sym in syms:
        if sym not in cur:
            continue
        price, _ = cur[sym]
        pc = prev.get(sym)
        chg = round((price - pc) / pc * 100, 2) if pc else 0.0
        items.append({
            "symbol": _DISPLAY.get(sym, sym),
            "raw_symbol": sym,
            "price": price,
            "change_pct": chg,
            "positive": chg >= 0,
        })
    return {"items": items, "as_of": asof.isoformat() if hasattr(asof, "isoformat") else None}


# ════════════════════════════════════════════════════════════════
#  آنالیتیکسِ بازدید — ثبتِ هر بازدیدِ صفحه (منبع/دستگاه/کشور)
#  بدونِ auth؛ بیکنِ سبک از فرانت. غنی‌سازی + درجِ DB در پس‌زمینه
#  تا پاسخ فوری برگردد و تجربهٔ کاربر کند نشود.
# ════════════════════════════════════════════════════════════════
class TrackBeacon(BaseModel):
    path: Optional[str] = Field(None, max_length=500)
    title: Optional[str] = Field(None, max_length=300)
    referrer: Optional[str] = Field(None, max_length=500)
    visitor_id: Optional[str] = Field(None, max_length=40)
    session_id: Optional[str] = Field(None, max_length=40)
    is_new_visitor: bool = False
    landing: bool = False
    utm_source: Optional[str] = Field(None, max_length=120)
    utm_medium: Optional[str] = Field(None, max_length=120)
    utm_campaign: Optional[str] = Field(None, max_length=120)
    lang: Optional[str] = Field(None, max_length=20)
    screen: Optional[str] = Field(None, max_length=20)


def _client_ip(request: Request) -> Optional[str]:
    """IPِ واقعیِ کلاینت پشتِ پراکسی‌ها (اولین hop در X-Forwarded-For)."""
    xff = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


async def _persist_visit(beacon: TrackBeacon, ip: Optional[str], ua: str) -> None:
    """غنی‌سازی + درجِ یک رویدادِ بازدید (در پس‌زمینه، با سشنِ مستقل)."""
    try:
        ua_info = parse_ua(ua)
        src = classify_source(beacon.referrer, beacon.utm_source, beacon.utm_medium,
                              settings.WEBSITE_DOMAIN.lower())
        geo = await geo_lookup(ip)  # best-effort، با کش
        ev = VisitEvent(
            visitor_id=beacon.visitor_id,
            session_id=beacon.session_id,
            is_new_visitor=bool(beacon.is_new_visitor),
            path=(beacon.path or "/")[:500],
            title=(beacon.title or None),
            referrer=(beacon.referrer or None),
            referrer_host=src.get("referrer_host") or None,
            source=src.get("source"),
            source_detail=src.get("source_detail"),
            utm_source=beacon.utm_source,
            utm_medium=beacon.utm_medium,
            utm_campaign=beacon.utm_campaign,
            landing=bool(beacon.landing),
            device=ua_info["device"],
            browser=ua_info["browser"],
            os=ua_info["os"],
            is_bot=ua_info["is_bot"],
            lang=beacon.lang,
            screen=beacon.screen,
            country=geo.get("country"),
            country_code=geo.get("country_code"),
            city=geo.get("city"),
            ip_hash=hash_ip(ip),
            user_agent=ua[:400] if ua else None,
        )
        async with async_session_factory() as s:
            s.add(ev)
            await s.commit()
    except Exception as exc:  # noqa: BLE001 — آنالیتیکس هرگز نباید چیزی را بشکند
        logger.warning("visit_persist_failed", error=str(exc))


@router.post("/track")
async def track_visit(
    beacon: TrackBeacon,
    request: Request,
    background: BackgroundTasks,
) -> dict:
    """ثبتِ بازدید — پاسخِ آنی، غنی‌سازی و درج در پس‌زمینه."""
    ip = _client_ip(request)
    ua = request.headers.get("user-agent", "")

    # گاردِ ساده ضدِ سیل: حداکثر ~۱۵۰ بازدید در دقیقه از هر IP
    try:
        if redis_client.client is not None and ip:
            import hashlib as _h
            rk = f"track:rl:{_h.md5(ip.encode(), usedforsecurity=False).hexdigest()}:{int(time.time() // 60)}"
            cnt = await redis_client.client.incr(rk)
            if cnt == 1:
                await redis_client.client.expire(rk, 90)
            if cnt > 150:
                return {"ok": True, "throttled": True}
    except Exception:  # noqa: BLE001
        pass

    background.add_task(_persist_visit, beacon, ip, ua)
    return {"ok": True}
