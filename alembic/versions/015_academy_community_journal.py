"""آکادمی — ژورنالِ معاملاتی + انجمن (پست/پاسخ)

academy_journal، academy_posts، academy_post_replies اضافه می‌شوند.

Revision ID: 015_academy_community
Revises: 014_academy_students
Create Date: 2026-06-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "015_academy_community"
down_revision: Union[str, None] = "014_academy_students"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "academy_journal",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=30), nullable=True),
        sa.Column("direction", sa.String(length=8), nullable=True),
        sa.Column("entry", sa.Numeric(18, 5), nullable=True),
        sa.Column("exit", sa.Numeric(18, 5), nullable=True),
        sa.Column("size", sa.Numeric(12, 2), nullable=True),
        sa.Column("pnl", sa.Numeric(14, 2), nullable=True),
        sa.Column("emotion", sa.String(length=20), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("lesson_learned", sa.Text(), nullable=True),
        sa.Column("traded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["academy_students.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_academy_journal_student_id", "academy_journal", ["student_id"])

    op.create_table(
        "academy_posts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=12), server_default="published", nullable=True),
        sa.Column("flag_reason", sa.String(length=200), nullable=True),
        sa.Column("likes", sa.Integer(), server_default="0", nullable=True),
        sa.Column("replies_count", sa.Integer(), server_default="0", nullable=True),
        sa.Column("reports", sa.Integer(), server_default="0", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["academy_students.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_academy_posts_student_id", "academy_posts", ["student_id"])
    op.create_index("ix_academy_posts_status", "academy_posts", ["status"])
    op.create_index("ix_academy_posts_created_at", "academy_posts", ["created_at"])

    op.create_table(
        "academy_post_replies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=12), server_default="published", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["post_id"], ["academy_posts.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["academy_students.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_academy_post_replies_post_id", "academy_post_replies", ["post_id"])


def downgrade() -> None:
    op.drop_table("academy_post_replies")
    op.drop_table("academy_posts")
    op.drop_table("academy_journal")
