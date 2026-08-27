"""Add the AcademyStudent fields used by the Pro-Chart account and admin flows.

Revision ID: 043_academy_product_account_fields
Revises: 042_account_center
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "043_acct_fields"
down_revision: Union[str, None] = "042_account_center"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Bring academy_students in line with the current AcademyStudent model."""
    op.add_column(
        "academy_students",
        sa.Column("role", sa.String(length=20), nullable=True, server_default="user"),
    )
    op.add_column(
        "academy_students",
        sa.Column("suspended_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "academy_students",
        sa.Column("account_type", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "academy_students",
        sa.Column("prochart_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "academy_students",
        sa.Column("forex_copy_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "academy_students",
        sa.Column("forex_signal_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "academy_students",
        sa.Column("copy_crypto", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "academy_students",
        sa.Column("copy_crypto_risk", sa.Float(), nullable=True, server_default="1.0"),
    )
    op.add_column(
        "academy_students",
        sa.Column("copy_forex", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "academy_students",
        sa.Column("copy_forex_risk", sa.Float(), nullable=True, server_default="1.0"),
    )
    op.add_column(
        "academy_students",
        sa.Column("kyc_status", sa.String(length=12), nullable=True, server_default="none"),
    )
    op.add_column(
        "academy_students",
        sa.Column("kyc_full_name", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "academy_students",
        sa.Column("kyc_country", sa.String(length=60), nullable=True),
    )
    op.add_column(
        "academy_students",
        sa.Column("disclaimer_version", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    """Remove the Pro-Chart account fields."""
    for name in (
        "disclaimer_version",
        "kyc_country",
        "kyc_full_name",
        "kyc_status",
        "copy_forex_risk",
        "copy_forex",
        "copy_crypto_risk",
        "copy_crypto",
        "forex_signal_until",
        "forex_copy_until",
        "prochart_until",
        "account_type",
        "suspended_until",
        "role",
    ):
        op.drop_column("academy_students", name)
