"""آکادمی: محدودیتِ دستگاه (academy_devices) + شمارهٔ موبایل روی academy_students

Revision ID: 031_academy_devices
Revises: 030_ig_tenant
Create Date: 2026-06-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "031_academy_devices"
down_revision: Union[str, None] = "030_ig_tenant"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("academy_students", sa.Column("phone_number", sa.String(20), nullable=True))
    op.add_column("academy_students", sa.Column("phone_verified", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_index("ix_academy_students_phone_number", "academy_students", ["phone_number"])

    op.create_table(
        "academy_devices",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("academy_students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_id", sa.String(80), nullable=False),
        sa.Column("device_name", sa.String(180), nullable=True),
        sa.Column("user_agent", sa.String(400), nullable=True),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("student_id", "device_id", name="uq_academy_device"),
    )
    op.create_index("ix_academy_devices_student_id", "academy_devices", ["student_id"])
    op.create_index("ix_academy_devices_device_id", "academy_devices", ["device_id"])


def downgrade() -> None:
    op.drop_index("ix_academy_devices_device_id", table_name="academy_devices")
    op.drop_index("ix_academy_devices_student_id", table_name="academy_devices")
    op.drop_table("academy_devices")
    op.drop_index("ix_academy_students_phone_number", table_name="academy_students")
    op.drop_column("academy_students", "phone_verified")
    op.drop_column("academy_students", "phone_number")
