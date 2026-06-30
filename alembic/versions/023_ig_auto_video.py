"""اینستاگرام — تولیدِ خودکارِ ویدیو (ElevenLabs) + اتصالِ خودکارِ دایرکتِ هوشمند

Revision ID: 023_ig_auto_video
Revises: 022_instagram_gaps
Create Date: 2026-06-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "023_ig_auto_video"
down_revision: Union[str, None] = "022_instagram_gaps"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ig_contents", sa.Column("gen_video", sa.Boolean(), server_default=sa.false(), nullable=True))
    op.add_column("ig_contents", sa.Column("video_prompt", sa.Text(), nullable=True))
    op.add_column("ig_contents", sa.Column("video_status", sa.String(length=20), nullable=True))
    op.add_column("ig_contents", sa.Column("video_spec", JSONB(), nullable=True))
    op.add_column("ig_contents", sa.Column("auto_reply_keyword", sa.String(length=120), nullable=True))
    op.add_column("ig_contents", sa.Column("auto_reply_link", sa.String(length=1000), nullable=True))
    op.add_column("ig_contents", sa.Column("auto_reply_text", sa.Text(), nullable=True))
    op.add_column("ig_contents", sa.Column("auto_reply_done", sa.Boolean(), server_default=sa.false(), nullable=True))


def downgrade() -> None:
    for col in ("auto_reply_done", "auto_reply_text", "auto_reply_link", "auto_reply_keyword",
                "video_spec", "video_status", "video_prompt", "gen_video"):
        op.drop_column("ig_contents", col)
