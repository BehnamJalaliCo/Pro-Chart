"""اندپوینتِ EAِ اتو-تریدر — سیگنال‌های فعال را با قرارداد ساده برای EA برمی‌گرداند.

EA (روی MT5) این لیست را می‌خواند و معاملاتِ متناظر را باز/مدیریت می‌کند.
احراز با توکنِ ثابت (EA_TOKEN). فقط سیگنال‌های فعالِ live برگردانده می‌شوند.
"""

from __future__ import annotations

import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.core.config import settings
from src.core.database import Signal, TradeHistory
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)
router = APIRouter()

_ONEROYAL_REFERRAL_PATH = "/go/oneroyal"


def _oneroyal_referral_state(**extra) -> dict:
    return {
        "referral_only": True,
        "integration_level": "referral_only",
        "referral_path": _ONEROYAL_REFERRAL_PATH,
        "enabled": False,
        "connected": False,
        "eligible": False,
        **extra,
    }


def _reject_oneroyal_operation() -> None:
    raise HTTPException(
        status_code=410,
        detail=_oneroyal_referral_state(reason="oneroyal_referral_only"),
    )


def _ea_token_ok(token: str | None) -> bool:
    """مقایسهٔ امنِ توکنِ EA (constant-time؛ جلوگیری از timing attack)."""
    expected = settings.EA_TOKEN or ""
    if not expected or not token:
        return False
    return hmac.compare_digest(str(token), str(expected))


# ── تنظیماتِ EAِ اتو-تریدر (قابلِ کنترل از پنل ادمین، ذخیره در Redis) ──
EA_SETTINGS_KEY = "ea:settings"
EA_DEFAULTS = {
    "enabled": False,            # کلیدِ اصلیِ روشن/خاموش (پیش‌فرض خاموش برای ایمنی)
    "risk_percent": 1.0,         # ریسکِ هر معامله (% موجودی)
    "fixed_lots": 0.0,           # اگر >0 حجمِ ثابت
    "max_lot": 5.0,              # سقفِ حجم
    "max_open_trades": 10,
    "symbol_suffix": "",         # پسوندِ نمادِ بروکر
    "set_tp_tp3": True,          # حدِ سودِ نهایی روی TP3
    "breakeven_at_tp1": True,
    "breakeven_buffer_frac": 0.10,
    "use_trailing": True,
    "trail_start_frac": 1.0,
    "trail_distance_frac": 0.5,
    "close_on_signal_gone": True,
    "max_spread_points": 0,
    "allowed_symbols": "",       # csv؛ خالی = همه
    # ── گاردِ ریسکِ روزانه ──
    "max_daily_trades": 0,       # ۰ = بدون محدودیت
    "max_daily_loss_pct": 0.0,   # ۰ = بدون محدودیت (توقفِ بازکردنِ معامله پس از این ضررِ روزانه)
    # ── فرمانِ بستنِ همه (one-shot؛ پنل افزایش می‌دهد) ──
    "close_all_id": 0,
}

EA_STATUS_KEY = "ea:status"


async def get_ea_settings() -> dict:
    return dict(EA_DEFAULTS)


async def set_ea_settings(patch: dict) -> dict:
    _reject_oneroyal_operation()


def _settings_to_kv(s: dict) -> str:
    """تبدیل به فایلِ key=value برای EA."""
    def b(x):
        return "1" if x else "0"
    lines = [
        f"enabled={b(s['enabled'])}",
        f"risk_percent={s['risk_percent']}",
        f"fixed_lots={s['fixed_lots']}",
        f"max_lot={s['max_lot']}",
        f"max_open_trades={int(s['max_open_trades'])}",
        f"symbol_suffix={s['symbol_suffix']}",
        f"set_tp_tp3={b(s['set_tp_tp3'])}",
        f"breakeven_at_tp1={b(s['breakeven_at_tp1'])}",
        f"breakeven_buffer_frac={s['breakeven_buffer_frac']}",
        f"use_trailing={b(s['use_trailing'])}",
        f"trail_start_frac={s['trail_start_frac']}",
        f"trail_distance_frac={s['trail_distance_frac']}",
        f"close_on_signal_gone={b(s['close_on_signal_gone'])}",
        f"max_spread_points={int(s['max_spread_points'])}",
        f"allowed_symbols={s['allowed_symbols']}",
        f"max_daily_trades={int(s['max_daily_trades'])}",
        f"max_daily_loss_pct={s['max_daily_loss_pct']}",
        f"close_all_id={int(s['close_all_id'])}",
    ]
    return "\n".join(lines)


async def store_ea_status(raw: str) -> dict:
    """parseِ متنِ key=value وضعیتِ EA + ذخیره در Redis با مهرِ زمانیِ سرور."""
    st: dict = {}
    for line in (raw or "").splitlines():
        if "=" not in line:
            continue
        k, _, v = line.partition("=")
        st[k.strip()] = v.strip()
    st["_server_ts"] = int(datetime.now(timezone.utc).timestamp())
    await redis_client.client.set(EA_STATUS_KEY, __import__("json").dumps(st), ex=120)
    await _detect_dismissed(0, st.get("positions", ""))  # مَستر = uid 0
    return st


