"""academy phase 4+5: saved strategies, journal tags/screenshot/ai, post reactions/best, reply threads

Revision ID: 036_academy_phase45
Revises: 035_academy_studyplan
Create Date: 2026-06-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "036_academy_phase45"
down_revision = "035_academy_studyplan"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "academy_saved_strategies",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("kind", sa.String(12), server_default="lab"),
        sa.Column("params", JSONB, nullable=True),
        sa.Column("metrics", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.add_column("academy_journal", sa.Column("tags", JSONB, nullable=True))
    op.add_column("academy_journal", sa.Column("screenshot_url", sa.String(1000), nullable=True))
    op.add_column("academy_journal", sa.Column("ai_review", sa.Text, nullable=True))
    op.add_column("academy_posts", sa.Column("reactions", JSONB, nullable=True))
    op.add_column("academy_posts", sa.Column("best_reply_id", sa.Integer, nullable=True))
    op.add_column("academy_post_replies", sa.Column("parent_id", sa.Integer, nullable=True))


def downgrade() -> None:
    op.drop_column("academy_post_replies", "parent_id")
    op.drop_column("academy_posts", "best_reply_id")
    op.drop_column("academy_posts", "reactions")
    op.drop_column("academy_journal", "ai_review")
    op.drop_column("academy_journal", "screenshot_url")
    op.drop_column("academy_journal", "tags")
    op.drop_table("academy_saved_strategies")
