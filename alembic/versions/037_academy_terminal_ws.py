"""academy: terminal workspace (chart layout sync)

Revision ID: 037_academy_terminal_ws
Revises: 036_academy_phase45
Create Date: 2026-06-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "037_academy_terminal_ws"
down_revision = "036_academy_phase45"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "academy_terminal_workspaces",
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("layout", JSONB, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("academy_terminal_workspaces")
