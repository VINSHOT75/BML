import sys
import unittest
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


class TenantAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine, expire_on_commit=False)()
        self.owner_a, self.auth_a = self.make_identity("a", "organization_owner")
        self.owner_b, self.auth_b = self.make_identity("b", "organization_owner")

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def make_identity(self, suffix, role):
        user = orm.User(id=f"user_{suffix}", google_sub=f"google_{suffix}", email=f"{suffix}@example.com", name=f"User {suffix}")
        organization = orm.Organization(id=f"org_{suffix}", name=f"Organization {suffix}", slug=f"organization-{suffix}")
        membership = orm.Membership(id=f"mem_{suffix}", user_id=user.id, organization_id=organization.id, role=role, status="active")
        self.db.add_all([user, organization, membership]); self.db.commit()
        return user, app.AuthContext(user, organization, membership, None, app.permissions_for(role))

    def test_vehicle_queries_are_isolated_by_organization(self):
        self.db.add_all([
            orm.Vehicle(id="veh_a", organization_id="org_a", registration_number="A-1", vehicle_type="Truck", make="Tata", model="A", year=2025, capacity_tons=10),
            orm.Vehicle(id="veh_b", organization_id="org_b", registration_number="B-1", vehicle_type="Truck", make="Tata", model="B", year=2025, capacity_tons=10),
        ])
        self.db.commit()

        vehicles_a = app.get_vehicles(self.auth_a, self.db)
        vehicles_b = app.get_vehicles(self.auth_b, self.db)

        self.assertEqual([vehicle["vehicle_id"] for vehicle in vehicles_a], ["veh_a"])
        self.assertEqual([vehicle["vehicle_id"] for vehicle in vehicles_b], ["veh_b"])

    def test_cross_organization_entity_returns_not_found(self):
        self.db.add(orm.Vehicle(id="veh_b", organization_id="org_b", registration_number="B-1", vehicle_type="Truck", make="Tata", model="B", year=2025, capacity_tons=10))
        self.db.commit()

        with self.assertRaises(HTTPException) as context:
            app.get_vehicle("veh_b", self.auth_a, self.db)
        self.assertEqual(context.exception.status_code, 404)

    def test_viewer_cannot_receive_write_permission_dependency(self):
        _, viewer = self.make_identity("viewer", "viewer")
        dependency = app.require_permission("vehicles.create")

        with self.assertRaises(HTTPException) as context:
            dependency(viewer)
        self.assertEqual(context.exception.status_code, 403)

    def test_dispatcher_can_assign_but_cannot_manage_members(self):
        _, dispatcher = self.make_identity("dispatcher", "dispatcher")
        self.assertTrue(app.permits(dispatcher.permissions, "trips.assign"))
        self.assertFalse(app.permits(dispatcher.permissions, "members.manage"))


if __name__ == "__main__":
    unittest.main()