def _pos_ids(positions: str) -> set:
    """idِ سیگنالِ هر پوزیشن از فیلدِ positions (فرمتِ ۶-فیلدیِ v1.34: …;sl;id)."""
    ids = set()
    for chunk in (positions or "").split("|"):
        p = chunk.split(";")
        if len(p) >= 6:
            try:
                sid = int(float(p[5]))
                if sid > 0:
                    ids.add(sid)
            except (ValueError, IndexError):
                continue
    return ids


async def _detect_dismissed(uid: int, positions: str) -> None:
    """تشخیصِ «بستنِ بیرونی»: پوزیشنی که در وضعیتِ قبلی بود و حالا نیست ولی سیگنالش
    هنوز فعال است → کاربر/ادمین دستی (یا close-all) بسته → به dismissed اضافه کن تا
    /ea/signals دیگر آن را نفرستد و EA دوباره بازش نکند (ماندگار، ضدِ re-open). فقط
    وقتی EA فرمتِ id-دار (v1.34) می‌فرستد فعال است."""
    try:
        cur = _pos_ids(positions)
        pkey = f"ea:posids:{uid}"
        prev_raw = await redis_client.client.smembers(pkey)
        prev = {int(x) for x in prev_raw} if prev_raw else set()
        for sid in (prev - cur):
            if await redis_client.client.exists(f"signal:active:{sid}"):
                await redis_client.client.sadd(f"ea:dismissed:{uid}", sid)
                await redis_client.client.expire(f"ea:dismissed:{uid}", 604800)
                logger.info("ea_signal_dismissed", uid=uid, signal_id=sid)
        await redis_client.client.delete(pkey)
        if cur:
            await redis_client.client.sadd(pkey, *cur)
            await redis_client.client.expire(pkey, 600)
    except Exception:  # noqa: BLE001
        pass


async def _dismissed_ids(uid: int) -> set:
    try:
        raw = await redis_client.client.smembers(f"ea:dismissed:{uid}")
        return {int(x) for x in raw} if raw else set()
    except Exception:  # noqa: BLE001
        return set()


async def _detect_dismissed_atomic(uid: int, cur_ids: set) -> None:
    """نسخهٔ اتمیکِ تشخیصِ «بستنِ دستی» — مستقیماً از لیستِ پوزیشن‌هایی که EA همین
    لحظه (روی درخواستِ /ea/signals) گزارش می‌کند. چون تشخیص و فیدِ سیگنال در یک
    درخواستِ واحد انجام می‌شوند، دیگر race وجود ندارد: سیگنالی که کاربر بسته، در
    همین پاسخ هم dismiss و هم حذف می‌شود → EA هرگز دوباره بازش نمی‌کند."""
    try:
        pkey = f"ea:posids:{uid}"
        prev_raw = await redis_client.client.smembers(pkey)
        prev = {int(x) for x in prev_raw} if prev_raw else set()
        for sid in (prev - cur_ids):
            if await redis_client.client.exists(f"signal:active:{sid}"):
                await redis_client.client.sadd(f"ea:dismissed:{uid}", sid)
                await redis_client.client.expire(f"ea:dismissed:{uid}", 604800)
                logger.info("ea_signal_dismissed_atomic", uid=uid, signal_id=sid)
        await redis_client.client.delete(pkey)
        if cur_ids:
            await redis_client.client.sadd(pkey, *cur_ids)
            await redis_client.client.expire(pkey, 600)
    except Exception:  # noqa: BLE001
        pass


async def get_ea_status() -> dict:
    return {}


def _action(direction: str | None) -> str:
    return "SELL" if (direction or "").lower() in ("sell", "short") else "BUY"


def _f(v):
    return float(v) if v is not None else None


def _ccy(symbol: str) -> set:
    """ارزهای یک نماد (برای سنجشِ همبستگی). کالاها → {BASE, USD}."""
    s = (symbol or "").upper()
    if s[:3] in ("XAU", "XAG", "XTI", "XNG"):
        return {s[:3], "USD"}
    if len(s) == 6:
        return {s[:3], s[3:]}
    return {s}


def _risk_mult(s, rows) -> float:
    """ضریبِ حجمِ تطبیقی: اطمینان (امتیاز) × همبستگی (کاهش به‌ازای هر پوزیشنِ هم‌ارز).
    خروجی در [SIZE_MIN_MULT, SIZE_MAX_MULT]. خطا → ۱.۰ (خنثی)."""
    if not settings.ADAPTIVE_SIZING_ENABLED:
        return 1.0
    try:
        score = float(getattr(s, "signal_score", 0) or 0)
        # اطمینان: امتیاز ۶۰→۰.۵ ، ۸۰→۱.۳ (خطی، کلیپ)
        mult_conf = max(0.5, min(settings.SIZE_MAX_MULT, 0.5 + (score - 60.0) * 0.04))
        # همبستگی: شمارشِ سیگنال‌های فعالِ دیگری که ارزِ مشترک دارند
        mine = _ccy(s.symbol)
        n_corr = 0
        for o in rows:
            if o.id == s.id:
                continue
            if mine & _ccy(o.symbol):
                n_corr += 1
        mult_corr = max(settings.SIZE_CORR_FLOOR, 1.0 - settings.SIZE_CORR_PENALTY * n_corr)
        return round(max(settings.SIZE_MIN_MULT,
                         min(settings.SIZE_MAX_MULT, mult_conf * mult_corr)), 3)
    except Exception:  # noqa: BLE001
        return 1.0


