"""افزودن جداول بک‌تست

Revision ID: 002_backtest_tables
Revises: 001_initial
Create Date: 2026-05-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "002_backtest_tables"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "backtest_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("kind", sa.String(20), nullable=False, server_default="replay"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("symbol", sa.String(10), nullable=True),
        sa.Column("timeframe", sa.String(5), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("initial_balance", sa.Numeric(15, 2), nullable=True),
        sa.Column("final_balance", sa.Numeric(15, 2), nullable=True),
        sa.Column("total_signals", sa.Integer(), nullable=True),
        sa.Column("trades_executed", sa.Integer(), nullable=True),
        sa.Column("win_rate", sa.Numeric(5, 4), nullable=True),
        sa.Column("profit_factor", sa.Numeric(8, 3), nullable=True),
        sa.Column("sharpe_ratio", sa.Numeric(8, 3), nullable=True),
        sa.Column("max_drawdown_pct", sa.Numeric(6, 4), nullable=True),
        sa.Column("metrics_full", JSONB(), nullable=True),
        sa.Column("attribution", JSONB(), nullable=True),
        sa.Column("config", JSONB(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_backtest_runs_symbol", "backtest_runs", ["symbol"])
    op.create_index("ix_backtest_runs_status_created", "backtest_runs", ["status", "created_at"])

    op.create_table(
        "backtest_trades",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("backtest_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(10), nullable=False),
        sa.Column("direction", sa.String(5), nullable=False),
        sa.Column("entry_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("entry_price", sa.Numeric(20, 8), nullable=False),
        sa.Column("exit_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exit_price", sa.Numeric(20, 8), nullable=False),
        sa.Column("exit_reason", sa.String(20), nullable=False),
        sa.Column("lot_size", sa.Numeric(10, 4), nullable=False),
        sa.Column("gross_pips", sa.Numeric(10, 2), nullable=True),
        sa.Column("net_pips", sa.Numeric(10, 2), nullable=True),
        sa.Column("gross_pnl_dollar", sa.Numeric(15, 2), nullable=True),
        sa.Column("commission_dollar", sa.Numeric(10, 2), nullable=True),
        sa.Column("swap_dollar", sa.Numeric(10, 2), nullable=True),
        sa.Column("net_pnl_dollar", sa.Numeric(15, 2), nullable=True),
        sa.Column("r_multiple", sa.Numeric(8, 3), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("tags", JSONB(), nullable=True),
    )
    op.create_index("ix_backtest_trades_run_id", "backtest_trades", ["run_id"])
    op.create_index("ix_backtest_trades_symbol", "backtest_trades", ["symbol"])


def downgrade() -> None:
    op.drop_index("ix_backtest_trades_symbol", table_name="backtest_trades")
    op.drop_index("ix_backtest_trades_run_id", table_name="backtest_trades")
    op.drop_table("backtest_trades")
    op.drop_index("ix_backtest_runs_status_created", table_name="backtest_runs")
    op.drop_index("ix_backtest_runs_symbol", table_name="backtest_runs")
    op.drop_table("backtest_runs")
