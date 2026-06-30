"""اینستاگرام — ستون‌های تکمیلیِ کمبودها (post_type، reminder، follow، smart_enabled)

Revision ID: 022_instagram_gaps
Revises: 021_instagram
Create Date: 2026-06-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "022_instagram_gaps"
down_revision: Union[str, None] = "021_instagram"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ig_accounts", sa.Column("smart_enabled", sa.Boolean(), server_default=sa.true(), nullable=True))
    op.add_column("ig_contents", sa.Column("post_type", sa.String(length=12), server_default="post", nullable=True))
    op.add_column("ig_auto_replies", sa.Column("follow_message", sa.Text(), nullable=True))
    op.add_column("ig_auto_replies", sa.Column("follow_button_text", sa.String(length=100), nullable=True))
    op.add_column("ig_auto_replies", sa.Column("reminder_hours", sa.Integer(), nullable=True))
    op.add_column("ig_auto_replies", sa.Column("reminder_message_id", sa.Integer(), nullable=True))
    # گسترشِ specific_media از ۴۰ به ۱۲۰
    op.alter_column("ig_auto_replies", "specific_media", type_=sa.String(length=120), existing_type=sa.String(length=40))


def downgrade() -> None:
    op.alter_column("ig_auto_replies", "specific_media", type_=sa.String(length=40), existing_type=sa.String(length=120))
    op.drop_column("ig_auto_replies", "reminder_message_id")
    op.drop_column("ig_auto_replies", "reminder_hours")
    op.drop_column("ig_auto_replies", "follow_button_text")
    op.drop_column("ig_auto_replies", "follow_message")
    op.drop_column("ig_contents", "post_type")
    op.drop_column("ig_accounts", "smart_enabled")
