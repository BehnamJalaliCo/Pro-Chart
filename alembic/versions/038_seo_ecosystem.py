"""seo ecosystem: search-console metrics, action items, pagespeed

Revision ID: 038_seo_ecosystem
Revises: 037_academy_terminal_ws
Create Date: 2026-06-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "038_seo_ecosystem"
down_revision = "037_academy_terminal_ws"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "seo_metrics_daily",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("day", sa.DateTime(timezone=True), nullable=False, unique=True, index=True),
        sa.Column("clicks", sa.Integer, server_default="0"),
        sa.Column("impressions", sa.Integer, server_default="0"),
        sa.Column("ctr", sa.Numeric(6, 4), nullable=True),
        sa.Column("position", sa.Numeric(6, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "seo_actions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("category", sa.String(30), nullable=False, index=True),
        sa.Column("severity", sa.String(10), server_default="info", index=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("detail", sa.Text, nullable=True),
        sa.Column("target", sa.Text, nullable=True),
        sa.Column("metrics", JSONB, nullable=True),
        sa.Column("dedup_key", sa.String(120), nullable=True, index=True),
        sa.Column("status", sa.String(12), server_default="open", index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "seo_pagespeed",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("strategy", sa.String(10), server_default="mobile"),
        sa.Column("performance", sa.Integer, nullable=True),
        sa.Column("seo", sa.Integer, nullable=True),
        sa.Column("accessibility", sa.Integer, nullable=True),
        sa.Column("best_practices", sa.Integer, nullable=True),
        sa.Column("lcp_ms", sa.Numeric(10, 1), nullable=True),
        sa.Column("cls", sa.Numeric(6, 4), nullable=True),
        sa.Column("tbt_ms", sa.Numeric(10, 1), nullable=True),
        sa.Column("issues", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )


def downgrade() -> None:
    op.drop_table("seo_pagespeed")
    op.drop_table("seo_actions")
    op.drop_table("seo_metrics_daily")
