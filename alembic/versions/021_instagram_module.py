"""ماژولِ اینستاگرام (مستقل) — اکانت‌ها، پاسخِ خودکار، پیام، فرم، محتوا، صندوق

Revision ID: 021_instagram
Revises: 020_bootcamp_cert
Create Date: 2026-06-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "021_instagram"
down_revision: Union[str, None] = "020_bootcamp_cert"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ig_accounts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("ig_pk", sa.String(length=40), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="offline", nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_ig_accounts_username", "ig_accounts", ["username"])

    op.create_table(
        "ig_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("msg_type", sa.String(length=20), server_default="text", nullable=True),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("buttons", JSONB(), nullable=True),
        sa.Column("file_url", sa.String(length=1000), nullable=True),
        sa.Column("file_kind", sa.String(length=12), nullable=True),
        sa.Column("products", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["ig_accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ig_messages_account_id", "ig_messages", ["account_id"])

    op.create_table(
        "ig_auto_replies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("on_direct", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("on_comment", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("match_mode", sa.String(length=12), server_default="contains", nullable=True),
        sa.Column("keywords", JSONB(), nullable=True),
        sa.Column("message_id", sa.Integer(), nullable=True),
        sa.Column("require_follow", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("specific_media", sa.String(length=40), nullable=True),
        sa.Column("reminder", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("comment_after_dm", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("max_replies", sa.Integer(), nullable=True),
        sa.Column("like_dm", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("use_ai", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("ai_prompt", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("sent_count", sa.Integer(), server_default="0", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["ig_accounts.id"]),
        sa.ForeignKeyConstraint(["message_id"], ["ig_messages.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ig_auto_replies_account_id", "ig_auto_replies", ["account_id"])

    op.create_table(
        "ig_forms",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("start_trigger", sa.String(length=255), nullable=True),
        sa.Column("questions", JSONB(), nullable=True),
        sa.Column("cancel_trigger", sa.String(length=255), nullable=True),
        sa.Column("cancel_message", sa.Text(), nullable=True),
        sa.Column("end_message", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["ig_accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ig_forms_account_id", "ig_forms", ["account_id"])

    op.create_table(
        "ig_contents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("account_ids", JSONB(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("captions_custom", JSONB(), nullable=True),
        sa.Column("media_urls", JSONB(), nullable=True),
        sa.Column("cover_url", sa.String(length=1000), nullable=True),
        sa.Column("hashtags", sa.Text(), nullable=True),
        sa.Column("first_comment", sa.Text(), nullable=True),
        sa.Column("x_thread", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("auto_delete_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ai_prompt", sa.Text(), nullable=True),
        sa.Column("cover_spec", JSONB(), nullable=True),
        sa.Column("source", sa.String(length=20), server_default="manual", nullable=True),
        sa.Column("mode", sa.String(length=12), server_default="now", nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ig_contents_scheduled_at", "ig_contents", ["scheduled_at"])

    op.create_table(
        "ig_inbox",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=12), nullable=False),
        sa.Column("from_username", sa.String(length=80), nullable=True),
        sa.Column("media_code", sa.String(length=40), nullable=True),
        sa.Column("text_in", sa.Text(), nullable=True),
        sa.Column("text_out", sa.Text(), nullable=True),
        sa.Column("auto_reply_id", sa.Integer(), nullable=True),
        sa.Column("handled", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("ext_id", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["ig_accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ig_inbox_account_id", "ig_inbox", ["account_id"])
    op.create_index("ix_ig_inbox_ext_id", "ig_inbox", ["ext_id"])


def downgrade() -> None:
    for t in ("ig_inbox", "ig_contents", "ig_forms", "ig_auto_replies", "ig_messages", "ig_accounts"):
        op.drop_table(t)
