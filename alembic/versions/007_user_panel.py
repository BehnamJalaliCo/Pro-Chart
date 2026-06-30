"""پنلِ کاربریِ VIP — ایمیل/OTP + KYC + حسابِ کپی‌ترید + سلبِ مسئولیت

افزایشی و سازگار با ستون‌های موجودِ users. اضافه می‌کند:
- ستون‌های users: email, email_verified, kyc_status, kyc_full_name, kyc_country,
  kyc_doc_path, kyc_reviewed_at
- جداول: trading_accounts, copy_settings, disclaimer_acceptances

Revision ID: 007_user_panel
Revises: 006_normalize_signal_status
Create Date: 2026-06-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_user_panel"
down_revision: Union[str, None] = "006_normalize_signal_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── ستون‌های جدیدِ users (افزایشی) ──
    op.add_column("users", sa.Column("email", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("users", sa.Column("kyc_status", sa.String(20), server_default="none", nullable=False))
    op.add_column("users", sa.Column("kyc_full_name", sa.String(160), nullable=True))
    op.add_column("users", sa.Column("kyc_country", sa.String(80), nullable=True))
    op.add_column("users", sa.Column("kyc_doc_path", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("kyc_reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_email", "users", ["email"])

    # ── trading_accounts ──
    op.create_table(
        "trading_accounts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("broker", sa.String(80), nullable=False),
        sa.Column("server", sa.String(120), nullable=False),
        sa.Column("login", sa.String(40), nullable=False),
        sa.Column("password_enc", sa.Text(), nullable=False),
        sa.Column("is_oneroyal", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("balance", sa.Numeric(18, 2), nullable=True),
        sa.Column("equity", sa.Numeric(18, 2), nullable=True),
        sa.Column("currency", sa.String(10), nullable=True),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_trading_accounts_user_id", "trading_accounts", ["user_id"])
    op.create_index("ix_trading_accounts_telegram_id", "trading_accounts", ["telegram_id"])

    # ── copy_settings ──
    op.create_table(
        "copy_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("risk_mode", sa.String(20), server_default="proportional", nullable=False),
        sa.Column("risk_value", sa.Numeric(10, 2), server_default="1.0", nullable=False),
        sa.Column("max_lot", sa.Numeric(10, 2), server_default="1.0", nullable=False),
        sa.Column("max_open_trades", sa.Integer(), server_default="10", nullable=False),
        sa.Column("copy_sl_tp", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("max_daily_loss_pct", sa.Numeric(6, 2), server_default="0", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_copy_settings_user_id", "copy_settings", ["user_id"])

    # ── disclaimer_acceptances ──
    op.create_table(
        "disclaimer_acceptances",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("text_snapshot", sa.Text(), nullable=False),
        sa.Column("full_name", sa.String(160), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_disclaimer_acceptances_user_id", "disclaimer_acceptances", ["user_id"])
    op.create_index("ix_disclaimer_acceptances_telegram_id", "disclaimer_acceptances", ["telegram_id"])


def downgrade() -> None:
    op.drop_table("disclaimer_acceptances")
    op.drop_table("copy_settings")
    op.drop_table("trading_accounts")
    op.drop_index("ix_users_email", table_name="users")
    for col in ("kyc_reviewed_at", "kyc_doc_path", "kyc_country", "kyc_full_name",
                "kyc_status", "email_verified", "email"):
        op.drop_column("users", col)
