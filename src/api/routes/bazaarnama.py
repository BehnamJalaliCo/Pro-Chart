"""
بازارنما — APIِ سرورِ تریدینگ‌ویوِ ایرانی (درونِ آکادمی).

دادهٔ کندل/اندیکاتور از مسیرهای موجودِ academy می‌آید؛ این ماژول مالکیتِ
لِی‌اوت‌ها، اسکریپت‌های «نمااسکریپت»، واچ‌لیست‌ها و آلارم‌های هر دانشجو را مدیریت می‌کند.
همه پشتِ احرازِ دانشجو (scope=academy).
"""

from __future__ import annotations

import base64
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from sqlalchemy import func, select, text as _sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.academy import (
    _chart_rows,
    _current_price,
    _ema_list,
    _effective_tier,
    _ind_atr,
    _rsi_list,
    current_student,
)
from src.core.config import settings
from src.core.database import (
    AcademyKyc,
    AcademyKycDoc,
    AcademyStudent,
    AcademySupportTicket,
    AcademyVoucher,
    AcademyVoucherRedemption,
    BnAiSignal,
    BnAlert,
    BnLayout,
    BnScript,
    BnWatchlist,
)
from src.core.logger import get_logger
from src.core.security import create_access_token, verify_access_token
from src.llm.client import llm_client
from src.signals.candle_utils import drop_unclosed_candle_rows

router = APIRouter()
logger = get_logger(__name__)

# سهمیهٔ روزانهٔ سیگنالِ AI بر اساسِ تیر
_AI_QUOTA = {"vip": 2, "premium": 5}

# قابلیت‌های پرمیومِ بازارنما (کاربرِ عادی/free قفل است): اسکریپت‌نویسی، هوشِ مصنوعی،
# و ترید روی چارت (LBank). OneRoyal فقط مسیرِ معرفی است.
# فعال‌سازی: ثبت‌نام → واریز → تأییدِ مدیر (tier=vip/premium).
_PREMIUM_MSG = "این قابلیت ویژهٔ کاربرانِ پرمیومِ بازارنماست؛ پس از ثبت‌نام، واریز و تأییدِ مدیر فعال می‌شود."
_VIP_MSG = "این قابلیت با اشتراکِ پرو-چارت (VIP) فعال می‌شود."


def _prochart_active(st: "AcademyStudent") -> bool:
    # اشتراکِ پرو-چارت (تک‌سطحیِ VIP) فعال است؟ — با سازگاریِ عقب‌روِ tier قدیمی
    pu = getattr(st, "prochart_until", None)
    if pu is not None and pu > datetime.now(timezone.utc):
        return True
    return _effective_tier(st) in ("vip", "premium")


def _require_prochart(st: "AcademyStudent") -> None:
    # پرو-چارت VIP همه‌چیزِ اپ را باز می‌کند (سیگنال/AI/اسکریپت/معاملهٔ واقعی)
    if not _prochart_active(st):
        raise HTTPException(status_code=403,
                            detail={"msg": _PREMIUM_MSG, "premium_required": True})


# سازگاری: گِیت‌های قدیمی حالا = اشتراکِ پرو-چارت (تک‌سطحی)
def _require_vip(st: "AcademyStudent") -> None:
    _require_prochart(st)


def _require_premium(st: "AcademyStudent") -> None:
    _require_prochart(st)


def _norm_dir(d):
    return "buy" if str(d or "").lower() in ("long", "buy") else "sell"


@router.get("/signals")
async def bn_signals(market: str = "crypto", limit: int = 50,
                     st: AcademyStudent = Depends(current_student)):
    """فیدِ سیگنالِ یکپارچه (کریپتو/فارکس) — نیازمندِ اشتراکِ پرو-چارت."""
    _require_prochart(st)
    import os as _os, httpx as _httpx
    limit = max(1, min(int(limit or 50), 100))
    market = market if market in ("crypto", "forex") else "crypto"
    out = []
    try:
        async with _httpx.AsyncClient(timeout=6.0) as cx:
            if market == "crypto":
                base = _os.getenv("BN_CRYPTO_SVC_URL", "http://10.10.1.4:8000")
                r = await cx.get(base + "/api/demo/signals")  # demoِ کریپتو حداقلِ limit دارد → محلی برش می‌زنیم
                data = (r.json().get("signals", []) if r.status_code == 200 else [])
                for x in data[:limit]:
                    out.append({"id": f"cx-{x.get('id')}", "market": "crypto", "symbol": x.get("symbol"),
                                "direction": _norm_dir(x.get("direction")), "entry": x.get("entry_price"),
                                "sl": x.get("sl_price"),
                                "tps": [v for v in (x.get("tp1_price"), x.get("tp2_price")) if v is not None],
                                "confidence": x.get("confidence"), "status": x.get("status"),
                                "timeframe": x.get("timeframe"), "source": "tradeyar",
                                "created_at": x.get("created_at")})
            else:
                base = _os.getenv("BN_FOREX_SVC_URL", "http://10.10.1.3:8000")
                r = await cx.get(base + "/public/signals/svc", params={"limit": limit},
                                 headers={"X-Internal-Token": _os.getenv("BN_BRIDGE_TOKEN", "")})
                data = (r.json().get("items", []) if r.status_code == 200 else [])
                for x in data[:limit]:
                    out.append({"id": f"fx-{x.get('id')}", "market": "forex", "symbol": x.get("symbol"),
                                "direction": _norm_dir(x.get("direction")), "entry": x.get("entry_price"),
                                "sl": x.get("sl"),
                                "tps": [v for v in (x.get("tp1"), x.get("tp2"), x.get("tp3")) if v is not None],
                                "confidence": x.get("signal_score"), "status": x.get("status"),
                                "timeframe": x.get("timeframe"), "source": "coinepro-fx",
                                "created_at": x.get("created_at")})
    except Exception as e:  # noqa: BLE001
        logger.warning("bn_signals_fetch_failed", market=market, error=str(e))
    return {"market": market, "signals": out, "count": len(out)}


