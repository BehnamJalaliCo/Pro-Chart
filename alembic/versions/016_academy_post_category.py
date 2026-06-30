"""آکادمی — دسته‌بندیِ موضوعیِ پست‌های انجمن

Revision ID: 016_post_category
Revises: 015_academy_community
Create Date: 2026-06-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "016_post_category"
down_revision: Union[str, None] = "015_academy_community"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("academy_posts", sa.Column("category", sa.String(length=20), nullable=True))
    op.create_index("ix_academy_posts_category", "academy_posts", ["category"])


def downgrade() -> None:
    op.drop_index("ix_academy_posts_category", table_name="academy_posts")
    op.drop_column("academy_posts", "category")
