"""دسترسیِ پنلِ کاربری (تأییدِ مدیریت) + فیلدهای رصدِ منابع

افزایشی:
- users: panel_approved, panel_approved_at, panel_approved_by
- trading_accounts: last_trade_at, warned_at

Revision ID: 008_panel_access
Revises: 007_user_panel
Create Date: 2026-06-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_panel_access"
down_revision: Union[str, None] = "007_user_panel"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("panel_approved", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("users", sa.Column("panel_approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("panel_approved_by", sa.BigInteger(), nullable=True))
    op.add_column("trading_accounts", sa.Column("last_trade_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("trading_accounts", sa.Column("warned_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("trading_accounts", "warned_at")
    op.drop_column("trading_accounts", "last_trade_at")
    op.drop_column("users", "panel_approved_by")
    op.drop_column("users", "panel_approved_at")
    op.drop_column("users", "panel_approved")
