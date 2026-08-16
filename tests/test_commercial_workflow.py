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


class CommercialWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, expire_on_commit=False)()
        user = orm.User(id="user_a", google_sub="google_a", email="owner@example.com", name="Owner")
        org = orm.Organization(id="org_a", name="Org A", slug="org-a")
        membership = orm.Membership(id="mem_a", user_id=user.id, organization_id=org.id, role="organization_owner", status="active")
        customer = orm.Customer(id="customer_a", organization_id=org.id, name="Acme", contact_name="Ana", phone="123")
        pickup = orm.CustomerLocation(id="pickup_a", organization_id=org.id, customer_id=customer.id, name="Plant", address="1 Road", city="Pune")
        delivery = orm.CustomerLocation(id="delivery_a", organization_id=org.id, customer_id=customer.id, name="Warehouse", address="2 Road", city="Mumbai")
        load = orm.Load(id="load_a", organization_id=org.id, reference_number="LOAD-001", customer_id=customer.id,
            pickup_location_id=pickup.id, delivery_location_id=delivery.id, cargo_type="General", cargo_weight_tons=10,
            pickup_at=datetime.now(timezone.utc), status="submitted", created_by_user_id=user.id)
        self.db.add_all([user, org, membership, customer, pickup, delivery, load]); self.db.commit()
        self.auth = app.AuthContext(user, org, membership, None, {"*"})

    def tearDown(self):
        self.db.close(); Base.metadata.drop_all(self.engine); self.engine.dispose()

    def test_quote_invoice_and_partial_payment(self):
        quote = app.create_quotation(app.QuotationPayload(load_id="load_a", base_amount=10000, fuel_surcharge=1000, toll_charges=500, tax_rate=18), self.auth, self.db)
        self.assertEqual(float(quote["subtotal"]), 11500)
        self.assertEqual(float(quote["total_amount"]), 13570)
        app.update_quotation_status(quote["quotation_id"], "sent", self.auth, self.db)
        accepted = app.update_quotation_status(quote["quotation_id"], "accepted", self.auth, self.db)
        self.assertEqual(accepted["status"], "accepted")
        self.assertEqual(self.db.get(orm.Load, "load_a").quoted_amount, 13570)

        self.db.get(orm.Load, "load_a").status = "delivered"; self.db.commit()
        invoice = app.create_invoice(app.InvoicePayload(load_id="load_a", due_at=datetime.now(timezone.utc) + timedelta(days=15)), self.auth, self.db)
        self.assertEqual(float(invoice["total_amount"]), 13570)
        issued = app.issue_invoice(invoice["invoice_id"], self.auth, self.db)
        self.assertEqual(issued["status"], "issued")
        partial = app.record_payment(invoice["invoice_id"], app.PaymentPayload(amount=5000, payment_method="upi", reference="UTR-1"), self.auth, self.db)
        self.assertEqual(partial["status"], "partially_paid")
        self.assertEqual(float(partial["balance_due"]), 8570)
        paid = app.record_payment(invoice["invoice_id"], app.PaymentPayload(amount=8570), self.auth, self.db)
        self.assertEqual(paid["status"], "paid")
        self.assertEqual(len(paid["payments"]), 2)

    def test_invoice_requires_delivery_and_overpayment_is_rejected(self):
        with self.assertRaises(HTTPException) as context:
            app.create_invoice(app.InvoicePayload(load_id="load_a", subtotal=1000), self.auth, self.db)
        self.assertEqual(context.exception.status_code, 409)
        load = self.db.get(orm.Load, "load_a"); load.status = "delivered"; self.db.commit()
        invoice = app.create_invoice(app.InvoicePayload(load_id="load_a", subtotal=1000), self.auth, self.db)
        app.issue_invoice(invoice["invoice_id"], self.auth, self.db)
        with self.assertRaises(HTTPException) as context:
            app.record_payment(invoice["invoice_id"], app.PaymentPayload(amount=1001), self.auth, self.db)
        self.assertEqual(context.exception.status_code, 409)

    def test_commercial_records_are_tenant_scoped(self):
        quote = app.create_quotation(app.QuotationPayload(load_id="load_a", base_amount=1000), self.auth, self.db)
        other_user = orm.User(id="user_b", google_sub="google_b", email="b@example.com", name="B")
        other_org = orm.Organization(id="org_b", name="Org B", slug="org-b")
        other_membership = orm.Membership(id="mem_b", user_id=other_user.id, organization_id=other_org.id, role="organization_owner", status="active")
        self.db.add_all([other_user, other_org, other_membership]); self.db.commit()
        other_auth = app.AuthContext(other_user, other_org, other_membership, None, {"*"})
        self.assertEqual(app.list_quotations(other_auth, self.db), [])
        with self.assertRaises(HTTPException) as context:
            app.update_quotation_status(quote["quotation_id"], "sent", other_auth, self.db)
        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
