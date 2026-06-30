"""آنالیتیکسِ بازدید — جدولِ visit_events

ثبتِ هر بازدیدِ صفحه برای مانیتورِ ترافیکِ سایت (منبع، دستگاه، کشور، …).
جدولِ جدید است (بدونِ تغییرِ جداولِ موجود) → کاملاً افزایشی و امن.

Revision ID: 011_visit_events
Revises: 010_kyc_professional
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011_visit_events"
down_revision: Union[str, None] = "010_kyc_professional"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "visit_events",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("visitor_id", sa.String(length=40), nullable=True),
        sa.Column("session_id", sa.String(length=40), nullable=True),
        sa.Column("is_new_visitor", sa.Boolean(), nullable=True),
        sa.Column("path", sa.String(length=500), nullable=True),
        sa.Column("title", sa.String(length=300), nullable=True),
        sa.Column("referrer", sa.String(length=500), nullable=True),
        sa.Column("referrer_host", sa.String(length=180), nullable=True),
        sa.Column("source", sa.String(length=30), nullable=True),
        sa.Column("source_detail", sa.String(length=80), nullable=True),
        sa.Column("utm_source", sa.String(length=120), nullable=True),
        sa.Column("utm_medium", sa.String(length=120), nullable=True),
        sa.Column("utm_campaign", sa.String(length=120), nullable=True),
        sa.Column("landing", sa.Boolean(), nullable=True),
        sa.Column("device", sa.String(length=12), nullable=True),
        sa.Column("browser", sa.String(length=40), nullable=True),
        sa.Column("os", sa.String(length=40), nullable=True),
        sa.Column("is_bot", sa.Boolean(), nullable=True),
        sa.Column("lang", sa.String(length=20), nullable=True),
        sa.Column("screen", sa.String(length=20), nullable=True),
        sa.Column("country", sa.String(length=60), nullable=True),
        sa.Column("country_code", sa.String(length=4), nullable=True),
        sa.Column("city", sa.String(length=80), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=400), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_visit_events_ts", "visit_events", ["ts"])
    op.create_index("ix_visit_events_visitor_id", "visit_events", ["visitor_id"])
    op.create_index("ix_visit_events_session_id", "visit_events", ["session_id"])
    op.create_index("ix_visit_events_path", "visit_events", ["path"])
    op.create_index("ix_visit_events_referrer_host", "visit_events", ["referrer_host"])
    op.create_index("ix_visit_events_source", "visit_events", ["source"])
    op.create_index("ix_visit_events_device", "visit_events", ["device"])
    op.create_index("ix_visit_events_is_bot", "visit_events", ["is_bot"])
    op.create_index("ix_visit_events_country", "visit_events", ["country"])
    op.create_index("ix_visit_events_ip_hash", "visit_events", ["ip_hash"])


def downgrade() -> None:
    op.drop_table("visit_events")
