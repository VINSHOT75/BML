"""Add customers, locations, transporters, loads and link trips."""

from alembic import op
import sqlalchemy as sa

revision = "20260810_0002"
down_revision = "20260810_0001"
branch_labels = None
depends_on = None


def upgrade():
    # ``initialize_database`` intentionally supports fresh developer databases.
    # checkfirst keeps this migration safe if a dev server created the new tables
    # before Alembic was run, while remaining a normal upgrade in production.
    from orm_models import Customer, CustomerLocation, Load, Transporter

    bind = op.get_bind()
    for table in (Customer.__table__, CustomerLocation.__table__, Transporter.__table__, Load.__table__):
        table.create(bind=bind, checkfirst=True)
    columns = {column["name"] for column in sa.inspect(bind).get_columns("trips")}
    if "load_id" not in columns:
        with op.batch_alter_table("trips") as batch:
            batch.add_column(sa.Column("load_id", sa.String(40), nullable=True))
            batch.create_foreign_key("fk_trips_load_id", "loads", ["load_id"], ["id"], ondelete="SET NULL")
            batch.create_unique_constraint("uq_trips_load_id", ["load_id"])


def downgrade():
    with op.batch_alter_table("trips") as batch:
        batch.drop_constraint("uq_trips_load_id", type_="unique"); batch.drop_constraint("fk_trips_load_id", type_="foreignkey"); batch.drop_column("load_id")
    op.drop_table("loads"); op.drop_table("transporters"); op.drop_table("customer_locations"); op.drop_table("customers")