@router.get("/copytrade/status")
async def bn_copytrade_status(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """وضعیتِ کپی‌ترید؛ فارکس همیشه fail-closed و OneRoyal referral-only است."""
    from src.core.database import BnExchangeAccount
    accs = (await db.execute(select(BnExchangeAccount).where(BnExchangeAccount.student_id == st.id))).scalars().all()
    lbank = next((a for a in accs if a.kind == "lbank"), None)
    mt5 = next((a for a in accs if a.kind == "mt5"), None)
    now = datetime.now(timezone.utc)
    fx_sub = bool(getattr(st, "forex_copy_until", None) and st.forex_copy_until > now)
    ref_ok = bool(lbank and getattr(lbank, "referral_verified", False))
    forex = {
        "enabled": False,
        "connected": False,
        "subscription": False,
        "eligible": False,
        "integration_level": "referral_only",
        "referral_path": "/go/oneroyal",
        # فقط برای اطلاعِ خودِ کاربر؛ هیچ شناسه یا اتصالِ زنده‌ای بازگردانده نمی‌شود.
        "legacy_connection_present": bool(mt5),
        "legacy_subscription_active": fx_sub,
        "legacy_copy_was_enabled": bool(getattr(st, "copy_forex", False)),
    }
    return {
        "crypto": {"enabled": bool(getattr(st, "copy_crypto", False)),
                   "risk_pct": float(getattr(st, "copy_crypto_risk", 1.0) or 1.0),
                   "connected": bool(lbank), "referral_ok": ref_ok, "eligible": ref_ok},
        "forex": forex,
    }


@router.post("/copytrade/forex")
async def bn_copytrade_forex_disabled(st: AcademyStudent = Depends(current_student)):
    """Bodyless compatibility route: OneRoyal is referral-only."""
    del st
    raise HTTPException(status_code=410, detail={
        "msg": "کپی‌ترید OneRoyal/MT5 در بازارنما ارائه نمی‌شود؛ OneRoyal فقط لینک معرفی است.",
        "oneroyal_referral_only": True,
        "referral_path": "/go/oneroyal",
    })


@router.post("/copytrade/crypto")
async def bn_copytrade_set_crypto(payload: dict = Body(...),
                                  st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """روشن/خاموش‌کردن کپی‌ترید کریپتو؛ این مسیر هیچ بازار دیگری را نمی‌پذیرد."""
    from src.core.database import BnExchangeAccount
    enabled = bool(payload.get("enabled"))
    if enabled:
        try:
            from src.core.redis_client import redis_client as _rc_ks
            if await _rc_ks.client.get("bn:killswitch") in (b"1", "1"):
                raise HTTPException(503, {"msg": "اجرای معاملات موقتاً توسطِ مدیر متوقف شده است.", "killswitch": True})
        except HTTPException:
            raise
        except Exception:  # noqa: BLE001
            pass
    try:
        risk = float(payload.get("risk_pct", 1.0) or 1.0)
    except Exception:  # noqa: BLE001
        risk = 1.0
    risk = max(0.1, min(risk, 100.0))
    accs = (await db.execute(select(BnExchangeAccount).where(BnExchangeAccount.student_id == st.id))).scalars().all()
    lbank = next((a for a in accs if a.kind == "lbank"), None)
    if not (lbank and getattr(lbank, "referral_verified", False)):
        raise HTTPException(403, {"msg": "کپیِ کریپتو نیازمندِ اتصالِ LBank + تأییدِ رفرال است.", "premium_required": True})
    st.copy_crypto = enabled; st.copy_crypto_risk = risk
    await db.commit()
    return {"ok": True, "market": "crypto", "enabled": enabled, "risk_pct": risk,
            "note": "ثبت شد؛ اجرا با سیگنال‌های بعدیِ کریپتو"}


def _now():
    return datetime.now(timezone.utc)


# ─────────────────────────── قیمتِ زنده (Real-time) ───────────────────────────

@router.get("/referral-link")
async def referral_link(st: AcademyStudent = Depends(current_student)):
    """مسیر معرفی داخلی مناسب نوع حساب؛ OneRoyal صرفاً referral-only است."""
    import os as _o
    from src.api.routes.referrals import (
        REFERRAL_DISCLOSURE,
        REFERRAL_ELIGIBILITY,
        internal_referral_path,
    )
    at = getattr(st, "account_type", None)
    if at == "broker":
        return {"account_type": "broker", "broker": "OneRoyal",
                "url": internal_referral_path("oneroyal"),
                "integration_level": "referral_only",
                "disclosure": REFERRAL_DISCLOSURE,
                "eligibility": REFERRAL_ELIGIBILITY}
    return {"account_type": "crypto", "broker": "LBank",
            "url": internal_referral_path("lbank"),
            "disclosure": REFERRAL_DISCLOSURE,
            "eligibility": REFERRAL_ELIGIBILITY,
            "min_deposit": _o.getenv("LBANK_REFERRAL_MIN_DEPOSIT", "")}


async def _lbank_changes() -> dict:
    """٪ تغییرِ ۲۴سِ همهٔ جفت‌های LBank — یک fetch، کشِ ۶۰ثانیه (bn:lbchg)."""
    from src.core.redis_client import redis_client
    import json as _json
    try:
        c = await redis_client.get_json("bn:lbchg")
        if c:
            return c
    except Exception:  # noqa: BLE001
        pass
    res: dict = {}
    try:
        import httpx as _hx
        async with _hx.AsyncClient(timeout=10.0) as cli:
            r = await cli.get("https://api.lbkex.com/v2/ticker/24hr.do", params={"symbol": "all"})
            for row in (r.json().get("data") or []):
                sym = str(row.get("symbol", "")).replace("_", "").upper()
                tk = row.get("ticker") or {}
                if sym and tk.get("change") is not None:
                    try:
                        res[sym] = float(tk.get("change") or 0)
                    except Exception:  # noqa: BLE001
                        pass
        if res:
            await redis_client.client.set("bn:lbchg", _json.dumps(res), ex=60)
    except Exception:  # noqa: BLE001
        pass
    return res


async def _attach_change_pct(out: dict, db) -> None:
    """٪ تغییرِ ۲۴سِ علامت‌دار: کریپتو از LBank، فارکس از بستِ روزِ قبلِ candles."""
    from src.api.routes._crypto_feed import is_crypto
    crypto = [x for x in out if is_crypto(x)]
    forex = [x for x in out if not is_crypto(x)]
    if crypto:
        ch = await _lbank_changes()
        for x in crypto:
            v = ch.get(x.replace("_", "").upper())
            if v is not None:
                out[x]["change_pct"] = round(v, 3)
    if forex:
        from sqlalchemy import text as _text
        rows = (await db.execute(_text(
            "SELECT DISTINCT ON (symbol) symbol, close FROM candles "
            "WHERE symbol = ANY(:syms) AND timeframe='D1' "
            "AND time < date_trunc('day', now() at time zone 'UTC') "
            "ORDER BY symbol, time DESC"), {"syms": forex})).all()
        prev = {r[0]: float(r[1]) for r in rows if r[1] is not None}
        for x in forex:
            pc = prev.get(x); mid = out[x].get("mid")
            if pc and mid:
                out[x]["change_pct"] = round((float(mid) - pc) / pc * 100.0, 3)


@router.get("/prices")
async def live_prices(
    symbols: str = "",
    st: AcademyStudent = Depends(current_student),
    db: AsyncSession = Depends(get_db),
):
    """
    قیمتِ زندهٔ لحظه‌ای از Redis (همان تیک‌هایی که data-feed منتشر می‌کند).
    در ساعاتِ بستهٔ بازار خالی برمی‌گردد → فرانت «بازار بسته» نشان می‌دهد.
    """
    from src.core.redis_client import redis_client

    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()][:40]
    out = {}
    for s in syms:
        try:
            p = await redis_client.get_price(s)
        except Exception:  # noqa: BLE001
            p = None
        if not p:
            continue
        bid = float(p.get("bid") or p.get("price") or 0)
        ask = float(p.get("ask") or bid or 0)
        if not bid and not ask:
            continue
        mid = (bid + ask) / 2 if (bid and ask) else (bid or ask)
        out[s] = {"bid": bid, "ask": ask, "mid": round(mid, 8), "ts": p.get("ts") or p.get("timestamp")}
    # کریپتو (LBank) → قیمتِ لحظه‌ایِ مستقلِ دینامیک از LBank (۲۴/۷، بدونِ کلید/وایت‌لیست)
    try:
        from src.api.routes._crypto_feed import crypto_prices, is_crypto, ensure_pairs
        await ensure_pairs()
        crypto_syms = [s for s in syms if is_crypto(s) and s not in out]
        if crypto_syms:
            out.update(await crypto_prices(crypto_syms))
    except Exception:  # noqa: BLE001
        pass
    try:
        await _attach_change_pct(out, db)
    except Exception:  # noqa: BLE001
        pass
    return {"prices": out, "market_open": bool(out), "server_time": _now().isoformat()}


# ─────────────────── متادیتای نماد (name_fa/name_en/cat) ───────────────────
_CCY_FA = {"USD": "دلار", "EUR": "یورو", "GBP": "پوند", "JPY": "ین ژاپن", "CHF": "فرانک سوئیس",
           "AUD": "دلار استرالیا", "CAD": "دلار کانادا", "NZD": "دلار نیوزیلند", "CNH": "یوان چین",
           "SEK": "کرون سوئد", "NOK": "کرون نروژ", "TRY": "لیر ترکیه", "ZAR": "رند آفریقا",
           "MXN": "پزو مکزیک", "SGD": "دلار سنگاپور", "HKD": "دلار هنگ‌کنگ", "PLN": "زلوتی", "DKK": "کرون دانمارک"}
_METAL_FA = {"XAU": ("طلا", "Gold"), "XAG": ("نقره", "Silver"), "XPT": ("پلاتین", "Platinum"), "XPD": ("پالادیوم", "Palladium")}
_ENERGY_FA = {"WTI": ("نفت WTI", "Crude Oil WTI"), "BRENT": ("نفت برنت", "Brent Oil"),
              "USOIL": ("نفت WTI", "Crude Oil"), "UKOIL": ("نفت برنت", "Brent Oil"), "NGAS": ("گازِ طبیعی", "Natural Gas")}
_INDEX_FA = {"US30": ("داوجونز", "Dow 30"), "NAS100": ("نزدک ۱۰۰", "Nasdaq 100"), "US500": ("اس‌اند‌پی ۵۰۰", "S&P 500"),
             "SPX500": ("اس‌اند‌پی ۵۰۰", "S&P 500"), "GER40": ("دکسِ آلمان", "DAX 40"), "DE40": ("دکسِ آلمان", "DAX 40"),
             "UK100": ("فوتسیِ انگلیس", "FTSE 100"), "JPN225": ("نیکی ۲۲۵", "Nikkei 225"), "HK50": ("هنگ‌سنگ", "Hang Seng"),
             "AUS200": ("ASX 200", "ASX 200"), "FRA40": ("کک ۴۰", "CAC 40"), "EU50": ("یوروستاکس ۵۰", "Euro Stoxx 50"),
             "US2000": ("راسل ۲۰۰۰", "Russell 2000"), "USDX": ("شاخصِ دلار", "US Dollar Index")}
_CRYPTO_FA = {"BTC": "بیت‌کوین", "ETH": "اتریوم", "BNB": "بایننس‌کوین", "SOL": "سولانا", "XRP": "ریپل",
              "ADA": "کاردانو", "DOGE": "دوج‌کوین", "TRX": "ترون", "DOT": "پولکادات", "MATIC": "پالیگان",
              "LTC": "لایت‌کوین", "SHIB": "شیبا", "AVAX": "آوالانچ", "LINK": "چین‌لینک", "UNI": "یونی‌سواپ",
              "ATOM": "کازموس", "XLM": "استلار", "ETC": "اتریوم‌کلاسیک", "FIL": "فایل‌کوین", "APT": "اپتوس",
              "ARB": "آربیتروم", "OP": "آپتیمیزم", "NEAR": "نیر", "INJ": "اینجکتیو", "SUI": "سویی",
              "PEPE": "پپه", "WIF": "داگ‌ویف‌هت", "TON": "تون", "SEI": "سِی", "TIA": "سلستیا"}


def _classify_symbol(raw: str, fxset: set) -> dict:
    su = (raw or "").strip().upper()
    if not su:
        return {"symbol": raw, "cat": "other", "name_fa": raw, "name_en": raw}
    # فلز
    if su[:3] in _METAL_FA and (len(su) <= 6):
        fa, en = _METAL_FA[su[:3]]
        return {"symbol": su, "cat": "metal", "base": su[:3], "quote": su[3:] or "USD", "name_fa": fa, "name_en": en, "desc": fa}
    # انرژی
    for k, (fa, en) in _ENERGY_FA.items():
        if su.startswith(k):
            return {"symbol": su, "cat": "energy", "name_fa": fa, "name_en": en, "desc": fa}
    # شاخص
    if su in _INDEX_FA:
        fa, en = _INDEX_FA[su]
        return {"symbol": su, "cat": "index", "name_fa": fa, "name_en": en, "desc": fa}
    # کریپتو
    try:
        from src.api.routes._crypto_feed import is_crypto
        _isc = is_crypto(su)
    except Exception:  # noqa: BLE001
        _isc = su.endswith("USDT")
    if _isc:
        base = su.replace("_", "")
        for q in ("USDT", "USDC", "USD"):
            if base.endswith(q):
                base = base[:-len(q)]; quote = q; break
        else:
            quote = "USDT"
        fa = _CRYPTO_FA.get(base)
        return {"symbol": su, "cat": "crypto", "base": base, "quote": quote,
                "name_fa": (fa + f" ({base})") if fa else base, "name_en": base, "desc": (fa or base)}
    # فارکس (۶ حرفیِ ارزی)
    if len(su) == 6 and su.isalpha() and su[:3] in _CCY_FA and su[3:] in _CCY_FA:
        a, b = su[:3], su[3:]
        fa = f"{_CCY_FA[a]} / {_CCY_FA[b]}"
        return {"symbol": su, "cat": "forex", "base": a, "quote": b, "name_fa": fa, "name_en": f"{a}/{b}", "desc": fa}
    # سهام (نمادِ آلفا از فیدِ OneRoyal که فارکس/فلز/شاخص نبود)
    if su.isalpha() and su in fxset:
        return {"symbol": su, "cat": "stock", "name_fa": su, "name_en": su, "desc": f"سهامِ {su}"}
    return {"symbol": su, "cat": "other", "name_fa": su, "name_en": su, "desc": su}


@router.get("/symbol-meta")
async def bn_symbol_meta(symbols: str = "", st: AcademyStudent = Depends(current_student)):
    """متادیتای نماد {symbol, cat, name_fa, name_en, base, quote, desc} — برای merge در فرانت.
    بدونِ symbols → همهٔ نمادهای کاتالوگ (کریپتو + fxsyms)."""
    from src.core.redis_client import redis_client
    try:
        fxset = {str(x).upper() for x in (await redis_client.client.smembers("bn:fxsyms") or [])}
    except Exception:  # noqa: BLE001
        fxset = set()
    if symbols.strip():
        wanted = [s.strip().upper() for s in symbols.split(",") if s.strip()][:500]
    else:
        wanted = list(fxset)
        try:
            from src.api.routes._crypto_feed import ensure_pairs
            wanted += [str(c).upper() for c in await ensure_pairs()]
        except Exception:  # noqa: BLE001
            pass
    meta = {}
    for sym in wanted:
        meta[sym] = _classify_symbol(sym, fxset)
    return {"meta": meta, "count": len(meta)}


# ─────────────────── سفارش از روی چارت (trade-from-chart) ───────────────────
# فاز ۱+۲: اعتبارسنجی + R/R + پیش‌نمایش.  فاز ۳+۴: اجرای زنده روی حسابِ اتوترِیدِ مَستر.
# اجرای زنده دو گاردِ هم‌زمان دارد:
#   ۱) فلگِ سرور  BN_CHART_TRADING_LIVE=1
#   ۲) کلیدِ مالک  هدرِ X-BN-Owner-Key == BN_OWNER_KEY  (فقط مرورگرِ خودِ مالک داردش)
# سفارش به سرورِ اصلی (BN_MAIN_API) → /ea/manual-open فوروارد می‌شود که سیگنالِ
# signal_type=="manual" می‌سازد؛ آن سیگنال در /ea/signals فقط به مَستر سرو می‌شود و
# هرگز روی حساب‌های کپیِ کلاینت‌ها باز نمی‌شود (ایزولاسیونِ تست‌شده).

@router.post("/manual-order")
async def manual_order(
    request: Request,
    side: str = Body(..., embed=True),
    symbol: str = Body(..., embed=True),
    entry: float = Body(..., embed=True),
    sl: float = Body(..., embed=True),
    tp: float = Body(..., embed=True),
    st: AcademyStudent = Depends(current_student),
):
    """سفارشِ دستی از روی چارت — اعتبارسنجی + R/R + (اگر مالک و زنده) اجرا روی مَستر."""
    import os as _os

    side = (side or "").lower()
    if side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="جهتِ سفارش نامعتبر است.")
    ok = (side == "buy" and sl < entry < tp) or (side == "sell" and tp < entry < sl)
    if not ok:
        raise HTTPException(status_code=400, detail="ترتیبِ ورود/حدضرر/حدسود برای این جهت نامعتبر است.")
    risk = abs(entry - sl)
    reward = abs(tp - entry)
    rr = round(reward / risk, 2) if risk else 0.0
    sym = symbol.upper()

    live = _os.getenv("BN_CHART_TRADING_LIVE") == "1"
    owner_key = _os.getenv("BN_OWNER_KEY", "")
    req_key = request.headers.get("X-BN-Owner-Key", "")
    import hmac as _hmac
    is_owner = bool(owner_key) and bool(req_key) and _hmac.compare_digest(req_key, owner_key)

    # ترید روی چارت قابلیتِ پرمیوم است (کاربرِ free قفل). مالک با owner-key همیشه مجاز است.
    if not is_owner:
        _require_premium(st)

    # اجرای زنده فقط برای مالک (با کلید) و وقتی فلگ روشن است؛ بقیه → پیش‌نمایش
    if live and is_owner:
        main = _os.getenv("BN_MAIN_API", "https://fx.trade-future.ir/api").rstrip("/")
        bridge = _os.getenv("BN_BRIDGE_TOKEN", "")
        try:
            import httpx
            async with httpx.AsyncClient(timeout=8.0) as cli:
                r = await cli.post(
                    f"{main}/ea/manual-open",
                    json={"side": side, "symbol": sym, "entry": entry, "sl": sl, "tp1": tp},
                    headers={"X-Bridge-Token": bridge},
                )
            if r.status_code == 200:
                d = r.json()
                return {
                    "placed": True, "preview": False, "id": d.get("id"),
                    "side": side, "symbol": sym, "entry": entry, "sl": sl, "tp": tp, "rr": rr,
                    "reason": "سفارش روی حسابِ اتوترِیدِ شما (مَستر) ثبت شد.",
                }
            detail = "اجرای سفارش ناموفق بود."
            try:
                detail = r.json().get("detail", detail)
            except Exception:  # noqa: BLE001
                pass
            raise HTTPException(status_code=502, detail=detail)
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"ارتباط با سرورِ اجرا برقرار نشد: {exc}")

    # پیش‌نمایش (همهٔ کاربرانِ غیرِمالک، یا وقتی اجرای زنده خاموش است)
    return {
        "placed": False, "preview": True,
        "side": side, "symbol": sym, "entry": entry, "sl": sl, "tp": tp, "rr": rr,
        "reason": "حالتِ پیش‌نمایش — اعتبارسنجی انجام شد." if not live
        else "حالتِ پیش‌نمایش — این سفارش روی حسابِ معاملاتی اجرا نمی‌شود.",
    }


