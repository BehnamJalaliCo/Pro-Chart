"""تاریخچهٔ معاملاتِ واقعی — جدولِ trade_history

ثبتِ هر پوزیشنِ بسته‌شده با سود ناخالص/کمیسیون/سواپ/خالص (از دیلِ واقعیِ MT5).
جدولِ جدید است → کاملاً افزایشی و امن.

Revision ID: 012_trade_history
Revises: 011_visit_events
Create Date: 2026-06-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012_trade_history"
down_revision: Union[str, None] = "011_visit_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trade_history",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("account_uid", sa.Integer(), nullable=False),
        sa.Column("deal_id", sa.BigInteger(), nullable=False),
        sa.Column("position_ticket", sa.BigInteger(), nullable=True),
        sa.Column("signal_id", sa.Integer(), nullable=True),
        sa.Column("symbol", sa.String(length=30), nullable=True),
        sa.Column("direction", sa.String(length=5), nullable=True),
        sa.Column("volume", sa.Numeric(12, 2), nullable=True),
        sa.Column("entry_price", sa.Numeric(18, 6), nullable=True),
        sa.Column("exit_price", sa.Numeric(18, 6), nullable=True),
        sa.Column("open_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("close_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_sec", sa.Integer(), nullable=True),
        sa.Column("gross_profit", sa.Numeric(14, 2), nullable=True),
        sa.Column("commission", sa.Numeric(14, 2), nullable=True),
        sa.Column("swap", sa.Numeric(14, 2), nullable=True),
        sa.Column("spread_cost", sa.Numeric(14, 2), nullable=True),
        sa.Column("net_profit", sa.Numeric(14, 2), nullable=True),
        sa.Column("pips", sa.Numeric(12, 1), nullable=True),
        sa.Column("close_reason", sa.String(length=20), nullable=True),
        sa.Column("balance_after", sa.Numeric(16, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_uid", "deal_id", name="uq_trade_account_deal"),
    )
    op.create_index("ix_trade_history_account_uid", "trade_history", ["account_uid"])
    op.create_index("ix_trade_history_signal_id", "trade_history", ["signal_id"])
    op.create_index("ix_trade_history_symbol", "trade_history", ["symbol"])
    op.create_index("ix_trade_history_close_time", "trade_history", ["close_time"])
    op.create_index("ix_trade_history_net_profit", "trade_history", ["net_profit"])


def downgrade() -> None:
    op.drop_table("trade_history")
