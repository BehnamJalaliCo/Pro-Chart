"""academy phase 2: AI study plans + paper order types

Revision ID: 035_academy_studyplan
Revises: 034_academy_courses
Create Date: 2026-06-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "035_academy_studyplan"
down_revision = "034_academy_courses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "academy_study_plans",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("goal", sa.String(300), nullable=True),
        sa.Column("days", sa.Integer, server_default="30"),
        sa.Column("plan", JSONB, nullable=True),
        sa.Column("status", sa.String(12), server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # paper trading: order types (phase 3)
    op.add_column("academy_paper", sa.Column("order_type", sa.String(12), server_default="market", nullable=True))
    op.add_column("academy_paper", sa.Column("limit_price", sa.Numeric(18, 5), nullable=True))


def downgrade() -> None:
    op.drop_column("academy_paper", "limit_price")
    op.drop_column("academy_paper", "order_type")
    op.drop_table("academy_study_plans")
