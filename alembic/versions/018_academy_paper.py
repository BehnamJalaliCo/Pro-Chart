"""آکادمی — معاملهٔ کاغذی (Paper-Trading) روی قیمتِ زنده

Revision ID: 018_academy_paper
Revises: 017_academy_practice
Create Date: 2026-06-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "018_academy_paper"
down_revision: Union[str, None] = "017_academy_practice"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "academy_paper",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=30), nullable=False),
        sa.Column("direction", sa.String(length=8), nullable=False),
        sa.Column("entry", sa.Numeric(18, 5), nullable=False),
        sa.Column("sl", sa.Numeric(18, 5), nullable=True),
        sa.Column("tp", sa.Numeric(18, 5), nullable=True),
        sa.Column("size", sa.Numeric(18, 4), nullable=False),
        sa.Column("risk_usd", sa.Numeric(12, 2), nullable=True),
        sa.Column("status", sa.String(length=10), server_default="open", nullable=True),
        sa.Column("exit", sa.Numeric(18, 5), nullable=True),
        sa.Column("pnl_usd", sa.Numeric(14, 2), nullable=True),
        sa.Column("outcome", sa.String(length=12), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["academy_students.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_academy_paper_student_id", "academy_paper", ["student_id"])
    op.create_index("ix_academy_paper_status", "academy_paper", ["status"])


def downgrade() -> None:
    op.drop_table("academy_paper")
