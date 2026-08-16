import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))
import application as app  # noqa: E402
import orm_models as orm  # noqa: E402
from persistence import Base  # noqa: E402


class EmailReminderTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool); Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, expire_on_commit=False)(); now = datetime.now(timezone.utc)
        user = orm.User(id="owner", google_sub="g", email="owner@example.com", name="Owner"); org = orm.Organization(id="org", name="Org", slug="org")
        membership = orm.Membership(id="mem", user_id=user.id, organization_id=org.id, role="organization_owner", status="active")
        customer = orm.Customer(id="customer", organization_id=org.id, name="Acme", contact_name="Ana", phone="1", email="billing@acme.test")
        pickup = orm.CustomerLocation(id="pickup", organization_id=org.id, customer_id=customer.id, name="A", address="A", city="A"); delivery = orm.CustomerLocation(id="delivery", organization_id=org.id, customer_id=customer.id, name="B", address="B", city="B")
        load = orm.Load(id="load", organization_id=org.id, reference_number="LOAD-1", customer_id=customer.id, pickup_location_id=pickup.id, delivery_location_id=delivery.id, cargo_type="General", cargo_weight_tons=1, pickup_at=now, delivery_by=now - timedelta(hours=1), status="in_execution", created_by_user_id=user.id)
        trip = orm.Trip(id="trip", organization_id=org.id, load_id=load.id, origin="A", destination="B", cargo_type="General", cargo_weight_tons=1, customer_name="Acme", scheduled_date=now, status="in_progress")
        invoice = orm.Invoice(id="invoice", organization_id=org.id, load_id=load.id, invoice_number="INV-1", subtotal=1000, tax_rate=0, tax_amount=0, total_amount=1000, amount_paid=0, balance_due=1000, status="issued", due_at=now + timedelta(days=2), created_by_user_id=user.id)
        document = orm.ComplianceDocument(id="doc", organization_id=org.id, entity_type="vehicle", entity_id="vehicle", document_type="insurance", file_name="x.pdf", mime_type="application/pdf", file_data="data:application/pdf;base64,WA==", expires_at=now + timedelta(days=10), uploaded_by_user_id=user.id)
        expense = orm.TripExpense(id="expense", organization_id=org.id, trip_id=trip.id, category="fuel", description="Fuel", estimated_amount=100, actual_amount=100, status="submitted", submitted_by_user_id=user.id, updated_at=now - timedelta(hours=48))
        settings = orm.EmailSettings(id="settings", organization_id=org.id, enabled=True, invoice_days_before_due=3, compliance_days_before_expiry=30, pending_expense_hours=24)
        self.db.add_all([user, org, membership, customer, pickup, delivery, load, trip, invoice, document, expense, settings]); self.db.commit()
        self.auth = app.AuthContext(user, org, membership, None, {"*"})

    def tearDown(self): self.db.close(); Base.metadata.drop_all(self.engine); self.engine.dispose()

    def test_scan_queues_each_reminder_once(self):
        result = app.run_reminder_scan(self.db, "org"); self.assertGreaterEqual(result["queued"], 4)
        first_count = self.db.query(orm.EmailOutbox).count(); app.run_reminder_scan(self.db, "org")
        self.assertEqual(self.db.query(orm.EmailOutbox).count(), first_count)
        types = {item.notification_type for item in self.db.query(orm.EmailOutbox).all()}
        self.assertTrue({"invoice_reminder", "compliance_expiry", "load_delayed", "expense_pending"}.issubset(types))

    def test_transactional_notification_adds_email_and_unconfigured_delivery_stays_queued(self):
        app.notify(self.db, "org", ["owner"], "trip_assigned", "Trip assigned", "New trip", "trip", "trip"); self.db.commit()
        email = self.db.scalar(app.select(orm.EmailOutbox).where(orm.EmailOutbox.notification_type == "trip_assigned")); self.assertIsNotNone(email)
        with patch.dict(os.environ, {"SMTP_HOST": "", "SMTP_FROM_EMAIL": ""}): result = app.process_email_outbox(self.db)
        self.assertFalse(result["configured"]); self.assertEqual(email.status, "queued")

    def test_settings_validation(self):
        payload = app.EmailSettingsPayload(enabled=True, invoice_days_before_due=31)
        with self.assertRaises(HTTPException) as context: app.update_email_settings(payload, self.auth, self.db)
        self.assertEqual(context.exception.status_code, 400)


if __name__ == "__main__": unittest.main()