# ─────────────────────────── Layouts ───────────────────────────

@router.get("/layouts")
async def list_layouts(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BnLayout).where(BnLayout.student_id == st.id).order_by(BnLayout.updated_at.desc()))
    return [{"id": l.id, "name": l.name, "is_default": l.is_default,
             "updated_at": l.updated_at.isoformat() if l.updated_at else None} for l in res.scalars().all()]


@router.get("/layouts/{layout_id}")
async def get_layout(layout_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = await db.get(BnLayout, layout_id)
    if not l or l.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    return {"id": l.id, "name": l.name, "is_default": l.is_default, "data": l.data}


@router.post("/layouts")
async def save_layout(payload: dict = Body(...), st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    name = (payload.get("name") or "چیدمان").strip()[:120]
    data = payload.get("data") or {}
    lid = payload.get("id")
    if lid:
        l = await db.get(BnLayout, int(lid))
        if not l or l.student_id != st.id:
            raise HTTPException(404, "یافت نشد")
        l.name, l.data = name, data
    else:
        l = BnLayout(student_id=st.id, name=name, data=data)
        db.add(l)
    if payload.get("is_default"):
        # فقط یک پیش‌فرض
        res = await db.execute(select(BnLayout).where(BnLayout.student_id == st.id))
        for other in res.scalars().all():
            other.is_default = False
        l.is_default = True
    await db.commit()
    return {"ok": True, "id": l.id}


@router.post("/layouts/{layout_id}/rename")
async def rename_layout(layout_id: int, payload: dict = Body(...), st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """تغییرِ نامِ یک لِی‌اوت بدونِ لمسِ دادهٔ چیدمان (افزایشی؛ ایمن‌تر از POST /layouts که کلِ data را بازمی‌نویسد)."""
    l = await db.get(BnLayout, layout_id)
    if not l or l.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    name = (payload.get("name") or "").strip()[:120]
    if not name:
        raise HTTPException(400, "نام لازم است")
    l.name = name
    await db.commit()
    return {"ok": True, "id": l.id, "name": l.name}


@router.delete("/layouts/{layout_id}")
async def delete_layout(layout_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = await db.get(BnLayout, layout_id)
    if not l or l.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    await db.delete(l)
    await db.commit()
    return {"ok": True}


# ─────────────────────────── Scripts (نمااسکریپت) ───────────────────────────

_STARTER = """// نمااسکریپت — نمونه: کراسِ HMA
study("HMA Cross", overlay=true)
fast = ta.hma(close, 9)
slow = ta.hma(close, 21)
plot(fast, "HMA سریع", color.blue)
plot(slow, "HMA کند", color.orange)
buy  = crossover(fast, slow)
sell = crossunder(fast, slow)
plotshape(buy,  "خرید",  shape.up,   color.green)
plotshape(sell, "فروش",  shape.down, color.red)
alertcondition(buy,  "سیگنالِ خرید")
alertcondition(sell, "سیگنالِ فروش")
"""


@router.get("/scripts")
async def list_scripts(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BnScript).where(BnScript.student_id == st.id).order_by(BnScript.updated_at.desc()))
    items = [{"id": s.id, "name": s.name, "kind": s.kind, "enabled": s.enabled,
              "updated_at": s.updated_at.isoformat() if s.updated_at else None} for s in res.scalars().all()]
    return {"scripts": items, "starter": _STARTER}


@router.get("/scripts/{script_id}")
async def get_script(script_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    s = await db.get(BnScript, script_id)
    if not s or s.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    return {"id": s.id, "name": s.name, "kind": s.kind, "source": s.source, "enabled": s.enabled}


@router.post("/scripts")
async def save_script(payload: dict = Body(...), st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    _require_vip(st)  # اسکریپت‌نویسی قابلیتِ VIP است
    name = (payload.get("name") or "اسکریپت").strip()[:120]
    source = payload.get("source") or ""
    kind = payload.get("kind") if payload.get("kind") in ("indicator", "strategy") else "indicator"
    if len(source) > 40000:
        raise HTTPException(400, "اسکریپت بیش از حد بزرگ است.")
    sid = payload.get("id")
    if sid:
        s = await db.get(BnScript, int(sid))
        if not s or s.student_id != st.id:
            raise HTTPException(404, "یافت نشد")
        s.name, s.source, s.kind = name, source, kind
    else:
        # سقفِ ۵۰ اسکریپت per student
        cnt = len((await db.execute(select(BnScript.id).where(BnScript.student_id == st.id))).all())
        if cnt >= 50:
            raise HTTPException(429, "به سقفِ اسکریپت‌ها رسیدی.")
        s = BnScript(student_id=st.id, name=name, source=source, kind=kind)
        db.add(s)
    await db.commit()
    return {"ok": True, "id": s.id}


@router.delete("/scripts/{script_id}")
async def delete_script(script_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    s = await db.get(BnScript, script_id)
    if not s or s.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    await db.delete(s)
    await db.commit()
    return {"ok": True}


# ─────────────────────────── Watchlist ───────────────────────────

# #۱۱ کریپتو-CFDهای فارکس (BTCUSD/ETHUSD/…) از واچ‌لیستِ فارکس حذف می‌شوند (کریپتو از LBank به‌شکلِ *USDT می‌آید)
_WL_CRYPTO_CFD = re.compile(
    r'^(BTC|ETH|XRP|DOGE|SOL|LTC|BNB|ADA|DOT|MATIC|AVAX|LINK|TRX|BCH|XLM|ATOM|UNI|SHIB|PEPE|TON|NEAR)USD$'
)


def _clean_fx_wl(syms):
    """کریپتو-CFDهای فارکس را از واچ‌لیست بیرون می‌کشد (BTCUSDT و امثالش که واقعاً کریپتواند، می‌مانند)."""
    return [s for s in (syms or []) if not _WL_CRYPTO_CFD.match(str(s).upper())]


async def _get_or_make_wl(st, db) -> BnWatchlist:
    wl = (await db.execute(select(BnWatchlist).where(BnWatchlist.student_id == st.id).limit(1))).scalar_one_or_none()
    if not wl:
        wl = BnWatchlist(student_id=st.id, name="پیش‌فرض",
                         symbols=["EURUSD", "XAUUSD", "GBPUSD", "USDJPY", "USDCHF"])
        db.add(wl)
        await db.commit()
    return wl


@router.get("/watchlist")
async def get_watchlist(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    wl = await _get_or_make_wl(st, db)
    cleaned = _clean_fx_wl(wl.symbols or [])
    # اگر واچ‌لیستِ ذخیره‌شده کریپتو-CFD داشت، یک‌بار پاک‌سازی و persist کن
    if cleaned != (wl.symbols or []):
        wl.symbols = cleaned
        await db.commit()
    return {"id": wl.id, "name": wl.name, "symbols": cleaned}


@router.put("/watchlist")
async def set_watchlist(payload: dict = Body(...), st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    wl = await _get_or_make_wl(st, db)
    syms = payload.get("symbols")
    if isinstance(syms, list):
        wl.symbols = [str(s).upper()[:20] for s in syms][:50]
    await db.commit()
    return {"ok": True, "symbols": wl.symbols}


# ─────────────────────────── Alerts ───────────────────────────

@router.get("/alerts")
async def list_alerts(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BnAlert).where(BnAlert.student_id == st.id).order_by(BnAlert.created_at.desc()))
    return [{"id": a.id, "symbol": a.symbol, "tf": a.tf, "name": a.name, "condition": a.condition,
             "active": a.active, "last_triggered_at": a.last_triggered_at.isoformat() if a.last_triggered_at else None}
            for a in res.scalars().all()]


@router.post("/alerts")
async def create_alert(payload: dict = Body(...), st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    cond = payload.get("condition") or {}
    if not cond:
        raise HTTPException(400, "شرطِ آلارم لازم است.")
    a = BnAlert(student_id=st.id, symbol=(payload.get("symbol") or "EURUSD").upper()[:20],
                tf=(payload.get("tf") or "H1")[:8], name=(payload.get("name") or "")[:160] or None,
                condition=cond, active=True)
    db.add(a)
    await db.commit()
    return {"ok": True, "id": a.id}


@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    a = await db.get(BnAlert, alert_id)
    if not a or a.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    await db.delete(a)
    await db.commit()
    return {"ok": True}


# ─────────────────────────── سیگنالِ لحظه‌ایِ AI ───────────────────────────

def _rnd(p: float) -> float:
    a = abs(p)
    d = 2 if a >= 100 else 3 if a >= 10 else 5
    return round(p, d)


def _last(arr):
    for v in reversed(arr or []):
        if v is not None:
            return v
    return None


async def _ai_used_today(db, sid: int) -> int:
    start = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    rows = (await db.execute(select(BnAiSignal.id).where(
        BnAiSignal.student_id == sid, BnAiSignal.created_at >= start))).all()
    return len(rows)


def _sig_dict(s: BnAiSignal) -> dict:
    f = lambda x: float(x) if x is not None else None  # noqa: E731
    return {"id": s.id, "symbol": s.symbol, "tf": s.tf, "direction": s.direction,
            "entry": f(s.entry), "sl": f(s.sl), "tp1": f(s.tp1), "tp2": f(s.tp2), "tp3": f(s.tp3),
            "confidence": s.confidence, "reason": s.reason, "status": s.status, "hit": s.hit,
            "created_at": s.created_at.isoformat() if s.created_at else None}


@router.get("/ai-signal/quota")
async def ai_quota(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    tier = _effective_tier(st)
    limit = _AI_QUOTA.get(tier, 0)
    used = await _ai_used_today(db, st.id) if limit else 0
    return {"tier": tier, "limit": limit, "used": used, "remaining": max(0, limit - used)}


@router.get("/ai-signal/active")
async def ai_active(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BnAiSignal).where(BnAiSignal.student_id == st.id,
                                                    BnAiSignal.status != "deleted")
                           .order_by(BnAiSignal.created_at.desc()).limit(10))
    return [_sig_dict(s) for s in res.scalars().all()]


@router.post("/ai-signal")
async def ai_signal(payload: dict = Body(...), st: AcademyStudent = Depends(current_student),
                    db: AsyncSession = Depends(get_db)):
    """ستاپِ کاملِ AI در تایم‌فریمِ کاربر — ترکیبِ همگراییِ تکنیکال + هوشِ مصنوعی، SL/TP مبتنی بر ATR."""
    _require_vip(st)  # سیگنالِ AI قابلیتِ VIP است (free → مودالِ ارتقاء)
    tier = _effective_tier(st)
    limit = _AI_QUOTA.get(tier, 0)
    if not limit:
        raise HTTPException(403, {"msg": "سیگنالِ AI ویژهٔ اعضای پرمیوم است.", "premium_required": True})
    used = await _ai_used_today(db, st.id)
    if used >= limit:
        raise HTTPException(429, f"سهمیهٔ امروزِ سیگنالِ AI ({limit}) تمام شد؛ فردا دوباره.")

    symbol = (payload.get("symbol") or "EURUSD").upper()[:20]
    tf = (payload.get("tf") or "H1")[:8]
    candles = drop_unclosed_candle_rows(
        await _chart_rows(db, symbol, tf, limit=220),
        tf,
    )
    if len(candles) < 60:
        raise HTTPException(400, "دادهٔ کافی برای این نماد/تایم‌فریم نیست.")

    closes = [c["c"] for c in candles]
    highs = [c["h"] for c in candles]
    lows = [c["l"] for c in candles]
    price = (await _current_price(db, symbol)) or closes[-1]
    atr = _last(_ind_atr(candles, 14).get("atr")) or (price * 0.002)
    rsi = _last(_rsi_list(closes, 14)) or 50.0
    ema20 = _last(_ema_list(closes, 20)) or price
    ema50 = _last(_ema_list(closes, 50)) or price
    ema200 = _last(_ema_list(closes, 200)) or price
    sw_hi = max(highs[-20:]); sw_lo = min(lows[-20:])

    up = (ema20 > ema50) + (ema50 > ema200) + (rsi > 50) + (price > ema20)
    dn = (ema20 < ema50) + (ema50 < ema200) + (rsi < 50) + (price < ema20)
    tech_dir = "buy" if up >= 3 else "sell" if dn >= 3 else None
    conf_base = 50 + 9 * max(up, dn)

    # هوشِ مصنوعیِ پروژه (Claude) — جهت/اطمینان/دلیل (با fallback به تکنیکال)
    ai_dir, ai_reason, ai_conf = None, "", None
    try:
        from src.llm.client import llm_client
        summary = (
            f"نماد {symbol} تایم‌فریم {tf}. قیمت {_rnd(price)}. "
            f"RSI14={rsi:.0f}. EMA20={_rnd(ema20)} EMA50={_rnd(ema50)} EMA200={_rnd(ema200)}. "
            f"ATR={_rnd(atr)}. سقفِ ۲۰کندل={_rnd(sw_hi)} کفِ ۲۰کندل={_rnd(sw_lo)}."
        )
        sysp = ("تو تحلیل‌گرِ ارشدِ فارکسی. فقط یک خطِ JSON برگردان بدونِ توضیح: "
                '{"direction":"buy|sell|none","confidence":<۰تا۱۰۰>,"reason":"یک جملهٔ فارسیِ کوتاهِ تحلیلی"}')
        out = await llm_client.complete(summary, system=sysp, cache_ttl=0)
        if out:
            import json as _json
            mt = re.search(r"\{.*\}", out, re.S)
            if mt:
                j = _json.loads(mt.group(0))
                ai_dir = (j.get("direction") or "").lower()
                ai_conf = int(j.get("confidence") or 0)
                ai_reason = str(j.get("reason") or "")[:400]
    except Exception as exc:  # noqa: BLE001
        logger.warning("ai_signal_llm_failed", error=str(exc))

    # تصمیمِ نهایی: ترجیحِ همگراییِ AI+تکنیکال → موفقیتِ بالاتر
    if ai_dir in ("buy", "sell"):
        direction = ai_dir
        agree = (tech_dir == ai_dir)
        confidence = max(40, min(93, conf_base + (12 if agree else -12) + (ai_conf - 60) // 5 if ai_conf else conf_base))
    elif tech_dir:
        direction = tech_dir
        confidence = max(40, min(85, conf_base))
        ai_reason = ai_reason or "بر اساسِ همگراییِ روند و مومنتوم."
    else:
        raise HTTPException(422, "بازار جهتِ روشنی ندارد؛ فعلاً ستاپِ معتبری نیست (سهمیه مصرف نشد).")

    risk = max(atr * 1.2, price * 0.0015)
    if direction == "buy":
        entry, sl = price, price - risk
        tp1, tp2, tp3 = price + risk, price + 2 * risk, price + 3 * risk
    else:
        entry, sl = price, price + risk
        tp1, tp2, tp3 = price - risk, price - 2 * risk, price - 3 * risk

    sig = BnAiSignal(student_id=st.id, symbol=symbol, tf=tf, direction=direction,
                     entry=_rnd(entry), sl=_rnd(sl), tp1=_rnd(tp1), tp2=_rnd(tp2), tp3=_rnd(tp3),
                     confidence=int(confidence), reason=ai_reason or "ستاپِ تکنیکال.", status="active",
                     last_price=_rnd(price))
    db.add(sig)
    await db.commit()
    logger.info("ai_signal_created", sid=st.id, symbol=symbol, tf=tf, dir=direction, conf=int(confidence))
    out = _sig_dict(sig)
    out["remaining"] = max(0, limit - used - 1)
    return out


@router.delete("/ai-signal/{sig_id}")
async def ai_delete(sig_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    s = await db.get(BnAiSignal, sig_id)
    if not s or s.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    # حذفِ نرم: ردیف می‌مانَد تا سهمیهٔ روزانه پس‌داده نشود (هزینهٔ تولید قبلاً صرف شده).
    # فقط از فهرست/چارت پنهان می‌شود؛ _ai_used_today همچنان آن را می‌شمارد.
    s.status = "deleted"
    await db.commit()
    return {"ok": True}


# ─────────────────────────── اخبارِ بازار (فارسی، بدونِ عکس) ───────────────────────────

@router.get("/news")
async def bn_news():
    """مهم‌ترین اخبارِ مؤثر بر بازار، ترجمه/خلاصه‌شده به فارسی توسطِ news-worker.

    عمومی است (دادهٔ کاربری ندارد). منبع: Redis کلیدِ bn:news. بدونِ عکس.
    """
    from src.core.redis_client import redis_client
    try:
        items = await redis_client.get_json("bn:news")
        return {"items": items or []}
    except Exception:
        return {"items": []}


@router.get("/calendar")
async def bn_calendar():
    """تقویمِ اقتصادیِ هفتگی (رویدادهای مؤثر بر بازار)، عنوان‌ها فارسی‌شده توسطِ news-worker.

    عمومی. منبع: Redis کلیدِ bn:calendar (دادهٔ واقعیِ faireconomy/ForexFactory).
    """
    from src.core.redis_client import redis_client
    try:
        items = await redis_client.get_json("bn:calendar")
        return {"items": items or []}
    except Exception:
        return {"items": []}


@router.get("/fundamentals")
async def bn_fundamentals(symbol: str = ""):
    """داده‌های بنیادیِ سهام (P/E، EPS، درآمد به‌ازای سهم، Market Cap، حاشیه‌ها،
    ROE/ROA، سود تقسیمی، بتا، بدهی به حقوقِ صاحبانِ سهام و بازهٔ ۵۲هفته) از Finnhub.

    عمومی (دادهٔ کاربری ندارد). Finnhubِ رایگان فقط برای سهامِ آمریکا داده دارد؛
    کریپتو/فارکس/نمادِ ناموجود ⇒ available=False. کشِ ۱۰دقیقه در Redis (bn:fund:{SYM}).
    """
    import os as _os

    from src.core.redis_client import redis_client
    sym = re.sub(r"[^A-Za-z0-9.\-]", "", (symbol or "").upper())[:15]
    if not sym:
        return {"available": False, "symbol": ""}
    ckey = f"bn:fund:{sym}"
    try:
        cached = await redis_client.get_json(ckey)
        if cached:
            return cached
    except Exception:  # noqa: BLE001
        pass
    key = _os.getenv("FINNHUB_API_KEY", "")
    if not key:
        return {"available": False, "symbol": sym, "reason": "no-key"}
    out = {"available": False, "symbol": sym}
    try:
        import httpx as _hx
        async with _hx.AsyncClient(timeout=8.0) as cli:
            mr = await cli.get("https://finnhub.io/api/v1/stock/metric",
                               params={"symbol": sym, "metric": "all", "token": key})
            pr = await cli.get("https://finnhub.io/api/v1/stock/profile2",
                               params={"symbol": sym, "token": key})
        m = ((mr.json() or {}).get("metric", {}) or {}) if mr.status_code == 200 else {}
        p = (pr.json() or {}) if pr.status_code == 200 else {}

        def g(*keys):
            for k in keys:
                v = m.get(k)
                if v is not None:
                    try:
                        return float(v)
                    except (TypeError, ValueError):
                        return v
            return None

        mcap_m = p.get("marketCapitalization")  # واحد: میلیون
        metrics = {
            "peTTM": g("peTTM", "peBasicExclExtraTTM"),
            "epsTTM": g("epsTTM", "epsBasicExclExtraItemsTTM"),
            "pbAnnual": g("pbAnnual", "pbQuarterly"),
            "psTTM": g("psTTM", "psAnnual"),
            "roeTTM": g("roeTTM"),
            "roaTTM": g("roaTTM"),
            "netMarginTTM": g("netProfitMarginTTM"),
            "grossMarginTTM": g("grossMarginTTM"),
            "revenuePerShareTTM": g("revenuePerShareTTM"),
            "dividendYieldTTM": g("currentDividendYieldTTM", "dividendYieldIndicatedAnnual"),
            "beta": g("beta"),
            "debtToEquity": g("totalDebt/totalEquityAnnual", "longTermDebt/equityAnnual"),
            "week52High": g("52WeekHigh"),
            "week52Low": g("52WeekLow"),
            "marketCap": (float(mcap_m) * 1_000_000) if mcap_m else None,
        }
        prof = {
            "name": p.get("name"),
            "industry": p.get("finnhubIndustry"),
            "exchange": p.get("exchange"),
            "currency": p.get("currency"),
            "shareOutstanding": p.get("shareOutstanding"),
            "weburl": p.get("weburl"),
        }
        has = any(v is not None for v in metrics.values()) or bool(prof.get("name"))
        out = {"available": bool(has), "symbol": sym, "metrics": metrics, "profile": prof}
    except Exception:  # noqa: BLE001
        out = {"available": False, "symbol": sym}
    try:
        await redis_client.set_json(ckey, out, expire=600)
    except Exception:  # noqa: BLE001
        pass
    return out


# ═══════════════════ پنلِ ادمینِ بازارنما (تأییدِ پرمیوم) ═══════════════════
# احراز با رمزِ BN_ADMIN_PASSWORD → توکنِ scope=bn_admin (۱۲ ساعت).
import os as _os_admin
import hmac as _hmac_admin


def _bn_admin_user() -> str:
    # نام‌کاربریِ ادمینِ بازارنما (پیش‌فرض behnamjalali؛ در آینده برای سوپرادمین/چند ادمین قابلِ گسترش)
    return _os_admin.getenv("BN_ADMIN_USERNAME", "behnamjalali")


def _bn_admin_pw() -> str:
    return _os_admin.getenv("BN_ADMIN_PASSWORD", "")


async def current_bn_admin(authorization: str | None = Header(None)) -> bool:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="ورودِ ادمین لازم است.")
    p = verify_access_token(authorization.split(" ", 1)[1].strip())
    if not p or p.get("scope") != "bn_admin":
        raise HTTPException(status_code=401, detail="توکنِ ادمینِ نامعتبر.")
    return True


@router.post("/admin/login")
async def bn_admin_login(username: str = Body("", embed=True), password: str = Body(..., embed=True)):
    exp_user = _bn_admin_user()
    exp_pw = _bn_admin_pw()
    ok_user = _hmac_admin.compare_digest((username or "").strip().lower(), (exp_user or "").strip().lower())
    ok_pw = bool(exp_pw) and _hmac_admin.compare_digest(password or "", exp_pw)
    if not (ok_user and ok_pw):
        raise HTTPException(status_code=403, detail="نام‌کاربری یا رمزِ ادمین نادرست است.")
    token = create_access_token({"sub": (username or "").strip() or exp_user, "scope": "bn_admin"},
                                expires_delta=timedelta(hours=12))
    return {"token": token}


@router.get("/admin/users")
async def bn_admin_users(q: str = "", _: bool = Depends(current_bn_admin),
                         db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(AcademyStudent).order_by(AcademyStudent.created_at.desc()).limit(1000)
    )).scalars().all()
    out, ql = [], (q or "").lower().strip()
    for s in rows:
        uname = s.username or ""
        if uname.startswith("student-9"):
            continue  # مهمان‌های موقت را نشان نده
        if ql and ql not in uname.lower() and ql not in (s.email or "").lower() and ql not in (s.full_name or "").lower():
            continue
        out.append({
            "id": s.id, "username": uname, "email": s.email, "full_name": s.full_name,
            "tier": s.tier, "status": s.status,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "last_login_at": s.last_login_at.isoformat() if s.last_login_at else None,
        })
    return {"users": out, "count": len(out)}


@router.post("/admin/set-tier")
async def bn_admin_set_tier(student_id: int = Body(..., embed=True),
                            tier: str = Body(..., embed=True),
                            days: int = Body(30, embed=True),
                            _: bool = Depends(current_bn_admin),
                            db: AsyncSession = Depends(get_db)):
    if tier not in ("free", "vip", "premium"):
        raise HTTPException(status_code=400, detail="تیرِ نامعتبر.")
    s = await db.get(AcademyStudent, int(student_id))
    if not s:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    s.tier = tier
    if tier == "free":
        s.expires_at = None
    elif days and int(days) > 0:
        s.expires_at = datetime.now(timezone.utc) + timedelta(days=int(days))
    await db.commit()
    logger.info("bn_admin_set_tier", sid=s.id, tier=tier, days=days)
    return {"ok": True, "id": s.id, "tier": s.tier,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None}


@router.post("/admin/set-status")
async def bn_admin_set_status(student_id: int = Body(..., embed=True),
                              status: str = Body(..., embed=True),
                              _: bool = Depends(current_bn_admin),
                              db: AsyncSession = Depends(get_db)):
    if status not in ("active", "disabled"):
        raise HTTPException(status_code=400, detail="وضعیتِ نامعتبر.")
    s = await db.get(AcademyStudent, int(student_id))
    if not s:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    s.status = status
    await db.commit()
    return {"ok": True, "id": s.id, "status": s.status}


@router.post("/admin/set-referral")
async def bn_admin_set_referral(student_id: int = Body(..., embed=True),
                                kind: str = Body("lbank", embed=True),
                                verified: bool = Body(True, embed=True),
                                _: bool = Depends(current_bn_admin),
                                db: AsyncSession = Depends(get_db)):
    """override دستیِ تأییدِ رفرال توسطِ مدیر (وقتی API هنوز وایت‌لیست نشده)."""
    from src.core.database import BnExchangeAccount
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == int(student_id),
        BnExchangeAccount.kind == kind))).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="حسابِ متصل یافت نشد.")
    a.referral_verified = bool(verified)
    a.note = "تأییدِ دستیِ مدیر" if verified else "ردِ رفرال توسطِ مدیر"
    await db.commit()
    return {"ok": True, "student_id": a.student_id, "kind": kind, "referral_verified": a.referral_verified}


@router.get("/admin/orders")
async def bn_admin_orders(status: str = "", market: str = "", limit: int = 100,
                          _: bool = Depends(current_bn_admin),
                          db: AsyncSession = Depends(get_db)):
    """سفارش‌های تریدِ واقعیِ بازارنما (کریپتو/فارکس) برای اشرافِ مدیر."""
    from src.core.database import BnOrder
    q = select(BnOrder).order_by(BnOrder.id.desc())
    if status:
        q = q.where(BnOrder.status == status)
    if market:
        q = q.where(BnOrder.market == market)
    rows = (await db.execute(q.limit(min(int(limit or 100), 500)))).scalars().all()
    sids = {r.student_id for r in rows}
    names = {}
    if sids:
        for s in (await db.execute(select(AcademyStudent).where(AcademyStudent.id.in_(sids)))).scalars().all():
            names[s.id] = s.username or s.email
    out = [{"id": r.id, "user": names.get(r.student_id), "market": r.market, "broker": r.broker,
            "account_ref": r.account_ref, "symbol": r.symbol, "side": r.side, "amount": r.amount,
            "price": r.price, "status": r.status, "broker_order_id": r.broker_order_id,
            "error": r.error, "created_at": r.created_at.isoformat() if r.created_at else None}
           for r in rows]
    return {"orders": out, "count": len(out)}


# ═══════════════ جایگاه‌های تبلیغاتیِ منو (#۱۴ — مدیریت‌پذیر از ادمین) ═══════════════
@router.get("/ads")
async def bn_ads():
    """جایگاه‌های تبلیغاتیِ منوی همبرگری (لوگوی صرافی/وان‌رویال + متن + لینک). از Redis."""
    from src.core.redis_client import redis_client
    import json as _j
    try:
        raw = await redis_client.client.get("bn:ads")
        return {"slots": _j.loads(raw) if raw else {}}
    except Exception:  # noqa: BLE001
        return {"slots": {}}


@router.post("/admin/ads")
async def bn_admin_set_ads(slot: str = Body(..., embed=True), logo: str = Body("", embed=True),
                           text: str = Body("", embed=True), link: str = Body("", embed=True),
                           active: bool = Body(True, embed=True), _: bool = Depends(current_bn_admin)):
    """تنظیمِ یک جایگاهِ تبلیغاتی توسطِ ادمین."""
    from src.core.redis_client import redis_client
    import json as _j
    try:
        raw = await redis_client.client.get("bn:ads"); d = _j.loads(raw) if raw else {}
    except Exception:  # noqa: BLE001
        d = {}
    if not active and slot in d:
        del d[slot]
    else:
        d[slot] = {"logo": logo, "text": text, "link": link, "active": True}
    await redis_client.client.set("bn:ads", _j.dumps(d))
    return {"ok": True, "slots": d}


# ═══════════════ پرداختِ خودکارِ اشتراک (USDT روی BSC) #222 ═══════════════
async def _notify_support(text: str) -> None:
    """پیامِ بهترین‌تلاش به پشتیبانی/ادمین در تلگرام."""
    import os as _o
    token = _o.getenv("TELEGRAM_BOT_TOKEN", "") or _o.getenv("BOT_TOKEN", "")
    chat = _o.getenv("BN_SUPPORT_CHAT_ID", "") or _o.getenv("TELEGRAM_ADMIN_ID", "") or "51213927"
    if not token:
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=8.0) as cli:
            await cli.post(f"https://api.telegram.org/bot{token}/sendMessage",
                           json={"chat_id": chat, "text": text})
    except Exception:  # noqa: BLE001
        pass


@router.post("/payment/submit")
async def payment_submit(tx_hash: str = Body(..., embed=True),
                         product: str = Body("prochart", embed=True),
                         plan: str = Body("monthly", embed=True),
                         st: AcademyStudent = Depends(current_student),
                         db: AsyncSession = Depends(get_db)):
    """کاربر هشِ تراکنشِ USDT (BEP-20) را می‌فرستد → تأییدِ خودکار روی BSC →
    ارتقاء به پرمیوم + اطلاع به پشتیبانی. (پلن: monthly=۱۵ USDT/۳۰روز، yearly=۲۰۰/۳۶۵)"""
    if product == "forex_copy":
        # پیش از بررسی tx، ثبتِ پرداخت یا تغییرِ اشتراک رد شود.
        raise HTTPException(status_code=410, detail={
            "msg": "اشتراک کپی‌ترید OneRoyal/MT5 ارائه نمی‌شود؛ وجهی برای این محصول ارسال نکنید.",
            "oneroyal_referral_only": True,
            "referral_path": "/go/oneroyal",
        })
    from src.core.config import settings
    from src.core.redis_client import redis_client
    from src.api.routes._bsc import verify_usdt_payment

    # محصولاتِ مجزا — همه به یک کیفِ کانترکت واریز؛ تفکیک با (محصول+مبلغ)+ضدِتکرارِ tx
    _PRODUCT_PRICES = {
        "prochart":        {"monthly": (25.0, 30),  "yearly": (200.0, 365)},
        "academy_vip":     {"monthly": (25.0, 30),  "yearly": (250.0, 365)},
        "academy_premium": {"monthly": (60.0, 30),  "yearly": (600.0, 365)},
    }
    product = product if product in _PRODUCT_PRICES else "prochart"
    _plans = _PRODUCT_PRICES[product]
    plan = plan if plan in _plans else next(iter(_plans))
    min_amt, days = _plans[plan]
    txk = (tx_hash or "").strip().lower()
    try:
        if await redis_client.exists(f"bn:tx:{txk}"):
            raise HTTPException(status_code=409, detail="این تراکنش قبلاً ثبت شده است.")
    except HTTPException:
        raise
    except Exception:  # noqa: BLE001
        pass

    res = await verify_usdt_payment(tx_hash, settings.ACADEMY_BEP20_ADDRESS, min_amt)
    if not res.get("valid"):
        raise HTTPException(status_code=400, detail=res.get("reason", "تأییدِ پرداخت ناموفق بود."))

    try:
        await redis_client.client.set(f"bn:tx:{txk}", str(st.id), ex=86400 * 90)
    except Exception:  # noqa: BLE001
        pass
    until = datetime.now(timezone.utc) + timedelta(days=days)
    from sqlalchemy import text as _sqltext
    await db.execute(_sqltext(
        "INSERT INTO bn_payments (student_id, product, plan, tx_hash, usdt, status) "
        "VALUES (:s,:p,:pl,:tx,:u,'confirmed')"),
        {"s": st.id, "p": product, "pl": plan, "tx": (tx_hash or "")[:80], "u": res.get("amount")})
    if product == "prochart":
        st.prochart_until = until
    elif product == "academy_vip":
        st.tier = "vip"; st.expires_at = until
    elif product == "academy_premium":
        st.tier = "premium"; st.expires_at = until
    await db.commit()
    await _notify_support(
        "💰 پرداختِ اشتراکِ بازارنما\n"
        f"کاربر: {st.username} ({getattr(st, 'account_type', None) or '-'})\n"
        f"محصول: {product} | پلن: {plan} ({days} روز) | مبلغ: {res.get('amount')} USDT\n"
        f"از: {res.get('from')}\ntx: {tx_hash}"
    )
    logger.info("bn_payment_verified", sid=st.id, amount=res.get("amount"), product=product, plan=plan)
    return {"ok": True, "product": product, "days": days, "amount": res.get("amount"), "until": until.isoformat()}


# ═══════════════ اتصالِ حسابِ واقعیِ کاربر (LBank) #217 #218 ═══════════════
@router.get("/connect/status")
async def connect_status(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    from src.core.database import BnExchangeAccount
    rows = (await db.execute(select(BnExchangeAccount).where(BnExchangeAccount.student_id == st.id))).scalars().all()
    out = {}
    for a in rows:
        if a.kind == "mt5":
            # رکوردِ تاریخی فقط برای اطلاع/امکانِ پاک‌سازی؛ شناسهٔ حساب بازگردانده نمی‌شود.
            out[a.kind] = {
                "connected": False,
                "legacy_record_present": True,
                "status": "referral_only",
                "integration_level": "referral_only",
                "referral_path": "/go/oneroyal",
            }
            continue
        out[a.kind] = {"connected": True, "account_ref": a.account_ref, "server": a.server,
                       "referral_verified": a.referral_verified, "status": a.status, "note": a.note}
    return {"accounts": out, "account_type": getattr(st, "account_type", None)}


@router.post("/connect/lbank")
async def connect_lbank(api_key: str = Body(..., embed=True), api_secret: str = Body(..., embed=True),
                        uid: str = Body("", embed=True),
                        st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """ذخیرهٔ امنِ کلیدِ API صرافیِ LBankِ کاربر (Fernet). تریدِ واقعی پس از تأییدِ رفرال + پرمیوم."""
    _require_premium(st)
    from src.core.database import BnExchangeAccount
    from src.core.crypto import encrypt_secret
    if not (api_key or "").strip() or not (api_secret or "").strip():
        raise HTTPException(status_code=400, detail="کلیدِ API و Secret لازم است.")
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == "lbank"))).scalar_one_or_none()
    if not a:
        a = BnExchangeAccount(student_id=st.id, kind="lbank"); db.add(a)
    a.enc_key = encrypt_secret(api_key.strip())
    a.enc_secret = encrypt_secret(api_secret.strip())
    a.account_ref = (uid or "").strip() or None
    a.status = "active"
    # تلاشِ خودکار برای تأییدِ رفرال (کاربر باید زیرمجموعهٔ لینکِ ما باشد؛ نیازمندِ وایت‌لیستِ IP)
    ref = {"verified": False, "reason": "no_uid"}
    if a.account_ref:
        try:
            from src.api.routes._lbank_referral import verify_referral
            ref = await verify_referral(a.account_ref)
        except Exception:  # noqa: BLE001
            ref = {"verified": False, "reason": "error"}
    a.referral_verified = bool(ref.get("verified"))
    a.note = ("تأیید شد — زیرمجموعهٔ رفرالِ ما" if a.referral_verified
              else f"در انتظارِ تأییدِ رفرال ({ref.get('reason')})")
    await db.commit()
    return {"ok": True, "kind": "lbank", "referral_verified": a.referral_verified, "note": a.note}


@router.post("/connect/mt5")
async def connect_mt5(st: AcademyStudent = Depends(current_student)):
    """MT5/OneRoyal یک integration محصولی نیست؛ payload این مسیر هرگز پردازش یا ذخیره نمی‌شود."""
    raise HTTPException(status_code=410, detail={
        "msg": "اتصال MT5 در بازارنما ارائه نمی‌شود؛ OneRoyal فقط لینک معرفی است.",
        "oneroyal_referral_only": True,
        "referral_path": "/go/oneroyal",
    })


@router.delete("/connect/{kind}")
async def connect_remove(kind: str, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    from src.core.database import BnExchangeAccount
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == kind))).scalar_one_or_none()
    if a:
        await db.delete(a); await db.commit()
    return {"ok": True}


# ═══════════════ تریدِ واقعی روی حسابِ خودِ کاربر (نه کپی) #219 ═══════════════
@router.post("/real-order")
async def real_order(side: str = Body(..., embed=True), symbol: str = Body(..., embed=True),
                     amount: float = Body(..., embed=True), price: float = Body(0, embed=True),
                     leverage: int = Body(5, embed=True),
                     st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """سفارشِ واقعی فقط روی حساب LBank خودِ کاربر.
    OneRoyal referral-only است و هیچ سفارشِ غیرکریپتو وارد DB یا صفِ اجرا نمی‌شود."""
    _require_premium(st)
    try:
        from src.core.redis_client import redis_client as _rc_ks
        if await _rc_ks.client.get("bn:killswitch") in (b"1", "1"):
            raise HTTPException(503, {"msg": "اجرای معاملات موقتاً توسطِ مدیر متوقف شده است.", "killswitch": True})
    except HTTPException:
        raise
    except Exception:  # noqa: BLE001
        pass
    from src.core.database import BnExchangeAccount
    from src.api.routes._crypto_feed import is_crypto, ensure_pairs
    side = (side or "").lower()
    if side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="جهتِ سفارش نامعتبر است.")
    sym = (symbol or "").upper()
    await ensure_pairs()
    crypto = is_crypto(sym)
    if not crypto:
        raise HTTPException(status_code=403, detail={
            "msg": "ترید مستقیم OneRoyal/MT5 در بازارنما ارائه نمی‌شود؛ OneRoyal فقط لینک معرفی است.",
            "oneroyal_referral_only": True,
            "referral_path": "/go/oneroyal",
        })
    kind = "lbank"
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == kind))).scalar_one_or_none()
    if not a or a.status != "active":
        raise HTTPException(status_code=400, detail={
            "msg": "ابتدا حساب LBank خود را در پنلِ کاربری وصل کن.",
            "connect_required": True, "kind": kind})
    if not a.referral_verified:
        raise HTTPException(status_code=403, detail={
            "msg": "برای تریدِ واقعی باید با لینکِ رفرالِ ما زیرمجموعه شوی و تأیید شود.",
            "referral_required": True})
    from src.core.database import BnOrder
    # موتورِ مستقلِ فیوچرزِ Pro-Chart (مستقیم به LBank با کلیدِ کاربر؛ مستقل از تریدیار)
    from src.api.routes import crypto_exec
    from src.core.crypto import decrypt_secret
    key = decrypt_secret(a.enc_key or "") or ""
    sec = decrypt_secret(a.enc_secret or "") or ""
    if not key or not sec:
        raise HTTPException(status_code=400, detail="کلیدِ API نامعتبر؛ دوباره وصل کن.")
    order = BnOrder(student_id=st.id, market="crypto", broker="LBank",
                    account_ref=a.account_ref, symbol=sym, side=side,
                    amount=float(amount), price=float(price) or None, status="pending")
    db.add(order)
    await db.flush()
    res = await crypto_exec.open_market(key, sec, sym, side, float(amount), int(leverage or 5))
    if res.get("disabled"):
        order.status = "failed"; order.error = "crypto_exec_disabled"
        await db.commit()
        raise HTTPException(status_code=503, detail={
            "msg": "اجرای واقعیِ کریپتو در حالِ راه‌اندازیِ نهایی است؛ به‌زودی فعال می‌شود.",
            "crypto_exec_disabled": True})
    if res.get("ok"):
        order.status = "filled"
        _r = res.get("resp") or {}
        order.broker_order_id = str(_r.get("orderId") or _r.get("data") or _r.get("clientOrderId") or "")[:64]
        await db.commit()
        logger.info("bn_real_order_lbank_futures", sid=st.id, sym=sym, side=side)
        return {"placed": True, "broker": "LBank", "market": "futures",
                "symbol": sym, "side": side, "amount": amount, "leverage": int(leverage or 5)}
    order.status = "failed"
    order.error = str(res.get("error") or "")[:255]
    await db.commit()
    raise HTTPException(status_code=502, detail=res.get("error", "سفارشِ فیوچرزِ LBank ناموفق بود."))


