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


class DriverExecutionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine); self.db = sessionmaker(bind=self.engine, expire_on_commit=False)()
        owner = orm.User(id="owner", google_sub="owner", email="owner@test.com", name="Owner")
        driver_user = orm.User(id="driver_user", google_sub="driver", email="driver@test.com", name="Driver")
        org = orm.Organization(id="org", name="Org", slug="org")
        driver = orm.Driver(id="driver", organization_id="org", name="Driver", phone="1", license_number="L1", license_expiry=datetime.now(timezone.utc)+timedelta(days=100))
        vehicle = orm.Vehicle(id="vehicle", organization_id="org", registration_number="V1", vehicle_type="Truck", make="Tata", model="X", year=2025, capacity_tons=10)
        owner_mem = orm.Membership(id="owner_mem", user_id="owner", organization_id="org", role="organization_owner")
        driver_mem = orm.Membership(id="driver_mem", user_id="driver_user", organization_id="org", role="driver", driver_id="driver")
        trip = orm.Trip(id="trip", organization_id="org", origin="A", destination="B", cargo_type="General", cargo_weight_tons=5, customer_name="C", scheduled_date=datetime.now(timezone.utc), vehicle_id="vehicle", driver_id="driver", status="assigned")
        self.db.add_all([owner, driver_user, org, driver, vehicle, owner_mem, driver_mem, trip]); self.db.commit()
        self.auth = app.AuthContext(driver_user, org, driver_mem, None, app.permissions_for("driver"))

    def tearDown(self): self.db.close(); Base.metadata.drop_all(self.engine); self.engine.dispose()

    def test_driver_only_sees_assigned_trips(self):
        self.assertEqual([x["trip_id"] for x in app.get_driver_trips(self.auth, self.db)], ["trip"])
        self.assertFalse(app.permits(self.auth.permissions, "trips.read"))

    def test_start_requires_acceptance_and_passed_check(self):
        with self.assertRaises(HTTPException): app.start_driver_trip("trip", self.auth, self.db)
        app.create_driver_trip_event("trip", app.TripEventPayload(event_type="accepted"), self.auth, self.db)
        with self.assertRaises(HTTPException): app.start_driver_trip("trip", self.auth, self.db)
        check = app.PreTripCheck(trip_id="trip", driver_id="driver", vehicle_id="vehicle", tires_ok=True, brakes_ok=True, lights_ok=True, mirrors_ok=True, documents_ok=True)
        app.create_pre_trip_check(check, self.auth, self.db)
        app.start_driver_trip("trip", self.auth, self.db)
        self.assertEqual(self.db.get(orm.Trip, "trip").status, "in_progress")

    def test_milestones_must_be_recorded_in_order(self):
        with self.assertRaises(HTTPException) as context: app.create_driver_trip_event("trip", app.TripEventPayload(event_type="loaded"), self.auth, self.db)
        self.assertEqual(context.exception.status_code, 409)

    def test_execution_milestones_are_blocked_until_trip_starts(self):
        app.create_driver_trip_event("trip", app.TripEventPayload(event_type="accepted"), self.auth, self.db)
        with self.assertRaises(HTTPException) as context:
            app.create_driver_trip_event("trip", app.TripEventPayload(event_type="reached_pickup"), self.auth, self.db)
        self.assertEqual(context.exception.status_code, 409)
        self.assertIn("Start the trip", context.exception.detail)


if __name__ == "__main__": unittest.main()
