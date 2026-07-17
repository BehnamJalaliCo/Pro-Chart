"""مرکزِ حساب (Account Center): آواتار، تغییرِ رمز/دستگاه، تاریخچهٔ پرداخت، voucher، KYC، دعوت، پشتیبانی، حذفِ حساب

Revision ID: 042_account_center
Revises: 041_bn_ai_signals
Create Date: 2026-07-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "042_account_center"
down_revision: Union[str, None] = "041_bn_ai_signals"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── ستون‌های جدیدِ academy_students ──
    op.add_column("academy_students", sa.Column("avatar_id", sa.String(64), nullable=True))
    op.add_column("academy_students", sa.Column("referral_code", sa.String(16), nullable=True))
    op.add_column("academy_students", sa.Column("referred_by", sa.Integer(), nullable=True))
    op.add_column("academy_students", sa.Column("invite_rewarded", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("academy_students", sa.Column("deletion_scheduled_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_academy_students_referral_code", "academy_students", ["referral_code"])
    op.create_index("ix_academy_students_referred_by", "academy_students", ["referred_by"])

    # ── academy_avatars ──
    op.create_table(
        "academy_avatars",
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("academy_students.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("content_type", sa.String(40), nullable=False),
        sa.Column("data_b64", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── academy_payments ──
    op.create_table(
        "academy_payments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("academy_students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tx_hash", sa.String(120), nullable=True),
        sa.Column("plan", sa.String(20), nullable=True),
        sa.Column("amount_usdt", sa.Numeric(10, 2), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("product", sa.String(20), server_default="prochart"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_academy_payments_student_id", "academy_payments", ["student_id"])
    op.create_index("ix_academy_payments_tx_hash", "academy_payments", ["tx_hash"])

    # ── academy_vouchers + redemptions ──
    op.create_table(
        "academy_vouchers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(40), nullable=False),
        sa.Column("tier", sa.String(20), server_default="vip"),
        sa.Column("days", sa.Integer(), server_default="30"),
        sa.Column("max_uses", sa.Integer(), server_default="1"),
        sa.Column("used_count", sa.Integer(), server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("code", name="uq_academy_voucher_code"),
    )
    op.create_index("ix_academy_vouchers_code", "academy_vouchers", ["code"])
    op.create_table(
        "academy_voucher_redemptions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("voucher_id", sa.Integer(), sa.ForeignKey("academy_vouchers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("academy_students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("voucher_id", "student_id", name="uq_academy_voucher_redeem"),
    )
    op.create_index("ix_academy_voucher_redemptions_voucher_id", "academy_voucher_redemptions", ["voucher_id"])
    op.create_index("ix_academy_voucher_redemptions_student_id", "academy_voucher_redemptions", ["student_id"])

    # ── academy_kyc + docs ──
    op.create_table(
        "academy_kyc",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("academy_students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), server_default="none"),
        sa.Column("level", sa.Integer(), server_default="0"),
        sa.Column("full_name", sa.String(160), nullable=True),
        sa.Column("national_id", sa.String(40), nullable=True),
        sa.Column("birth_date", sa.String(20), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("student_id", name="uq_academy_kyc_student"),
    )
    op.create_index("ix_academy_kyc_student_id", "academy_kyc", ["student_id"])
    op.create_table(
        "academy_kyc_docs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("kyc_id", sa.Integer(), sa.ForeignKey("academy_kyc.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doc_type", sa.String(20), nullable=False),
        sa.Column("data_b64", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_academy_kyc_docs_kyc_id", "academy_kyc_docs", ["kyc_id"])

    # ── academy_support_tickets ──
    op.create_table(
        "academy_support_tickets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("academy_students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_academy_support_tickets_student_id", "academy_support_tickets", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_academy_support_tickets_student_id", table_name="academy_support_tickets")
    op.drop_table("academy_support_tickets")
    op.drop_index("ix_academy_kyc_docs_kyc_id", table_name="academy_kyc_docs")
    op.drop_table("academy_kyc_docs")
    op.drop_index("ix_academy_kyc_student_id", table_name="academy_kyc")
    op.drop_table("academy_kyc")
    op.drop_index("ix_academy_voucher_redemptions_student_id", table_name="academy_voucher_redemptions")
    op.drop_index("ix_academy_voucher_redemptions_voucher_id", table_name="academy_voucher_redemptions")
    op.drop_table("academy_voucher_redemptions")
    op.drop_index("ix_academy_vouchers_code", table_name="academy_vouchers")
    op.drop_table("academy_vouchers")
    op.drop_index("ix_academy_payments_tx_hash", table_name="academy_payments")
    op.drop_index("ix_academy_payments_student_id", table_name="academy_payments")
    op.drop_table("academy_payments")
    op.drop_table("academy_avatars")
    op.drop_index("ix_academy_students_referred_by", table_name="academy_students")
    op.drop_index("ix_academy_students_referral_code", table_name="academy_students")
    op.drop_column("academy_students", "deletion_scheduled_at")
    op.drop_column("academy_students", "invite_rewarded")
    op.drop_column("academy_students", "referred_by")
    op.drop_column("academy_students", "referral_code")
    op.drop_column("academy_students", "avatar_id")