# ═══════════ فیدِ دادهٔ زندهٔ فارکس از حسابِ مَسترِ MT5 (اکسپورترِ سرورِ کپی) ═══════════
# اکسپورتر روی سرورِ ویندوزِ مَستر اجرا می‌شود (همان‌جا که MT5ِ مَسترِ OneRoyal هست)،
# همهٔ نمادها + کندل + قیمت را با BN_FEED_TOKEN به اینجا می‌فرستد. کندل در candles
# upsert و قیمت در Redis می‌نشیند؛ نمادها در bn:fxsyms تا dropdown همه را نشان دهد.
@router.post("/feed/forex")
async def feed_forex(payload: dict = Body(...),
                     x_feed_token: str | None = Header(None),
                     db: AsyncSession = Depends(get_db)):
    import hmac as _hmac
    import os as _os
    want = _os.getenv("BN_FEED_TOKEN", "")
    if not (want and x_feed_token and _hmac.compare_digest(x_feed_token, want)):
        raise HTTPException(status_code=401, detail="unauthorized")
    from sqlalchemy import text as _text
    from src.core.redis_client import redis_client

    symbols = payload.get("symbols") or []
    candles = payload.get("candles") or []     # [{symbol,timeframe,rows:[[ts,o,h,l,c,v],...]}]
    quotes = payload.get("quotes") or []       # [{symbol,bid,ask}]

    if symbols:
        try:
            await redis_client.client.sadd("bn:fxsyms", *[str(s)[:10] for s in symbols])
        except Exception:  # noqa: BLE001
            pass

    n = 0
    for c in candles:
        sym = (c.get("symbol") or "")[:10]
        tf = (c.get("timeframe") or "")[:5]
        rows = c.get("rows") or []
        if not (sym and tf and rows):
            continue
        for r in rows:
            try:
                ts = int(r[0]); o = float(r[1]); h = float(r[2]); lo = float(r[3]); cl = float(r[4])
                v = float(r[5]) if len(r) > 5 and r[5] is not None else 0.0
            except Exception:  # noqa: BLE001
                continue
            await db.execute(_text(
                "INSERT INTO candles(time,symbol,timeframe,open,high,low,close,volume,source) "
                "VALUES (to_timestamp(:ts),:s,:tf,:o,:h,:l,:c,:v,'mt5_master') "
                "ON CONFLICT (time,symbol,timeframe) DO UPDATE SET "
                "open=excluded.open,high=excluded.high,low=excluded.low,"
                "close=excluded.close,volume=excluded.volume,source='mt5_master'"),
                {"ts": ts, "s": sym, "tf": tf, "o": o, "h": h, "l": lo, "c": cl, "v": v})
            n += 1
    if n:
        await db.commit()

    # MT5 (وان‌رویال) = فالبکِ فارکس: فقط وقتی finnhub برای این نماد غایب/کهنه است بنویس،
    # تا وقتی finnhub زنده است منبعِ اصلی بماند (به‌خواستِ مالک: finnhub اصلی، MT5 فالبک).
    import time as _t
    _FX_FRESH = 8  # ثانیه — اگر tickِ finnhub تازه‌تر از این بود، MT5 دست نمی‌زند
    now_e = int(_t.time())
    for q in quotes:
        sym = (q.get("symbol") or "")[:10]
        try:
            bid = float(q.get("bid") or 0); ask = float(q.get("ask") or bid)
        except Exception:  # noqa: BLE001
            continue
        if not (sym and (bid or ask)):
            continue
        try:
            cur = await redis_client.get_price(sym)
        except Exception:  # noqa: BLE001
            cur = None
        if cur and cur.get("source") == "finnhub":
            try:
                if (now_e - int(cur.get("ts") or 0)) < _FX_FRESH:
                    continue                      # finnhub زنده و تازه → نگذار MT5 رونویسی کند
            except Exception:  # noqa: BLE001
                pass
        mid = (bid + ask) / 2 if (bid and ask) else (bid or ask)
        await redis_client.set_price(sym, {"bid": bid, "ask": ask, "price": mid,
                                           "ts": now_e, "source": "mt5"})
    return {"ok": True, "candles": n, "symbols": len(symbols), "quotes": len(quotes)}


