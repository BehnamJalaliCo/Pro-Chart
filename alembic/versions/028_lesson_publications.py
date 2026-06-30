"""انتشارِ خودکارِ ویدیوی درس‌ها در یوتیوب/آپارات — جدولِ ردگیری

Revision ID: 028_lesson_pub
Revises: 027_article_seo
Create Date: 2026-06-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "028_lesson_pub"
down_revision: Union[str, None] = "027_article_seo"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lesson_publications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("academy_lessons.id"), nullable=False),
        sa.Column("platform", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), server_default="pending", nullable=False),
        sa.Column("external_id", sa.String(64), nullable=True),
        sa.Column("url", sa.String(500), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("lesson_id", "platform", name="uq_lesson_platform"),
    )
    op.create_index("ix_lesson_publications_lesson_id", "lesson_publications", ["lesson_id"])
    op.create_index("ix_lesson_publications_platform", "lesson_publications", ["platform"])


def downgrade() -> None:
    op.drop_index("ix_lesson_publications_platform", table_name="lesson_publications")
    op.drop_index("ix_lesson_publications_lesson_id", table_name="lesson_publications")
    op.drop_table("lesson_publications")
