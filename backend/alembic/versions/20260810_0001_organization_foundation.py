"""Create the organization and tenant-owned relational schema."""

from alembic import op

from persistence import Base
import orm_models  # noqa: F401


revision = "20260810_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    Base.metadata.create_all(bind=op.get_bind())


def downgrade():
    Base.metadata.drop_all(bind=op.get_bind())
