"""bazaarnama: AI real-time signals (setup + TP/SL tracking)

Revision ID: 041_bn_ai_signals
Revises: 040_bazaarnama
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa

revision = "041_bn_ai_signals"
down_revision = "040_bazaarnama"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bn_ai_signals",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("tf", sa.String(8), nullable=False),
        sa.Column("direction", sa.String(4), nullable=False),          # buy/sell
        sa.Column("entry", sa.Numeric(20, 8), nullable=False),
        sa.Column("sl", sa.Numeric(20, 8), nullable=False),
        sa.Column("tp1", sa.Numeric(20, 8), nullable=False),
        sa.Column("tp2", sa.Numeric(20, 8), nullable=True),
        sa.Column("tp3", sa.Numeric(20, 8), nullable=True),
        sa.Column("confidence", sa.Integer, nullable=True),            # ٪ موفقیتِ تخمینی
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("status", sa.String(12), server_default="active", index=True),  # active/tp1/tp2/tp3/sl/expired
        sa.Column("hit", sa.String(12), nullable=True),                # آخرین سطحِ خورده
        sa.Column("last_price", sa.Numeric(20, 8), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("bn_ai_signals")
