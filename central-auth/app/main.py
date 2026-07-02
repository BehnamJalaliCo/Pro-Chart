"""سرویسِ Auth مرکزیِ Pro-Chart — صدور/تأییدِ JWT واحد (RS256) + هویت/tier.

نسخهٔ اول (M2): login/refresh/logout/me/guest/jwks/health + set-tier.
ثبت‌نامِ OTP و مهاجرت در گام‌های بعدی سیم‌کشی می‌شوند.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import Base, engine, get_db
from app.models import AuditLog, Device, Identity, RefreshToken
from app.schemas import LoginIn, MeOut, RefreshIn, SetTierIn, TokenOut
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    jwks,
    verify_password,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # bootstrapِ اسکلت — در تولید با Alembic جایگزین می‌شود (M2 §rollout)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Pro-Chart Central Auth", version="0.1.0", lifespan=lifespan)

_TIER_RANK = {"free": 0, "vip": 1, "premium": 2}


def _effective_tier(idn: Identity) -> str:
    if idn.expires_at and idn.expires_at < datetime.now(timezone.utc):
        return "free"
    return idn.tier


async def _audit(db: AsyncSession, identity_id: str | None, action: str, detail: str | None = None) -> None:
    db.add(AuditLog(identity_id=identity_id, action=action, detail=detail))


async def _current_identity(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Identity:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "missing token")
    payload = decode_token(authorization.split(" ", 1)[1].strip())
    if not payload or payload.get("type") != "access":
        raise HTTPException(401, "invalid token")
    idn = await db.get(Identity, payload.get("sub"))
    if not idn or idn.status != "active":
        raise HTTPException(401, "inactive identity")
    return idn


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "central-auth", "version": app.version}


@app.get("/.well-known/jwks.json")
async def jwks_endpoint() -> dict:
    return jwks()


@app.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)) -> TokenOut:
    q = await db.execute(
        select(Identity).where(
            or_(Identity.username == body.identifier, Identity.email == body.identifier)
        )
    )
    idn = q.scalar_one_or_none()
    if not idn or not idn.password_hash or not verify_password(body.password, idn.password_hash):
        raise HTTPException(401, "bad credentials")
    if idn.status != "active":
        raise HTTPException(403, "disabled")

    # سقفِ دستگاه
    if body.device_id:
        dq = await db.execute(select(Device).where(Device.identity_id == idn.id))
        devices = dq.scalars().all()
        known = next((d for d in devices if d.device_id == body.device_id), None)
        if known:
            known.last_seen = datetime.now(timezone.utc)
        else:
            if len(devices) >= settings.MAX_DEVICES:
                raise HTTPException(409, "device limit reached")
            db.add(Device(identity_id=idn.id, device_id=body.device_id))

    tier = _effective_tier(idn)
    claims = {"sub": idn.id, "kind": idn.kind, "scope": "app", "tier": tier}
    if idn.legacy_student_id is not None:
        claims["legacy_student_id"] = idn.legacy_student_id
    access = create_access_token(claims)
    refresh = create_refresh_token({"sub": idn.id})
    rp = decode_token(refresh)
    db.add(RefreshToken(jti=rp["jti"], identity_id=idn.id, expires_at=datetime.fromtimestamp(rp["exp"], timezone.utc)))
    await _audit(db, idn.id, "login")
    await db.commit()
    return TokenOut(access_token=access, refresh_token=refresh, tier=tier, kind=idn.kind)


@app.post("/auth/guest", response_model=TokenOut)
async def guest() -> TokenOut:
    """مهمانِ اپ — بدونِ ردیفِ DB، جایگزینِ bn-guest. tier=free."""
    claims = {"sub": "guest:" + uuid.uuid4().hex[:12], "kind": "guest", "scope": "app", "tier": "free", "guest": True}
    return TokenOut(access_token=create_access_token(claims), refresh_token=None, tier="free", kind="guest")


@app.post("/auth/refresh", response_model=TokenOut)
async def refresh(body: RefreshIn, db: AsyncSession = Depends(get_db)) -> TokenOut:
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(401, "invalid refresh")
    row = await db.get(RefreshToken, payload.get("jti"))
    if not row or row.revoked:
        raise HTTPException(401, "refresh revoked")
    idn = await db.get(Identity, payload.get("sub"))
    if not idn or idn.status != "active":
        raise HTTPException(401, "inactive")
    # چرخش: ابطالِ قدیمی، صدورِ جدید
    row.revoked = True
    tier = _effective_tier(idn)
    claims = {"sub": idn.id, "kind": idn.kind, "scope": "app", "tier": tier}
    if idn.legacy_student_id is not None:
        claims["legacy_student_id"] = idn.legacy_student_id
    access = create_access_token(claims)
    new_refresh = create_refresh_token({"sub": idn.id})
    rp = decode_token(new_refresh)
    db.add(RefreshToken(jti=rp["jti"], identity_id=idn.id, expires_at=datetime.fromtimestamp(rp["exp"], timezone.utc)))
    await _audit(db, idn.id, "refresh")
    await db.commit()
    return TokenOut(access_token=access, refresh_token=new_refresh, tier=tier, kind=idn.kind)


@app.post("/auth/logout")
async def logout(body: RefreshIn, db: AsyncSession = Depends(get_db)) -> dict:
    payload = decode_token(body.refresh_token)
    if payload and payload.get("jti"):
        row = await db.get(RefreshToken, payload["jti"])
        if row:
            row.revoked = True
            await _audit(db, payload.get("sub"), "logout")
            await db.commit()
    return {"status": "ok"}


@app.get("/auth/me", response_model=MeOut)
async def me(idn: Identity = Depends(_current_identity)) -> MeOut:
    return MeOut(
        id=idn.id, kind=idn.kind, username=idn.username, email=idn.email,
        tier=_effective_tier(idn), status=idn.status,
    )


@app.post("/admin/set-tier")
async def set_tier(
    body: SetTierIn,
    idn: Identity = Depends(_current_identity),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if idn.kind != "admin":
        raise HTTPException(403, "admin only")
    if body.tier not in _TIER_RANK:
        raise HTTPException(400, "bad tier")
    target = await db.get(Identity, body.identity_id)
    if not target:
        raise HTTPException(404, "not found")
    target.tier = body.tier
    if body.expires_at:
        target.expires_at = datetime.fromisoformat(body.expires_at)
    await _audit(db, idn.id, "set_tier", f"{body.identity_id}->{body.tier}")
    await db.commit()
    return {"status": "ok", "identity_id": body.identity_id, "tier": body.tier}
