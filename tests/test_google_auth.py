import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, Response
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

import application as app  # noqa: E402
import orm_models as orm  # noqa: E402
from persistence import Base  # noqa: E402


class GoogleAuthTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def google_profile(self, sub="google-owner", email="owner@example.com", name="Owner"):
        return {
            "sub": sub,
            "email": email,
            "email_verified": True,
            "name": name,
            "picture": "https://example.com/avatar.png",
        }

    def login(self, profile):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "client-id"}, clear=False), patch.object(
            app.id_token, "verify_oauth2_token", return_value=profile
        ):
            response = Response()
            user = app.create_session(app.GoogleLoginRequest(credential="google-id-token"), response, self.db)
        return user, response

    def test_first_verified_user_bootstraps_owner_membership(self):
        user, response = self.login(self.google_profile())

        self.assertEqual(user["email"], "owner@example.com")
        self.assertEqual(user["role"], "organization_owner")
        self.assertEqual(user["organization_name"], "BookMyLoad")
        self.assertIn("session_token=", response.headers["set-cookie"])
        self.assertNotIn("sess_", self.db.scalar(select(orm.UserSession)).token_hash)
        self.assertEqual(self.db.query(orm.Organization).count(), 1)
        self.assertEqual(self.db.query(orm.Membership).count(), 1)

    def test_uninvited_second_user_is_rejected(self):
        self.login(self.google_profile())

        with self.assertRaises(HTTPException) as context:
            self.login(self.google_profile("google-outsider", "outsider@example.com", "Outsider"))

        self.assertEqual(context.exception.status_code, 403)
        self.assertIn("invitation", context.exception.detail)

    def test_invited_google_user_joins_with_assigned_role(self):
        owner_data, _ = self.login(self.google_profile())
        owner = self.db.get(orm.User, owner_data["user_id"])
        organization = self.db.get(orm.Organization, owner_data["organization_id"])
        membership = self.db.scalar(select(orm.Membership).where(orm.Membership.user_id == owner.id))
        auth = app.AuthContext(owner, organization, membership, None, {"*"})
        invitation = app.create_invitation(
            app.InvitationCreate(email="dispatcher@example.com", role=app.Role.DISPATCHER),
            auth,
            self.db,
        )

        user, _ = self.login(self.google_profile("google-dispatcher", "dispatcher@example.com", "Dispatcher"))

        self.assertEqual(user["role"], "dispatcher")
        self.assertEqual(user["organization_id"], organization.id)
        stored = self.db.get(orm.Invitation, invitation["invitation_id"])
        self.assertEqual(stored.status, "accepted")

    def test_invalid_google_token_is_rejected(self):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "client-id"}, clear=False), patch.object(
            app.id_token, "verify_oauth2_token", side_effect=ValueError("invalid")
        ):
            with self.assertRaises(HTTPException) as context:
                app.create_session(app.GoogleLoginRequest(credential="bad-token"), Response(), self.db)

        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(self.db.query(orm.UserSession).count(), 0)

    def test_missing_client_id_is_reported(self):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": ""}, clear=False):
            with self.assertRaises(HTTPException) as context:
                app.create_session(app.GoogleLoginRequest(credential="token"), Response(), self.db)
        self.assertEqual(context.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
