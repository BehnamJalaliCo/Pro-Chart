"""academy phase 1: lesson ratings, comments, server notes, achievements, streaks

Revision ID: 034_academy_courses
Revises: 033_broadcast_fields
Create Date: 2026-06-20
"""
from alembic import op
import sqlalchemy as sa

revision = "034_academy_courses"
down_revision = "033_broadcast_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "academy_lesson_ratings",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("lesson_id", sa.Integer, sa.ForeignKey("academy_lessons.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("stars", sa.Integer, nullable=False),
        sa.Column("review", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("student_id", "lesson_id", name="uq_academy_rating"),
    )
    op.create_table(
        "academy_lesson_comments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("lesson_id", sa.Integer, sa.ForeignKey("academy_lessons.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("status", sa.String(12), server_default="published"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "academy_lesson_notes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("lesson_id", sa.Integer, sa.ForeignKey("academy_lessons.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("student_id", "lesson_id", name="uq_academy_note"),
    )
    op.create_table(
        "academy_achievements",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("badge", sa.String(40), nullable=False),
        sa.Column("earned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("student_id", "badge", name="uq_academy_achievement"),
    )
    op.create_table(
        "academy_streaks",
        sa.Column("student_id", sa.Integer, sa.ForeignKey("academy_students.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("current_streak", sa.Integer, server_default="0"),
        sa.Column("longest_streak", sa.Integer, server_default="0"),
        sa.Column("last_active_date", sa.Date, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("academy_streaks")
    op.drop_table("academy_achievements")
    op.drop_table("academy_lesson_notes")
    op.drop_table("academy_lesson_comments")
    op.drop_table("academy_lesson_ratings")
