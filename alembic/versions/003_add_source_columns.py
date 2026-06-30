"""افزودن ستون source به candles و ticks (و volume به ticks)

هماهنگ‌سازی schema با src/data/candle_builder.py که هنگام درج،
ستون‌های source (نام منبع داده) و volume را می‌نویسد.

Revision ID: 003_add_source_columns
Revises: 002_backtest_tables
Create Date: 2026-05-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_add_source_columns"
down_revision: Union[str, None] = "002_backtest_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # candles: ستون source (نام منبع داده‌ای که کندل از آن آمده)
    op.add_column(
        "candles",
        sa.Column("source", sa.String(20), nullable=True),
    )
    # ticks: ستون‌های volume و source (مطابق INSERT در candle_builder)
    op.add_column(
        "ticks",
        sa.Column("volume", sa.Numeric(20, 4), nullable=True),
    )
    op.add_column(
        "ticks",
        sa.Column("source", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ticks", "source")
    op.drop_column("ticks", "volume")
    op.drop_column("candles", "source")
