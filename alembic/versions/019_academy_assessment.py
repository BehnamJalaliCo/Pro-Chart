"""آکادمی — نتیجهٔ آزمونِ سطح‌سنجیِ ورودی

Revision ID: 019_academy_assessment
Revises: 018_academy_paper
Create Date: 2026-06-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "019_academy_assessment"
down_revision: Union[str, None] = "018_academy_paper"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("academy_students", sa.Column("assessment_level", sa.String(length=20), nullable=True))
    op.add_column("academy_students", sa.Column("assessment_score", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("academy_students", "assessment_score")
    op.drop_column("academy_students", "assessment_level")
