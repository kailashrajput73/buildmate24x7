"""Add nested folders with stable sibling ordering."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_folders"
down_revision = "0001_auth_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "folders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("normalized_name", sa.String(length=320), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("display_order", sa.BigInteger(), server_default="1000", nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["parent_id"], ["folders.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_folders_parent_order", "folders", ["parent_id", "display_order"])
    op.create_index(
        "uq_folders_active_parent_name",
        "folders",
        [sa.text("COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)"), "normalized_name"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_folders_active_parent_name", table_name="folders")
    op.drop_index("ix_folders_parent_order", table_name="folders")
    op.drop_table("folders")
