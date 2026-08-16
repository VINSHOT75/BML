import sys
import unittest
from datetime import datetime, timezone
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


class TripExpenseTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, expire_on_commit=False)()
        user = orm.User(id="owner", google_sub="owner-google", email="owner@example.com", name="Owner")
        org = orm.Organization(id="org_a", name="Org A", slug="org-a")
        membership = orm.Membership(id="owner-mem", user_id=user.id, organization_id=org.id, role="organization_owner", status="active")
        customer = orm.Customer(id="customer", organization_id=org.id, name="Acme", contact_name="Ana", phone="123")
        pickup = orm.CustomerLocation(id="pickup", organization_id=org.id, customer_id=customer.id, name="A", address="A", city="Pune")
        delivery = orm.CustomerLocation(id="delivery", organization_id=org.id, customer_id=customer.id, name="B", address="B", city="Mumbai")
        load = orm.Load(id="load", organization_id=org.id, reference_number="LOAD-1", customer_id=customer.id, pickup_location_id=pickup.id,
            delivery_location_id=delivery.id, cargo_type="General", cargo_weight_tons=10, pickup_at=datetime.now(timezone.utc), quoted_amount=11800,
            status="delivered", created_by_user_id=user.id)
        trip = orm.Trip(id="trip", organization_id=org.id, load_id=load.id, origin="Pune", destination="Mumbai", cargo_type="General",
            cargo_weight_tons=10, customer_name="Acme", scheduled_date=datetime.now(timezone.utc), status="completed")
        invoice = orm.Invoice(id="invoice", organization_id=org.id, load_id=load.id, invoice_number="INV-1", subtotal=10000, tax_rate=18,
            tax_amount=1800, total_amount=11800, amount_paid=0, balance_due=11800, status="issued", created_by_user_id=user.id)
        self.db.add_all([user, org, membership, customer, pickup, delivery, load, trip, invoice]); self.db.commit()
        self.auth = app.AuthContext(user, org, membership, None, {"*"})

    def tearDown(self):
        self.db.close(); Base.metadata.drop_all(self.engine); self.engine.dispose()

    def test_approved_actual_cost_drives_pre_tax_profit(self):
        expense = app.create_expense(app.TripExpensePayload(trip_id="trip", category="fuel", description="Diesel", estimated_amount=3000, actual_amount=3200), self.auth, self.db)
        self.assertEqual(expense["status"], "draft")
        submitted = app.submit_expense(expense["expense_id"], self.auth, self.db)
        self.assertEqual(submitted["status"], "submitted")
        approved = app.review_expense(expense["expense_id"], app.ExpenseReviewPayload(status="approved"), self.auth, self.db)
        self.assertEqual(approved["status"], "approved")
        summary = app.profitability(self.auth, self.db)
        self.assertEqual(float(summary["revenue"]), 10000)
        self.assertEqual(float(summary["approved_actual_cost"]), 3200)
        self.assertEqual(float(summary["actual_profit"]), 6800)
        self.assertEqual(summary["trips"][0]["actual_margin_percent"], 68)

    def test_pending_and_rejected_costs_do_not_reduce_actual_profit(self):
        first = app.create_expense(app.TripExpensePayload(trip_id="trip", category="toll", description="Highway toll", actual_amount=500), self.auth, self.db)
        app.submit_expense(first["expense_id"], self.auth, self.db)
        summary = app.profitability(self.auth, self.db)
        self.assertEqual(float(summary["trips"][0]["pending_actual_cost"]), 500)
        self.assertEqual(float(summary["actual_profit"]), 10000)
        app.review_expense(first["expense_id"], app.ExpenseReviewPayload(status="rejected", notes="Duplicate"), self.auth, self.db)
        self.assertEqual(float(app.profitability(self.auth, self.db)["actual_profit"]), 10000)

    def test_invalid_category_and_cross_tenant_trip_are_rejected(self):
        with self.assertRaises(HTTPException) as context:
            app.create_expense(app.TripExpensePayload(trip_id="trip", category="invalid", description="Bad", actual_amount=1), self.auth, self.db)
        self.assertEqual(context.exception.status_code, 400)
        other_user = orm.User(id="other", google_sub="other-google", email="other@example.com", name="Other")
        other_org = orm.Organization(id="org_b", name="Org B", slug="org-b")
        other_membership = orm.Membership(id="other-mem", user_id=other_user.id, organization_id=other_org.id, role="organization_owner", status="active")
        self.db.add_all([other_user, other_org, other_membership]); self.db.commit()
        other_auth = app.AuthContext(other_user, other_org, other_membership, None, {"*"})
        with self.assertRaises(HTTPException) as context:
            app.create_expense(app.TripExpensePayload(trip_id="trip", category="fuel", description="Bad", actual_amount=1), other_auth, self.db)
        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
