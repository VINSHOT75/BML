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


class LiveTrackingTests(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine("sqlite:///:memory:",connect_args={"check_same_thread":False},poolclass=StaticPool); Base.metadata.create_all(self.engine); self.db=sessionmaker(bind=self.engine,expire_on_commit=False)()
        org=orm.Organization(id="org",name="Org",slug="org"); owner=orm.User(id="owner",google_sub="o",email="o@x.com",name="Owner"); user=orm.User(id="user",google_sub="d",email="d@x.com",name="Driver")
        driver=orm.Driver(id="driver",organization_id="org",name="Driver",phone="1",license_number="L",license_expiry=datetime.now(timezone.utc)); vehicle=orm.Vehicle(id="vehicle",organization_id="org",registration_number="V",vehicle_type="Truck",make="Tata",model="X",year=2025,capacity_tons=10,status="in_transit")
        owner_mem=orm.Membership(id="om",user_id="owner",organization_id="org",role="organization_owner"); driver_mem=orm.Membership(id="dm",user_id="user",organization_id="org",role="driver",driver_id="driver")
        trip=orm.Trip(id="trip",organization_id="org",origin="A",origin_lat=19.0,origin_lng=72.0,destination="B",destination_lat=20.0,destination_lng=73.0,cargo_type="General",cargo_weight_tons=5,customer_name="C",scheduled_date=datetime.now(timezone.utc),vehicle_id="vehicle",driver_id="driver",status="in_progress",started_at=datetime.now(timezone.utc))
        self.db.add_all([org,owner,user,driver,vehicle,owner_mem,driver_mem,trip]); self.db.commit(); self.driver_auth=app.AuthContext(user,org,driver_mem,None,app.permissions_for("driver")); self.owner_auth=app.AuthContext(owner,org,owner_mem,None,{"*"})
    def tearDown(self): self.db.close(); Base.metadata.drop_all(self.engine); self.engine.dispose()

    def test_driver_location_is_stored_and_visible_to_operations(self):
        result=app.update_driver_location("trip",app.LocationUpdate(lat=19.001,lng=72.001,accuracy_meters=12),self.driver_auth,self.db)
        self.assertTrue(result["stored"]); active=app.get_active_tracking(self.owner_auth,self.db); self.assertEqual(len(active),1); self.assertEqual(active[0]["last_location"]["driver_id"],"driver"); self.assertIsNone(active[0]["alert"])

    def test_location_is_rejected_when_trip_not_running(self):
        self.db.get(orm.Trip,"trip").status="assigned"; self.db.commit()
        with self.assertRaises(HTTPException) as context: app.update_driver_location("trip",app.LocationUpdate(lat=19,lng=72),self.driver_auth,self.db)
        self.assertEqual(context.exception.status_code,409)

    def test_geofence_suggests_pickup_without_changing_milestone(self):
        result=app.update_driver_location("trip",app.LocationUpdate(lat=19.0001,lng=72.0001),self.driver_auth,self.db)
        self.assertEqual(result["geofence"]["suggestion"],"reached_pickup"); self.assertFalse(app.has_trip_event(self.db,"trip","reached_pickup"))

    def test_other_driver_cannot_update_trip(self):
        other=orm.Driver(id="other",organization_id="org",name="Other",phone="2",license_number="L2",license_expiry=datetime.now(timezone.utc)); self.db.add(other); self.db.flush(); self.driver_auth.membership.driver_id="other"
        with self.assertRaises(HTTPException) as context: app.update_driver_location("trip",app.LocationUpdate(lat=19,lng=72),self.driver_auth,self.db)
        self.assertEqual(context.exception.status_code,404)


if __name__=="__main__": unittest.main()
