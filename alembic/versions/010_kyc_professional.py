"""فیلدهای حرفه‌ایِ احراز هویت (KYC) — افزایشی

افزوده می‌شود به users:
- kyc_dob (تاریخِ تولد، رشته YYYY-MM-DD)
- kyc_nationality (ملیت)
- kyc_doc_type (نوعِ مدرک: passport/national_id/drivers_license)
- kyc_doc_number (شمارهٔ مدرک)
- kyc_address (نشانیِ محلِ سکونت)
- kyc_submitted_at (زمانِ ثبت)

همه nullable → سازگار با ردیف‌های موجود.

Revision ID: 010_kyc_professional
Revises: 009_copy_servers
Create Date: 2026-06-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010_kyc_professional"
down_revision: Union[str, None] = "009_copy_servers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("kyc_dob", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("kyc_nationality", sa.String(length=80), nullable=True))
    op.add_column("users", sa.Column("kyc_doc_type", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("kyc_doc_number", sa.String(length=60), nullable=True))
    op.add_column("users", sa.Column("kyc_address", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("kyc_submitted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "kyc_submitted_at")
    op.drop_column("users", "kyc_address")
    op.drop_column("users", "kyc_doc_number")
    op.drop_column("users", "kyc_doc_type")
    op.drop_column("users", "kyc_nationality")
    op.drop_column("users", "kyc_dob")
