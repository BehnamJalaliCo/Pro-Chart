"""seo: monitored urls for pagespeed + extra core-web-vitals columns

Revision ID: 039_seo_monitored_urls
Revises: 038_seo_ecosystem
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa

revision = "039_seo_monitored_urls"
down_revision = "038_seo_ecosystem"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "seo_monitored_urls",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("url", sa.Text, nullable=False, unique=True),
        sa.Column("label", sa.String(120), nullable=True),
        sa.Column("enabled", sa.Boolean, server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # ستون‌های Core Web Vitalsِ بیشتر
    op.add_column("seo_pagespeed", sa.Column("fcp_ms", sa.Numeric(10, 1), nullable=True))
    op.add_column("seo_pagespeed", sa.Column("si_ms", sa.Numeric(10, 1), nullable=True))

    # seedِ صفحاتِ پیش‌فرض
    op.bulk_insert(
        sa.table(
            "seo_monitored_urls",
            sa.column("url", sa.Text),
            sa.column("label", sa.String),
            sa.column("enabled", sa.Boolean),
        ),
        [
            {"url": "https://fx.trade-future.ir/", "label": "صفحهٔ اصلی", "enabled": True},
            {"url": "https://fx.trade-future.ir/blog", "label": "بلاگ", "enabled": True},
            {"url": "https://fx.trade-future.ir/academy", "label": "آکادمی", "enabled": True},
            {"url": "https://fx.trade-future.ir/signals", "label": "سیگنال‌ها", "enabled": True},
            {"url": "https://fx.trade-future.ir/performance", "label": "عملکرد", "enabled": True},
        ],
    )


def downgrade() -> None:
    op.drop_column("seo_pagespeed", "si_ms")
    op.drop_column("seo_pagespeed", "fcp_ms")
    op.drop_table("seo_monitored_urls")
