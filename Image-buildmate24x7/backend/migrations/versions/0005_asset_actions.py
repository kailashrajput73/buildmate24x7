"""Add collections, asset display names and version counter."""
from alembic import op
import sqlalchemy as sa

revision = "0005_asset_actions"
down_revision = "0004_asset_order"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("assets", sa.Column("display_name", sa.String(255), nullable=True))
    op.add_column("assets", sa.Column("current_version_number", sa.BigInteger(), server_default="1", nullable=False))
    op.create_table(
        "collections",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_table(
        "asset_collections",
        sa.Column("asset_id", sa.Uuid(), primary_key=True),
        sa.Column("collection_id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["collection_id"], ["collections.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_asset_collections_collection", "asset_collections", ["collection_id"])

def downgrade() -> None:
    op.drop_index("ix_asset_collections_collection", table_name="asset_collections")
    op.drop_table("asset_collections")
    op.drop_table("collections")
    op.drop_column("assets", "current_version_number")
    op.drop_column("assets", "display_name")
