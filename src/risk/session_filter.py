from datetime import datetime, timezone
from enum import Enum
from zoneinfo import ZoneInfo


class Session(str, Enum):
    TOKYO = "tokyo"
    LONDON = "london"
    NEW_YORK = "new_york"


_TOKYO = ZoneInfo("Asia/Tokyo")
_LONDON = ZoneInfo("Europe/London")
_NEW_YORK = ZoneInfo("America/New_York")


def _as_utc(now: datetime) -> datetime:
    """Normalize callers to an aware UTC instant without changing the timestamp."""
    if now.tzinfo is None:
        return now.replace(tzinfo=timezone.utc)
    return now.astimezone(timezone.utc)


def _is_dst(now: datetime, zone: ZoneInfo) -> bool:
    return bool(_as_utc(now).astimezone(zone).dst())


def is_eu_dst(now: datetime) -> bool:
    """Whether Europe/London observes DST at this exact instant."""
    return _is_dst(now, _LONDON)


def is_us_dst(now: datetime) -> bool:
    """Whether America/New_York observes DST at this exact instant."""
    return _is_dst(now, _NEW_YORK)


def _is_local_hour_between(now: datetime, zone: ZoneInfo, start: int, end: int) -> bool:
    local = _as_utc(now).astimezone(zone)
    wall_seconds = local.hour * 3600 + local.minute * 60 + local.second
    return start * 3600 <= wall_seconds < end * 3600


def current_sessions(now: datetime) -> list[Session]:
    """Return sessions active at ``now`` using each market's IANA wall clock."""
    sessions: list[Session] = []
    if _is_local_hour_between(now, _TOKYO, 9, 18):
        sessions.append(Session.TOKYO)
    if _is_local_hour_between(now, _LONDON, 8, 17):
        sessions.append(Session.LONDON)
    if _is_local_hour_between(now, _NEW_YORK, 8, 17):
        sessions.append(Session.NEW_YORK)
    return sessions


def is_low_liquidity_window(now: datetime) -> bool:
    return _as_utc(now).hour in (21, 22, 23)


def is_session_allowed(symbol: str, now: datetime, strict_unknown: bool = False):
    sessions = current_sessions(now)
    if symbol.upper() in {"US30", "NAS100", "US500"}:
        return (Session.NEW_YORK in sessions, "خارج ساعت شاخص")
    if symbol.upper() == "ZZZUSD":
        return (not strict_unknown, "نماد ناشناخته")
    return (
        Session.LONDON in sessions or Session.NEW_YORK in sessions,
        "outside session",
    )
