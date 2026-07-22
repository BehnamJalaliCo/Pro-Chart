"""نقش و مجوزِ ادمین (فاز۸، بخشِ ۸A) — منبعِ حقیقتِ سرور.

جدولِ ۵ نقش × ۲۳ مجوز طبقِ `SERVER_HANDOFF_09_admin.md`. نقشِ هر کاربر از env
`BN_ADMIN_ROLES` می‌آید (بدونِ نیاز به migration در قدمِ صفر):
    BN_ADMIN_ROLES="993218234:superadmin, support-ali:support, x@y.com:analyst"
کلید = student id یا username یا email؛ مقدار = یکی از نقش‌ها. نبود → نقشِ `user` (بدونِ دسترسی).

هم `GET /me` و هم میدل‌ورِ `requireAdmin` از همین ماژول می‌خوانند.
"""

from __future__ import annotations

import os
from functools import lru_cache

# ترتیبِ پایدار برای خروجی
ALL_PERMISSIONS = [
    "admin.access", "overview.read",
    "users.read", "users.unmask_email", "users.ban", "users.reset_pin",
    "users.logout_devices", "users.suspend", "users.delete",
    "subscriptions.read", "subscriptions.grant", "subscriptions.cancel", "subscriptions.refund",
    "kyc.review", "signals.author", "copy.manage",
    "tickets.read", "tickets.reply", "tickets.assign",
    "broadcast.send", "audit.read", "system.read", "system.killswitch",
]

_SUPERADMIN = set(ALL_PERMISSIONS)
_ADMIN = _SUPERADMIN - {"users.delete", "subscriptions.refund", "system.killswitch"}
_SUPPORT = {
    "admin.access", "overview.read", "users.read", "users.ban", "users.reset_pin",
    "users.logout_devices", "subscriptions.read", "kyc.review", "tickets.read", "tickets.reply",
}
_ANALYST = {"admin.access", "overview.read", "users.read", "subscriptions.read",
            "audit.read", "system.read"}
_READ_ONLY = {"admin.access", "overview.read", "users.read", "subscriptions.read", "system.read"}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "superadmin": _SUPERADMIN,
    "admin": _ADMIN,
    "support": _SUPPORT,
    "analyst": _ANALYST,
    "read_only": _READ_ONLY,
    "user": set(),
}

# رتبهٔ نقش برای گیتِ تخصیصِ نقش (کسی نمی‌تواند نقشی بالاتر/برابرِ خودش را به دیگری بدهد جز superadmin)
ROLE_RANK = {"user": 0, "read_only": 1, "analyst": 2, "support": 3, "admin": 4, "superadmin": 5}
ASSIGNABLE_ROLES = list(ROLE_RANK.keys())


@lru_cache(maxsize=1)
def _allowlist() -> dict[str, str]:
    raw = os.getenv("BN_ADMIN_ROLES", "") or ""
    out: dict[str, str] = {}
    for part in raw.split(","):
        part = part.strip()
        if ":" not in part:
            continue
        key, _, role = part.partition(":")
        role = role.strip().lower()
        key = key.strip().lower()
        if key and role in ROLE_PERMISSIONS:
            out[key] = role
    return out


def role_for(student) -> str:
    """نقشِ کاربر. اولویت: ستونِ DB (تخصیص از پنل) سپس env allowlist. پیش‌فرض: user."""
    col = getattr(student, "role", None)
    if col:
        c = str(col).strip().lower()
        if c in ROLE_PERMISSIONS and c != "user":
            return c
    al = _allowlist()
    if not al:
        return "user"
    for k in (getattr(student, "id", None), getattr(student, "username", None),
              getattr(student, "email", None)):
        if k is None:
            continue
        role = al.get(str(k).strip().lower())
        if role:
            return role
    return "user"


def permissions_for(role: str) -> list[str]:
    perms = ROLE_PERMISSIONS.get(role, set())
    return [p for p in ALL_PERMISSIONS if p in perms]


def has_permission(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())
