"""آکادمی — دانش‌آموزِ مستقل (نام‌کاربری/رمز، ساختهٔ ادمین) به‌جای کاربرِ تلگرام

academy_students اضافه می‌شود؛ جداولِ وابسته (subscriptions/progress/mentor) که خالی‌اند
دوباره با student_id ساخته می‌شوند.

Revision ID: 014_academy_students
Revises: 013_academy_vip
Create Date: 2026-06-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "014_academy_students"
down_revision: Union[str, None] = "013_academy_vip"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "academy_students",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=120), nullable=True),
        sa.Column("tier", sa.String(length=20), nullable=False, server_default="free"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_academy_students_username", "academy_students", ["username"])
    op.create_index("ix_academy_students_email", "academy_students", ["email"])

    # جداولِ خالی → drop و recreate با student_id (به‌ترتیبِ وابستگی)
    op.drop_table("academy_mentor_messages")
    op.drop_table("academy_mentor_threads")
    op.drop_table("academy_progress")
    op.drop_table("academy_subscriptions")

    op.create_table(
        "academy_subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("tier", sa.String(length=20), nullable=False, server_default="free"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("amount_usdt", sa.Numeric(10, 2), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_request_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["student_id"], ["academy_students.id"]),
        sa.ForeignKeyConstraint(["payment_request_id"], ["payment_requests.id"]),
    )
    op.create_index("ix_academy_subscriptions_student_id", "academy_subscriptions", ["student_id"])

    op.create_table(
        "academy_progress",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="started"),
        sa.Column("quiz_score", sa.Integer(), nullable=True),
        sa.Column("viewed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["student_id"], ["academy_students.id"]),
        sa.ForeignKeyConstraint(["lesson_id"], ["academy_lessons.id"]),
        sa.UniqueConstraint("student_id", "lesson_id", name="uq_academy_progress_student_lesson"),
    )
    op.create_index("ix_academy_progress_student_id", "academy_progress", ["student_id"])

    op.create_table(
        "academy_mentor_threads",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["student_id"], ["academy_students.id"]),
    )
    op.create_index("ix_academy_mentor_threads_student_id", "academy_mentor_threads", ["student_id"])

    op.create_table(
        "academy_mentor_messages",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=12), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("lang", sa.String(length=5), nullable=False, server_default="fa"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["thread_id"], ["academy_mentor_threads.id"]),
    )
    op.create_index("ix_academy_mentor_messages_thread_id", "academy_mentor_messages", ["thread_id"])


def downgrade() -> None:
    op.drop_table("academy_mentor_messages")
    op.drop_table("academy_mentor_threads")
    op.drop_table("academy_progress")
    op.drop_table("academy_subscriptions")
    op.drop_table("academy_students")
