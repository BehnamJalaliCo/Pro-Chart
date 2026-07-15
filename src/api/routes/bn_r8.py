"""R8 — legacy copy-trade boundary plus KYC and disclaimer APIs.

OneRoyal is referral-only; forex action routes are intentionally fail-closed.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.academy import current_student
from src.core.database import AcademyStudent

router = APIRouter()

_DISCLAIMER_VERSION = "1"
_DISCLAIMER_TEXT = (
    "کپی‌ترید و معاملهٔ اهرمی ریسکِ بالایی دارد و ممکن است به از دست رفتنِ کاملِ سرمایه منجر شود. "
    "عملکردِ گذشته تضمینی برای آینده نیست. این خدمت «توصیهٔ سرمایه‌گذاری» نیست و مسئولیتِ تصمیم‌ها با خودِ کاربر است."
)


def _forex_referral_state(**extra) -> dict:
    state = {
        "referral_only": True,
        "integration_level": "referral_only",
        "referral_path": "/go/oneroyal",
        "connected": False,
        "eligible": False,
        "enabled": False,
    }
    state.update(extra)
    return state


def _reject_forex_action() -> None:
    raise HTTPException(
        status_code=403,
        detail=_forex_referral_state(reason="oneroyal_referral_only"),
    )


# ── §2 کنترل‌های اضطراری ──
@router.post("/copytrade/stop")
async def copytrade_stop(market: str = "forex",
                         st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    if market != "forex":
        st.copy_crypto = False
        await db.commit()
        return {"ok": True}
    _reject_forex_action()


@router.post("/copytrade/close-all")
async def copytrade_close_all(st: AcademyStudent = Depends(current_student)):
    _reject_forex_action()


@router.post("/copytrade/close/{pos_id}")
async def copytrade_close_one(pos_id: int, st: AcademyStudent = Depends(current_student)):
    _reject_forex_action()


# ── §5 تاریخچه/عملکردِ کپیِ فارکس ──
@router.get("/copytrade/history")
async def copytrade_history(market: str = "forex",
                            st: AcademyStudent = Depends(current_student)):
    if market != "forex":
        return {"win_rate": 0, "net_pnl": 0.0, "closed_count": 0, "curve": [], "trades": []}
    del st
    return _forex_referral_state(
        win_rate=0,
        net_pnl=0.0,
        closed_count=0,
        curve=[],
        trades=[],
    )


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
