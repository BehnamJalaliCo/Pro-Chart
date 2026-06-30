"""رجیستریِ سرورهای کپی + sharding پایدارِ کاربر→سرور

افزایشی:
- جدولِ copy_servers (ip یکتا، hetzner_id، status، capacity، last_seen_at)
- trading_accounts.server_id (FK به copy_servers، nullable، SET NULL در حذف)

Revision ID: 009_copy_servers
Revises: 008_panel_access
Create Date: 2026-06-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_copy_servers"
down_revision: Union[str, None] = "008_panel_access"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "copy_servers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ip", sa.String(length=45), nullable=False),
        sa.Column("hetzner_id", sa.BigInteger(), nullable=True),
        sa.Column("name", sa.String(length=80), nullable=True),
        sa.Column("hostname", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column("capacity", sa.Integer(), server_default="24", nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_copy_servers_ip", "copy_servers", ["ip"], unique=True)
    op.create_index("ix_copy_servers_hetzner_id", "copy_servers", ["hetzner_id"])
    op.add_column("trading_accounts", sa.Column("server_id", sa.Integer(), nullable=True))
    op.create_index("ix_trading_accounts_server_id", "trading_accounts", ["server_id"])
    op.create_foreign_key(
        "fk_trading_accounts_server_id", "trading_accounts", "copy_servers",
        ["server_id"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_trading_accounts_server_id", "trading_accounts", type_="foreignkey")
    op.drop_index("ix_trading_accounts_server_id", "trading_accounts")
    op.drop_column("trading_accounts", "server_id")
    op.drop_index("ix_copy_servers_hetzner_id", "copy_servers")
    op.drop_index("ix_copy_servers_ip", "copy_servers")
    op.drop_table("copy_servers")
