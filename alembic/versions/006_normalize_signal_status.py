"""یکدست‌سازی Signal.status به حروف کوچک + server_default

ممیزی نشان داد engine/tracker با حروف بزرگ ("ACTIVE"/"CLOSED") می‌نوشتند ولی
کوئری‌های API/performance با حروف کوچک فیلتر می‌کردند → شمارش سیگنال فعال صفر،
عدم‌بسته‌شدن دستی، نامرئی‌بودن در KPI و مدارشکن. این migration مقادیر موجود را
lowercase می‌کند و server_default را به 'active' می‌گذارد.

Revision ID: 006_normalize_signal_status
Revises: 005_tx_hash_unique
Create Date: 2026-06-01
"""

from typing import Sequence, Union

from alembic import op

revision: str = "006_normalize_signal_status"
down_revision: Union[str, None] = "005_tx_hash_unique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # یکدست‌سازی همه‌ی مقادیر موجود به حروف کوچک
    op.execute("UPDATE signals SET status = lower(status) WHERE status <> lower(status)")
    # server_default برای ردیف‌های آینده
    op.execute("ALTER TABLE signals ALTER COLUMN status SET DEFAULT 'active'")


def downgrade() -> None:
    op.execute("ALTER TABLE signals ALTER COLUMN status DROP DEFAULT")
