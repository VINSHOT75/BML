"""Add authenticated drivers, execution events and proof of delivery."""

from alembic import op
import sqlalchemy as sa

revision = "20260810_0003"
down_revision = "20260810_0002"
branch_labels = None
depends_on = None


def add_columns(table_name, definitions):
    bind = op.get_bind()
    existing = {column["name"] for column in sa.inspect(bind).get_columns(table_name)}
    missing = [(name, column) for name, column in definitions if name not in existing]
    if missing:
        with op.batch_alter_table(table_name) as batch:
            for _, column in missing:
                batch.add_column(column)


def upgrade():
    from orm_models import TripEvent

    bind = op.get_bind()
    add_columns("memberships", [("driver_id", sa.Column("driver_id", sa.String(40), nullable=True))])
    add_columns("invitations", [("driver_id", sa.Column("driver_id", sa.String(40), nullable=True))])
    add_columns("trips", [
        ("delivered_to", sa.Column("delivered_to", sa.String(200), nullable=True)),
        ("delivery_otp", sa.Column("delivery_otp", sa.String(12), nullable=True)),
        ("pod_lat", sa.Column("pod_lat", sa.Float(), nullable=True)),
        ("pod_lng", sa.Column("pod_lng", sa.Float(), nullable=True)),
    ])
    TripEvent.__table__.create(bind=bind, checkfirst=True)


def downgrade():
    op.drop_table("trip_events")
    with op.batch_alter_table("trips") as batch:
        batch.drop_column("pod_lng"); batch.drop_column("pod_lat"); batch.drop_column("delivery_otp"); batch.drop_column("delivered_to")
    with op.batch_alter_table("invitations") as batch: batch.drop_column("driver_id")
    with op.batch_alter_table("memberships") as batch: batch.drop_column("driver_id")
