"""R8 — کپی‌تریدِ فارکسِ زنده: کنترل‌های اضطراری، تاریخچه، KYC + دیسکلیمر (قلمروِ کاربرِ اپ)."""
from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.academy import current_student
from src.core.database import AcademyStudent, BnExchangeAccount
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

_DISCLAIMER_VERSION = "1"
_DISCLAIMER_TEXT = (
    "کپی‌ترید و معاملهٔ اهرمی ریسکِ بالایی دارد و ممکن است به از دست رفتنِ کاملِ سرمایه منجر شود. "
    "عملکردِ گذشته تضمینی برای آینده نیست. این خدمت «توصیهٔ سرمایه‌گذاری» نیست و مسئولیتِ تصمیم‌ها با خودِ کاربر است."
)


async def _forex_mt5_login(st, db) -> str | None:
    acc = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == "mt5"))).scalars().first()
    return acc.account_ref if acc else None


def _fx_base() -> str:
    return os.getenv("BN_FOREX_SVC_URL", "http://10.10.1.3:8000")


def _fx_headers() -> dict:
    return {"X-Internal-Token": os.getenv("BN_BRIDGE_TOKEN", "")}


# ── §2 کنترل‌های اضطراری ──
@router.post("/copytrade/stop")
async def copytrade_stop(payload: dict = Body(default={}),
                         st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    market = payload.get("market", "forex")
    if market != "forex":
        st.copy_crypto = False
        await db.commit()
        return {"ok": True}
    login = await _forex_mt5_login(st, db)
    st.copy_forex = False
    await db.commit()
    if not login:
        return {"ok": True, "note": "MT5 متصل نیست."}
    try:
        async with httpx.AsyncClient(timeout=6.0) as cx:
            await cx.post(_fx_base() + "/user/copy-svc-stop", headers=_fx_headers(), json={"mt5_login": login})
    except Exception as e:  # noqa: BLE001
        logger.warning("copy_stop_fwd_failed", error=str(e))
    return {"ok": True}


@router.post("/copytrade/close-all")
async def copytrade_close_all(payload: dict = Body(default={}),
                              st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    login = await _forex_mt5_login(st, db)
    if not login:
        raise HTTPException(404, "حسابِ MT5 متصل نیست.")
    try:
        async with httpx.AsyncClient(timeout=8.0) as cx:
            r = await cx.post(_fx_base() + "/user/copy-svc-close-all", headers=_fx_headers(), json={"mt5_login": login})
            if r.status_code == 200:
                return {"ok": True}
    except Exception as e:  # noqa: BLE001
        logger.warning("close_all_fwd_failed", error=str(e))
    raise HTTPException(502, "ارسالِ فرمان به سرورِ اجرا ناموفق بود.")


@router.post("/copytrade/close/{pos_id}")
async def copytrade_close_one(pos_id: int, payload: dict = Body(default={}),
                              st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    login = await _forex_mt5_login(st, db)
    symbol = str(payload.get("symbol") or "").strip()
    if not login:
        raise HTTPException(404, "حسابِ MT5 متصل نیست.")
    if not symbol:
        raise HTTPException(400, "برای بستنِ پوزیشن، نمادِ آن لازم است (symbol).")
    try:
        async with httpx.AsyncClient(timeout=8.0) as cx:
            r = await cx.post(_fx_base() + "/user/copy-svc-close", headers=_fx_headers(),
                              json={"mt5_login": login, "symbol": symbol})
            if r.status_code == 200:
                return {"ok": True}
    except Exception as e:  # noqa: BLE001
        logger.warning("close_one_fwd_failed", error=str(e))
    raise HTTPException(502, "بستنِ پوزیشن ناموفق بود.")


# ── §5 تاریخچه/عملکردِ کپیِ فارکس ──
@router.get("/copytrade/history")
async def copytrade_history(market: str = "forex",
                            st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    if market != "forex":
        return {"win_rate": 0, "net_pnl": 0.0, "closed_count": 0, "curve": [], "trades": []}
    login = await _forex_mt5_login(st, db)
    if not login:
        return {"win_rate": 0, "net_pnl": 0.0, "closed_count": 0, "curve": [], "trades": [], "connected": False}
    try:
        async with httpx.AsyncClient(timeout=8.0) as cx:
            r = await cx.get(_fx_base() + "/user/copy-svc-history", params={"login": login}, headers=_fx_headers())
            if r.status_code == 200:
                return r.json()
    except Exception as e:  # noqa: BLE001
        logger.warning("copy_history_fwd_failed", error=str(e))
    return {"win_rate": 0, "net_pnl": 0.0, "closed_count": 0, "curve": [], "trades": []}


# ── §4 KYC ──
@router.get("/kyc")
async def get_kyc(st: AcademyStudent = Depends(current_student)):
    return {"status": getattr(st, "kyc_status", None) or "none",
            "full_name": getattr(st, "kyc_full_name", None), "country": getattr(st, "kyc_country", None)}


@router.post("/kyc")
async def submit_kyc(payload: dict = Body(...),
                     st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    fn = (payload.get("full_name") or "").strip()
    country = (payload.get("country") or "").strip()
    if not fn or not country:
        raise HTTPException(400, "نام و کشور لازم است.")
    # تأییدِ آنیِ خودکار (مطابقِ رفتارِ کوین‌پرو)
    st.kyc_full_name = fn[:120]
    st.kyc_country = country[:60]
    st.kyc_status = "approved"
    await db.commit()
    return {"status": "approved", "approved": True}


# ── §4 دیسکلیمر ──
@router.get("/disclaimer")
async def get_disclaimer(st: AcademyStudent = Depends(current_student)):
    accepted = (getattr(st, "disclaimer_version", None) == _DISCLAIMER_VERSION)
    return {"accepted": bool(accepted), "version": _DISCLAIMER_VERSION, "text": _DISCLAIMER_TEXT}


@router.post("/disclaimer/accept")
async def accept_disclaimer(payload: dict = Body(default={}),
                            st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    st.disclaimer_version = _DISCLAIMER_VERSION
    await db.commit()
    return {"ok": True, "accepted": True}
