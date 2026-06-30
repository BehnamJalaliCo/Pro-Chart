"""آکادمی — بوت‌کمپ (ستون‌های دانش‌آموز) + گواهیِ معتبر

Revision ID: 020_bootcamp_cert
Revises: 019_academy_assessment
Create Date: 2026-06-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020_bootcamp_cert"
down_revision: Union[str, None] = "019_academy_assessment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("academy_students", sa.Column("bootcamp", sa.String(length=40), nullable=True))
    op.add_column("academy_students", sa.Column("bootcamp_started_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "academy_certificates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["academy_students.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_academy_certificates_student_id", "academy_certificates", ["student_id"])
    op.create_index("ix_academy_certificates_code", "academy_certificates", ["code"])


def downgrade() -> None:
    op.drop_table("academy_certificates")
    op.drop_column("academy_students", "bootcamp_started_at")
    op.drop_column("academy_students", "bootcamp")
