"""اسکیمای درخواست/پاسخ."""
from __future__ import annotations

from pydantic import BaseModel, EmailStr


class LoginIn(BaseModel):
    identifier: str  # username یا email
    password: str
    device_id: str | None = None


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    tier: str
    kind: str


class RegisterRequestIn(BaseModel):
    email: EmailStr
    app: str = "bazaarnama"  # academy|bazaarnama


class RegisterVerifyIn(BaseModel):
    email: EmailStr
    otp: str
    username: str
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class SetTierIn(BaseModel):
    identity_id: str
    tier: str  # free|vip|premium
    expires_at: str | None = None


class MeOut(BaseModel):
    id: str
    kind: str
    username: str | None
    email: str | None
    tier: str
    status: str


class IssueIn(BaseModel):
    legacy_student_id: int
    email: str | None = None
    tier: str = "free"
