"""فاز ۷ — بخشِ 7D: سکیوریتی (شکاف‌ها).

قرارداد: `SERVER_HANDOFF_08_...md` §7D. مسیرها زیرِ `/academy/security/`. همه نیازِ توکن.
2FA = TOTP (stdlib، بدونِ pyotp). api-keys بازاستفاده از `BnExchangeAccount` + رمزنگاریِ Fernet.
قفلِ اپ/بیومتریک سمتِ کلاینت است.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.academy import current_student
from src.core.database import AcademyDevice, BnExchangeAccount
from src.core.logger import get_logger
from src.core.security import verify_access_token

logger = get_logger(__name__)
router = APIRouter()

_PROVIDERS = ("lbank", "coinprofx8")


def _reject_guest(authorization: Optional[str]) -> None:
    if not authorization or " " not in authorization:
        return
    p = verify_access_token(authorization.split(" ", 1)[1].strip())
    if p and p.get("guest"):
        raise HTTPException(status_code=401, detail={"error": {"code": "GUEST_FORBIDDEN", "message": "وارد شو."}})


def _ms(dt) -> Optional[int]:
    return int(dt.timestamp() * 1000) if dt else None


# ── TOTP (RFC 6238، stdlib) ──
def _b32secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _totp(secret: str, at: Optional[float] = None, step: int = 30, digits: int = 6) -> str:
    pad = "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(secret + pad)
    counter = int((at if at is not None else time.time()) // step)
    h = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    o = h[-1] & 0x0F
    code = (struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code).zfill(digits)


def _totp_valid(secret: str, code: str, window: int = 1) -> bool:
    code = str(code or "").strip()
    now = time.time()
    return any(_totp(secret, now + w * 30) == code for w in range(-window, window + 1))


def _device_browser(ua: Optional[str]) -> str:
    ua = (ua or "").lower()
    return ("Chrome" if "chrome" in ua and "edg" not in ua else "Edge" if "edg" in ua
            else "Safari" if "safari" in ua else "Firefox" if "firefox" in ua else "مرورگر")


# ── Overview ──
@router.get("/security/overview")
async def security_overview(authorization: Optional[str] = Header(None),
                            st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    tf = (await db.execute(text("SELECT method,enabled FROM academy_2fa WHERE student_id=:s"),
                           {"s": st.id})).first()
    accs = (await db.execute(select(BnExchangeAccount).where(BnExchangeAccount.student_id == st.id))).scalars().all()
    devices = (await db.execute(select(AcademyDevice).where(AcademyDevice.student_id == st.id))).scalars().all()
    last = max(devices, key=lambda d: d.last_seen_at or datetime.min.replace(tzinfo=timezone.utc), default=None)
    return {
        "two_factor": {"enabled": bool(tf and tf[1]), "methods": ["authenticator", "email", "phone"]},
        "kyc": {"status": getattr(st, "kyc_status", "none") or "none"},
        "connections": {"exchange": any(a.kind == "lbank" and a.status == "active" for a in accs),
                        "broker": any(a.kind == "mt5" for a in accs)},
        "sessions_count": len(devices),
        "last_login": ({"ip": getattr(last, "ip", None), "country": None,
                        "device": getattr(last, "device_name", None),
                        "at": _ms(getattr(last, "last_seen_at", None))} if last else None),
    }


# ── 2FA ──
@router.post("/security/2fa/setup")
async def twofa_setup(method: str = Body("authenticator", embed=True), authorization: Optional[str] = Header(None),
                      st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    if method != "authenticator":
        # email/phone: کدِ OTP از مسیرهای موجود؛ اینجا فقط authenticator (TOTP)
        raise HTTPException(status_code=400, detail={"error": {"code": "unsupported_method",
                            "message": "فعلاً فقط authenticator (TOTP)."}})
    sec = _b32secret()
    await db.execute(text(
        "INSERT INTO academy_2fa (student_id,method,secret,enabled,created_at) VALUES (:s,'authenticator',:sec,false,now()) "
        "ON CONFLICT (student_id) DO UPDATE SET secret=:sec, method='authenticator', enabled=false"),
        {"s": st.id, "sec": sec})
    await db.commit()
    label = getattr(st, "username", None) or f"student{st.id}"
    otpauth = f"otpauth://totp/Pro-Chart:{label}?secret={sec}&issuer=Pro-Chart&digits=6&period=30"
    return {"method": "authenticator", "secret": sec, "otpauth_url": otpauth}


@router.post("/security/2fa/verify")
async def twofa_verify(code: str = Body(..., embed=True), method: str = Body("authenticator", embed=True),
                       authorization: Optional[str] = Header(None),
                       st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    row = (await db.execute(text("SELECT secret FROM academy_2fa WHERE student_id=:s"), {"s": st.id})).first()
    if not row or not row[0]:
        raise HTTPException(status_code=400, detail={"error": {"code": "not_setup", "message": "ابتدا 2FA را راه‌اندازی کن."}})
    if not _totp_valid(row[0], code):
        raise HTTPException(status_code=400, detail={"error": {"code": "invalid_code", "message": "کد نامعتبر است."}})
    await db.execute(text("UPDATE academy_2fa SET enabled=true WHERE student_id=:s"), {"s": st.id})
    await db.commit()
    return {"enabled": True}


@router.post("/security/2fa/disable")
async def twofa_disable(code: str = Body(..., embed=True), authorization: Optional[str] = Header(None),
                        st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    row = (await db.execute(text("SELECT secret,enabled FROM academy_2fa WHERE student_id=:s"), {"s": st.id})).first()
    if not row or not row[1]:
        return {"enabled": False}
    if not _totp_valid(row[0], code):
        raise HTTPException(status_code=400, detail={"error": {"code": "invalid_code", "message": "کد نامعتبر است."}})
    await db.execute(text("DELETE FROM academy_2fa WHERE student_id=:s"), {"s": st.id})
    await db.commit()
    return {"enabled": False}


# ── Activity (از دستگاه‌ها؛ fail-soft) ──
@router.get("/security/activity")
async def security_activity(limit: int = 50, authorization: Optional[str] = Header(None),
                            st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    limit = max(1, min(int(limit), 100))
    devices = (await db.execute(select(AcademyDevice).where(AcademyDevice.student_id == st.id)
                                .order_by(AcademyDevice.last_seen_at.desc().nullslast()).limit(limit))).scalars().all()
    events = [{"type": "login", "ip": getattr(d, "ip", None), "country": None,
               "device": getattr(d, "device_name", None),
               "browser": _device_browser(getattr(d, "user_agent", None)),
               "at": _ms(getattr(d, "last_seen_at", None))} for d in devices]
    return {"events": events}


# ── API keys (BnExchangeAccount) ──
@router.get("/security/api-keys")
async def security_api_keys(authorization: Optional[str] = Header(None),
                            st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    accs = {a.kind: a for a in (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id))).scalars().all()}
    keys = []
    for prov in _PROVIDERS:
        # coinprofx8 (فارکس) در BnExchangeAccount kind ندارد → connected:false
        a = accs.get("lbank") if prov == "lbank" else None
        keys.append({"provider": prov, "connected": bool(a and a.status == "active"),
                     "permissions": (["read", "trade"] if a and getattr(a, "referral_verified", False) else ["read"]) if a else [],
                     "added_at": _ms(getattr(a, "created_at", None)) if a else None})
    return {"keys": keys}


@router.post("/security/api-keys")
async def security_add_key(provider: str = Body(..., embed=True), api_key: str = Body(..., embed=True),
                           api_secret: str = Body(..., embed=True), passphrase: Optional[str] = Body(None, embed=True),
                           authorization: Optional[str] = Header(None),
                           st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    if provider not in _PROVIDERS:
        raise HTTPException(status_code=400, detail={"error": {"code": "bad_provider", "message": "provider نامعتبر."}})
    if provider != "lbank":
        raise HTTPException(status_code=400, detail={"error": {"code": "unsupported",
                            "message": "اتصالِ کلیدِ این ارائه‌دهنده فعلاً از این مسیر نیست."}})
    if not (api_key or "").strip() or not (api_secret or "").strip():
        raise HTTPException(status_code=400, detail={"error": {"code": "missing", "message": "کلید و Secret لازم است."}})
    from src.core.crypto import encrypt_secret
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == "lbank"))).scalar_one_or_none()
    if not a:
        a = BnExchangeAccount(student_id=st.id, kind="lbank"); db.add(a)
    a.enc_key = encrypt_secret(api_key.strip())
    a.enc_secret = encrypt_secret(api_secret.strip())
    a.status = "active"
    await db.commit()
    return {"connected": True, "provider": provider}


@router.delete("/security/api-keys/{provider}")
async def security_delete_key(provider: str, authorization: Optional[str] = Header(None),
                              st=Depends(current_student), db: AsyncSession = Depends(get_db)) -> dict:
    _reject_guest(authorization)
    kind = "lbank" if provider == "lbank" else provider
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == kind))).scalar_one_or_none()
    if a:
        await db.delete(a)
        await db.commit()
    return {"connected": False, "provider": provider}
