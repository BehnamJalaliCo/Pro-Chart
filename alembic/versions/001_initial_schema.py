"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, ARRAY

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── TimescaleDB Extension ────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")

    # ── جدول سیگنال‌ها ────────────────────────────────
    op.create_table(
        'signals',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('symbol', sa.String(10), nullable=False),
        sa.Column('direction', sa.String(5), nullable=False),
        sa.Column('signal_type', sa.String(20), nullable=False),
        sa.Column('entry_price', sa.Numeric(20, 8), nullable=True),
        sa.Column('entry_zone_low', sa.Numeric(20, 8), nullable=True),
        sa.Column('entry_zone_high', sa.Numeric(20, 8), nullable=True),
        sa.Column('sl', sa.Numeric(20, 8), nullable=True),
        sa.Column('tp1', sa.Numeric(20, 8), nullable=True),
        sa.Column('tp2', sa.Numeric(20, 8), nullable=True),
        sa.Column('tp3', sa.Numeric(20, 8), nullable=True),
        sa.Column('trailing_sl', sa.Numeric(20, 8), nullable=True),
        sa.Column('signal_score', sa.Integer(), nullable=True),
        sa.Column('technical_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('pattern_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('ml_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('timeframe', sa.String(5), nullable=True),
        sa.Column('mtf_confirmation', JSONB(), nullable=True),
        sa.Column('analysis_details', JSONB(), nullable=True),
        sa.Column('status', sa.String(20), server_default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('close_reason', sa.String(20), nullable=True),
        sa.Column('pnl_pips', sa.Numeric(10, 2), nullable=True),
        sa.Column('pnl_dollar', sa.Numeric(15, 2), nullable=True),
        sa.Column('hit_target', sa.String(5), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_signals_symbol', 'signals', ['symbol'])
    op.create_index('ix_signals_status', 'signals', ['status'])
    op.create_index('ix_signals_created_at', 'signals', ['created_at'])

    # ── جدول کاربران ─────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('telegram_id', sa.BigInteger(), nullable=False),
        sa.Column('username', sa.String(100), nullable=True),
        sa.Column('first_name', sa.String(100), nullable=True),
        sa.Column('last_name', sa.String(100), nullable=True),
        sa.Column('plan', sa.String(20), server_default='free'),
        sa.Column('preferred_symbols', ARRAY(sa.Text()), nullable=True),
        sa.Column('notify_strength', sa.String(20), server_default='all'),
        sa.Column('notify_enabled', sa.Boolean(), server_default='true'),
        sa.Column('language', sa.String(5), server_default='fa'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('last_active', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_banned', sa.Boolean(), server_default='false'),
        sa.Column('ban_reason', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('telegram_id'),
    )
    op.create_index('ix_users_telegram_id', 'users', ['telegram_id'])

    # ── جدول عملکرد سیگنال‌ها ────────────────────────
    op.create_table(
        'signal_performance',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('period_type', sa.String(10), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('symbol', sa.String(10), nullable=True),
        sa.Column('total_signals', sa.Integer(), server_default='0'),
        sa.Column('win_count', sa.Integer(), server_default='0'),
        sa.Column('loss_count', sa.Integer(), server_default='0'),
        sa.Column('win_rate', sa.Numeric(5, 2), nullable=True),
        sa.Column('total_pips', sa.Numeric(10, 2), nullable=True),
        sa.Column('avg_pips', sa.Numeric(10, 2), nullable=True),
        sa.Column('max_win_pips', sa.Numeric(10, 2), nullable=True),
        sa.Column('max_loss_pips', sa.Numeric(10, 2), nullable=True),
        sa.Column('profit_factor', sa.Numeric(5, 2), nullable=True),
        sa.Column('avg_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('calculated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── جدول عملکرد مدل‌های ML ───────────────────────
    op.create_table(
        'ml_model_performance',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('model_name', sa.String(50), nullable=False),
        sa.Column('version', sa.String(20), nullable=True),
        sa.Column('accuracy', sa.Numeric(5, 4), nullable=True),
        sa.Column('precision_score', sa.Numeric(5, 4), nullable=True),
        sa.Column('recall_score', sa.Numeric(5, 4), nullable=True),
        sa.Column('f1_score', sa.Numeric(5, 4), nullable=True),
        sa.Column('current_weight', sa.Numeric(3, 2), nullable=True),
        sa.Column('trained_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('training_samples', sa.Integer(), nullable=True),
        sa.Column('features_used', ARRAY(sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── جدول ادمین‌ها ─────────────────────────────────
    op.create_table(
        'admins',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('role', sa.String(20), server_default='admin'),
        sa.Column('telegram_id', sa.BigInteger(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
    )

    # ── جدول مقالات ───────────────────────────────────
    op.create_table(
        'articles',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('cover_image', sa.String(500), nullable=True),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('is_published', sa.Boolean(), server_default='false'),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('view_count', sa.Integer(), server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    )

    # ── جدول لاگ فعالیت‌ها ────────────────────────────
    op.create_table(
        'activity_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('details', JSONB(), nullable=True),
        sa.Column('admin_id', sa.Integer(), sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_activity_logs_created_at', 'activity_logs', ['created_at'])

    # ── جدول پیام‌های انبوه ───────────────────────────
    op.create_table(
        'broadcasts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_recipients', sa.Integer(), server_default='0'),
        sa.Column('delivered_count', sa.Integer(), server_default='0'),
        sa.Column('failed_count', sa.Integer(), server_default='0'),
        sa.Column('status', sa.String(20), server_default='draft'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── جدول کندل‌ها (TimescaleDB Hypertable) ────────
    op.create_table(
        'candles',
        sa.Column('time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('symbol', sa.String(10), nullable=False),
        sa.Column('timeframe', sa.String(5), nullable=False),
        sa.Column('open', sa.Numeric(20, 8), nullable=False),
        sa.Column('high', sa.Numeric(20, 8), nullable=False),
        sa.Column('low', sa.Numeric(20, 8), nullable=False),
        sa.Column('close', sa.Numeric(20, 8), nullable=False),
        sa.Column('volume', sa.Numeric(20, 4), nullable=True),
        sa.PrimaryKeyConstraint('time', 'symbol', 'timeframe'),
    )

    # تبدیل به hypertable
    op.execute("""
        SELECT create_hypertable('candles', 'time',
            chunk_time_interval => INTERVAL '1 week',
            if_not_exists => TRUE
        )
    """)

    # فشرده‌سازی خودکار
    op.execute("""
        ALTER TABLE candles SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'symbol, timeframe'
        )
    """)

    op.execute("""
        SELECT add_compression_policy('candles', INTERVAL '30 days', if_not_exists => TRUE)
    """)

    # سیاست حفظ داده (2 سال)
    op.execute("""
        SELECT add_retention_policy('candles', INTERVAL '2 years', if_not_exists => TRUE)
    """)

    # ── جدول تیک‌ها (TimescaleDB Hypertable) ─────────
    op.create_table(
        'ticks',
        sa.Column('time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('symbol', sa.String(10), nullable=False),
        sa.Column('bid', sa.Numeric(20, 8), nullable=False),
        sa.Column('ask', sa.Numeric(20, 8), nullable=False),
        sa.Column('spread', sa.Numeric(10, 4), nullable=True),
        sa.PrimaryKeyConstraint('time', 'symbol'),
    )

    op.execute("""
        SELECT create_hypertable('ticks', 'time',
            chunk_time_interval => INTERVAL '1 day',
            if_not_exists => TRUE
        )
    """)

    op.execute("""
        ALTER TABLE ticks SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'symbol'
        )
    """)

    op.execute("""
        SELECT add_compression_policy('ticks', INTERVAL '7 days', if_not_exists => TRUE)
    """)

    op.execute("""
        SELECT add_retention_policy('ticks', INTERVAL '90 days', if_not_exists => TRUE)
    """)


def downgrade() -> None:
    op.drop_table('ticks')
    op.drop_table('candles')
    op.drop_table('broadcasts')
    op.drop_table('activity_logs')
    op.drop_table('articles')
    op.drop_table('admins')
    op.drop_table('ml_model_performance')
    op.drop_table('signal_performance')
    op.drop_table('users')
    op.drop_table('signals')
