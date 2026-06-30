"""broadcast: title, media_url, message_type, target_plan (admin پیام‌ها)

Revision ID: 033_broadcast_fields
Revises: 032_ig_oversight
Create Date: 2026-06-20
"""
from alembic import op
import sqlalchemy as sa

revision = "033_broadcast_fields"
down_revision = "032_ig_oversight"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("broadcasts", sa.Column("title", sa.String(200), nullable=True))
    op.add_column("broadcasts", sa.Column("media_url", sa.String(500), nullable=True))
    op.add_column("broadcasts", sa.Column("message_type", sa.String(20), server_default="text", nullable=True))
    op.add_column("broadcasts", sa.Column("target_plan", sa.String(40), nullable=True))


def downgrade() -> None:
    op.drop_column("broadcasts", "target_plan")
    op.drop_column("broadcasts", "message_type")
    op.drop_column("broadcasts", "media_url")
    op.drop_column("broadcasts", "title")
