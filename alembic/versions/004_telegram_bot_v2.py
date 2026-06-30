"""بازنویسی ربات تلگرام نسخه ۲ — onboarding، اشتراک، پرداخت، کانال، لاگ پیام

ستون‌های جدید به users (افزایشی، با server_default برای ردیف‌های موجود) و
پنج جدول جدید: payment_requests, subscriptions, channel_members,
onboarding_sessions, bot_messages.

Revision ID: 004_telegram_bot_v2
Revises: 003_add_source_columns
Create Date: 2026-05-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004_telegram_bot_v2"
down_revision: Union[str, None] = "003_add_source_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── ۱) ستون‌های جدید روی جدول پرشده‌ی users ──
    # status روی ردیف‌های موجود NOT NULL است → server_default="active"
    op.add_column("users", sa.Column("phone_number", sa.String(20), nullable=True))
    op.create_index("ix_users_phone_number", "users", ["phone_number"])
    op.add_column("users", sa.Column("registration_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("skill_level", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("skill_score", sa.Integer(), nullable=True))
    op.add_column(
        "users",
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )
    op.add_column("users", sa.Column("referral_code", sa.String(12), nullable=True))
    op.create_unique_constraint("uq_users_referral_code", "users", ["referral_code"])
    op.create_index("ix_users_referral_code", "users", ["referral_code"])
    op.add_column("users", sa.Column("referred_by", sa.BigInteger(), nullable=True))
    op.create_index("ix_users_referred_by", "users", ["referred_by"])

    # ── ۲) payment_requests (قبل از subscriptions چون هدف FK است) ──
    op.create_table(
        "payment_requests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("plan", sa.String(20), nullable=False),
        sa.Column("amount_usdt", sa.Numeric(10, 2), nullable=False),
        sa.Column("network", sa.String(10), nullable=True),
        sa.Column("tx_hash", sa.String(120), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("admins.id"), nullable=True),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_payment_requests_user_id", "payment_requests", ["user_id"])
    op.create_index("ix_payment_requests_telegram_id", "payment_requests", ["telegram_id"])
    op.create_index("ix_payment_requests_tx_hash", "payment_requests", ["tx_hash"])
    op.create_index("ix_payment_requests_status", "payment_requests", ["status"])

    # ── ۳) subscriptions ──
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("plan", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("amount_usdt", sa.Numeric(10, 2), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "payment_request_id", sa.Integer(),
            sa.ForeignKey("payment_requests.id"), nullable=True,
        ),
        sa.Column("reminder_3d_sent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reminder_1d_sent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("expiry_processed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
    op.create_index("ix_subscriptions_telegram_id", "subscriptions", ["telegram_id"])
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"])
    op.create_index("ix_subscriptions_expires_at", "subscriptions", ["expires_at"])

    # ── ۴) channel_members ──
    op.create_table(
        "channel_members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.String(40), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="invited"),
        sa.Column("invite_link", sa.Text(), nullable=True),
        sa.Column("invited_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_channel_members_user_id", "channel_members", ["user_id"])
    op.create_index("ix_channel_members_telegram_id", "channel_members", ["telegram_id"])
    op.create_index("ix_channel_members_status", "channel_members", ["status"])
    op.create_index("ix_channel_members_is_active", "channel_members", ["is_active"])

    # ── ۵) onboarding_sessions ──
    op.create_table(
        "onboarding_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("step", sa.String(30), nullable=False, server_default="welcome"),
        sa.Column("temp_name", sa.String(200), nullable=True),
        sa.Column("temp_phone", sa.String(20), nullable=True),
        sa.Column("quiz_answers", postgresql.JSONB(), nullable=True),
        sa.Column("quiz_score", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_onboarding_sessions_telegram_id", "onboarding_sessions", ["telegram_id"])

    # ── ۶) bot_messages (حجم بالا → BigInteger PK) ──
    op.create_table(
        "bot_messages",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("direction", sa.String(3), nullable=False),
        sa.Column("message_type", sa.String(20), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("handler", sa.String(60), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_bot_messages_telegram_id", "bot_messages", ["telegram_id"])
    op.create_index("ix_bot_messages_created_at", "bot_messages", ["created_at"])


def downgrade() -> None:
    op.drop_table("bot_messages")
    op.drop_table("onboarding_sessions")
    op.drop_table("channel_members")
    op.drop_table("subscriptions")
    op.drop_table("payment_requests")

    op.drop_index("ix_users_referred_by", table_name="users")
    op.drop_column("users", "referred_by")
    op.drop_index("ix_users_referral_code", table_name="users")
    op.drop_constraint("uq_users_referral_code", "users", type_="unique")
    op.drop_column("users", "referral_code")
    op.drop_column("users", "status")
    op.drop_column("users", "skill_score")
    op.drop_column("users", "skill_level")
    op.drop_column("users", "registration_date")
    op.drop_index("ix_users_phone_number", table_name="users")
    op.drop_column("users", "phone_number")
