"""Add email settings and durable delivery outbox."""
from alembic import op

revision = "20260811_0008"
down_revision = "20260810_0007"
branch_labels = None
depends_on = None


def upgrade():
    from orm_models import EmailOutbox, EmailSettings
    bind = op.get_bind()
    EmailSettings.__table__.create(bind=bind, checkfirst=True)
    EmailOutbox.__table__.create(bind=bind, checkfirst=True)


def downgrade():
    op.drop_table("email_outbox")
    op.drop_table("email_settings")
