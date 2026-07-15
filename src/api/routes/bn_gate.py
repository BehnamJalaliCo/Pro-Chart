"""B24 — signal access and crypto copy settings.

OneRoyal is referral-only. Legacy forex-copy routes deliberately expose no
MT5 connection, persistence, or execution surface. Forex signal analysis is
independent of broker integration and retains its trial/subscription gate.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.academy import current_student
from src.core.database import AcademyStudent, BnExchangeAccount
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

_CRYPTO_MIN_DEPOSIT = float(os.getenv("BN_CRYPTO_MIN_DEPOSIT", "50"))
_FOREX_TRIAL_HOURS = int(os.getenv("BN_FOREX_TRIAL_HOURS", "48"))
_ONEROYAL_REFERRAL_PATH = "/go/oneroyal"


def _forex_referral_state(**extra) -> dict:
    state = {
        "referral_only": True,
        "integration_level": "referral_only",
        "referral_path": _ONEROYAL_REFERRAL_PATH,
        "connected": False,
        "eligible": False,
        "enabled": False,
    }
    state.update(extra)
    return state


def _reject_forex_copy_action() -> None:
    raise HTTPException(
        status_code=403,
        detail=_forex_referral_state(reason="oneroyal_referral_only"),
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── تریالِ ۴۸ساعتهٔ فارکس (یک‌بارمصرف، بازتولیدِ مکانیزمِ CoinePro) ──
async def grant_forex_trial(st: AcademyStudent, db: AsyncSession) -> None:
    """در ثبت‌نامِ اول: تریالِ ۴۸ساعته بده — فقط اگر تریالِ قبلی و اشتراکِ فعالی نباشد."""
    try:
        if st.forex_signal_until is not None:
            return  # قبلاً یک‌بار داده شده
        if st.forex_copy_until and st.forex_copy_until > _now():
            return  # اشتراکِ فعال دارد
        st.forex_signal_until = _now() + timedelta(hours=_FOREX_TRIAL_HOURS)
        await db.commit()
    except Exception as e:  # noqa: BLE001
        logger.warning("grant_forex_trial_failed", error=str(e))


def _prochart_active(st: AcademyStudent) -> bool:
    from src.api.routes.bazaarnama import _prochart_active as _pa
    return _pa(st)


async def _crypto_gate(st: AcademyStudent, db: AsyncSession) -> dict:
    """کریپتو: رفرالِ LBank + موجودی ≥ $۵۰. بدونِ تریال."""
    acc = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == "lbank"))).scalars().first()
    if not acc or acc.status != "active":
        return {"allowed": False, "reason": "connect_required", "deposit_needed": _CRYPTO_MIN_DEPOSIT}
    if not getattr(acc, "referral_verified", False):
        return {"allowed": False, "reason": "referral_required", "deposit_needed": _CRYPTO_MIN_DEPOSIT}
    # موجودیِ زندهٔ حسابِ کاربر (کششِ کوتاه‌کش)
    bal = await _crypto_balance(st, acc)
    if bal is None:
        return {"allowed": False, "reason": "deposit_unverified", "deposit_needed": _CRYPTO_MIN_DEPOSIT}
    if bal < _CRYPTO_MIN_DEPOSIT:
        return {"allowed": False, "reason": "deposit_required",
                "deposit_needed": round(_CRYPTO_MIN_DEPOSIT - bal, 2), "balance": round(bal, 2)}
    return {"allowed": True, "reason": "ok", "deposit_needed": 0, "balance": round(bal, 2)}


async def _crypto_balance(st: AcademyStudent, acc) -> float | None:
    """موجودیِ USDT حسابِ فیوچرزِ کاربر (کشِ ۶۰ثانیه در Redis)."""
    try:
        from src.core.redis_client import redis_client
        ck = f"bn:cbal:{st.id}"
        cached = await redis_client.client.get(ck)
        if cached is not None:
            try:
                return float(cached)
            except Exception:  # noqa: BLE001
                pass
        from src.core.crypto import decrypt_secret
        from src.api.routes import crypto_exec
        key = decrypt_secret(acc.enc_key or "") or ""
        sec = decrypt_secret(acc.enc_secret or "") or ""
        if not key or not sec:
            return None
        bal = await crypto_exec.balance(key, sec)
        if bal is not None:
            await redis_client.client.set(ck, str(bal), ex=60)
        return bal
    except Exception as e:  # noqa: BLE001
        logger.warning("crypto_balance_failed", sid=st.id, error=str(e))
        return None


def _forex_gate(st: AcademyStudent) -> dict:
    """فارکس تحلیلی: تریالِ ۴۸ساعته یا اشتراکِ فعال، مستقل از OneRoyal."""
    fsu = st.forex_signal_until
    if fsu and fsu > _now():
        return {"allowed": True, "reason": "trial", "trial_ends_at": fsu.isoformat()}
    if _prochart_active(st):
        return {"allowed": True, "reason": "subscription", "trial_ends_at": None}
    if fsu is not None:
        return {"allowed": False, "reason": "trial_expired", "trial_ends_at": fsu.isoformat()}
    return {"allowed": False, "reason": "subscription_required", "trial_ends_at": None}


@router.get("/signal-access")
async def signal_access(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """منبعِ واحدِ حقیقتِ گیتِ سیگنال برای اپ."""
    return {"crypto": await _crypto_gate(st, db), "forex": _forex_gate(st),
            "crypto_min_deposit": _CRYPTO_MIN_DEPOSIT, "forex_trial_hours": _FOREX_TRIAL_HOURS}


# ══════════ تنظیماتِ کاملِ پنلِ کپی ══════════
def _b(v, d):  # bool
    return bool(v) if isinstance(v, bool) or v in (0, 1, "0", "1", "true", "false", True, False) else d


def _clampi(v, lo, hi, d):
    try:
        return max(lo, min(hi, int(float(v))))
    except Exception:  # noqa: BLE001
        return d


def _clampf(v, lo, hi, d):
    try:
        return max(lo, min(hi, float(v)))
    except Exception:  # noqa: BLE001
        return d


# ── کریپتو: ۲۳ فیلد (نام‌ها عیناً مطابقِ user_trade_settings تریدیار) ──
_CRYPTO_DEFAULTS = {
    "enabled": False, "leverage_value": 5, "amount_value": 50.0,
    "margin_mode": "ISOLATED", "position_type": "HEDGE", "amount_mode": "MARGIN",
    "auto_tp_sl_enabled": True, "auto_entry_enabled": True, "tp_target": 2,
    "order_price_type": "4", "tp_sl_order_price_type": "0",
    "trigger_price_type": 1, "trigger_price_calc_type": 0,
    "sl_mode": "EXACT", "sl_offset_pct": None, "trailing_stop_enabled": False,
    "use_server_tp_sl": False, "max_positions": 3,
    "signature_method": "HmacSHA256", "product_group": "SwapU", "use_trader_api": False,
}


def _clamp_crypto(inp: dict) -> dict:
    o = {}
    for k, v in inp.items():
        if k in ("api_key", "api_secret"):
            continue  # کلید از مسیرِ connect/lbank، نه اینجا
        if k == "enabled":
            o[k] = _b(v, False)
        elif k == "leverage_value":
            o[k] = _clampi(v, 1, 125, 5)
        elif k == "amount_value":
            o[k] = _clampf(v, 5.0, 100000.0, 50.0)
        elif k == "margin_mode":
            o[k] = "ISOLATED"  # قفل
        elif k == "position_type":
            o[k] = v if v in ("HEDGE", "NET") else "HEDGE"
        elif k == "amount_mode":
            o[k] = v if v in ("MARGIN", "NOTIONAL") else "MARGIN"
        elif k in ("auto_tp_sl_enabled", "auto_entry_enabled", "trailing_stop_enabled",
                   "use_server_tp_sl", "use_trader_api"):
            o[k] = _b(v, _CRYPTO_DEFAULTS[k])
        elif k == "tp_target":
            o[k] = _clampi(v, 1, 6, 2)
        elif k == "order_price_type":
            o[k] = "4"  # قفلِ market
        elif k == "tp_sl_order_price_type":
            o[k] = str(v) if str(v) in ("0", "1", "2") else "0"
        elif k == "trigger_price_type":
            o[k] = _clampi(v, 0, 1, 1)
        elif k == "trigger_price_calc_type":
            o[k] = _clampi(v, 0, 3, 0)
        elif k == "sl_mode":
            o[k] = v if v in ("EXACT", "OFFSET") else "EXACT"
        elif k == "sl_offset_pct":
            if v is None:
                o[k] = None
            else:
                f = _clampf(v, 0.01, 100.0, 1.0)
                o[k] = f
                o["sl_mode"] = "OFFSET"
        elif k == "max_positions":
            o[k] = _clampi(v, 1, 50, 3)
        elif k == "signature_method":
            o[k] = "HmacSHA256"
        elif k == "product_group":
            o[k] = "SwapU"
    return o


async def _get_settings(table: str, sid: int, db) -> dict:
    row = (await db.execute(text(f"SELECT data FROM {table} WHERE student_id=:s"), {"s": sid})).first()
    return dict(row[0]) if row and row[0] else {}


async def _save_settings(table: str, sid: int, data: dict, db) -> None:
    import json
    await db.execute(text(
        f"INSERT INTO {table} (student_id, data, updated_at) VALUES (:s, CAST(:d AS jsonb), now()) "
        f"ON CONFLICT (student_id) DO UPDATE SET data=CAST(:d AS jsonb), updated_at=now()"),
        {"s": sid, "d": json.dumps(data)})
    await db.commit()


@router.get("/copytrade/crypto/settings")
async def get_crypto_settings(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    stored = await _get_settings("bn_crypto_copy_settings", st.id, db)
    out = {**_CRYPTO_DEFAULTS, **stored}
    acc = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == "lbank"))).scalars().first()
    out["api_key_set"] = bool(acc and acc.enc_key)
    out["api_secret_set"] = bool(acc and acc.enc_secret)
    return out


@router.post("/copytrade/crypto/settings")
async def set_crypto_settings(payload: dict = Body(...),
                              st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    stored = await _get_settings("bn_crypto_copy_settings", st.id, db)
    merged = {**stored, **_clamp_crypto(payload)}
    await _save_settings("bn_crypto_copy_settings", st.id, merged, db)
    return {"ok": True, **{**_CRYPTO_DEFAULTS, **merged}}


@router.get("/copytrade/forex/settings")
async def get_forex_settings(st: AcademyStudent = Depends(current_student)):
    """Compatibility response; no MT5 lookup or forex settings read occurs."""
    del st
    return _forex_referral_state(settings_available=False)


@router.post("/copytrade/forex/settings")
async def set_forex_settings(st: AcademyStudent = Depends(current_student)):
    """Forex copy settings are not a ProChart product surface."""
    del st
    _reject_forex_copy_action()
