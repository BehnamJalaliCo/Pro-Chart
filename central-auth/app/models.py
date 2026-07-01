"""مدل‌های هویتِ مرکزی — منبعِ واحدِ حقیقت برای هویت/tier."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return uuid.uuid4().hex


class Identity(Base):
    """منبعِ واحد: هر کاربر/ادمین/مهمانِ اپ."""
    __tablename__ = "identities"

    id: Mapped[str] = mapped_column(PGUUID(as_uuid=False), primary_key=True, default=_uuid)
    kind: Mapped[str] = mapped_column(String(16), default="student")  # student|admin|guest
    username: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    phone_number: Mapped[str | None] = mapped_column(String(32), index=True)
    password_hash: Mapped[str | None] = mapped_column(Text)
    full_name: Mapped[str | None] = mapped_column(String(128))

    tier: Mapped[str] = mapped_column(String(20), default="free")  # free|vip|premium
    status: Mapped[str] = mapped_column(String(16), default="active")  # active|disabled
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    account_type: Mapped[str | None] = mapped_column(String(16))  # crypto|broker

    # ردِ کاربرِ قدیمی برای مهاجرت
    legacy_student_id: Mapped[int | None] = mapped_column(Integer, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    devices: Mapped[list["Device"]] = relationship(back_populates="identity", cascade="all, delete-orphan")


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("identity_id", "device_id", name="uq_identity_device"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    identity_id: Mapped[str] = mapped_column(ForeignKey("identities.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[str] = mapped_column(String(128))
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    identity: Mapped[Identity] = relationship(back_populates="devices")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    identity_id: Mapped[str] = mapped_column(ForeignKey("identities.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class SigningKey(Base):
    """کلیدهای عمومیِ فعال برای JWKS (کلیدِ خصوصی اینجا نیست)."""
    __tablename__ = "signing_keys"

    kid: Mapped[str] = mapped_column(String(64), primary_key=True)
    public_pem: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    identity_id: Mapped[str | None] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(48))  # login|logout|refresh|set_tier|register|guest
    detail: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
