"""Add trip expenses and profitability inputs."""
from alembic import op

revision = "20260810_0007"
down_revision = "20260810_0006"
branch_labels = None
depends_on = None


def upgrade():
    from orm_models import TripExpense
    TripExpense.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade():
    op.drop_table("trip_expenses")
