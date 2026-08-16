import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

import application as app  # noqa: E402
import orm_models as orm  # noqa: E402
from persistence import Base  # noqa: E402


class ReportingAnalyticsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine); self.db = sessionmaker(bind=self.engine, expire_on_commit=False)()
        now = datetime.now(timezone.utc)
        user = orm.User(id="owner", google_sub="google-owner", email="owner@example.com", name="Owner")
        org = orm.Organization(id="org", name="Org", slug="org"); membership = orm.Membership(id="mem", user_id=user.id, organization_id=org.id, role="organization_owner", status="active")
        customer = orm.Customer(id="customer", organization_id=org.id, name="Acme", contact_name="Ana", phone="1")
        pickup = orm.CustomerLocation(id="pickup", organization_id=org.id, customer_id=customer.id, name="A", address="A", city="Pune")
        delivery = orm.CustomerLocation(id="delivery", organization_id=org.id, customer_id=customer.id, name="B", address="B", city="Mumbai")
        driver = orm.Driver(id="driver", organization_id=org.id, name="Dev", phone="1", license_number="L", license_expiry=now + timedelta(days=100))
        vehicle = orm.Vehicle(id="vehicle", organization_id=org.id, registration_number="MH-01", vehicle_type="Truck", make="Tata", model="X", year=2025, capacity_tons=20)
        load = orm.Load(id="load", organization_id=org.id, reference_number="LOAD-1", customer_id=customer.id, pickup_location_id=pickup.id, delivery_location_id=delivery.id, cargo_type="General", cargo_weight_tons=10, pickup_at=now - timedelta(days=2), delivery_by=now - timedelta(days=1), status="delivered", created_by_user_id=user.id)
        trip = orm.Trip(id="trip", organization_id=org.id, load_id=load.id, origin="Pune", destination="Mumbai", cargo_type="General", cargo_weight_tons=10, customer_name="Acme", scheduled_date=now - timedelta(days=2), completed_at=now - timedelta(days=1, hours=2), driver_id=driver.id, vehicle_id=vehicle.id, status="completed", distance_km=150)
        invoice = orm.Invoice(id="invoice", organization_id=org.id, load_id=load.id, invoice_number="INV-1", subtotal=10000, tax_rate=18, tax_amount=1800, total_amount=11800, amount_paid=5000, balance_due=6800, status="partially_paid", issued_at=now - timedelta(days=1), due_at=now + timedelta(days=10), created_by_user_id=user.id)
        payment = orm.Payment(id="payment", organization_id=org.id, invoice_id=invoice.id, amount=5000, paid_at=now - timedelta(hours=1), payment_method="upi", recorded_by_user_id=user.id)
        expense = orm.TripExpense(id="expense", organization_id=org.id, trip_id=trip.id, category="fuel", description="Diesel", estimated_amount=1800, actual_amount=2000, status="approved", submitted_by_user_id=user.id, reviewed_by_user_id=user.id)
        self.db.add_all([user, org, membership, customer, pickup, delivery, driver, vehicle, load, trip, invoice, payment, expense]); self.db.commit()
        self.auth = app.AuthContext(user, org, membership, None, {"*"}); self.start = now - timedelta(days=10); self.end = now + timedelta(days=1)

    def tearDown(self):
        self.db.close(); Base.metadata.drop_all(self.engine); self.engine.dispose()

    def test_real_financial_and_operational_totals(self):
        report = app.build_report(self.db, self.auth, self.start, self.end)
        summary = report["summary"]
        self.assertEqual(summary["loads"], 1); self.assertEqual(summary["completed_trips"], 1); self.assertEqual(summary["on_time"], 1)
        self.assertEqual(float(summary["revenue"]), 10000); self.assertEqual(float(summary["collected"]), 5000)
        self.assertEqual(float(summary["approved_expenses"]), 2000); self.assertEqual(float(summary["profit"]), 8000); self.assertEqual(summary["margin_percent"], 80)
        self.assertEqual(report["customers"][0]["customer_name"], "Acme"); self.assertEqual(report["drivers"][0]["distance_km"], 150)

    def test_filters_and_csv_export_use_same_dataset(self):
        self.assertEqual(app.build_report(self.db, self.auth, self.start, self.end, customer_id="missing")["summary"]["loads"], 0)
        fuel = app.build_report(self.db, self.auth, self.start, self.end, expense_category="fuel")
        self.assertEqual(float(fuel["summary"]["approved_expenses"]), 2000)
        response = app.export_report_csv("trips", self.start, self.end, None, None, None, None, None, None, self.auth, self.db)
        body = response.body.decode("utf-8-sig")
        self.assertIn("load_reference", body); self.assertIn("LOAD-1", body); self.assertIn("8000.00", body)

    def test_report_range_and_tenant_boundaries(self):
        with self.assertRaises(HTTPException) as context: app.build_report(self.db, self.auth, self.end, self.start)
        self.assertEqual(context.exception.status_code, 400)
        other_user = orm.User(id="other", google_sub="other", email="other@example.com", name="Other"); other_org = orm.Organization(id="other-org", name="Other", slug="other")
        other_membership = orm.Membership(id="other-mem", user_id=other_user.id, organization_id=other_org.id, role="organization_owner", status="active")
        self.db.add_all([other_user, other_org, other_membership]); self.db.commit(); other_auth = app.AuthContext(other_user, other_org, other_membership, None, {"*"})
        self.assertEqual(app.build_report(self.db, other_auth, self.start, self.end)["summary"]["loads"], 0)


if __name__ == "__main__":
    unittest.main()
