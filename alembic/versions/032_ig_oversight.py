"""ig oversight: enc login password (admin reveal), feature permissions, notes, login meta

Revision ID: 032_ig_oversight
Revises: 031_academy_devices
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "032_ig_oversight"
down_revision = "031_academy_devices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ig_users", sa.Column("enc_login_password", sa.String(500), nullable=True))
    op.add_column("ig_users", sa.Column("permissions", JSONB, nullable=True))
    op.add_column("ig_users", sa.Column("notes", sa.Text, nullable=True))
    op.add_column("ig_users", sa.Column("login_count", sa.Integer, server_default="0", nullable=False))
    op.add_column("ig_users", sa.Column("last_login_ip", sa.String(45), nullable=True))


def downgrade() -> None:
    op.drop_column("ig_users", "last_login_ip")
    op.drop_column("ig_users", "login_count")
    op.drop_column("ig_users", "notes")
    op.drop_column("ig_users", "permissions")
    op.drop_column("ig_users", "enc_login_password")
