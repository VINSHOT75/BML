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


class LoadWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, expire_on_commit=False)()
        user = orm.User(id="user_a", google_sub="google_a", email="a@example.com", name="Owner")
        org = orm.Organization(id="org_a", name="Org A", slug="org-a")
        membership = orm.Membership(id="mem_a", user_id=user.id, organization_id=org.id, role="organization_owner", status="active")
        self.db.add_all([user, org, membership]); self.db.commit()
        self.auth = app.AuthContext(user, org, membership, None, {"*"})
        customer = app.create_customer(app.CustomerPayload(name="Acme", contact_name="Ana", phone="123"), self.auth, self.db)
        self.customer_id = customer["customer_id"]
        self.pickup_id = app.create_customer_location(self.customer_id, app.LocationPayload(name="Plant", address="1 Road", city="Pune"), self.auth, self.db)["location_id"]
        self.delivery_id = app.create_customer_location(self.customer_id, app.LocationPayload(name="Warehouse", address="2 Road", city="Mumbai"), self.auth, self.db)["location_id"]
        self.db.add_all([
            orm.Driver(id="drv_a", organization_id="org_a", name="Driver", phone="123", license_number="LIC", license_expiry=datetime.now(timezone.utc) + timedelta(days=100)),
            orm.Vehicle(id="veh_a", organization_id="org_a", registration_number="MH-1", vehicle_type="Truck", make="Tata", model="X", year=2025, capacity_tons=20),
        ]); self.db.commit()

    def tearDown(self):
        self.db.close(); Base.metadata.drop_all(self.engine); self.engine.dispose()

    def payload(self, weight=10):
        return app.LoadPayload(reference_number="LOAD-001", customer_id=self.customer_id, pickup_location_id=self.pickup_id, delivery_location_id=self.delivery_id, cargo_type="General", cargo_weight_tons=weight, pickup_at=datetime.now(timezone.utc) + timedelta(days=1))

    def test_full_load_to_trip_lifecycle(self):
        load = app.create_load(self.payload(), self.auth, self.db)
        for status in [app.LoadStatus.SUBMITTED, app.LoadStatus.APPROVED, app.LoadStatus.SCHEDULED]:
            load = app.update_load_status(load["load_id"], status, self.auth, self.db)
        result = app.allocate_load(load["load_id"], app.LoadAllocation(driver_id="drv_a", vehicle_id="veh_a"), self.auth, self.db)
        self.assertEqual(result["load"]["status"], "allocated")
        self.assertEqual(result["trip"]["load_id"], load["load_id"])
        trip_id = result["trip"]["trip_id"]
        self.db.add_all([
            orm.TripEvent(id="event_accept", organization_id="org_a", trip_id=trip_id, user_id="user_a", event_type="accepted"),
            orm.PreTripCheck(id="check_pass", organization_id="org_a", trip_id=trip_id, driver_id="drv_a", vehicle_id="veh_a", tires_ok=True, brakes_ok=True, lights_ok=True, mirrors_ok=True, documents_ok=True),
        ]); self.db.commit()
        app.update_trip_status(trip_id, app.TripStatus.IN_PROGRESS, self.auth, self.db)
        self.assertEqual(app.get_load(load["load_id"], self.auth, self.db)["status"], "in_execution")
        trip = self.db.get(orm.Trip, trip_id); trip.delivered_to = "Receiver"; trip.delivery_otp = "1234"
        self.db.add(orm.TripEvent(id="event_arrive", organization_id="org_a", trip_id=trip_id, user_id="user_a", event_type="reached_destination")); self.db.commit()
        app.update_trip_status(trip_id, app.TripStatus.COMPLETED, self.auth, self.db)
        self.assertEqual(app.get_load(load["load_id"], self.auth, self.db)["status"], "delivered")
        closed = app.update_load_status(load["load_id"], app.LoadStatus.CLOSED, self.auth, self.db)
        self.assertEqual(closed["status"], "closed")

    def test_capacity_is_enforced(self):
        load = app.create_load(self.payload(weight=25), self.auth, self.db)
        for status in [app.LoadStatus.SUBMITTED, app.LoadStatus.APPROVED, app.LoadStatus.SCHEDULED]: app.update_load_status(load["load_id"], status, self.auth, self.db)
        with self.assertRaises(HTTPException) as context: app.allocate_load(load["load_id"], app.LoadAllocation(driver_id="drv_a", vehicle_id="veh_a"), self.auth, self.db)
        self.assertEqual(context.exception.status_code, 409)

    def test_cross_tenant_customer_reference_is_rejected(self):
        user = orm.User(id="user_b", google_sub="google_b", email="b@example.com", name="B")
        org = orm.Organization(id="org_b", name="Org B", slug="org-b")
        membership = orm.Membership(id="mem_b", user_id=user.id, organization_id=org.id, role="organization_owner", status="active")
        self.db.add_all([user, org, membership]); self.db.commit()
        auth_b = app.AuthContext(user, org, membership, None, {"*"})
        with self.assertRaises(HTTPException) as context: app.create_load(self.payload(), auth_b, self.db)
        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
