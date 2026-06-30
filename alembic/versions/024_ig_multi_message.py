"""اینستاگرام — چند پیامِ پشت‌سرِهم در دستورِ پاسخِ خودکار (message_ids)

Revision ID: 024_ig_multi_message
Revises: 023_ig_auto_video
Create Date: 2026-06-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "024_ig_multi_message"
down_revision: Union[str, None] = "023_ig_auto_video"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ig_auto_replies", sa.Column("message_ids", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("ig_auto_replies", "message_ids")
