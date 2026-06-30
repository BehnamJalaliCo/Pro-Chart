"""مقالات — فیلدهای سئو: tags/meta_description/word_count/content_hash/pillar

Revision ID: 027_article_seo
Revises: 026_ig_ap_campaigns
Create Date: 2026-06-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "027_article_seo"
down_revision: Union[str, None] = "026_ig_ap_campaigns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("articles", sa.Column("tags", JSONB(), nullable=True))
    op.add_column("articles", sa.Column("meta_description", sa.String(320), nullable=True))
    op.add_column("articles", sa.Column("word_count", sa.Integer(), nullable=True))
    op.add_column("articles", sa.Column("content_hash", sa.String(32), nullable=True))
    op.add_column("articles", sa.Column("pillar_slug", sa.String(255), nullable=True))
    op.add_column("articles", sa.Column("is_pillar", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_index("ix_articles_content_hash", "articles", ["content_hash"])
    op.create_index("ix_articles_pillar_slug", "articles", ["pillar_slug"])


def downgrade() -> None:
    op.drop_index("ix_articles_pillar_slug", table_name="articles")
    op.drop_index("ix_articles_content_hash", table_name="articles")
    for col in ("is_pillar", "pillar_slug", "content_hash", "word_count", "meta_description", "tags"):
        op.drop_column("articles", col)
