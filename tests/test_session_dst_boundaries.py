from datetime import datetime, timezone

import pytest

from src.risk.session_filter import Session, current_sessions, is_eu_dst, is_us_dst


UTC = timezone.utc


def at(year: int, month: int, day: int, hour: int, minute: int = 0, second: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, second, tzinfo=UTC)


@pytest.mark.parametrize(
    ("instant", "expected"),
    [
        (at(2026, 3, 29, 0, 59, 59), False),
        (at(2026, 3, 29, 1, 0, 0), True),
        (at(2026, 10, 25, 0, 59, 59), True),
        (at(2026, 10, 25, 1, 0, 0), False),
    ],
)
def test_europe_london_dst_uses_real_2026_transition_instants(instant, expected):
    assert is_eu_dst(instant) is expected


@pytest.mark.parametrize(
    ("instant", "expected"),
    [
        (at(2026, 3, 8, 6, 59, 59), False),
        (at(2026, 3, 8, 7, 0, 0), True),
        (at(2026, 11, 1, 5, 59, 59), True),
        (at(2026, 11, 1, 6, 0, 0), False),
    ],
)
def test_america_new_york_dst_uses_real_2026_transition_instants(instant, expected):
    assert is_us_dst(instant) is expected


@pytest.mark.parametrize(
    ("instant", "session", "active"),
    [
        # London is 08:00-17:00 local: UTC+0 in winter and UTC+1 in summer.
        (at(2026, 1, 15, 7, 59), Session.LONDON, False),
        (at(2026, 1, 15, 8, 0), Session.LONDON, True),
        (at(2026, 1, 15, 16, 59), Session.LONDON, True),
        (at(2026, 1, 15, 17, 0), Session.LONDON, False),
        (at(2026, 6, 15, 6, 59), Session.LONDON, False),
        (at(2026, 6, 15, 7, 0), Session.LONDON, True),
        (at(2026, 6, 15, 15, 59), Session.LONDON, True),
        (at(2026, 6, 15, 16, 0), Session.LONDON, False),
        # New York is 08:00-17:00 local: UTC-5 in winter and UTC-4 in summer.
        (at(2026, 1, 15, 12, 59), Session.NEW_YORK, False),
        (at(2026, 1, 15, 13, 0), Session.NEW_YORK, True),
        (at(2026, 1, 15, 21, 59), Session.NEW_YORK, True),
        (at(2026, 1, 15, 22, 0), Session.NEW_YORK, False),
        (at(2026, 6, 15, 11, 59), Session.NEW_YORK, False),
        (at(2026, 6, 15, 12, 0), Session.NEW_YORK, True),
        (at(2026, 6, 15, 20, 59), Session.NEW_YORK, True),
        (at(2026, 6, 15, 21, 0), Session.NEW_YORK, False),
        # Tokyo has no DST and remains 09:00-18:00 Asia/Tokyo.
        (at(2026, 6, 15, 23, 59), Session.TOKYO, False),
        (at(2026, 6, 15, 0, 0), Session.TOKYO, True),
        (at(2026, 6, 15, 8, 59), Session.TOKYO, True),
        (at(2026, 6, 15, 9, 0), Session.TOKYO, False),
    ],
)
def test_session_boundaries_follow_market_local_wall_clock(instant, session, active):
    assert (session in current_sessions(instant)) is active


def test_us_europe_mismatch_week_uses_each_markets_own_timezone():
    # US DST has started, Europe DST has not: both sessions are active here.
    sessions = current_sessions(at(2026, 3, 20, 12, 30))
    assert Session.LONDON in sessions
    assert Session.NEW_YORK in sessions
