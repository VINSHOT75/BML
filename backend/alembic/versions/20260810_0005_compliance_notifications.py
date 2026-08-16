"""Add compliance documents and in-app notifications."""
from alembic import op
revision="20260810_0005"; down_revision="20260810_0004"; branch_labels=None; depends_on=None
def upgrade():
    from orm_models import ComplianceDocument, Notification
    bind=op.get_bind(); ComplianceDocument.__table__.create(bind=bind,checkfirst=True); Notification.__table__.create(bind=bind,checkfirst=True)
def downgrade():
    op.drop_table("notifications"); op.drop_table("compliance_documents")
