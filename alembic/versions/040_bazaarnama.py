"""bazaarnama: layouts, scripts, alerts, watchlists (TradingView-clone foundation)

Revision ID: 040_bazaarnama
Revises: 039_seo_monitored_urls
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "040_bazaarnama"
down_revision = "039_seo_monitored_urls"
branch_labels = None
depends_on = None

_FK = dict(nullable=False, index=True)


def upgrade() -> None:
    op.create_table(
        "bn_layouts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), **_FK),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("data", JSONB, nullable=True),           # نماد/تایم‌فریم/اندیکاتورها/ترسیم‌ها
        sa.Column("is_default", sa.Boolean, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_table(
        "bn_scripts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), **_FK),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("kind", sa.String(16), server_default="indicator"),   # indicator/strategy
        sa.Column("source", sa.Text, nullable=False),                   # کدِ نمااسکریپت
        sa.Column("enabled", sa.Boolean, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_table(
        "bn_alerts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), **_FK),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("tf", sa.String(8), server_default="H1"),
        sa.Column("name", sa.String(160), nullable=True),
        sa.Column("condition", JSONB, nullable=False),                  # نوع/عملگر/مقدار/منبع
        sa.Column("active", sa.Boolean, server_default=sa.true()),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "bn_watchlists",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), **_FK),
        sa.Column("name", sa.String(120), server_default="پیش‌فرض"),
        sa.Column("symbols", JSONB, nullable=True),                     # فهرستِ نمادها
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("bn_watchlists")
    op.drop_table("bn_alerts")
    op.drop_table("bn_scripts")
    op.drop_table("bn_layouts")
