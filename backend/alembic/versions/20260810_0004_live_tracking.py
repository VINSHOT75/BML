"""Add tenant-scoped trip location history."""

from alembic import op

revision = "20260810_0004"
down_revision = "20260810_0003"
branch_labels = None
depends_on = None


def upgrade():
    from orm_models import TripLocation
    TripLocation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table("trip_locations")
