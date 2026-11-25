"""Persist manual asset ordering."""
from alembic import op
import sqlalchemy as sa

revision = "0004_asset_order"
down_revision = "0003_assets"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("assets", sa.Column("display_order", sa.BigInteger(), server_default="1000", nullable=False))
    op.create_index("ix_assets_folder_order", "assets", ["folder_id", "display_order"])

def downgrade() -> None:
    op.drop_index("ix_assets_folder_order", table_name="assets")
    op.drop_column("assets", "display_order")