# ═══════════════ مرکزِ حساب (Account Center) ═══════════════
_TIER_RANK = {"free": 0, "vip": 1, "premium": 2}


# ── ۴) تاریخچهٔ پرداختِ خودسرویس (از جدولِ واقعیِ bn_payments) ──
@router.get("/payment/history")
async def payment_history(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(_sql_text(
        "SELECT tx_hash, plan, product, usdt, status, created_at "
        "FROM bn_payments WHERE student_id=:s ORDER BY created_at DESC LIMIT 100"),
        {"s": st.id})).all()
    return {"tx": [{
        "tx_hash": r[0],
        "plan": r[1],
        "product": r[2],
        "amount_usdt": (float(r[3]) if r[3] is not None else None),
        "status": r[4],
        "at": r[5].isoformat() if r[5] else None,
    } for r in rows]}


# ── ۵) کدِ redeem/voucher ──
@router.post("/payment/redeem")
async def redeem_voucher(code: str = Body(..., embed=True),
                         st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    c = (code or "").strip().upper()
    if not c:
        raise HTTPException(status_code=400, detail="کدِ اشتراک را وارد کن.")
    v = (await db.execute(select(AcademyVoucher).where(func.upper(AcademyVoucher.code) == c))).scalar_one_or_none()
    if v is None:
        raise HTTPException(status_code=400, detail="کدِ نامعتبر است.")
    now = _now()
    if not v.is_active:
        raise HTTPException(status_code=400, detail="این کد غیرفعال شده است.")
    if v.expires_at is not None and v.expires_at <= now:
        raise HTTPException(status_code=400, detail="این کد منقضی شده است.")
    if (v.used_count or 0) >= (v.max_uses or 1):
        raise HTTPException(status_code=400, detail="ظرفیتِ این کد پر شده است.")
    dup = (await db.execute(select(AcademyVoucherRedemption).where(
        AcademyVoucherRedemption.voucher_id == v.id,
        AcademyVoucherRedemption.student_id == st.id))).scalar_one_or_none()
    if dup is not None:
        raise HTTPException(status_code=400, detail="این کد را قبلاً استفاده کرده‌اید.")
    if _TIER_RANK.get(v.tier, 0) > _TIER_RANK.get(_effective_tier(st), 0):
        st.tier = v.tier
    base = st.expires_at if (st.expires_at and st.expires_at > now) else now
    st.expires_at = base + timedelta(days=int(v.days or 0))
    v.used_count = (v.used_count or 0) + 1
    db.add(AcademyVoucherRedemption(voucher_id=v.id, student_id=st.id))
    # ثبت در تاریخچهٔ واقعیِ پرداخت (bn_payments) برای نمایش در payment/history
    await db.execute(_sql_text(
        "INSERT INTO bn_payments (student_id, product, plan, tx_hash, usdt, status) "
        "VALUES (:s,'voucher','voucher',NULL,0,'confirmed')"), {"s": st.id})
    await _grant_invite_reward(db, st)
    await db.commit()
    logger.info("bn_voucher_redeemed", sid=st.id, voucher=v.id, tier=st.tier)
    return {"ok": True, "tier": st.tier, "expires_at": st.expires_at.isoformat()}


# ── ۶) KYC آکادمی با آپلودِ مدرک (سطحِ بالاتر از kyc_status پایه) ──
_KYC_ACCEPTED_DOCS = ["national_card", "passport", "driver_license"]
_KYC_REQUIRED = ["national_card", "selfie"]
_KYC_MAX_DOC_BYTES = 4 * 1024 * 1024
_KYC_BIRTH_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _kyc_meta() -> dict:
    return {"required_docs": _KYC_REQUIRED,
            "accepted_doc_types": _KYC_ACCEPTED_DOCS + ["selfie"],
            "max_doc_mb": _KYC_MAX_DOC_BYTES // (1024 * 1024)}


@router.get("/kyc/status")
async def kyc_status(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    k = (await db.execute(select(AcademyKyc).where(AcademyKyc.student_id == st.id))).scalar_one_or_none()
    if k is None:
        base = getattr(st, "kyc_status", None) or "none"
        return {"status": base, "level": 0, "reason": None, **_kyc_meta()}
    return {"status": k.status, "level": k.level, "reason": k.reason, **_kyc_meta()}


def _decode_doc(b64: str, label: str) -> str:
    raw = (b64 or "").strip()
    if raw[:5].lower() == "data:" and "," in raw:
        raw = raw.split(",", 1)[1]
    if not raw:
        raise HTTPException(status_code=400, detail=f"{label} ارسال نشده است.")
    try:
        blob = base64.b64decode(raw, validate=True)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"دادهٔ {label} نامعتبر است (base64).")
    if len(blob) > _KYC_MAX_DOC_BYTES:
        raise HTTPException(status_code=400, detail=f"حجمِ {label} بیش از ۴ مگابایت است.")
    return base64.b64encode(blob).decode()


@router.post("/kyc/submit")
async def kyc_submit(full_name: str = Body(..., embed=True), national_id: str = Body(..., embed=True),
                     birth_date: str = Body(..., embed=True), docs: list = Body(..., embed=True),
                     selfie_b64: str = Body(..., embed=True),
                     st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """ثبتِ KYC با آپلودِ مدرک + سلفی. وضعیت اولیه pending (بازبینیِ دستیِ ادمین)."""
    fn = (full_name or "").strip()
    nid = (national_id or "").strip()
    bd = (birth_date or "").strip()
    if len(fn) < 3:
        raise HTTPException(status_code=400, detail="نامِ کامل را کامل وارد کن.")
    if len(nid) < 4:
        raise HTTPException(status_code=400, detail="کدِ ملی/شمارهٔ مدرک نامعتبر است.")
    if not _KYC_BIRTH_RE.match(bd):
        raise HTTPException(status_code=400, detail="تاریخِ تولد باید به شکلِ YYYY-MM-DD باشد.")
    if not isinstance(docs, list) or not docs:
        raise HTTPException(status_code=400, detail="حداقل یک مدرکِ هویتی لازم است.")
    if len(docs) > 5:
        raise HTTPException(status_code=400, detail="حداکثر ۵ مدرک مجاز است.")
    saved: list[tuple[str, str]] = []
    for d in docs:
        dtype = (d.get("type") or "").strip().lower() if isinstance(d, dict) else ""
        if dtype not in _KYC_ACCEPTED_DOCS:
            raise HTTPException(status_code=400,
                                detail=f"نوعِ مدرک نامعتبر است. مجاز: {', '.join(_KYC_ACCEPTED_DOCS)}.")
        saved.append((dtype, _decode_doc(d.get("data_b64"), f"مدرکِ {dtype}")))
    saved.append(("selfie", _decode_doc(selfie_b64, "سلفی")))

    now = _now()
    k = (await db.execute(select(AcademyKyc).where(AcademyKyc.student_id == st.id))).scalar_one_or_none()
    if k is None:
        k = AcademyKyc(student_id=st.id)
        db.add(k)
        await db.flush()
    k.status = "pending"
    k.full_name = fn[:160]
    k.national_id = nid[:40]
    k.birth_date = bd
    k.reason = None
    k.submitted_at = now
    # هم‌گام‌سازی با فیلدِ پایهٔ روی دانش‌آموز
    st.kyc_status = "pending"
    st.kyc_full_name = fn[:120]
    for old in (await db.execute(select(AcademyKycDoc).where(AcademyKycDoc.kyc_id == k.id))).scalars().all():
        await db.delete(old)
    for dtype, clean in saved:
        db.add(AcademyKycDoc(kyc_id=k.id, doc_type=dtype, data_b64=clean))
    await db.commit()
    await _notify_support(f"🪪 KYCِ جدیدِ بازارنما — کاربر: {st.username} | نام: {fn} | مدارک: {len(saved)}")
    logger.info("bn_kyc_submitted", sid=st.id, docs=len(saved))
    return {"status": "pending"}


# ── ۷) دعوتِ کاربر-به-کاربر ──
async def _ensure_referral_code(db: AsyncSession, st: AcademyStudent) -> str:
    if st.referral_code:
        return st.referral_code
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(12):
        cand = "".join(secrets.choice(alphabet) for _ in range(8))
        exists = (await db.execute(select(AcademyStudent.id).where(
            AcademyStudent.referral_code == cand))).scalar_one_or_none()
        if not exists:
            st.referral_code = cand
            await db.commit()
            return cand
    raise HTTPException(status_code=500, detail="تولیدِ کدِ دعوت ناموفق بود؛ دوباره تلاش کن.")


async def _grant_invite_reward(db: AsyncSession, st: AcademyStudent) -> None:
    """در اولین پرداختِ موفقِ کاربرِ دعوت‌شده، به دعوت‌کننده روزِ VIP بده. idempotent."""
    if not getattr(st, "referred_by", None) or getattr(st, "invite_rewarded", False):
        return
    inviter = (await db.execute(select(AcademyStudent).where(
        AcademyStudent.id == st.referred_by))).scalar_one_or_none()
    st.invite_rewarded = True
    if inviter is None or inviter.id == st.id:
        return
    days = int(getattr(settings, "ACADEMY_INVITE_REWARD_DAYS", 15) or 15)
    now = _now()
    base = inviter.expires_at if (inviter.expires_at and inviter.expires_at > now) else now
    inviter.expires_at = base + timedelta(days=days)
    if _TIER_RANK.get(inviter.tier or "free", 0) < 1:
        inviter.tier = "vip"


@router.get("/invite")
async def invite(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    code = await _ensure_referral_code(db, st)
    invited = (await db.execute(select(func.count()).select_from(AcademyStudent).where(
        AcademyStudent.referred_by == st.id))).scalar() or 0
    rewarded = (await db.execute(select(func.count()).select_from(AcademyStudent).where(
        AcademyStudent.referred_by == st.id, AcademyStudent.invite_rewarded.is_(True)))).scalar() or 0
    days = int(getattr(settings, "ACADEMY_INVITE_REWARD_DAYS", 15) or 15)
    base_url = getattr(settings, "ACADEMY_SITE_URL", "") or "https://user.pro-chart.com"
    return {"code": code, "link": f"{base_url}?ref={code}",
            "invited_count": int(invited), "reward_total": int(rewarded) * days,
            "reward_unit": "روزِ اشتراکِ VIP"}


@router.post("/invite/redeem")
async def invite_redeem(code: str = Body(..., embed=True),
                        st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """ثبتِ کدِ دعوت‌کننده (یک‌بار؛ معمولاً بلافاصله پس از ثبت‌نام)."""
    if getattr(st, "referred_by", None):
        return {"ok": True, "already": True}
    c = (code or "").strip().upper()
    inviter = (await db.execute(select(AcademyStudent).where(
        func.upper(AcademyStudent.referral_code) == c))).scalar_one_or_none() if c else None
    if inviter is None or inviter.id == st.id:
        raise HTTPException(status_code=400, detail="کدِ دعوت نامعتبر است.")
    st.referred_by = inviter.id
    await db.commit()
    return {"ok": True, "already": False}


# ── ۸) پشتیبانی ──
_SUPPORT_SYSTEM = (
    "تو دستیارِ پشتیبانیِ «Pro-Chart» هستی. کوتاه، دقیق و به فارسی پاسخ بده. "
    "محصولات: پرو‌چارت (سیگنال + تریدِ واقعی)، کپی‌فارکس، کپی‌کریپتو، و آکادمی VIP. "
    "اشتراک با USDT روی شبکهٔ BEP-20 (BSC) پرداخت می‌شود. اگر سؤال نیازِ دخالتِ انسانی/مالی دارد، "
    "کاربر را به ثبتِ تیکتِ پشتیبانی راهنمایی کن."
)


@router.post("/support/chat")
async def support_chat(message: str = Body(..., embed=True), history: list | None = Body(None, embed=True),
                       st: AcademyStudent = Depends(current_student)):
    msg = (message or "").strip()[:2000]
    if not msg:
        raise HTTPException(status_code=400, detail="پیام خالی است.")
    lines: list[str] = []
    for h in (history or [])[-10:]:
        if not isinstance(h, dict):
            continue
        role = "کاربر" if (h.get("role") or "") == "user" else "پشتیبان"
        content = (h.get("content") or "").strip()[:1000]
        if content:
            lines.append(f"{role}: {content}")
    lines.append(f"کاربر: {msg}")
    prompt = "\n".join(lines) + "\nپشتیبان:"
    reply = await llm_client.complete(prompt, system=_SUPPORT_SYSTEM, system_replace=True)
    if not reply:
        reply = "الان امکانِ پاسخِ خودکار نیست. لطفاً تیکتِ پشتیبانی ثبت کن تا کارشناس پاسخ دهد."
    return {"reply": reply.strip()}


@router.post("/support/ticket")
async def support_ticket(subject: str = Body(..., embed=True), body: str = Body(..., embed=True),
                         st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    subj = (subject or "").strip()[:200]
    bd = (body or "").strip()[:5000]
    if len(subj) < 3 or len(bd) < 5:
        raise HTTPException(status_code=400, detail="موضوع و متنِ تیکت را کامل وارد کن.")
    t = AcademySupportTicket(student_id=st.id, subject=subj, body=bd, status="open")
    db.add(t)
    await db.commit()
    await db.refresh(t)
    await _notify_support(f"🎫 تیکتِ جدید #{t.id} — {st.username}\nموضوع: {subj}")
    return {"ticket_id": t.id}


@router.get("/support/tickets")
async def support_tickets(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AcademySupportTicket).where(AcademySupportTicket.student_id == st.id)
            .order_by(AcademySupportTicket.created_at.desc()).limit(100))).scalars().all()
    return {"tickets": [{
        "id": t.id, "subject": t.subject, "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    } for t in rows]}
