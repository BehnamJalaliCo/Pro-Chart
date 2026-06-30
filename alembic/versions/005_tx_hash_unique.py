"""یکتا کردن tx_hash در payment_requests — جلوگیری از replay پرداخت

مقادیر موجود canonical (lowercase) می‌شوند، سپس UNIQUE اضافه می‌شود.

Revision ID: 005_tx_hash_unique
Revises: 004_telegram_bot_v2
Create Date: 2026-05-30
"""

from typing import Sequence, Union

from alembic import op

revision: str = "005_tx_hash_unique"
down_revision: Union[str, None] = "004_telegram_bot_v2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # canonical کردن مقادیر موجود
    op.execute("UPDATE payment_requests SET tx_hash = lower(trim(tx_hash)) WHERE tx_hash IS NOT NULL")
    # dedup: null کردن همه به‌جز جدیدترین رکورد per hash؛ وگرنه UNIQUE روی
    # داده‌ی موجودِ دارای تکرار شکست می‌خورد و migration برای همیشه loop می‌شود.
    op.execute(
        "UPDATE payment_requests SET tx_hash = NULL "
        "WHERE tx_hash IS NOT NULL AND id NOT IN ("
        "  SELECT MAX(id) FROM payment_requests "
        "  WHERE tx_hash IS NOT NULL GROUP BY tx_hash"
        ")"
    )
    # حذف ایندکس قبلی (non-unique) و افزودن UNIQUE
    op.drop_index("ix_payment_requests_tx_hash", table_name="payment_requests")
    op.create_unique_constraint("uq_payment_requests_tx_hash", "payment_requests", ["tx_hash"])
    op.create_index("ix_payment_requests_tx_hash", "payment_requests", ["tx_hash"])


def downgrade() -> None:
    op.drop_index("ix_payment_requests_tx_hash", table_name="payment_requests")
    op.drop_constraint("uq_payment_requests_tx_hash", "payment_requests", type_="unique")
    op.create_index("ix_payment_requests_tx_hash", "payment_requests", ["tx_hash"])
