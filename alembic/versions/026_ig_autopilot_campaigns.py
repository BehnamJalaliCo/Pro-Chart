"""اینستاگرام — کمپین‌های خلبانِ خودکار (موضوع+کلیدواژه+لینک+CTA روی هر پست)

Revision ID: 026_ig_ap_campaigns
Revises: 025_ig_autopilot
Create Date: 2026-06-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "026_ig_ap_campaigns"
down_revision: Union[str, None] = "025_ig_autopilot"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ig_autopilots", sa.Column("campaigns", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("ig_autopilots", "campaigns")
