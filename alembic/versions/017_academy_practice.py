"""آکادمی — معاملاتِ شبیه‌سازِ تمرین (حسابِ مجازی)

Revision ID: 017_academy_practice
Revises: 016_post_category
Create Date: 2026-06-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "017_academy_practice"
down_revision: Union[str, None] = "016_post_category"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "academy_practice",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=30), nullable=True),
        sa.Column("direction", sa.String(length=8), nullable=True),
        sa.Column("entry", sa.Numeric(18, 5), nullable=True),
        sa.Column("exit", sa.Numeric(18, 5), nullable=True),
        sa.Column("pnl_r", sa.Numeric(8, 2), nullable=True),
        sa.Column("outcome", sa.String(length=12), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["academy_students.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_academy_practice_student_id", "academy_practice", ["student_id"])
    op.create_index("ix_academy_practice_created_at", "academy_practice", ["created_at"])


def downgrade() -> None:
    op.drop_table("academy_practice")
