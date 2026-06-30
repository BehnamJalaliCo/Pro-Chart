"""بلاگ → ویدیوی یوتیوب + شورت — ستون‌های ردگیری

Revision ID: 029_blog_video
Revises: 028_lesson_pub
Create Date: 2026-06-18
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "029_blog_video"
down_revision: Union[str, None] = "028_lesson_pub"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("articles", sa.Column("video_yt_id", sa.String(32), nullable=True))
    op.add_column("articles", sa.Column("short_yt_id", sa.String(32), nullable=True))
    op.add_column("articles", sa.Column("video_published_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_articles_video_yt_id", "articles", ["video_yt_id"])


def downgrade() -> None:
    op.drop_index("ix_articles_video_yt_id", table_name="articles")
    for c in ("video_published_at", "short_yt_id", "video_yt_id"):
        op.drop_column("articles", c)
