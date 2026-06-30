"""پنلِ مستقلِ Multi-Tenant اینستاگرام — جدولِ ig_users + لایهٔ مالکیت روی ig_accounts

Revision ID: 030_ig_tenant
Revises: 029_blog_video
Create Date: 2026-06-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "030_ig_tenant"
down_revision: Union[str, None] = "029_blog_video"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ig_users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(80), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=True),
        sa.Column("max_accounts", sa.Integer(), server_default="3", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("is_admin_seed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_admin_id", sa.Integer(), sa.ForeignKey("admins.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ig_users_username", "ig_users", ["username"], unique=True)

    op.add_column("ig_accounts", sa.Column("owner_id", sa.Integer(), sa.ForeignKey("ig_users.id", ondelete="CASCADE"), nullable=True))
    op.add_column("ig_accounts", sa.Column("enc_password", sa.String(500), nullable=True))
    op.add_column("ig_accounts", sa.Column("enc_totp", sa.String(500), nullable=True))
    op.add_column("ig_accounts", sa.Column("session_path", sa.String(255), nullable=True))
    op.create_index("ix_ig_accounts_owner_id", "ig_accounts", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_ig_accounts_owner_id", table_name="ig_accounts")
    for c in ("session_path", "enc_totp", "enc_password", "owner_id"):
        op.drop_column("ig_accounts", c)
    op.drop_index("ix_ig_users_username", table_name="ig_users")
    op.drop_table("ig_users")
