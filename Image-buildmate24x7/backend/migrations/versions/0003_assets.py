"""Add original image assets and immutable initial versions."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_assets"
down_revision = "0002_folders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("folder_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("media_type", sa.String(100), nullable=False),
        sa.Column("format", sa.String(10), nullable=False),
        sa.Column("width", sa.BigInteger(), nullable=False),
        sa.Column("height", sa.BigInteger(), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("storage_key", sa.String(80), nullable=False, unique=True),
        sa.Column("product_code", sa.String(160), nullable=True),
        sa.Column("product_name", sa.String(255), nullable=True),
        sa.Column("brand", sa.String(160), nullable=True),
        sa.Column("product_family", sa.String(160), nullable=True),
        sa.Column("category", sa.String(160), nullable=True),
        sa.Column("variant", sa.String(160), nullable=True),
        sa.Column("tags", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["folder_id"], ["folders.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("width > 0 AND height > 0 AND byte_size > 0", name="ck_assets_positive_dimensions_size"),
    )
    op.create_index("ix_assets_folder_created", "assets", ["folder_id", "created_at"])
    op.create_index("ix_assets_sha256", "assets", ["sha256"])
    op.create_table(
        "asset_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("storage_key", sa.String(80), nullable=False, unique=True),
        sa.Column("media_type", sa.String(100), nullable=False),
        sa.Column("format", sa.String(10), nullable=False),
        sa.Column("width", sa.BigInteger(), nullable=False),
        sa.Column("height", sa.BigInteger(), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("version_number > 0 AND width > 0 AND height > 0 AND byte_size > 0", name="ck_asset_versions_positive_values"),
        sa.UniqueConstraint("asset_id", "version_number", name="uq_asset_versions_number"),
    )


def downgrade() -> None:
    op.drop_table("asset_versions")
    op.drop_index("ix_assets_sha256", table_name="assets")
    op.drop_index("ix_assets_folder_created", table_name="assets")
    op.drop_table("assets")