@router.get("/signals")
async def ea_signals(
    token: str = Query(...),
    uid: int = Query(0),
    open_ids: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """سیگنال‌های فعال برای EA (احراز با token). uid → فیدِ مخصوصِ آن حساب:
    سیگنال‌هایی که کاربر/ادمین پوزیشنشان را بسته (dismissed) حذف می‌شوند تا دوباره
    باز نشوند. uid=0 = مَستر.

    open_ids: لیستِ id پوزیشن‌های بازِ فعلیِ EA (CSV). اگر فرستاده شود (bridge جدید)،
    بستنِ دستی به‌صورتِ اتمیک در همین درخواست تشخیص و dismiss می‌شود (ضدِّ race کامل).
    None = کلاینتِ قدیمی (تشخیص از مسیرِ status)."""
    if not _ea_token_ok(token):
        raise HTTPException(status_code=403, detail="forbidden")

    return _oneroyal_referral_state(signals=[], count=0)

    # Historical implementation retained below but unreachable while referral-only.

    # ── تشخیصِ اتمیکِ بستنِ دستی (هم‌زمان با فید → بدونِ race) ──
    if open_ids is not None:
        cur_ids = set()
        for tok in open_ids.split(","):
            tok = tok.strip()
            if tok.isdigit():
                cur_ids.add(int(tok))
        await _detect_dismissed_atomic(uid, cur_ids)

    rows = (await db.execute(
        select(Signal).where(Signal.status == "active")
        .order_by(desc(Signal.created_at)).limit(100)
    )).scalars().all()
    _dismissed = await _dismissed_ids(uid)
    if _dismissed:
        rows = [s for s in rows if s.id not in _dismissed]
    # سازگاریِ بحرانی: EA فقط سیگنالی را معامله کند که واقعاً در کانال پست شده.
    # شاخص = signal:msg:{id} (message_idِ پستِ کانال؛ TTL بلند). سیگنالِ active که
    # msg ندارد (مثلاً pub/sub گم‌شده → هرگز پست نشده) نباید روی حساب باز شود.
    try:
        if rows:
            async with redis_client.client.pipeline(transaction=False) as pipe:
                for s in rows:
                    pipe.exists(f"signal:msg:{s.id}")
                posted_flags = await pipe.execute()
            rows = [s for s, ok in zip(rows, posted_flags) if ok]
    except Exception as exc:  # noqa: BLE001 — fail-open: در خطای redis سیگنال‌ها را قطع نکن
        logger.warning("posted_filter_failed", error=str(exc))

    signals = [
        {
            "id": s.id,
            # نامِ بروکر برای اجرا (NAS100→USTEC, XTIUSD→WTI)؛ وگرنه «نماد یافت نشد»
            "symbol": settings.BROKER_SYMBOL_MAP.get(s.symbol, s.symbol),
            "action": _action(s.direction),
            "entry": _f(s.entry_price),
            "sl": _f(s.sl),
            "tp1": _f(s.tp1),
            "tp2": _f(s.tp2),
            "tp3": _f(s.tp3),
            "risk_mult": _risk_mult(s, rows),   # فاز ۴: حجمِ تطبیقی (اطمینان×همبستگی)
            # SLِ به‌روزشدهٔ سرور (سربه‌سر/تریلینگِ قفل‌شده پس از TP1). EA این را
            # با ImprovesSL اعمال می‌کند تا تاچِ کوتاهِ TP1 که بینِ tickها رخ می‌دهد
            # هم محافظت شود — وگرنه SL روی حسابِ واقعی بالا نمی‌رفت و به ورود برمی‌گشت.
            "trail_sl": _f(s.trailing_sl) if getattr(s, "trailing_sl", None) else 0.0,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in rows
    ]
    return {
        "signals": signals,
        "count": len(signals),
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


async def _expected_login_for(uid: int, db: AsyncSession) -> str:
    """لاگینِ حسابی که این uid باید روی آن ترید کند (مَستر یا کاربرِ کپی). برای گاردِ
    تطبیقِ حساب در EA — تا اگر ترمینال روی حسابِ اشتباه (مثلِ دموی پیش‌فرضِ موقعِ
    cold-startِ reprovision) باشد، ترید نکند."""
    try:
        if not uid:
            m = await get_master_account()
            return str(m.get("login", "")).strip() if m else ""
        from src.core.database import TradingAccount
        a = (await db.execute(
            select(TradingAccount).where(TradingAccount.user_id == uid))).scalars().first()
        return str(a.login).strip() if a and a.login else ""
    except Exception:  # noqa: BLE001
        return ""


@router.get("/config")
async def ea_config(token: str = Query(...), uid: int = Query(0),
                    db: AsyncSession = Depends(get_db)):
    """تنظیماتِ EA به‌صورتِ key=value. uid>0 → تنظیماتِ همان کاربر (کپیِ زنده)."""
    if not _ea_token_ok(token):
        raise HTTPException(status_code=403, detail="forbidden")
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(
        "enabled=0\nintegration_level=referral_only\nreferral_path=/go/oneroyal\n",
        headers={"Cache-Control": "no-store"},
    )

    # Historical implementation retained below but unreachable while referral-only.
    if uid and uid > 0:
        kv = await _user_settings_kv(uid)
        base = kv if kv is not None else _settings_to_kv(await get_ea_settings())
    else:
        base = _settings_to_kv(await get_ea_settings())
    # گاردِ تطبیقِ حساب: EA فقط وقتی ترید کند که ACCOUNT_LOGIN == expected_login باشد
    login = await _expected_login_for(uid, db)
    if login:
        base = base.rstrip("\n") + f"\nexpected_login={login}\n"
    return PlainTextResponse(base)


@router.post("/heartbeat")
async def ea_heartbeat(token: str = Query(...), uid: int = Query(0), body: dict = None):
    """دریافتِ وضعیتِ EA. uid>0 → وضعیتِ همان کاربر در ea:status:user:<uid>."""
    if not _ea_token_ok(token):
        raise HTTPException(status_code=403, detail="forbidden")
    _reject_oneroyal_operation()
    raw = (body or {}).get("raw", "")
    if uid and uid > 0:
        await _store_user_status(uid, raw)
    else:
        await store_ea_status(raw)
    return {"ok": True}


@router.post("/diag")
async def ea_diag(token: str = Query(...), uid: int = Query(0), body: dict = None):
    """لاگِ تشخیصیِ MT5 (login/connection/EA) را از agentِ ویندوز می‌گیرد و در Redis
    نگه می‌دارد تا برای رفعِ اشکالِ از راه دور خوانده شود (هرگز عمومی نشود)."""
    if not _ea_token_ok(token):
        raise HTTPException(status_code=403, detail="forbidden")
    _reject_oneroyal_operation()
    import json as _json
    payload = dict(body or {})
    payload["_server_ts"] = int(datetime.now(timezone.utc).timestamp())
    # گزارشِ منابعِ سرور (دارای metrics) → ea:diag:agent؛ لاگِ تشخیصیِ هر ترمینال (شاملِ
    # مَستر uid=0) → ea:diag:user:{uid}. این دو قبلاً روی uid=0 هم‌دیگر را بازنویسی می‌کردند.
    if "metrics" in payload:
        key = "ea:diag:agent"
    else:
        key = f"ea:diag:user:{uid}"
    try:
        await redis_client.client.set(key, _json.dumps(payload), ex=600)
    except Exception:  # noqa: BLE001
        pass
    return {"ok": True}


# ════════════════════════════════════════════════════════════
#  حسابِ معاملاتیِ مستر (اتو-ترید) — ورود/خروجِ حساب از پنل
#  مشخصات رمزنگاری‌شده در Redis؛ کانتینرِ مستر می‌خواند و با تغییرِ rev
#  خودکار با حسابِ جدید لاگین می‌کند.
# ════════════════════════════════════════════════════════════
MASTER_ACCT_KEY = "ea:master:account"
MASTER_REV_KEY = "ea:master:rev"


async def get_master_account() -> dict | None:
    """OneRoyal is referral-only; stored legacy credentials are never read."""
    return None


async def _bump_master_rev() -> int:
    try:
        return int(await redis_client.client.incr(MASTER_REV_KEY))
    except Exception:  # noqa: BLE001
        return 0


async def set_master_account(server: str, login: str, password: str) -> int:
    _reject_oneroyal_operation()


async def clear_master_account() -> int:
    """خروجِ صریح: نشانهٔ logout ذخیره می‌شود تا کانتینرِ مستر واقعاً از حساب خارج شود
    (با لاگینِ ماندگارِ قبلی دوباره وصل نشود)."""
    _reject_oneroyal_operation()


@router.get("/master-account")
async def ea_master_account(token: str = Query(...)):
    """فقط برای کانتینرِ مستر (token-gated): مشخصاتِ لاگینِ رمزگشایی‌شده + rev.
    هرگز عمومی نشود."""
    if not _ea_token_ok(token):
        raise HTTPException(status_code=403, detail="forbidden")
    return _oneroyal_referral_state(configured=False, rev=0)

    # Historical implementation retained below but unreachable while referral-only.
    from src.core.crypto import decrypt_secret
    acct = await get_master_account()
    try:
        rev = int(await redis_client.client.get(MASTER_REV_KEY) or 0)
    except Exception:  # noqa: BLE001
        rev = 0
    if not acct:
        return {"configured": False, "rev": rev}
    if acct.get("logout"):
        return {"configured": False, "logout": True, "rev": rev}
    pw = decrypt_secret(acct.get("password_enc", "")) or ""
    return {"configured": True, "rev": rev, "server": acct.get("server", ""),
            "login": acct.get("login", ""), "password": pw}


# ════════════════════════════════════════════════════════════
#  کپیِ زنده per-user — لیستِ حساب‌ها + تنظیمات + وضعیتِ هر کاربر
# ════════════════════════════════════════════════════════════
async def _user_settings_kv(uid: int) -> str | None:
    """kvِ تنظیماتِ EA برای کاربر uid — پایه از تنظیماتِ ادمین (استراتژی یکسان) +
    override با CopySettings کاربر (on/off + ریسک)."""
    from src.core.database import CopySettings
    base = dict(await get_ea_settings())
    async with __import__("src.core.database", fromlist=["async_session_factory"]).async_session_factory() as db:
        cs = (await db.execute(select(CopySettings).where(CopySettings.user_id == uid))).scalar_one_or_none()
    if cs is None:
        return None
    # گیتِ قطعیِ اجرا: اگر حساب دمو/غیرواقعی تشخیص داده شده، هرگز فعال نباشد —
    # ایجنت هر دور این را می‌خواند، پس حتی اگر کپی روشن باشد روی دمو ترید نمی‌کند.
    demo_blocked = False
    try:
        demo_blocked = bool(await redis_client.client.get(f"ea:user:{uid}:demo_blocked"))
    except Exception:  # noqa: BLE001
        demo_blocked = False
    # دروازهٔ اعتبارسنجی (سپرِ حقوقی): کپیِ پولِ واقعی فقط وقتی مَستر سوددهی ثابت کرده.
    # + محافظتِ دراوداونِ کاربر: اگر افتِ سرمایه از حد گذشت، کپی pause است.
    from src.analytics.validation import is_master_validated
    _validated = await is_master_validated()
    try:
        _dd_paused = bool(await redis_client.client.get(f"ea:user:{uid}:dd_paused"))
    except Exception:  # noqa: BLE001
        _dd_paused = False
    base["enabled"] = bool(cs.enabled) and not demo_blocked and _validated and not _dd_paused
    # close-allِ per-user: کاربر close_all_idِ ادمین را ارث نمی‌برد؛ کلیدِ مخصوصِ خودش
    # (ea:user:{uid}:close_all_id) را می‌خواند که با دکمهٔ «بستنِ همه»ی پنلِ کاربر/ادمین زیاد می‌شود.
    try:
        base["close_all_id"] = int(await redis_client.client.get(f"ea:user:{uid}:close_all_id") or 0)
    except Exception:  # noqa: BLE001
        base["close_all_id"] = 0
    base["max_lot"] = float(cs.max_lot)
    base["max_open_trades"] = int(cs.max_open_trades)
    base["max_daily_loss_pct"] = float(cs.max_daily_loss_pct)
    base["set_tp_tp3"] = bool(cs.copy_sl_tp)
    if cs.risk_mode == "fixed_lot":
        base["fixed_lots"] = float(cs.risk_value)
    else:  # proportional/risk_percent → ریسکِ درصدیِ روی موجودیِ کاربر
        base["fixed_lots"] = 0.0
        base["risk_percent"] = float(cs.risk_value)
    return _settings_to_kv(base)


async def _store_user_status(uid: int, raw: str) -> None:
    st: dict = {}
    for line in (raw or "").splitlines():
        if "=" in line:
            k, _, v = line.partition("=")
            st[k.strip()] = v.strip()
    st["_server_ts"] = int(datetime.now(timezone.utc).timestamp())
    # ── گیتِ قطعیِ ضدِ دمو: trade_mode از MT5 (۲=REAL). هر چیزِ دیگری (۰=DEMO،
    # ۱=CONTEST) حسابِ غیرواقعی است و هرگز نباید کپی/ترید کند. اگر EA trade_mode
    # نفرستد (نسخهٔ قدیمی)، گیتِ نام‌سرور در لینک پابرجاست. ──
    tm = st.get("trade_mode")
    is_demo = tm is not None and str(tm).strip() not in ("2", "")
    # قیدِ سختِ کاربر: «هیچ حسابِ دمو تحت هیچ شرایطی وارد پروژه/پنل نشود.»
    # بایپسِ ea:demo_allowed عمداً حذف شد تا دمو هرگز قابلِ فعال‌سازی نباشد → همیشه بلاک.
    _demo_ok = False
    if is_demo and not _demo_ok:
        try:
            await redis_client.client.set(f"ea:user:{uid}:demo_blocked", "1", ex=86400)
        except Exception:  # noqa: BLE001
            pass
    # ── فاز ۵: محافظتِ دراوداونِ هر کاربر (افتِ سرمایه از سقف > حد → pause کپی) ──
    try:
        _bal = float(st.get("balance") or 0) or float(st.get("equity") or 0)
        if _bal > 0 and settings.USER_MAX_DRAWDOWN_PCT > 0:
            _pk = f"ea:user:{uid}:peak_bal"
            _peak = float(await redis_client.client.get(_pk) or 0)
            if _bal > _peak:
                await redis_client.client.set(_pk, str(_bal))
                _peak = _bal
            if _peak > 0:
                _dd = 100.0 * (_peak - _bal) / _peak
                if _dd >= settings.USER_MAX_DRAWDOWN_PCT:
                    await redis_client.client.set(f"ea:user:{uid}:dd_paused", "1", ex=86400)
                    logger.warning("user_copy_dd_paused", uid=uid, dd_pct=round(_dd, 1))
    except Exception:  # noqa: BLE001
        pass
    await redis_client.client.set(f"ea:status:user:{uid}", __import__("json").dumps(st), ex=120)
    await _detect_dismissed(uid, st.get("positions", ""))  # ضدِ re-open per-user
    # همگام‌سازیِ موجودی/اکوئیتی به trading_accounts (نمایش در پنل)
    try:
        from src.core.database import CopySettings, TradingAccount, async_session_factory
        async with async_session_factory() as db:
            acc = (await db.execute(
                select(TradingAccount).where(TradingAccount.user_id == uid)
                .order_by(TradingAccount.id.desc())
            )).scalars().first()
            if acc:
                if is_demo and not _demo_ok:
                    # حسابِ دمو/مسابقه: بلاکِ کامل — کپی خاموش، وضعیتِ مسدود
                    acc.status = "demo_blocked"
                    acc.last_error = "حسابِ دمو/غیرواقعی است؛ فقط حسابِ Real مجاز است."
                    cs = (await db.execute(select(CopySettings).where(CopySettings.user_id == uid))).scalar_one_or_none()
                    if cs and cs.enabled:
                        cs.enabled = False
                    # اعلانِ یک‌بارهٔ کاربر
                    try:
                        if await redis_client.client.set(f"ea:user:{uid}:demo_notified", "1", nx=True, ex=86400):
                            await redis_client.client.rpush("telegram:direct_messages", __import__("json").dumps(
                                {"telegram_id": acc.telegram_id,
                                 "message": "⛔️ حسابِ متصل‌شده «دمو/غیرواقعی» است و کپی‌ترید روی آن مجاز نیست. "
                                            "لطفاً حسابِ واقعی (Real/Live) متصل کنید."}, ensure_ascii=False))
                    except Exception:  # noqa: BLE001
                        pass
                else:
                    acc.status = "connected" if st.get("connected") == "1" else "error"
                    if st.get("connected") != "1":
                        acc.last_error = "اتصال برقرار نیست"
                    else:
                        acc.last_error = None
                acc.balance = float(st.get("balance") or 0) or None
                acc.equity = float(st.get("equity") or 0) or None
                acc.currency = st.get("currency") or acc.currency
                acc.last_seen = datetime.now(timezone.utc)
                if int(float(st.get("open", 0) or 0)) > 0:
                    acc.last_trade_at = datetime.now(timezone.utc)
                await db.commit()
    except Exception:  # noqa: BLE001
        pass


async def _touch_server(db, ip: str, hostname: str = "", hetzner_id: int = 0):
    """ثبت/به‌روزرسانیِ یک سرورِ ویندوزِ کپی با IP (auto-register)."""
    from src.core.database import CopyServer
    now = datetime.now(timezone.utc)
    srv = (await db.execute(select(CopyServer).where(CopyServer.ip == ip))).scalar_one_or_none()
    if srv is None:
        srv = CopyServer(ip=ip, hostname=hostname or None, name=hostname or ip,
                         hetzner_id=hetzner_id or None, status="active",
                         capacity=settings.COPY_USERS_PER_SERVER, last_seen_at=now)
        db.add(srv)
    else:
        srv.last_seen_at = now
        if srv.status == "down":
            srv.status = "active"
        if hostname:
            srv.hostname = hostname
        if hetzner_id:
            srv.hetzner_id = hetzner_id
    await db.commit()
    await db.refresh(srv)
    return srv


async def _assign_unassigned(db):
    """حساب‌های فعالِ کپی که هنوز سرور ندارند را به کم‌بارترین سرورِ فعالِ دارای ظرفیت
    assign می‌کند (sharding پایدار — هر حساب فقط روی یک سرور؛ تریدِ دوبل ممنوع)."""
    from sqlalchemy import func
    from src.core.database import CopyServer, CopySettings, TradingAccount
    servers = (await db.execute(
        select(CopyServer).where(CopyServer.status == "active"))).scalars().all()
    if not servers:
        return
    counts = {}
    for s in servers:
        counts[s.id] = (await db.execute(
            select(func.count()).select_from(TradingAccount)
            .where(TradingAccount.server_id == s.id))).scalar() or 0
    pending = (await db.execute(
        select(TradingAccount).join(CopySettings, CopySettings.user_id == TradingAccount.user_id)
        .where(TradingAccount.server_id.is_(None), CopySettings.enabled.is_(True)))).scalars().all()
    changed = False
    for acc in pending:
        chosen = None
        for s in sorted(servers, key=lambda x: counts[x.id]):
            if counts[s.id] < s.capacity:
                chosen = s
                break
        if chosen is None:
            break  # ظرفیتِ کل تمام شد → منتظرِ scale-out
        acc.server_id = chosen.id
        counts[chosen.id] += 1
        changed = True
    if changed:
        await db.commit()


@router.get("/users")
async def ea_users(token: str = Query(...), ip: str = Query(""), host: str = Query(""),
                   hid: int = Query(0), db: AsyncSession = Depends(get_db)):
    """لیستِ حساب‌هایی که این سرور باید اجرا کند (فقط سهمِ همین سرور = sharding).
    شاملِ کردنشالِ رمزگشایی‌شده — فقط روی شبکهٔ داخلی با token. هرگز عمومی نشود.

    sharding: سرور با IP خودش (ip) شناخته می‌شود؛ فقط حساب‌هایی که server_id آن‌ها به
    همین سرور assign شده برگردانده می‌شود. سرورِ بدونِ ip یا ناشناس → لیستِ خالی
    (محافظت در برابرِ اجرای یک حساب روی چند سرور = تریدِ دوبل)."""
    if not _ea_token_ok(token):
        raise HTTPException(status_code=403, detail="forbidden")
    return _oneroyal_referral_state(users=[], live=False)

    # Historical implementation retained below but unreachable while referral-only.
    from src.core.crypto import decrypt_secret
    from src.core.database import TradingAccount

    # سرورِ بدونِ شناسه نباید هیچ کاربری اجرا کند (ایمنیِ sharding)
    if not ip:
        return {"users": [], "live": True, "note": "no_server_ip"}
    srv = await _touch_server(db, ip, host, hid)
    await _assign_unassigned(db)
    if srv.status != "active":
        return {"users": [], "live": True, "server_id": srv.id, "note": "draining"}

    accts = (await db.execute(
        select(TradingAccount).where(TradingAccount.server_id == srv.id))).scalars().all()
    out = []
    for a in accts[: settings.COPY_MAX_USERS]:
        pw = decrypt_secret(a.password_enc)
        if not pw:
            continue
        out.append({"uid": a.user_id, "login": a.login, "server": a.server, "password": pw})
    # ── حسابِ مَستر (uid=0) روی همین سرور اجرا شود (به‌جای Wine) ──
    # فقط روی سرورِ مَستر (ea:master_server_id)؛ اگر تنظیم نشده، روی سرورِ فعالِ موجود.
    try:
        macct = await get_master_account()
        if macct:
            msrv = await redis_client.client.get("ea:master_server_id")
            run_here = (int(msrv) == srv.id) if msrv else True  # پیش‌فرض: همین سرور
            if run_here:
                mpw = decrypt_secret(macct.get("password_enc", ""))
                if mpw and macct.get("login") and macct.get("server"):
                    out.append({"uid": 0, "login": str(macct["login"]),
                                "server": macct["server"], "password": mpw, "is_master": True})
    except Exception as exc:  # noqa: BLE001
        logger.warning("master_account_attach_failed", error=str(exc))
    return {"users": out, "live": True, "server_id": srv.id}


# ════════════════════════════════════════════════════════════════
#  دیلِ واقعی — EA پوزیشن‌های بسته‌شده را با کمیسیون/سواپِ واقعی گزارش می‌کند
# ════════════════════════════════════════════════════════════════
def _pip_size(sym: str) -> float:
    s = (sym or "").upper()
    if "JPY" in s:
        return 0.01
    if s.startswith("XAU"):
        return 0.1
    if s.startswith("XAG"):
        return 0.01
    if any(s.startswith(p) for p in ("US30", "US500", "NAS", "DE40", "SPX", "NDX")):
        return 1.0
    return 0.0001


@router.post("/deals")
async def ea_deals(
    body: dict,
    token: str = Query(...),
    uid: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    """دریافتِ دیلِ بسته‌شدهٔ واقعی از EA و ثبت در trade_history (idempotent بر deal_id).
    هر دیل: deal_id, position, signal_id, symbol, dir, volume, entry, exit, open_time,
    close_time, profit (ناخالص), commission, swap, reason, balance."""
    if not _ea_token_ok(token):
        raise HTTPException(status_code=403, detail="forbidden")
    _reject_oneroyal_operation()
    deals = body.get("deals") or []
    if not isinstance(deals, list) or not deals:
        return {"ok": True, "inserted": 0}

    from sqlalchemy.dialects.postgresql import insert as pg_insert

    inserted = 0
    for d in deals[:200]:
        try:
            did = int(d.get("deal_id") or 0)
            if did <= 0:
                continue
            sym = str(d.get("symbol") or "")
            gross = float(d.get("profit") or 0.0)
            comm = float(d.get("commission") or 0.0)
            swap = float(d.get("swap") or 0.0)
            net = gross + comm + swap
            entry = float(d.get("entry") or 0.0)
            exit_ = float(d.get("exit") or 0.0)
            direction = str(d.get("dir") or "").lower()
            ps = _pip_size(sym)
            pips = None
            if entry and exit_ and ps:
                raw = (exit_ - entry) if direction in ("buy", "long") else (entry - exit_)
                pips = round(raw / ps, 1)
            ct = d.get("close_time")
            ct_dt = datetime.fromtimestamp(int(ct), tz=timezone.utc) if ct else None
            sig_id = int(d.get("signal_id") or 0) or None
            # ورود/زمانِ ورود را از خودِ سیگنال پر می‌کنیم (EA فقط exit می‌فرستد)
            ot_dt = None
            if not entry and sig_id:
                sig = (await db.execute(select(Signal).where(Signal.id == sig_id))).scalar_one_or_none()
                if sig:
                    entry = float(sig.entry_price or 0.0)
                    ot_dt = sig.created_at
                    if not direction:
                        direction = "sell" if (sig.direction or "").lower() in ("sell", "short") else "buy"
                    # pips را با entryِ واقعی بازمحاسبه کن
                    if entry and exit_ and ps:
                        raw = (exit_ - entry) if direction in ("buy", "long") else (entry - exit_)
                        pips = round(raw / ps, 1)
            dur = int((ct_dt - ot_dt).total_seconds()) if (ot_dt and ct_dt and ct_dt > ot_dt) else None
            stmt = pg_insert(TradeHistory).values(
                account_uid=uid, deal_id=did,
                position_ticket=int(d.get("position") or 0) or None,
                signal_id=sig_id,
                symbol=sym, direction=direction,
                volume=float(d.get("volume") or 0.0),
                entry_price=entry or None, exit_price=exit_ or None,
                open_time=ot_dt, close_time=ct_dt, duration_sec=dur,
                gross_profit=gross, commission=comm, swap=swap,
                spread_cost=float(d.get("spread_cost") or 0.0) or None,
                net_profit=net, pips=pips,
                close_reason=str(d.get("reason") or "")[:20] or None,
                balance_after=float(d.get("balance") or 0.0) or None,
            ).on_conflict_do_nothing(constraint="uq_trade_account_deal")
            res = await db.execute(stmt)
            if res.rowcount:
                inserted += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("ea_deal_parse_failed", error=str(exc))
            continue
    await db.commit()
    if inserted:
        logger.info("ea_deals_ingested", uid=uid, inserted=inserted)
    return {"ok": True, "inserted": inserted}


# ════════════════════════════════════════════════════════════════
#  مشخصاتِ واقعیِ نماد از بروکر (EA گزارش می‌کند) → redis symspec:{symbol}
#  چون contract_size/tick_value بینِ بروکرها فرق دارد، تنها منبعِ دقیق همین است.
# ════════════════════════════════════════════════════════════════
def _pip_from_point(point: float, digits: int) -> float:
    """pip = point×۱۰ برای نمادهای fractional-pip (digits ۳ یا ۵)، وگرنه point."""
    if point <= 0:
        return 0.0001
    return point * 10.0 if digits in (3, 5) else point


@router.post("/symbols")
async def ea_symbols(body: dict, token: str = Query(...), uid: int = Query(0)):
    """کلِ لیستِ نمادهای بروکر (EA یک‌بار dump می‌کند) → redis ea:symbols:{uid}.
    برای کشفِ نامِ واقعیِ نزدک/نفت/گاز روی OneRoyal و نگاشتِ نام."""
    if not _ea_token_ok(token):
        raise HTTPException(status_code=403, detail="forbidden")
    _reject_oneroyal_operation()
    raw = str(body.get("symbols") or "")
    n = len([x for x in raw.splitlines() if x.strip()])
    try:
        await redis_client.client.set(f"ea:symbols:{uid}", raw, ex=7 * 86400)
    except Exception:  # noqa: BLE001
        pass
    logger.info("ea_symbols_stored", uid=uid, count=n)
    return {"ok": True, "count": n}


@router.post("/specs")
async def ea_specs(body: dict, token: str = Query(...), uid: int = Query(0),
                   db: AsyncSession = Depends(get_db)):
    """مشخصاتِ واقعیِ بروکر برای هر نماد. هر spec (مقادیرِ خامِ MT5):
    symbol, contract_size, tick_size, tick_value, point, digits, stops_level, spread_points.
    سرور pip_size/pip_dollar/spread_pips/min_stop_pips را محاسبه و در redis ذخیره می‌کند."""
    if not _ea_token_ok(token):
        raise HTTPException(status_code=403, detail="forbidden")
    _reject_oneroyal_operation()
    specs = body.get("specs") or []
    if not isinstance(specs, list):
        return {"ok": True, "stored": 0}
    import json as _json
    stored = 0
    for s in specs[:60]:
        try:
            sym = str(s.get("symbol") or "").strip()
            if not sym:
                continue
            cs = float(s.get("contract_size") or 0)
            tsz = float(s.get("tick_size") or 0)
            tv = float(s.get("tick_value") or 0)
            pt = float(s.get("point") or 0)
            dg = int(s.get("digits") or 0)
            stops = float(s.get("stops_level") or 0)
            spr = float(s.get("spread_points") or 0)
            if pt <= 0 or cs <= 0:
                continue
            # pip_sizeِ مرسومِ ثابت را نگه می‌داریم (سازگاریِ تاریخیِ شمارشِ پیپ)؛ مقادیرِ
            # اسپرد/min_stop/دلار را نسبت به همان pipِ مرسوم محاسبه می‌کنیم (نه pointِ خام).
            from src.core.instruments import static_pip_size_of
            pip = static_pip_size_of(sym) or _pip_from_point(pt, dg)
            pip_dollar = (tv * (pip / tsz)) if (tv > 0 and tsz > 0) else 0.0
            spread_pips = (spr * pt / pip) if pip > 0 else 0.0
            min_stop_pips = (stops * pt / pip) if pip > 0 else 0.0
            rec = {"symbol": sym, "contract_size": cs,
                   "pip_dollar_per_lot": round(pip_dollar, 4),
                   "spread_pips": round(spread_pips, 2), "min_stop_pips": round(min_stop_pips, 2)}
            await redis_client.client.set(f"symspec:{sym}", _json.dumps(rec), ex=7 * 86400)
            stored += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("ea_spec_parse_failed", error=str(exc))
    if stored:
        logger.info("ea_specs_stored", uid=uid, count=stored)
    return {"ok": True, "stored": stored}
