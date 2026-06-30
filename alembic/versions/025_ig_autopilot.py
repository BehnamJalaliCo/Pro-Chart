"""اینستاگرام — خلبانِ خودکار (مغزِ ارسالِ اتوماتیک)

Revision ID: 025_ig_autopilot
Revises: 024_ig_multi_message
Create Date: 2026-06-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "025_ig_autopilot"
down_revision: Union[str, None] = "024_ig_multi_message"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ig_autopilots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("account_ids", JSONB(), nullable=True),
        sa.Column("topics", JSONB(), nullable=True),
        sa.Column("post_types", JSONB(), nullable=True),
        sa.Column("gen_video", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("video_spec", JSONB(), nullable=True),
        sa.Column("caption_ai", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("times", JSONB(), nullable=True),
        sa.Column("auto_keyword", sa.String(length=120), nullable=True),
        sa.Column("auto_link", sa.String(length=1000), nullable=True),
        sa.Column("auto_reply_text", sa.Text(), nullable=True),
        sa.Column("first_comment_ai", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("topic_cursor", sa.Integer(), server_default="0", nullable=True),
        sa.Column("type_cursor", sa.Integer(), server_default="0", nullable=True),
        sa.Column("made_count", sa.Integer(), server_default="0", nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_ig_autopilots_next_run_at", "ig_autopilots", ["next_run_at"])


def downgrade() -> None:
    op.drop_index("ix_ig_autopilots_next_run_at", table_name="ig_autopilots")
    op.drop_table("ig_autopilots")
