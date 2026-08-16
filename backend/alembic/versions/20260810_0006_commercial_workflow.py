"""Add quotations, invoices and payments."""
from alembic import op

revision = "20260810_0006"
down_revision = "20260810_0005"
branch_labels = None
depends_on = None


def upgrade():
    from orm_models import Invoice, Payment, Quotation
    bind = op.get_bind()
    Quotation.__table__.create(bind=bind, checkfirst=True)
    Invoice.__table__.create(bind=bind, checkfirst=True)
    Payment.__table__.create(bind=bind, checkfirst=True)


def downgrade():
    op.drop_table("payments")
    op.drop_table("invoices")
    op.drop_table("quotations")
