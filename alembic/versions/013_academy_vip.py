"""آکادمیِ VIP — جداولِ درس/ویدیو/اشتراک/پیشرفت/کوییز/مربی

محصولِ مجزا روی academy.fx.trade-future.ir. کاملاً افزایشی و امن (جداولِ جدید).

Revision ID: 013_academy_vip
Revises: 012_trade_history
Create Date: 2026-06-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "013_academy_vip"
down_revision: Union[str, None] = "012_trade_history"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "academy_lessons",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False),
        sa.Column("order_in_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("title_fa", sa.String(length=255), nullable=False),
        sa.Column("title_en", sa.String(length=255), nullable=True),
        sa.Column("summary_fa", sa.Text(), nullable=True),
        sa.Column("summary_en", sa.Text(), nullable=True),
        sa.Column("content_fa", sa.Text(), nullable=False),
        sa.Column("content_en", sa.Text(), nullable=True),
        sa.Column("diagram_image", sa.String(length=500), nullable=True),
        sa.Column("min_tier", sa.String(length=20), nullable=False, server_default="vip"),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_academy_lessons_slug", "academy_lessons", ["slug"])
    op.create_index("ix_academy_lessons_level", "academy_lessons", ["level"])

    op.create_table(
        "academy_videos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("lang", sa.String(length=5), nullable=False, server_default="fa"),
        sa.Column("hls_url", sa.String(length=1000), nullable=True),
        sa.Column("duration_sec", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["lesson_id"], ["academy_lessons.id"]),
    )
    op.create_index("ix_academy_videos_lesson_id", "academy_videos", ["lesson_id"])

    op.create_table(
        "academy_subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("tier", sa.String(length=20), nullable=False, server_default="free"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("amount_usdt", sa.Numeric(10, 2), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_request_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["payment_request_id"], ["payment_requests.id"]),
    )
    op.create_index("ix_academy_subscriptions_user_id", "academy_subscriptions", ["user_id"])
    op.create_index("ix_academy_subscriptions_expires_at", "academy_subscriptions", ["expires_at"])

    op.create_table(
        "academy_progress",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="started"),
        sa.Column("quiz_score", sa.Integer(), nullable=True),
        sa.Column("viewed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["lesson_id"], ["academy_lessons.id"]),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_academy_progress_user_lesson"),
    )
    op.create_index("ix_academy_progress_user_id", "academy_progress", ["user_id"])

    op.create_table(
        "academy_quizzes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("question_fa", sa.Text(), nullable=False),
        sa.Column("question_en", sa.Text(), nullable=True),
        sa.Column("options", JSONB(), nullable=False),
        sa.Column("correct_index", sa.Integer(), nullable=False),
        sa.Column("explanation_fa", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["lesson_id"], ["academy_lessons.id"]),
    )
    op.create_index("ix_academy_quizzes_lesson_id", "academy_quizzes", ["lesson_id"])

    op.create_table(
        "academy_mentor_threads",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_academy_mentor_threads_user_id", "academy_mentor_threads", ["user_id"])

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
    for t in (
        "academy_mentor_messages", "academy_mentor_threads", "academy_quizzes",
        "academy_progress", "academy_subscriptions", "academy_videos", "academy_lessons",
    ):
        op.drop_table(t)
