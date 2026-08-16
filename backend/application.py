import hashlib
import json
import logging
import os
import re
import secrets
import uuid
import math
import threading
import time
import requests
import base64
import csv
import io
import html
import smtplib
import ssl
from collections import defaultdict
from email.message import EmailMessage
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from starlette.middleware.cors import CORSMiddleware

import orm_models as orm
from persistence import SessionLocal, get_db, initialize_database


logger = logging.getLogger(__name__)

app = FastAPI(title="BookMyLoad API", version="2.0.0")
api_router = APIRouter(prefix="/api")


class VehicleStatus(str, Enum):
    AVAILABLE = "available"
    IN_TRANSIT = "in_transit"
    MAINTENANCE = "maintenance"
    OFFLINE = "offline"


class DriverStatus(str, Enum):
    AVAILABLE = "available"
    ON_TRIP = "on_trip"
    OFF_DUTY = "off_duty"
    ON_LEAVE = "on_leave"


class TripStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class LoadStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    SCHEDULED = "scheduled"
    ALLOCATED = "allocated"
    IN_EXECUTION = "in_execution"
    DELIVERED = "delivered"
    CLOSED = "closed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class Role(str, Enum):
    ORGANIZATION_OWNER = "organization_owner"
    OPERATIONS_ADMIN = "operations_admin"
    DISPATCHER = "dispatcher"
    VIEWER = "viewer"
    DRIVER = "driver"


ROLE_PERMISSIONS = {
    Role.ORGANIZATION_OWNER.value: {"*"},
    Role.OPERATIONS_ADMIN.value: {
        "organization.read", "members.read", "vehicles.*", "drivers.*",
        "trips.*", "loads.*", "customers.*", "transporters.*", "compliance.*", "commercial.*", "expenses.*", "notifications.*", "tracking.read", "dashboard.read", "reports.read",
    },
    Role.DISPATCHER.value: {
        "organization.read", "vehicles.read", "drivers.read", "trips.*", "loads.*", "customers.read", "transporters.read", "notifications.read", "tracking.read",
        "compliance.read", "commercial.read", "expenses.read", "expenses.create", "expenses.update", "dashboard.read", "reports.read",
    },
    Role.VIEWER.value: {
        "organization.read", "vehicles.read", "drivers.read", "trips.read", "loads.read", "customers.read", "transporters.read", "notifications.read", "tracking.read",
        "compliance.read", "commercial.read", "expenses.read", "dashboard.read", "reports.read",
    },
    Role.DRIVER.value: {"driver.portal", "driver.location", "compliance.create", "compliance.read", "expenses.create", "expenses.read", "expenses.update", "notifications.read"},
}


class AppModel(BaseModel):
    def model_dump(self, *args, **kwargs):
        return self.dict(*args, **kwargs)


class GoogleLoginRequest(AppModel):
    credential: str


class OrganizationUpdate(AppModel):
    name: str


class InvitationCreate(AppModel):
    email: str
    role: Role


class DriverInvite(AppModel):
    email: str


class MembershipRoleUpdate(AppModel):
    role: Role


class OrganizationSwitch(AppModel):
    organization_id: str


class User(AppModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str
    organization_id: str
    organization_name: str
    permissions: List[str]
    memberships: List[dict] = []
    created_at: datetime


class VehicleBase(AppModel):
    registration_number: str
    vehicle_type: str
    make: str
    model: str
    year: int
    capacity_tons: float
    fuel_type: str = "diesel"
    current_location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class VehicleCreate(VehicleBase):
    pass


class Vehicle(VehicleBase):
    vehicle_id: str
    status: VehicleStatus = VehicleStatus.AVAILABLE
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None
    total_trips: int = 0
    total_km: float = 0
    created_at: datetime


class DriverBase(AppModel):
    name: str
    phone: str
    email: Optional[str] = None
    license_number: str
    license_expiry: datetime
    address: Optional[str] = None
    emergency_contact: Optional[str] = None


class DriverCreate(DriverBase):
    pass


class Driver(DriverBase):
    driver_id: str
    status: DriverStatus = DriverStatus.AVAILABLE
    assigned_vehicle_id: Optional[str] = None
    total_trips: int = 0
    total_km: float = 0
    rating: float = 5.0
    created_at: datetime


class TripBase(AppModel):
    origin: str
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    destination: str
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    cargo_type: str
    cargo_weight_tons: float
    customer_name: str
    customer_phone: Optional[str] = None
    scheduled_date: datetime
    notes: Optional[str] = None


class TripCreate(TripBase):
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None


class Trip(TripBase):
    trip_id: str
    load_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    driver_id: Optional[str] = None
    status: TripStatus = TripStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    distance_km: Optional[float] = None
    estimated_duration_hours: Optional[float] = None
    actual_duration_hours: Optional[float] = None
    pod_signature: Optional[str] = None
    pod_photo: Optional[str] = None
    pod_notes: Optional[str] = None
    created_at: datetime


class CustomerPayload(AppModel):
    name: str
    contact_name: str
    phone: str
    email: Optional[str] = None
    gst_number: Optional[str] = None
    billing_address: Optional[str] = None


class LocationPayload(AppModel):
    name: str
    address: str
    city: str
    state: Optional[str] = None
    postal_code: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class TransporterPayload(AppModel):
    name: str
    contact_name: str
    phone: str
    email: Optional[str] = None
    gst_number: Optional[str] = None
    service_areas: Optional[str] = None


class LoadPayload(AppModel):
    reference_number: str
    customer_id: str
    pickup_location_id: str
    delivery_location_id: str
    transporter_id: Optional[str] = None
    cargo_type: str
    cargo_weight_tons: float
    quantity: int = 1
    pickup_at: datetime
    delivery_by: Optional[datetime] = None
    quoted_amount: Optional[float] = None
    notes: Optional[str] = None


class LoadAllocation(AppModel):
    driver_id: str
    vehicle_id: str


class QuotationPayload(AppModel):
    load_id: str
    base_amount: float
    fuel_surcharge: float = 0
    toll_charges: float = 0
    handling_charges: float = 0
    tax_rate: float = 0
    valid_until: Optional[datetime] = None
    terms: Optional[str] = None


class InvoicePayload(AppModel):
    load_id: str
    subtotal: Optional[float] = None
    tax_rate: Optional[float] = None
    due_at: Optional[datetime] = None
    notes: Optional[str] = None


class PaymentPayload(AppModel):
    amount: float
    paid_at: Optional[datetime] = None
    payment_method: str = "bank_transfer"
    reference: Optional[str] = None
    notes: Optional[str] = None


class TripExpensePayload(AppModel):
    trip_id: str
    category: str
    description: str
    estimated_amount: float = 0
    actual_amount: Optional[float] = None
    expense_date: Optional[datetime] = None
    vendor: Optional[str] = None
    reference: Optional[str] = None
    receipt_file_name: Optional[str] = None
    receipt_mime_type: Optional[str] = None
    receipt_file_data: Optional[str] = None


class ExpenseReviewPayload(AppModel):
    status: str
    notes: Optional[str] = None


class EmailSettingsPayload(AppModel):
    enabled: bool = False
    transactional_enabled: bool = True
    invoice_reminders_enabled: bool = True
    invoice_days_before_due: int = 3
    compliance_reminders_enabled: bool = True
    compliance_days_before_expiry: int = 30
    delayed_load_reminders_enabled: bool = True
    pending_expense_reminders_enabled: bool = True
    pending_expense_hours: int = 24


class TripEventPayload(AppModel):
    event_type: str
    notes: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class ProofOfDeliveryPayload(AppModel):
    delivered_to: str
    delivery_otp: Optional[str] = None
    signature: Optional[str] = None
    photo: Optional[str] = None
    notes: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class LocationUpdate(AppModel):
    lat: float
    lng: float
    accuracy_meters: Optional[float] = None
    speed_kph: Optional[float] = None
    heading: Optional[float] = None
    recorded_at: Optional[datetime] = None


class ReverseGeocodeRequest(AppModel):
    lat: float
    lng: float


class DocumentCreate(AppModel):
    entity_type: str
    entity_id: str
    document_type: str
    document_number: Optional[str] = None
    issued_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    file_name: str
    mime_type: str
    file_data: str
    notes: Optional[str] = None


class DocumentVerification(AppModel):
    status: str
    notes: Optional[str] = None


class PreTripCheck(AppModel):
    check_id: str = Field(default_factory=lambda: f"chk_{uuid.uuid4().hex[:12]}")
    trip_id: str
    driver_id: str
    vehicle_id: str
    tires_ok: bool = False
    brakes_ok: bool = False
    lights_ok: bool = False
    mirrors_ok: bool = False
    fuel_level: str = "full"
    documents_ok: bool = False
    notes: Optional[str] = None
    checked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DashboardStats(AppModel):
    total_vehicles: int
    available_vehicles: int
    total_drivers: int
    available_drivers: int
    active_trips: int
    completed_trips_today: int
    total_km_today: float
    pending_maintenance: int


class AIInsightRequest(AppModel):
    query: str


class AIInsightResponse(AppModel):
    insight: str
    generated_at: datetime


class AuthContext:
    def __init__(self, user, organization, membership, session, permissions):
        self.user = user
        self.organization = organization
        self.membership = membership
        self.session = session
        self.permissions = permissions


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def aware(value):
    if value and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def slugify(value):
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or f"organization-{uuid.uuid4().hex[:6]}"


def permissions_for(role, platform_admin=False):
    if platform_admin:
        return {"*"}
    return set(ROLE_PERMISSIONS.get(role, set()))


def permits(permissions, permission):
    if "*" in permissions or permission in permissions:
        return True
    namespace = permission.split(".", 1)[0]
    return f"{namespace}.*" in permissions


def serialize_memberships(db, user_id):
    rows = db.execute(
        select(orm.Membership, orm.Organization)
        .join(orm.Organization, orm.Organization.id == orm.Membership.organization_id)
        .where(orm.Membership.user_id == user_id, orm.Membership.status == "active")
    ).all()
    return [
        {"organization_id": org.id, "organization_name": org.name, "role": membership.role}
        for membership, org in rows
    ]


def serialize_user(db, auth):
    return {
        "user_id": auth.user.id,
        "email": auth.user.email,
        "name": auth.user.name,
        "picture": auth.user.picture,
        "role": auth.membership.role,
        "driver_id": auth.membership.driver_id,
        "organization_id": auth.organization.id,
        "organization_name": auth.organization.name,
        "permissions": sorted(auth.permissions),
        "memberships": serialize_memberships(db, auth.user.id),
        "created_at": auth.user.created_at,
    }


def audit(db, auth, action, entity_type, entity_id=None, details=None):
    db.add(orm.AuditEvent(
        id=new_id("audit"), organization_id=auth.organization.id,
        user_id=auth.user.id, action=action, entity_type=entity_type,
        entity_id=entity_id, details=json.dumps(details) if details else None,
    ))


def get_email_settings(db, organization_id, create=False):
    value = db.scalar(select(orm.EmailSettings).where(orm.EmailSettings.organization_id == organization_id))
    if not value and create:
        value = orm.EmailSettings(id=new_id("emailcfg"), organization_id=organization_id)
        db.add(value); db.flush()
    return value


def enqueue_email(db, organization_id, recipient_email, subject, message, notification_type, entity_type=None, entity_id=None, recipient_name=None, dedup_key=None):
    email = (recipient_email or "").strip().lower()
    if not email or "@" not in email: return None
    settings = get_email_settings(db, organization_id)
    if not settings or not settings.enabled: return None
    if dedup_key and db.scalar(select(orm.EmailOutbox).where(orm.EmailOutbox.dedup_key == dedup_key)): return None
    safe_message = html.escape(message).replace("\n", "<br>")
    value = orm.EmailOutbox(id=new_id("email"), organization_id=organization_id, recipient_email=email, recipient_name=recipient_name,
        subject=subject, text_body=message, html_body=f"<div style='font-family:Arial,sans-serif'><h2>{html.escape(subject)}</h2><p>{safe_message}</p><p style='color:#64748b'>BookMyLoad · Automated notification</p></div>",
        notification_type=notification_type, entity_type=entity_type, entity_id=entity_id, dedup_key=dedup_key)
    db.add(value); return value


def notify(db, organization_id, user_ids, notification_type, title, message, entity_type=None, entity_id=None, severity="info"):
    for user_id in set(user_ids):
        db.add(orm.Notification(id=new_id("note"), organization_id=organization_id, user_id=user_id, notification_type=notification_type, title=title, message=message, entity_type=entity_type, entity_id=entity_id, severity=severity))
        settings = get_email_settings(db, organization_id)
        user = db.get(orm.User, user_id)
        if settings and settings.enabled and settings.transactional_enabled and user:
            enqueue_email(db, organization_id, user.email, title, message, notification_type, entity_type, entity_id, user.name, f"event:{organization_id}:{notification_type}:{entity_id or 'none'}:{user.id}")


def operational_user_ids(db, organization_id):
    return list(db.scalars(select(orm.Membership.user_id).where(orm.Membership.organization_id == organization_id, orm.Membership.status == "active", orm.Membership.role != Role.DRIVER.value)).all())


def driver_user_id(db, organization_id, driver_id):
    return db.scalar(select(orm.Membership.user_id).where(orm.Membership.organization_id == organization_id, orm.Membership.driver_id == driver_id, orm.Membership.status == "active"))


def get_session_token(request):
    token = request.cookies.get("session_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header.removeprefix("Bearer ").strip()
    return token


def get_current_user(request: Request, db: Session = Depends(get_db)):
    raw_token = get_session_token(request)
    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = db.scalar(select(orm.UserSession).where(orm.UserSession.token_hash == token_hash(raw_token)))
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    if aware(session.expires_at) < datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=401, detail="Session expired")
    user = db.get(orm.User, session.user_id)
    organization = db.get(orm.Organization, session.organization_id)
    membership = db.scalar(select(orm.Membership).where(
        orm.Membership.user_id == session.user_id,
        orm.Membership.organization_id == session.organization_id,
        orm.Membership.status == "active",
    ))
    if not user or not organization or not organization.is_active or not membership:
        raise HTTPException(status_code=401, detail="Organization access is no longer active")
    return AuthContext(user, organization, membership, session, permissions_for(membership.role, user.is_platform_admin))


def require_permission(permission):
    def dependency(auth: AuthContext = Depends(get_current_user)):
        if not permits(auth.permissions, permission):
            raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")
        return auth
    return dependency


def unique_slug(db, name):
    base = slugify(name)
    value = base
    counter = 2
    while db.scalar(select(orm.Organization).where(orm.Organization.slug == value)):
        value = f"{base}-{counter}"
        counter += 1
    return value


@api_router.post("/auth/login")
def create_session(login: GoogleLoginRequest, response: Response, db: Session = Depends(get_db)):
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(status_code=503, detail="Google Sign-In is not configured")
    try:
        google_user = id_token.verify_oauth2_token(
            login.credential, google_requests.Request(), client_id, clock_skew_in_seconds=10
        )
    except (ValueError, TypeError) as error:
        logger.warning("Google credential rejected: %s", error)
        raise HTTPException(status_code=401, detail="Invalid Google credential")
    except GoogleAuthError as error:
        logger.warning("Google credential verification unavailable: %s", error)
        raise HTTPException(status_code=503, detail="Google authentication is temporarily unavailable")

    google_sub = google_user.get("sub")
    email = google_user.get("email", "").strip().lower()
    if not google_sub or not email or not google_user.get("email_verified"):
        raise HTTPException(status_code=401, detail="A verified Google account is required")
    allowed_domains = {x.strip().lower() for x in os.environ.get("GOOGLE_ALLOWED_DOMAINS", "").split(",") if x.strip()}
    if allowed_domains and email.rsplit("@", 1)[-1] not in allowed_domains:
        raise HTTPException(status_code=403, detail="This Google account is not allowed")

    user = db.scalar(select(orm.User).where(orm.User.google_sub == google_sub))
    if not user:
        user = db.scalar(select(orm.User).where(orm.User.email == email))
    if user:
        user.google_sub = google_sub
        user.email = email
        user.name = google_user.get("name") or email.split("@", 1)[0]
        user.picture = google_user.get("picture")
        user.auth_provider = "google"
    else:
        platform_emails = {x.strip().lower() for x in os.environ.get("PLATFORM_ADMIN_EMAILS", "").split(",") if x.strip()}
        user = orm.User(
            id=new_id("user"), google_sub=google_sub, email=email,
            name=google_user.get("name") or email.split("@", 1)[0],
            picture=google_user.get("picture"), auth_provider="google",
            is_platform_admin=email in platform_emails,
        )
        db.add(user)
        db.flush()

    memberships = db.scalars(select(orm.Membership).where(
        orm.Membership.user_id == user.id, orm.Membership.status == "active"
    )).all()
    if not memberships:
        invitation = db.scalar(select(orm.Invitation).where(
            func.lower(orm.Invitation.email) == email,
            orm.Invitation.status == "pending",
            orm.Invitation.expires_at > datetime.now(timezone.utc),
        ).order_by(orm.Invitation.created_at))
        if invitation:
            membership = orm.Membership(
                id=new_id("mem"), user_id=user.id,
                organization_id=invitation.organization_id,
                role=invitation.role, driver_id=invitation.driver_id, status="active",
            )
            invitation.status = "accepted"
            invitation.accepted_at = datetime.now(timezone.utc)
            db.add(membership)
            memberships = [membership]
        else:
            membership_count = db.scalar(select(func.count()).select_from(orm.Membership)) or 0
            if membership_count == 0:
                org = db.scalar(select(orm.Organization).order_by(orm.Organization.created_at))
                if not org:
                    name = os.environ.get("DEFAULT_ORGANIZATION_NAME", "BookMyLoad")
                    org = orm.Organization(id=new_id("org"), name=name, slug=unique_slug(db, name))
                    db.add(org)
                    db.flush()
                membership = orm.Membership(
                    id=new_id("mem"), user_id=user.id, organization_id=org.id,
                    role=Role.ORGANIZATION_OWNER.value, status="active",
                )
                db.add(membership)
                memberships = [membership]
            else:
                db.commit()
                raise HTTPException(status_code=403, detail="No organization access. Ask an organization owner for an invitation.")

    membership = memberships[0]
    organization = db.get(orm.Organization, membership.organization_id)
    raw_token = f"sess_{secrets.token_urlsafe(32)}"
    session = orm.UserSession(
        id=new_id("session"), user_id=user.id, organization_id=organization.id,
        token_hash=token_hash(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(session)
    auth = AuthContext(user, organization, membership, session, permissions_for(membership.role, user.is_platform_admin))
    audit(db, auth, "auth.login", "user", user.id)
    db.commit()
    response.set_cookie(
        key="session_token", value=raw_token, httponly=True,
        secure=os.environ.get("COOKIE_SECURE", "false").lower() == "true",
        samesite="lax", path="/", max_age=7 * 24 * 60 * 60,
    )
    return serialize_user(db, auth)


@api_router.get("/auth/me")
def get_me(auth: AuthContext = Depends(get_current_user), db: Session = Depends(get_db)):
    return serialize_user(db, auth)


@api_router.post("/auth/switch-organization")
def switch_organization(payload: OrganizationSwitch, auth: AuthContext = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.scalar(select(orm.Membership).where(
        orm.Membership.user_id == auth.user.id,
        orm.Membership.organization_id == payload.organization_id,
        orm.Membership.status == "active",
    ))
    organization = db.get(orm.Organization, payload.organization_id)
    if not membership or not organization or not organization.is_active:
        raise HTTPException(status_code=403, detail="Organization access denied")
    auth.session.organization_id = organization.id
    db.commit()
    switched = AuthContext(auth.user, organization, membership, auth.session, permissions_for(membership.role, auth.user.is_platform_admin))
    return serialize_user(db, switched)


@api_router.post("/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw_token = get_session_token(request)
    if raw_token:
        session = db.scalar(select(orm.UserSession).where(orm.UserSession.token_hash == token_hash(raw_token)))
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}


@api_router.get("/organizations/current")
def current_organization(auth: AuthContext = Depends(require_permission("organization.read"))):
    return {"organization_id": auth.organization.id, "name": auth.organization.name, "slug": auth.organization.slug, "organization_type": auth.organization.organization_type}


@api_router.put("/organizations/current")
def update_organization(payload: OrganizationUpdate, auth: AuthContext = Depends(require_permission("organization.manage")), db: Session = Depends(get_db)):
    name = payload.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Organization name is required")
    auth.organization.name = name
    audit(db, auth, "organization.update", "organization", auth.organization.id, {"name": name})
    db.commit()
    return {"organization_id": auth.organization.id, "name": name, "slug": auth.organization.slug}


@api_router.get("/organizations/current/members")
def list_members(auth: AuthContext = Depends(require_permission("members.read")), db: Session = Depends(get_db)):
    rows = db.execute(select(orm.Membership, orm.User).join(orm.User, orm.User.id == orm.Membership.user_id).where(
        orm.Membership.organization_id == auth.organization.id, orm.Membership.status == "active"
    )).all()
    return [{"membership_id": m.id, "user_id": u.id, "driver_id": m.driver_id, "name": u.name, "email": u.email, "picture": u.picture, "role": m.role, "joined_at": m.created_at} for m, u in rows]


@api_router.post("/organizations/current/invitations")
def create_invitation(payload: InvitationCreate, auth: AuthContext = Depends(require_permission("members.manage")), db: Session = Depends(get_db)):
    if payload.role == Role.DRIVER:
        raise HTTPException(status_code=400, detail="Invite drivers from the Drivers page so their profile can be linked")
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")
    existing_user = db.scalar(select(orm.User).where(func.lower(orm.User.email) == email))
    if existing_user and db.scalar(select(orm.Membership).where(
        orm.Membership.user_id == existing_user.id,
        orm.Membership.organization_id == auth.organization.id,
        orm.Membership.status == "active",
    )):
        raise HTTPException(status_code=409, detail="User is already a member")
    existing = db.scalar(select(orm.Invitation).where(
        orm.Invitation.organization_id == auth.organization.id,
        func.lower(orm.Invitation.email) == email,
        orm.Invitation.status == "pending",
    ))
    if existing:
        existing.role = payload.role.value
        existing.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        invitation = existing
    else:
        invitation = orm.Invitation(
            id=new_id("invite"), organization_id=auth.organization.id,
            email=email, role=payload.role.value, status="pending",
            invited_by_user_id=auth.user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db.add(invitation)
    audit(db, auth, "member.invite", "invitation", invitation.id, {"email": email, "role": payload.role.value})
    db.commit()
    return {"invitation_id": invitation.id, "email": email, "role": invitation.role, "status": invitation.status, "expires_at": invitation.expires_at}


@api_router.get("/organizations/current/invitations")
def list_invitations(auth: AuthContext = Depends(require_permission("members.read")), db: Session = Depends(get_db)):
    invitations = db.scalars(select(orm.Invitation).where(orm.Invitation.organization_id == auth.organization.id).order_by(orm.Invitation.created_at.desc())).all()
    return [{"invitation_id": i.id, "email": i.email, "role": i.role, "status": i.status, "expires_at": i.expires_at, "created_at": i.created_at} for i in invitations]


@api_router.delete("/organizations/current/invitations/{invitation_id}")
def revoke_invitation(invitation_id: str, auth: AuthContext = Depends(require_permission("members.manage")), db: Session = Depends(get_db)):
    invitation = db.scalar(select(orm.Invitation).where(orm.Invitation.id == invitation_id, orm.Invitation.organization_id == auth.organization.id))
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    invitation.status = "revoked"
    audit(db, auth, "member.invitation_revoke", "invitation", invitation.id)
    db.commit()
    return {"message": "Invitation revoked"}


@api_router.patch("/organizations/current/members/{membership_id}")
def update_member_role(membership_id: str, payload: MembershipRoleUpdate, auth: AuthContext = Depends(require_permission("members.manage")), db: Session = Depends(get_db)):
    membership = db.scalar(select(orm.Membership).where(orm.Membership.id == membership_id, orm.Membership.organization_id == auth.organization.id))
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    if membership.user_id == auth.user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    if payload.role == Role.DRIVER:
        raise HTTPException(status_code=400, detail="Driver access must be created from the Drivers page")
    membership.driver_id = None
    membership.role = payload.role.value
    audit(db, auth, "member.role_update", "membership", membership.id, {"role": membership.role})
    db.commit()
    return {"membership_id": membership.id, "role": membership.role}


@api_router.delete("/organizations/current/members/{membership_id}")
def remove_member(membership_id: str, auth: AuthContext = Depends(require_permission("members.manage")), db: Session = Depends(get_db)):
    membership = db.scalar(select(orm.Membership).where(orm.Membership.id == membership_id, orm.Membership.organization_id == auth.organization.id))
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    if membership.user_id == auth.user.id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself")
    membership.status = "removed"
    db.query(orm.UserSession).filter(orm.UserSession.user_id == membership.user_id, orm.UserSession.organization_id == auth.organization.id).delete()
    audit(db, auth, "member.remove", "membership", membership.id)
    db.commit()
    return {"message": "Member removed"}


def vehicle_dict(v):
    return {"vehicle_id": v.id, "registration_number": v.registration_number, "vehicle_type": v.vehicle_type, "make": v.make, "model": v.model, "year": v.year, "capacity_tons": v.capacity_tons, "fuel_type": v.fuel_type, "current_location": v.current_location, "lat": v.lat, "lng": v.lng, "status": v.status, "last_maintenance": v.last_maintenance, "next_maintenance": v.next_maintenance, "total_trips": v.total_trips, "total_km": v.total_km, "created_at": v.created_at}


def driver_dict(d):
    return {"driver_id": d.id, "name": d.name, "phone": d.phone, "email": d.email, "license_number": d.license_number, "license_expiry": d.license_expiry, "address": d.address, "emergency_contact": d.emergency_contact, "status": d.status, "assigned_vehicle_id": d.assigned_vehicle_id, "total_trips": d.total_trips, "total_km": d.total_km, "rating": d.rating, "created_at": d.created_at}


def trip_dict(t):
    fields = ["load_id", "origin", "origin_lat", "origin_lng", "destination", "destination_lat", "destination_lng", "cargo_type", "cargo_weight_tons", "customer_name", "customer_phone", "scheduled_date", "notes", "vehicle_id", "driver_id", "status", "started_at", "completed_at", "distance_km", "estimated_duration_hours", "actual_duration_hours", "pod_signature", "pod_photo", "pod_notes", "delivered_to", "delivery_otp", "pod_lat", "pod_lng", "created_at"]
    return {"trip_id": t.id, **{field: getattr(t, field) for field in fields}}


def customer_dict(value, db):
    locations = db.scalars(select(orm.CustomerLocation).where(orm.CustomerLocation.customer_id == value.id, orm.CustomerLocation.organization_id == value.organization_id)).all()
    return {"customer_id": value.id, "name": value.name, "contact_name": value.contact_name, "phone": value.phone, "email": value.email, "gst_number": value.gst_number, "billing_address": value.billing_address, "is_active": value.is_active, "created_at": value.created_at, "locations": [location_dict(x) for x in locations]}


def location_dict(value):
    fields = ["customer_id", "name", "address", "city", "state", "postal_code", "contact_name", "contact_phone", "lat", "lng", "created_at"]
    return {"location_id": value.id, **{field: getattr(value, field) for field in fields}}


def transporter_dict(value):
    fields = ["name", "contact_name", "phone", "email", "gst_number", "service_areas", "is_active", "created_at"]
    return {"transporter_id": value.id, **{field: getattr(value, field) for field in fields}}


def load_dict(value, db):
    customer = db.get(orm.Customer, value.customer_id)
    pickup = db.get(orm.CustomerLocation, value.pickup_location_id)
    delivery = db.get(orm.CustomerLocation, value.delivery_location_id)
    trip = db.scalar(select(orm.Trip).where(orm.Trip.load_id == value.id))
    fields = ["reference_number", "customer_id", "pickup_location_id", "delivery_location_id", "transporter_id", "cargo_type", "cargo_weight_tons", "quantity", "pickup_at", "delivery_by", "quoted_amount", "notes", "status", "created_at", "updated_at"]
    return {"load_id": value.id, **{field: getattr(value, field) for field in fields}, "customer_name": customer.name if customer else None, "pickup": location_dict(pickup) if pickup else None, "delivery": location_dict(delivery) if delivery else None, "trip_id": trip.id if trip else None}


def money(value):
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def next_commercial_number(db, model, organization_id, prefix):
    year = datetime.now(timezone.utc).year
    count = db.scalar(select(func.count()).select_from(model).where(model.organization_id == organization_id)) or 0
    return f"{prefix}-{year}-{count + 1:04d}"


def quotation_amounts(payload):
    values = [money(payload.base_amount), money(payload.fuel_surcharge), money(payload.toll_charges), money(payload.handling_charges)]
    tax_rate = money(payload.tax_rate)
    if any(value < 0 for value in values) or values[0] <= 0 or tax_rate < 0 or tax_rate > 100:
        raise HTTPException(status_code=400, detail="Amounts must be valid and tax rate must be between 0 and 100")
    subtotal = sum(values, Decimal("0.00"))
    tax_amount = money(subtotal * tax_rate / Decimal("100"))
    return values, tax_rate, subtotal, tax_amount, subtotal + tax_amount


def quotation_dict(value, db):
    load = db.get(orm.Load, value.load_id)
    customer = db.get(orm.Customer, load.customer_id) if load else None
    fields = ["quotation_number", "load_id", "base_amount", "fuel_surcharge", "toll_charges", "handling_charges", "subtotal", "tax_rate", "tax_amount", "total_amount", "valid_until", "terms", "status", "accepted_at", "created_at", "updated_at"]
    result = {"quotation_id": value.id, **{field: getattr(value, field) for field in fields}}
    result.update({"load_reference": load.reference_number if load else None, "load_status": load.status if load else None, "customer_name": customer.name if customer else None})
    return result


def payment_dict(value):
    fields = ["invoice_id", "amount", "paid_at", "payment_method", "reference", "notes", "created_at"]
    return {"payment_id": value.id, **{field: getattr(value, field) for field in fields}}


def invoice_dict(value, db):
    load = db.get(orm.Load, value.load_id)
    customer = db.get(orm.Customer, load.customer_id) if load else None
    status = value.status
    if status in {"issued", "partially_paid"} and value.due_at and aware(value.due_at) < datetime.now(timezone.utc) and money(value.balance_due) > 0:
        status = "overdue"
    fields = ["invoice_number", "load_id", "quotation_id", "subtotal", "tax_rate", "tax_amount", "total_amount", "amount_paid", "balance_due", "issued_at", "due_at", "notes", "created_at", "updated_at"]
    result = {"invoice_id": value.id, **{field: getattr(value, field) for field in fields}, "status": status}
    result.update({"load_reference": load.reference_number if load else None, "load_status": load.status if load else None, "customer_name": customer.name if customer else None})
    payments = db.scalars(select(orm.Payment).where(orm.Payment.invoice_id == value.id, orm.Payment.organization_id == value.organization_id).order_by(orm.Payment.paid_at.desc())).all()
    result["payments"] = [payment_dict(payment) for payment in payments]
    return result


EXPENSE_CATEGORIES = {"fuel", "toll", "parking", "driver_allowance", "transporter", "loading", "unloading", "repair", "fine", "other"}


def validate_expense_payload(payload):
    if payload.category not in EXPENSE_CATEGORIES: raise HTTPException(status_code=400, detail="Unsupported expense category")
    if not payload.description.strip(): raise HTTPException(status_code=400, detail="Expense description is required")
    estimated, actual = money(payload.estimated_amount), money(payload.actual_amount) if payload.actual_amount is not None else None
    if estimated < 0 or (actual is not None and actual < 0) or (estimated == 0 and (actual is None or actual == 0)):
        raise HTTPException(status_code=400, detail="Enter a positive estimated or actual amount")
    receipt_values = [payload.receipt_file_name, payload.receipt_mime_type, payload.receipt_file_data]
    if any(receipt_values) and not all(receipt_values): raise HTTPException(status_code=400, detail="Receipt name, type and file are all required")
    if payload.receipt_file_data:
        if payload.receipt_mime_type not in {"application/pdf", "image/jpeg", "image/png", "image/webp"}: raise HTTPException(status_code=400, detail="Receipt must be PDF, JPEG, PNG or WebP")
        try: size = len(base64.b64decode(payload.receipt_file_data.split(",", 1)[-1], validate=True))
        except Exception: raise HTTPException(status_code=400, detail="Invalid receipt file")
        if size > 5 * 1024 * 1024: raise HTTPException(status_code=413, detail="Receipt must be 5 MB or smaller")
    return estimated, actual


def expense_trip(db, auth, trip_id):
    trip = tenant_entity(db, orm.Trip, trip_id, auth.organization.id, "Trip")
    if auth.membership.role == Role.DRIVER.value and trip.driver_id != auth.membership.driver_id:
        raise HTTPException(status_code=403, detail="You can only access expenses for your assigned trips")
    return trip


def expense_dict(value, db):
    trip = db.get(orm.Trip, value.trip_id); load = db.get(orm.Load, trip.load_id) if trip and trip.load_id else None
    submitter = db.get(orm.User, value.submitted_by_user_id)
    fields = ["trip_id", "category", "description", "estimated_amount", "actual_amount", "expense_date", "vendor", "reference", "receipt_file_name", "receipt_mime_type", "status", "review_notes", "reviewed_at", "created_at", "updated_at"]
    return {"expense_id": value.id, **{field: getattr(value, field) for field in fields}, "trip_status": trip.status if trip else None,
        "load_id": load.id if load else None, "load_reference": load.reference_number if load else None,
        "route": f"{trip.origin} → {trip.destination}" if trip else None, "submitted_by": submitter.name if submitter else None}


def trip_profitability(db, trip):
    load = db.get(orm.Load, trip.load_id) if trip.load_id else None
    invoice = db.scalar(select(orm.Invoice).where(orm.Invoice.organization_id == trip.organization_id, orm.Invoice.load_id == trip.load_id)) if load else None
    quote = db.scalar(select(orm.Quotation).where(orm.Quotation.organization_id == trip.organization_id, orm.Quotation.load_id == trip.load_id, orm.Quotation.status == "accepted")) if load else None
    revenue = money(invoice.subtotal if invoice else (quote.subtotal if quote else (load.quoted_amount if load else 0)))
    expenses = db.scalars(select(orm.TripExpense).where(orm.TripExpense.organization_id == trip.organization_id, orm.TripExpense.trip_id == trip.id)).all()
    estimated = sum((money(item.estimated_amount) for item in expenses if item.status != "rejected"), Decimal("0.00"))
    approved_actual = sum((money(item.actual_amount) for item in expenses if item.status == "approved" and item.actual_amount is not None), Decimal("0.00"))
    pending_actual = sum((money(item.actual_amount) for item in expenses if item.status == "submitted" and item.actual_amount is not None), Decimal("0.00"))
    projected_profit, actual_profit = revenue - estimated, revenue - approved_actual
    return {"trip_id": trip.id, "trip_status": trip.status, "load_id": load.id if load else None, "load_reference": load.reference_number if load else None,
        "customer_name": load.customer_id and db.get(orm.Customer, load.customer_id).name if load else trip.customer_name,
        "revenue": revenue, "estimated_cost": estimated, "approved_actual_cost": approved_actual, "pending_actual_cost": pending_actual,
        "projected_profit": projected_profit, "actual_profit": actual_profit,
        "actual_margin_percent": round(float(actual_profit / revenue * 100), 2) if revenue > 0 else None,
        "expense_count": len(expenses), "pending_count": sum(item.status == "submitted" for item in expenses)}


def tenant_entity(db, model, entity_id, organization_id, label):
    value = db.scalar(select(model).where(model.id == entity_id, model.organization_id == organization_id))
    if not value:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return value


GEOCODING_CACHE = {}
GEOCODING_LOCK = threading.Lock()
GEOCODING_LAST_REQUEST = 0.0


def geocoding_request(path, params):
    global GEOCODING_LAST_REQUEST
    base_url = os.environ.get("GEOCODING_BASE_URL", "https://nominatim.openstreetmap.org").rstrip("/")
    cache_key = (path, tuple(sorted((key, str(value).lower()) for key, value in params.items())))
    if cache_key in GEOCODING_CACHE:
        return GEOCODING_CACHE[cache_key]
    with GEOCODING_LOCK:
        if cache_key in GEOCODING_CACHE:
            return GEOCODING_CACHE[cache_key]
        wait = 1.05 - (time.monotonic() - GEOCODING_LAST_REQUEST)
        if wait > 0:
            time.sleep(wait)
        try:
            response = requests.get(
                f"{base_url}/{path}", params=params, timeout=12,
                headers={"User-Agent": os.environ.get("GEOCODING_USER_AGENT", "BookMyLoad/1.0 (development; contact project owner)")},
            )
            GEOCODING_LAST_REQUEST = time.monotonic()
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as error:
            logger.warning("Geocoding service unavailable: %s", error)
            raise HTTPException(status_code=503, detail="Address search is temporarily unavailable")
        if len(GEOCODING_CACHE) >= 500:
            GEOCODING_CACHE.pop(next(iter(GEOCODING_CACHE)))
        GEOCODING_CACHE[cache_key] = data
        return data


def geocode_result(value):
    address = value.get("address") or {}
    return {"display_name": value.get("display_name"), "lat": float(value["lat"]), "lng": float(value["lon"]), "address": address, "city": address.get("city") or address.get("town") or address.get("village") or address.get("municipality"), "state": address.get("state"), "postal_code": address.get("postcode"), "country": address.get("country")}


@api_router.get("/geocoding/search")
def search_addresses(q: str, auth: AuthContext = Depends(require_permission("customers.read"))):
    query = q.strip()
    if len(query) < 3: raise HTTPException(status_code=400, detail="Enter at least three characters")
    values = geocoding_request("search", {"q": query, "format": "jsonv2", "addressdetails": 1, "limit": 5})
    return [geocode_result(value) for value in values]


@api_router.post("/geocoding/reverse")
def reverse_geocode(payload: ReverseGeocodeRequest, auth: AuthContext = Depends(require_permission("customers.read"))):
    if not (-90 <= payload.lat <= 90 and -180 <= payload.lng <= 180): raise HTTPException(status_code=400, detail="Invalid coordinates")
    value = geocoding_request("reverse", {"lat": round(payload.lat, 6), "lon": round(payload.lng, 6), "format": "jsonv2", "addressdetails": 1, "zoom": 18})
    return geocode_result(value)


@api_router.get("/customers")
def get_customers(auth: AuthContext = Depends(require_permission("customers.read")), db: Session = Depends(get_db)):
    values = db.scalars(select(orm.Customer).where(orm.Customer.organization_id == auth.organization.id).order_by(orm.Customer.name)).all()
    return [customer_dict(x, db) for x in values]


@api_router.post("/customers")
def create_customer(payload: CustomerPayload, auth: AuthContext = Depends(require_permission("customers.create")), db: Session = Depends(get_db)):
    value = orm.Customer(id=new_id("cus"), organization_id=auth.organization.id, **payload.model_dump())
    db.add(value); audit(db, auth, "customer.create", "customer", value.id)
    try: db.commit()
    except IntegrityError: db.rollback(); raise HTTPException(status_code=409, detail="Customer name already exists")
    db.refresh(value); return customer_dict(value, db)


@api_router.put("/customers/{customer_id}")
def update_customer(customer_id: str, payload: CustomerPayload, auth: AuthContext = Depends(require_permission("customers.update")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Customer, customer_id, auth.organization.id, "Customer")
    for key, item in payload.model_dump().items(): setattr(value, key, item)
    audit(db, auth, "customer.update", "customer", value.id); db.commit(); return customer_dict(value, db)


@api_router.post("/customers/{customer_id}/locations")
def create_customer_location(customer_id: str, payload: LocationPayload, auth: AuthContext = Depends(require_permission("customers.create")), db: Session = Depends(get_db)):
    tenant_entity(db, orm.Customer, customer_id, auth.organization.id, "Customer")
    value = orm.CustomerLocation(id=new_id("loc"), organization_id=auth.organization.id, customer_id=customer_id, **payload.model_dump())
    db.add(value); audit(db, auth, "customer.location.create", "customer_location", value.id); db.commit(); db.refresh(value); return location_dict(value)


@api_router.delete("/customers/{customer_id}")
def delete_customer(customer_id: str, auth: AuthContext = Depends(require_permission("customers.delete")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Customer, customer_id, auth.organization.id, "Customer")
    if db.scalar(select(orm.Load).where(orm.Load.customer_id == value.id)): raise HTTPException(status_code=409, detail="Customer has loads and cannot be deleted")
    audit(db, auth, "customer.delete", "customer", value.id); db.delete(value); db.commit(); return {"message": "Customer deleted"}


@api_router.get("/transporters")
def get_transporters(auth: AuthContext = Depends(require_permission("transporters.read")), db: Session = Depends(get_db)):
    values = db.scalars(select(orm.Transporter).where(orm.Transporter.organization_id == auth.organization.id).order_by(orm.Transporter.name)).all()
    return [transporter_dict(x) for x in values]


@api_router.post("/transporters")
def create_transporter(payload: TransporterPayload, auth: AuthContext = Depends(require_permission("transporters.create")), db: Session = Depends(get_db)):
    value = orm.Transporter(id=new_id("trn"), organization_id=auth.organization.id, **payload.model_dump())
    db.add(value); audit(db, auth, "transporter.create", "transporter", value.id)
    try: db.commit()
    except IntegrityError: db.rollback(); raise HTTPException(status_code=409, detail="Transporter name already exists")
    db.refresh(value); return transporter_dict(value)


@api_router.put("/transporters/{transporter_id}")
def update_transporter(transporter_id: str, payload: TransporterPayload, auth: AuthContext = Depends(require_permission("transporters.update")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Transporter, transporter_id, auth.organization.id, "Transporter")
    for key, item in payload.model_dump().items(): setattr(value, key, item)
    audit(db, auth, "transporter.update", "transporter", value.id); db.commit(); return transporter_dict(value)


@api_router.delete("/transporters/{transporter_id}")
def delete_transporter(transporter_id: str, auth: AuthContext = Depends(require_permission("transporters.delete")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Transporter, transporter_id, auth.organization.id, "Transporter")
    if db.scalar(select(orm.Load).where(orm.Load.transporter_id == value.id, ~orm.Load.status.in_(["closed", "cancelled", "rejected"]))): raise HTTPException(status_code=409, detail="Transporter has active loads")
    audit(db, auth, "transporter.delete", "transporter", value.id); db.delete(value); db.commit(); return {"message": "Transporter deleted"}


@api_router.get("/loads")
def get_loads(status: Optional[LoadStatus] = None, auth: AuthContext = Depends(require_permission("loads.read")), db: Session = Depends(get_db)):
    query = select(orm.Load).where(orm.Load.organization_id == auth.organization.id)
    if status: query = query.where(orm.Load.status == status.value)
    return [load_dict(x, db) for x in db.scalars(query.order_by(orm.Load.created_at.desc())).all()]


@api_router.get("/loads/{load_id}")
def get_load(load_id: str, auth: AuthContext = Depends(require_permission("loads.read")), db: Session = Depends(get_db)):
    return load_dict(tenant_entity(db, orm.Load, load_id, auth.organization.id, "Load"), db)


def validate_load_references(db, payload, organization_id):
    customer = tenant_entity(db, orm.Customer, payload.customer_id, organization_id, "Customer")
    pickup = tenant_entity(db, orm.CustomerLocation, payload.pickup_location_id, organization_id, "Pickup location")
    delivery = tenant_entity(db, orm.CustomerLocation, payload.delivery_location_id, organization_id, "Delivery location")
    if pickup.customer_id != customer.id or delivery.customer_id != customer.id: raise HTTPException(status_code=400, detail="Both locations must belong to the selected customer")
    if payload.transporter_id: tenant_entity(db, orm.Transporter, payload.transporter_id, organization_id, "Transporter")
    if payload.cargo_weight_tons <= 0 or payload.quantity <= 0: raise HTTPException(status_code=400, detail="Weight and quantity must be positive")
    if payload.delivery_by and payload.delivery_by <= payload.pickup_at: raise HTTPException(status_code=400, detail="Delivery deadline must be after pickup")


CRITICAL_VEHICLE_DOCUMENTS = {"registration", "insurance", "fitness", "pollution", "permit"}
DRIVER_DOCUMENTS = {"license"}


def assert_assignment_compliance(db, organization_id, driver, vehicle):
    now = datetime.now(timezone.utc)
    if aware(driver.license_expiry) <= now:
        raise HTTPException(status_code=409, detail="Driver license is expired")
    documents = db.scalars(select(orm.ComplianceDocument).where(orm.ComplianceDocument.organization_id == organization_id, ((orm.ComplianceDocument.entity_type == "driver") & (orm.ComplianceDocument.entity_id == driver.id)) | ((orm.ComplianceDocument.entity_type == "vehicle") & (orm.ComplianceDocument.entity_id == vehicle.id)))).all()
    invalid = [doc for doc in documents if doc.verification_status == "rejected" or (doc.expires_at and aware(doc.expires_at) <= now)]
    critical = [doc for doc in invalid if (doc.entity_type == "driver" and doc.document_type in DRIVER_DOCUMENTS) or (doc.entity_type == "vehicle" and doc.document_type in CRITICAL_VEHICLE_DOCUMENTS)]
    if critical:
        names = ", ".join(sorted({doc.document_type.replace("_", " ") for doc in critical}))
        raise HTTPException(status_code=409, detail=f"Compliance blocked: expired or rejected {names}")


@api_router.post("/loads")
def create_load(payload: LoadPayload, auth: AuthContext = Depends(require_permission("loads.create")), db: Session = Depends(get_db)):
    validate_load_references(db, payload, auth.organization.id)
    duplicate = db.scalar(select(orm.Load).where(orm.Load.organization_id == auth.organization.id, orm.Load.reference_number == payload.reference_number.strip()))
    if duplicate: raise HTTPException(status_code=409, detail="Load reference already exists")
    value = orm.Load(id=new_id("load"), organization_id=auth.organization.id, created_by_user_id=auth.user.id, **payload.model_dump())
    db.add(value); audit(db, auth, "load.create", "load", value.id); db.commit(); db.refresh(value); return load_dict(value, db)


@api_router.put("/loads/{load_id}")
def update_load(load_id: str, payload: LoadPayload, auth: AuthContext = Depends(require_permission("loads.update")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Load, load_id, auth.organization.id, "Load")
    if value.status not in {"draft", "rejected"}: raise HTTPException(status_code=409, detail="Only draft or rejected loads can be edited")
    validate_load_references(db, payload, auth.organization.id)
    for key, item in payload.model_dump().items(): setattr(value, key, item)
    audit(db, auth, "load.update", "load", value.id); db.commit(); return load_dict(value, db)


LOAD_TRANSITIONS = {"draft": {"submitted", "cancelled"}, "submitted": {"approved", "rejected", "cancelled"}, "approved": {"scheduled", "cancelled"}, "scheduled": {"cancelled"}, "allocated": {"cancelled"}, "in_execution": set(), "delivered": {"closed"}, "closed": set(), "rejected": {"draft", "cancelled"}, "cancelled": set()}


@api_router.patch("/loads/{load_id}/status")
def update_load_status(load_id: str, status: LoadStatus, auth: AuthContext = Depends(require_permission("loads.update")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Load, load_id, auth.organization.id, "Load")
    if status.value not in LOAD_TRANSITIONS.get(value.status, set()): raise HTTPException(status_code=409, detail=f"Cannot move load from {value.status} to {status.value}")
    trip = db.scalar(select(orm.Trip).where(orm.Trip.load_id == value.id))
    if status == LoadStatus.CANCELLED and trip and trip.status not in {"pending", "assigned", "cancelled"}: raise HTTPException(status_code=409, detail="An active or completed trip prevents cancellation")
    if status == LoadStatus.CANCELLED and trip and trip.status != "cancelled": trip.status = "cancelled"
    old = value.status; value.status = status.value; audit(db, auth, "load.status", "load", value.id, {"from": old, "to": status.value}); db.commit(); return load_dict(value, db)


@api_router.post("/loads/{load_id}/allocate")
def allocate_load(load_id: str, payload: LoadAllocation, auth: AuthContext = Depends(require_permission("loads.allocate")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Load, load_id, auth.organization.id, "Load")
    if value.status != "scheduled": raise HTTPException(status_code=409, detail="Only scheduled loads can be allocated")
    customer = tenant_entity(db, orm.Customer, value.customer_id, auth.organization.id, "Customer")
    pickup = tenant_entity(db, orm.CustomerLocation, value.pickup_location_id, auth.organization.id, "Pickup location")
    delivery = tenant_entity(db, orm.CustomerLocation, value.delivery_location_id, auth.organization.id, "Delivery location")
    driver = tenant_entity(db, orm.Driver, payload.driver_id, auth.organization.id, "Driver")
    vehicle = tenant_entity(db, orm.Vehicle, payload.vehicle_id, auth.organization.id, "Vehicle")
    if driver.status != "available" or vehicle.status != "available": raise HTTPException(status_code=409, detail="Driver and vehicle must be available")
    assert_assignment_compliance(db, auth.organization.id, driver, vehicle)
    if vehicle.capacity_tons < value.cargo_weight_tons: raise HTTPException(status_code=409, detail="Vehicle capacity is below load weight")
    conflict = db.scalar(select(orm.Trip).where(orm.Trip.organization_id == auth.organization.id, orm.Trip.status.in_(["assigned", "in_progress"]), (orm.Trip.driver_id == driver.id) | (orm.Trip.vehicle_id == vehicle.id)))
    if conflict: raise HTTPException(status_code=409, detail="Driver or vehicle already has an active trip")
    trip = orm.Trip(id=new_id("trip"), organization_id=auth.organization.id, load_id=value.id, origin=f"{pickup.name}, {pickup.address}, {pickup.city}", origin_lat=pickup.lat, origin_lng=pickup.lng, destination=f"{delivery.name}, {delivery.address}, {delivery.city}", destination_lat=delivery.lat, destination_lng=delivery.lng, cargo_type=value.cargo_type, cargo_weight_tons=value.cargo_weight_tons, customer_name=customer.name, customer_phone=customer.phone, scheduled_date=value.pickup_at, notes=value.notes, vehicle_id=vehicle.id, driver_id=driver.id, status="assigned")
    db.add(trip); value.status = "allocated"; audit(db, auth, "load.allocate", "load", value.id, {"trip_id": trip.id, "driver_id": driver.id, "vehicle_id": vehicle.id})
    linked_user = driver_user_id(db, auth.organization.id, driver.id)
    if linked_user: notify(db, auth.organization.id, [linked_user], "trip_assigned", "New trip assigned", f"{trip.origin} to {trip.destination}", "trip", trip.id)
    db.commit(); return {"load": load_dict(value, db), "trip": trip_dict(trip)}


@api_router.delete("/loads/{load_id}")
def delete_load(load_id: str, auth: AuthContext = Depends(require_permission("loads.delete")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Load, load_id, auth.organization.id, "Load")
    if value.status not in {"draft", "rejected", "cancelled"}: raise HTTPException(status_code=409, detail="Only draft, rejected or cancelled loads can be deleted")
    audit(db, auth, "load.delete", "load", value.id); db.delete(value); db.commit(); return {"message": "Load deleted"}


@api_router.get("/commercial/quotations")
def list_quotations(auth: AuthContext = Depends(require_permission("commercial.read")), db: Session = Depends(get_db)):
    values = db.scalars(select(orm.Quotation).where(orm.Quotation.organization_id == auth.organization.id).order_by(orm.Quotation.created_at.desc())).all()
    return [quotation_dict(value, db) for value in values]


@api_router.post("/commercial/quotations")
def create_quotation(payload: QuotationPayload, auth: AuthContext = Depends(require_permission("commercial.create")), db: Session = Depends(get_db)):
    load = tenant_entity(db, orm.Load, payload.load_id, auth.organization.id, "Load")
    if load.status in {"delivered", "closed", "cancelled"}:
        raise HTTPException(status_code=409, detail="This load can no longer be quoted")
    if db.scalar(select(orm.Quotation).where(orm.Quotation.organization_id == auth.organization.id, orm.Quotation.load_id == load.id)):
        raise HTTPException(status_code=409, detail="A quotation already exists for this load")
    values, tax_rate, subtotal, tax_amount, total = quotation_amounts(payload)
    value = orm.Quotation(id=new_id("quote"), organization_id=auth.organization.id, load_id=load.id,
        quotation_number=next_commercial_number(db, orm.Quotation, auth.organization.id, "QT"), base_amount=values[0],
        fuel_surcharge=values[1], toll_charges=values[2], handling_charges=values[3], subtotal=subtotal,
        tax_rate=tax_rate, tax_amount=tax_amount, total_amount=total, valid_until=payload.valid_until,
        terms=payload.terms, created_by_user_id=auth.user.id)
    db.add(value); audit(db, auth, "quotation.create", "quotation", value.id, {"load_id": load.id, "total": float(total)})
    db.commit(); db.refresh(value); return quotation_dict(value, db)


@api_router.put("/commercial/quotations/{quotation_id}")
def update_quotation(quotation_id: str, payload: QuotationPayload, auth: AuthContext = Depends(require_permission("commercial.update")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Quotation, quotation_id, auth.organization.id, "Quotation")
    if value.status not in {"draft", "rejected"}: raise HTTPException(status_code=409, detail="Only draft or rejected quotations can be edited")
    if payload.load_id != value.load_id: raise HTTPException(status_code=400, detail="The quotation load cannot be changed")
    values, tax_rate, subtotal, tax_amount, total = quotation_amounts(payload)
    for field, item in zip(["base_amount", "fuel_surcharge", "toll_charges", "handling_charges"], values): setattr(value, field, item)
    value.tax_rate, value.subtotal, value.tax_amount, value.total_amount = tax_rate, subtotal, tax_amount, total
    value.valid_until, value.terms, value.status = payload.valid_until, payload.terms, "draft"
    audit(db, auth, "quotation.update", "quotation", value.id, {"total": float(total)}); db.commit(); return quotation_dict(value, db)


@api_router.patch("/commercial/quotations/{quotation_id}/status")
def update_quotation_status(quotation_id: str, status: str, auth: AuthContext = Depends(require_permission("commercial.update")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Quotation, quotation_id, auth.organization.id, "Quotation")
    transitions = {"draft": {"sent", "cancelled"}, "sent": {"accepted", "rejected", "cancelled"}, "rejected": {"draft", "cancelled"}, "accepted": set(), "cancelled": set()}
    if status not in transitions.get(value.status, set()): raise HTTPException(status_code=409, detail=f"Cannot move quotation from {value.status} to {status}")
    old = value.status; value.status = status
    load = tenant_entity(db, orm.Load, value.load_id, auth.organization.id, "Load")
    if status == "accepted":
        value.accepted_at = datetime.now(timezone.utc); load.quoted_amount = float(value.total_amount)
        notify(db, auth.organization.id, operational_user_ids(db, auth.organization.id), "quotation_accepted", "Quotation accepted", f"{value.quotation_number} for {load.reference_number} was accepted", "quotation", value.id, "success")
    audit(db, auth, "quotation.status", "quotation", value.id, {"from": old, "to": status}); db.commit(); return quotation_dict(value, db)


@api_router.get("/commercial/invoices")
def list_invoices(auth: AuthContext = Depends(require_permission("commercial.read")), db: Session = Depends(get_db)):
    values = db.scalars(select(orm.Invoice).where(orm.Invoice.organization_id == auth.organization.id).order_by(orm.Invoice.created_at.desc())).all()
    return [invoice_dict(value, db) for value in values]


@api_router.post("/commercial/invoices")
def create_invoice(payload: InvoicePayload, auth: AuthContext = Depends(require_permission("commercial.create")), db: Session = Depends(get_db)):
    load = tenant_entity(db, orm.Load, payload.load_id, auth.organization.id, "Load")
    if load.status not in {"delivered", "closed"}: raise HTTPException(status_code=409, detail="Invoices can only be created after delivery")
    if db.scalar(select(orm.Invoice).where(orm.Invoice.organization_id == auth.organization.id, orm.Invoice.load_id == load.id)):
        raise HTTPException(status_code=409, detail="An invoice already exists for this load")
    quote = db.scalar(select(orm.Quotation).where(orm.Quotation.organization_id == auth.organization.id, orm.Quotation.load_id == load.id, orm.Quotation.status == "accepted"))
    subtotal = money(payload.subtotal if payload.subtotal is not None else (quote.subtotal if quote else load.quoted_amount))
    tax_rate = money(payload.tax_rate if payload.tax_rate is not None else (quote.tax_rate if quote else 0))
    if subtotal <= 0 or tax_rate < 0 or tax_rate > 100: raise HTTPException(status_code=400, detail="A positive subtotal and valid tax rate are required")
    tax_amount = money(subtotal * tax_rate / Decimal("100")); total = subtotal + tax_amount
    value = orm.Invoice(id=new_id("invoice"), organization_id=auth.organization.id, load_id=load.id,
        quotation_id=quote.id if quote else None, invoice_number=next_commercial_number(db, orm.Invoice, auth.organization.id, "INV"),
        subtotal=subtotal, tax_rate=tax_rate, tax_amount=tax_amount, total_amount=total, amount_paid=0,
        balance_due=total, due_at=payload.due_at, notes=payload.notes, created_by_user_id=auth.user.id)
    db.add(value); audit(db, auth, "invoice.create", "invoice", value.id, {"load_id": load.id, "total": float(total)})
    db.commit(); db.refresh(value); return invoice_dict(value, db)


@api_router.patch("/commercial/invoices/{invoice_id}/issue")
def issue_invoice(invoice_id: str, auth: AuthContext = Depends(require_permission("commercial.update")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Invoice, invoice_id, auth.organization.id, "Invoice")
    if value.status != "draft": raise HTTPException(status_code=409, detail="Only draft invoices can be issued")
    value.status = "issued"; value.issued_at = datetime.now(timezone.utc)
    load = db.get(orm.Load, value.load_id)
    notify(db, auth.organization.id, operational_user_ids(db, auth.organization.id), "invoice_issued", "Invoice issued", f"{value.invoice_number} for {load.reference_number} is ready", "invoice", value.id)
    customer = db.get(orm.Customer, load.customer_id)
    if customer and customer.email:
        enqueue_email(db, auth.organization.id, customer.email, f"Invoice {value.invoice_number} issued", f"Hello {customer.contact_name},\nInvoice {value.invoice_number} for load {load.reference_number} totals ₹{money(value.total_amount)} and is due {aware(value.due_at).date() if value.due_at else 'on receipt'}.", "invoice_issued", "invoice", value.id, customer.contact_name, f"customer-invoice:{value.id}")
    audit(db, auth, "invoice.issue", "invoice", value.id); db.commit(); return invoice_dict(value, db)


@api_router.post("/commercial/invoices/{invoice_id}/payments")
def record_payment(invoice_id: str, payload: PaymentPayload, auth: AuthContext = Depends(require_permission("commercial.update")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.Invoice, invoice_id, auth.organization.id, "Invoice")
    if value.status not in {"issued", "partially_paid"}: raise HTTPException(status_code=409, detail="Payment can only be recorded against an issued invoice")
    amount = money(payload.amount)
    if amount <= 0: raise HTTPException(status_code=400, detail="Payment amount must be positive")
    if amount > money(value.balance_due): raise HTTPException(status_code=409, detail="Payment exceeds the outstanding balance")
    if payload.payment_method not in {"cash", "bank_transfer", "upi", "cheque", "other"}: raise HTTPException(status_code=400, detail="Unsupported payment method")
    payment = orm.Payment(id=new_id("payment"), organization_id=auth.organization.id, invoice_id=value.id, amount=amount,
        paid_at=payload.paid_at or datetime.now(timezone.utc), payment_method=payload.payment_method,
        reference=payload.reference, notes=payload.notes, recorded_by_user_id=auth.user.id)
    db.add(payment); value.amount_paid = money(value.amount_paid) + amount; value.balance_due = money(value.total_amount) - money(value.amount_paid)
    value.status = "paid" if money(value.balance_due) == 0 else "partially_paid"
    audit(db, auth, "payment.record", "payment", payment.id, {"invoice_id": value.id, "amount": float(amount)})
    if value.status == "paid": notify(db, auth.organization.id, operational_user_ids(db, auth.organization.id), "invoice_paid", "Invoice paid", f"{value.invoice_number} has been paid in full", "invoice", value.id, "success")
    db.commit(); return invoice_dict(value, db)


@api_router.get("/expenses")
def list_expenses(trip_id: Optional[str] = None, status: Optional[str] = None, auth: AuthContext = Depends(require_permission("expenses.read")), db: Session = Depends(get_db)):
    query = select(orm.TripExpense).where(orm.TripExpense.organization_id == auth.organization.id)
    if trip_id:
        expense_trip(db, auth, trip_id); query = query.where(orm.TripExpense.trip_id == trip_id)
    if status: query = query.where(orm.TripExpense.status == status)
    if auth.membership.role == Role.DRIVER.value:
        query = query.join(orm.Trip, orm.Trip.id == orm.TripExpense.trip_id).where(orm.Trip.driver_id == auth.membership.driver_id)
    return [expense_dict(value, db) for value in db.scalars(query.order_by(orm.TripExpense.created_at.desc())).all()]


@api_router.post("/expenses")
def create_expense(payload: TripExpensePayload, auth: AuthContext = Depends(require_permission("expenses.create")), db: Session = Depends(get_db)):
    trip = expense_trip(db, auth, payload.trip_id); estimated, actual = validate_expense_payload(payload)
    if trip.status == "cancelled": raise HTTPException(status_code=409, detail="Expenses cannot be added to a cancelled trip")
    is_driver = auth.membership.role == Role.DRIVER.value
    if is_driver and actual is None: raise HTTPException(status_code=400, detail="Drivers must enter the actual expense amount")
    value = orm.TripExpense(id=new_id("expense"), organization_id=auth.organization.id, trip_id=trip.id,
        category=payload.category, description=payload.description.strip(), estimated_amount=estimated, actual_amount=actual,
        expense_date=payload.expense_date, vendor=payload.vendor, reference=payload.reference,
        receipt_file_name=payload.receipt_file_name, receipt_mime_type=payload.receipt_mime_type, receipt_file_data=payload.receipt_file_data,
        status="submitted" if is_driver else "draft", submitted_by_user_id=auth.user.id)
    db.add(value); audit(db, auth, "expense.create", "trip_expense", value.id, {"trip_id": trip.id, "actual": float(actual) if actual is not None else None})
    if is_driver: notify(db, auth.organization.id, operational_user_ids(db, auth.organization.id), "expense_submitted", "Trip expense awaiting approval", f"{value.description}: ₹{actual}", "trip_expense", value.id)
    db.commit(); db.refresh(value); return expense_dict(value, db)


@api_router.put("/expenses/{expense_id}")
def update_expense(expense_id: str, payload: TripExpensePayload, auth: AuthContext = Depends(require_permission("expenses.update")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.TripExpense, expense_id, auth.organization.id, "Expense"); expense_trip(db, auth, value.trip_id)
    if value.status not in {"draft", "rejected"}: raise HTTPException(status_code=409, detail="Only draft or rejected expenses can be edited")
    if payload.trip_id != value.trip_id: raise HTTPException(status_code=400, detail="The expense trip cannot be changed")
    if auth.membership.role == Role.DRIVER.value and value.submitted_by_user_id != auth.user.id: raise HTTPException(status_code=403, detail="You can only edit your expenses")
    estimated, actual = validate_expense_payload(payload)
    for field in ["category", "description", "expense_date", "vendor", "reference", "receipt_file_name", "receipt_mime_type", "receipt_file_data"]: setattr(value, field, getattr(payload, field))
    value.estimated_amount, value.actual_amount, value.status, value.review_notes = estimated, actual, "draft", None
    audit(db, auth, "expense.update", "trip_expense", value.id); db.commit(); return expense_dict(value, db)


@api_router.patch("/expenses/{expense_id}/submit")
def submit_expense(expense_id: str, auth: AuthContext = Depends(require_permission("expenses.update")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.TripExpense, expense_id, auth.organization.id, "Expense"); expense_trip(db, auth, value.trip_id)
    if value.status not in {"draft", "rejected"}: raise HTTPException(status_code=409, detail="Only draft or rejected expenses can be submitted")
    if value.actual_amount is None or money(value.actual_amount) <= 0: raise HTTPException(status_code=409, detail="Enter the actual amount before submission")
    if auth.membership.role == Role.DRIVER.value and value.submitted_by_user_id != auth.user.id: raise HTTPException(status_code=403, detail="You can only submit your expenses")
    value.status = "submitted"; value.review_notes = None
    notify(db, auth.organization.id, operational_user_ids(db, auth.organization.id), "expense_submitted", "Trip expense awaiting approval", f"{value.description}: ₹{value.actual_amount}", "trip_expense", value.id)
    audit(db, auth, "expense.submit", "trip_expense", value.id); db.commit(); return expense_dict(value, db)


@api_router.patch("/expenses/{expense_id}/review")
def review_expense(expense_id: str, payload: ExpenseReviewPayload, auth: AuthContext = Depends(require_permission("expenses.approve")), db: Session = Depends(get_db)):
    if payload.status not in {"approved", "rejected"}: raise HTTPException(status_code=400, detail="Review status must be approved or rejected")
    value = tenant_entity(db, orm.TripExpense, expense_id, auth.organization.id, "Expense")
    if value.status != "submitted": raise HTTPException(status_code=409, detail="Only submitted expenses can be reviewed")
    value.status, value.review_notes, value.reviewed_by_user_id, value.reviewed_at = payload.status, payload.notes, auth.user.id, datetime.now(timezone.utc)
    notify(db, auth.organization.id, [value.submitted_by_user_id], "expense_reviewed", f"Expense {payload.status}", value.description, "trip_expense", value.id, "success" if payload.status == "approved" else "warning")
    audit(db, auth, "expense.review", "trip_expense", value.id, {"status": payload.status}); db.commit(); return expense_dict(value, db)


@api_router.get("/expenses/{expense_id}/receipt")
def get_expense_receipt(expense_id: str, auth: AuthContext = Depends(require_permission("expenses.read")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.TripExpense, expense_id, auth.organization.id, "Expense"); expense_trip(db, auth, value.trip_id)
    if not value.receipt_file_data: raise HTTPException(status_code=404, detail="No receipt attached")
    return {"file_name": value.receipt_file_name, "mime_type": value.receipt_mime_type, "file_data": value.receipt_file_data}


@api_router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: str, auth: AuthContext = Depends(require_permission("expenses.update")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.TripExpense, expense_id, auth.organization.id, "Expense"); expense_trip(db, auth, value.trip_id)
    if value.status not in {"draft", "rejected"}: raise HTTPException(status_code=409, detail="Only draft or rejected expenses can be deleted")
    if auth.membership.role == Role.DRIVER.value and value.submitted_by_user_id != auth.user.id: raise HTTPException(status_code=403, detail="You can only delete your expenses")
    audit(db, auth, "expense.delete", "trip_expense", value.id); db.delete(value); db.commit(); return {"message": "Expense deleted"}


@api_router.get("/profitability/trips")
def profitability(auth: AuthContext = Depends(require_permission("expenses.read")), db: Session = Depends(get_db)):
    query = select(orm.Trip).where(orm.Trip.organization_id == auth.organization.id)
    if auth.membership.role == Role.DRIVER.value: query = query.where(orm.Trip.driver_id == auth.membership.driver_id)
    rows = [trip_profitability(db, trip) for trip in db.scalars(query.order_by(orm.Trip.created_at.desc())).all()]
    return {"revenue": sum((money(row["revenue"]) for row in rows), Decimal("0.00")),
        "estimated_cost": sum((money(row["estimated_cost"]) for row in rows), Decimal("0.00")),
        "approved_actual_cost": sum((money(row["approved_actual_cost"]) for row in rows), Decimal("0.00")),
        "actual_profit": sum((money(row["actual_profit"]) for row in rows), Decimal("0.00")),
        "pending_approvals": sum(row["pending_count"] for row in rows), "trips": rows}


@api_router.get("/vehicles", response_model=List[Vehicle])
def get_vehicles(auth: AuthContext = Depends(require_permission("vehicles.read")), db: Session = Depends(get_db)):
    return [vehicle_dict(v) for v in db.scalars(select(orm.Vehicle).where(orm.Vehicle.organization_id == auth.organization.id).order_by(orm.Vehicle.created_at.desc())).all()]


@api_router.get("/vehicles/{vehicle_id}", response_model=Vehicle)
def get_vehicle(vehicle_id: str, auth: AuthContext = Depends(require_permission("vehicles.read")), db: Session = Depends(get_db)):
    value = db.scalar(select(orm.Vehicle).where(orm.Vehicle.id == vehicle_id, orm.Vehicle.organization_id == auth.organization.id))
    if not value: raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle_dict(value)


@api_router.post("/vehicles", response_model=Vehicle)
def create_vehicle(payload: VehicleCreate, auth: AuthContext = Depends(require_permission("vehicles.create")), db: Session = Depends(get_db)):
    data = payload.model_dump(); data["registration_number"] = data["registration_number"].strip().upper()
    value = orm.Vehicle(id=new_id("veh"), organization_id=auth.organization.id, **data)
    db.add(value); audit(db, auth, "vehicle.create", "vehicle", value.id)
    try: db.commit()
    except IntegrityError: db.rollback(); raise HTTPException(status_code=409, detail="Registration number already exists")
    db.refresh(value); return vehicle_dict(value)


@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
def update_vehicle(vehicle_id: str, payload: VehicleCreate, auth: AuthContext = Depends(require_permission("vehicles.update")), db: Session = Depends(get_db)):
    value = db.scalar(select(orm.Vehicle).where(orm.Vehicle.id == vehicle_id, orm.Vehicle.organization_id == auth.organization.id))
    if not value: raise HTTPException(status_code=404, detail="Vehicle not found")
    for key, item in payload.model_dump().items(): setattr(value, key, item.strip().upper() if key == "registration_number" else item)
    audit(db, auth, "vehicle.update", "vehicle", value.id)
    try: db.commit()
    except IntegrityError: db.rollback(); raise HTTPException(status_code=409, detail="Registration number already exists")
    db.refresh(value); return vehicle_dict(value)


@api_router.delete("/vehicles/{vehicle_id}")
def delete_vehicle(vehicle_id: str, auth: AuthContext = Depends(require_permission("vehicles.delete")), db: Session = Depends(get_db)):
    value = db.scalar(select(orm.Vehicle).where(orm.Vehicle.id == vehicle_id, orm.Vehicle.organization_id == auth.organization.id))
    if not value: raise HTTPException(status_code=404, detail="Vehicle not found")
    if db.scalar(select(orm.Trip).where(orm.Trip.organization_id == auth.organization.id, orm.Trip.vehicle_id == value.id, orm.Trip.status.in_(["assigned", "in_progress"]))):
        raise HTTPException(status_code=409, detail="Vehicle is assigned to an active trip")
    audit(db, auth, "vehicle.delete", "vehicle", value.id); db.delete(value); db.commit()
    return {"message": "Vehicle deleted"}


@api_router.patch("/vehicles/{vehicle_id}/status")
def update_vehicle_status(vehicle_id: str, status: VehicleStatus, auth: AuthContext = Depends(require_permission("vehicles.update")), db: Session = Depends(get_db)):
    value = db.scalar(select(orm.Vehicle).where(orm.Vehicle.id == vehicle_id, orm.Vehicle.organization_id == auth.organization.id))
    if not value: raise HTTPException(status_code=404, detail="Vehicle not found")
    value.status = status.value; audit(db, auth, "vehicle.status", "vehicle", value.id, {"status": status.value}); db.commit()
    return {"message": "Status updated"}


@api_router.get("/drivers", response_model=List[Driver])
def get_drivers(auth: AuthContext = Depends(require_permission("drivers.read")), db: Session = Depends(get_db)):
    return [driver_dict(d) for d in db.scalars(select(orm.Driver).where(orm.Driver.organization_id == auth.organization.id).order_by(orm.Driver.created_at.desc())).all()]


@api_router.get("/drivers/{driver_id}", response_model=Driver)
def get_driver(driver_id: str, auth: AuthContext = Depends(require_permission("drivers.read")), db: Session = Depends(get_db)):
    value = db.scalar(select(orm.Driver).where(orm.Driver.id == driver_id, orm.Driver.organization_id == auth.organization.id))
    if not value: raise HTTPException(status_code=404, detail="Driver not found")
    return driver_dict(value)


@api_router.post("/drivers", response_model=Driver)
def create_driver(payload: DriverCreate, auth: AuthContext = Depends(require_permission("drivers.create")), db: Session = Depends(get_db)):
    data = payload.model_dump(); data["license_number"] = data["license_number"].strip().upper()
    value = orm.Driver(id=new_id("drv"), organization_id=auth.organization.id, **data)
    db.add(value); audit(db, auth, "driver.create", "driver", value.id)
    try: db.commit()
    except IntegrityError: db.rollback(); raise HTTPException(status_code=409, detail="License number already exists")
    db.refresh(value); return driver_dict(value)


@api_router.post("/drivers/{driver_id}/invite")
def invite_driver(driver_id: str, payload: DriverInvite, auth: AuthContext = Depends(require_permission("drivers.update")), db: Session = Depends(get_db)):
    driver = tenant_entity(db, orm.Driver, driver_id, auth.organization.id, "Driver")
    email = payload.email.strip().lower()
    if "@" not in email: raise HTTPException(status_code=400, detail="A valid email is required")
    if db.scalar(select(orm.Membership).where(orm.Membership.organization_id == auth.organization.id, orm.Membership.driver_id == driver.id, orm.Membership.status == "active")):
        raise HTTPException(status_code=409, detail="This driver already has login access")
    user = db.scalar(select(orm.User).where(func.lower(orm.User.email) == email))
    if user and db.scalar(select(orm.Membership).where(orm.Membership.user_id == user.id, orm.Membership.organization_id == auth.organization.id, orm.Membership.status == "active")):
        raise HTTPException(status_code=409, detail="This email already belongs to an organization member")
    invitation = db.scalar(select(orm.Invitation).where(orm.Invitation.organization_id == auth.organization.id, func.lower(orm.Invitation.email) == email, orm.Invitation.status == "pending"))
    if invitation:
        invitation.role = Role.DRIVER.value; invitation.driver_id = driver.id; invitation.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    else:
        invitation = orm.Invitation(id=new_id("invite"), organization_id=auth.organization.id, email=email, role=Role.DRIVER.value, driver_id=driver.id, status="pending", invited_by_user_id=auth.user.id, expires_at=datetime.now(timezone.utc) + timedelta(days=7))
        db.add(invitation)
    audit(db, auth, "driver.invite", "driver", driver.id, {"email": email}); db.commit()
    return {"invitation_id": invitation.id, "driver_id": driver.id, "email": email, "expires_at": invitation.expires_at}


@api_router.put("/drivers/{driver_id}", response_model=Driver)
def update_driver(driver_id: str, payload: DriverCreate, auth: AuthContext = Depends(require_permission("drivers.update")), db: Session = Depends(get_db)):
    value = db.scalar(select(orm.Driver).where(orm.Driver.id == driver_id, orm.Driver.organization_id == auth.organization.id))
    if not value: raise HTTPException(status_code=404, detail="Driver not found")
    for key, item in payload.model_dump().items(): setattr(value, key, item.strip().upper() if key == "license_number" else item)
    audit(db, auth, "driver.update", "driver", value.id)
    try: db.commit()
    except IntegrityError: db.rollback(); raise HTTPException(status_code=409, detail="License number already exists")
    db.refresh(value); return driver_dict(value)


@api_router.delete("/drivers/{driver_id}")
def delete_driver(driver_id: str, auth: AuthContext = Depends(require_permission("drivers.delete")), db: Session = Depends(get_db)):
    value = db.scalar(select(orm.Driver).where(orm.Driver.id == driver_id, orm.Driver.organization_id == auth.organization.id))
    if not value: raise HTTPException(status_code=404, detail="Driver not found")
    if db.scalar(select(orm.Trip).where(orm.Trip.organization_id == auth.organization.id, orm.Trip.driver_id == value.id, orm.Trip.status.in_(["assigned", "in_progress"]))):
        raise HTTPException(status_code=409, detail="Driver is assigned to an active trip")
    audit(db, auth, "driver.delete", "driver", value.id); db.delete(value); db.commit()
    return {"message": "Driver deleted"}


@api_router.patch("/drivers/{driver_id}/status")
def update_driver_status(driver_id: str, status: DriverStatus, auth: AuthContext = Depends(require_permission("drivers.update")), db: Session = Depends(get_db)):
    value = db.scalar(select(orm.Driver).where(orm.Driver.id == driver_id, orm.Driver.organization_id == auth.organization.id))
    if not value: raise HTTPException(status_code=404, detail="Driver not found")
    value.status = status.value; audit(db, auth, "driver.status", "driver", value.id, {"status": status.value}); db.commit()
    return {"message": "Status updated"}


@api_router.get("/trips", response_model=List[Trip])
def get_trips(status: Optional[TripStatus] = None, auth: AuthContext = Depends(require_permission("trips.read")), db: Session = Depends(get_db)):
    query = select(orm.Trip).where(orm.Trip.organization_id == auth.organization.id)
    if status: query = query.where(orm.Trip.status == status.value)
    return [trip_dict(t) for t in db.scalars(query.order_by(orm.Trip.created_at.desc())).all()]


@api_router.get("/trips/{trip_id}", response_model=Trip)
def get_trip(trip_id: str, auth: AuthContext = Depends(require_permission("trips.read")), db: Session = Depends(get_db)):
    value = db.scalar(select(orm.Trip).where(orm.Trip.id == trip_id, orm.Trip.organization_id == auth.organization.id))
    if not value: raise HTTPException(status_code=404, detail="Trip not found")
    return trip_dict(value)


@api_router.post("/trips", response_model=Trip)
def create_trip(payload: TripCreate, auth: AuthContext = Depends(require_permission("trips.create")), db: Session = Depends(get_db)):
    value = orm.Trip(id=new_id("trip"), organization_id=auth.organization.id, **payload.model_dump())
    db.add(value); audit(db, auth, "trip.create", "trip", value.id); db.commit(); db.refresh(value)
    return trip_dict(value)


@api_router.put("/trips/{trip_id}", response_model=Trip)
def update_trip(trip_id: str, payload: TripCreate, auth: AuthContext = Depends(require_permission("trips.update")), db: Session = Depends(get_db)):
    value = db.scalar(select(orm.Trip).where(orm.Trip.id == trip_id, orm.Trip.organization_id == auth.organization.id))
    if not value: raise HTTPException(status_code=404, detail="Trip not found")
    if value.status in {"in_progress", "completed"}: raise HTTPException(status_code=409, detail="Active or completed trips cannot be edited")
    for key, item in payload.model_dump().items(): setattr(value, key, item)
    audit(db, auth, "trip.update", "trip", value.id); db.commit(); db.refresh(value)
    return trip_dict(value)


@api_router.delete("/trips/{trip_id}")
def delete_trip(trip_id: str, auth: AuthContext = Depends(require_permission("trips.delete")), db: Session = Depends(get_db)):
    value = db.scalar(select(orm.Trip).where(orm.Trip.id == trip_id, orm.Trip.organization_id == auth.organization.id))
    if not value: raise HTTPException(status_code=404, detail="Trip not found")
    if value.status not in {"pending", "cancelled"}: raise HTTPException(status_code=409, detail="Only pending or cancelled trips can be deleted")
    audit(db, auth, "trip.delete", "trip", value.id); db.delete(value); db.commit()
    return {"message": "Trip deleted"}


VALID_TRANSITIONS = {"pending": {"assigned", "cancelled"}, "assigned": {"in_progress", "cancelled"}, "in_progress": {"completed"}, "completed": set(), "cancelled": set()}


def passed_pre_trip_check(db, trip):
    check = db.scalar(select(orm.PreTripCheck).where(orm.PreTripCheck.trip_id == trip.id, orm.PreTripCheck.organization_id == trip.organization_id).order_by(orm.PreTripCheck.checked_at.desc()))
    return bool(check and check.tires_ok and check.brakes_ok and check.lights_ok and check.mirrors_ok and check.documents_ok)


def has_trip_event(db, trip_id, event_type):
    return bool(db.scalar(select(orm.TripEvent).where(orm.TripEvent.trip_id == trip_id, orm.TripEvent.event_type == event_type)))


def haversine_meters(lat1, lng1, lat2, lng2):
    radius = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    value = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(value))


@api_router.patch("/trips/{trip_id}/status")
def update_trip_status(trip_id: str, status: TripStatus, auth: AuthContext = Depends(require_permission("trips.update")), db: Session = Depends(get_db)):
    trip = db.scalar(select(orm.Trip).where(orm.Trip.id == trip_id, orm.Trip.organization_id == auth.organization.id))
    if not trip: raise HTTPException(status_code=404, detail="Trip not found")
    if status.value not in VALID_TRANSITIONS.get(trip.status, set()):
        raise HTTPException(status_code=409, detail=f"Cannot move trip from {trip.status} to {status.value}")
    driver = db.get(orm.Driver, trip.driver_id) if trip.driver_id else None
    vehicle = db.get(orm.Vehicle, trip.vehicle_id) if trip.vehicle_id else None
    if status == TripStatus.IN_PROGRESS:
        if not driver or not vehicle: raise HTTPException(status_code=409, detail="Driver and vehicle are required")
        if not has_trip_event(db, trip.id, "accepted"): raise HTTPException(status_code=409, detail="Driver must accept the trip before it can start")
        if not passed_pre_trip_check(db, trip): raise HTTPException(status_code=409, detail="A fully passed pre-trip check is required")
        trip.started_at = datetime.now(timezone.utc); driver.status = "on_trip"; vehicle.status = "in_transit"
        if trip.load_id:
            db.get(orm.Load, trip.load_id).status = "in_execution"
    elif status == TripStatus.COMPLETED:
        if not has_trip_event(db, trip.id, "reached_destination"): raise HTTPException(status_code=409, detail="Destination arrival must be recorded before completion")
        if not trip.delivered_to or not (trip.pod_signature or trip.pod_photo or trip.delivery_otp): raise HTTPException(status_code=409, detail="Proof of delivery is required")
        trip.completed_at = datetime.now(timezone.utc)
        if driver: driver.status = "available"; driver.total_trips += 1
        if vehicle: vehicle.status = "available"; vehicle.total_trips += 1
        if trip.load_id:
            db.get(orm.Load, trip.load_id).status = "delivered"
        notify(db, auth.organization.id, operational_user_ids(db, auth.organization.id), "delivery_completed", "Delivery completed", f"Trip {trip.id} was delivered to {trip.delivered_to}", "trip", trip.id)
    elif status == TripStatus.CANCELLED:
        if driver and driver.status == "on_trip": driver.status = "available"
        if vehicle and vehicle.status == "in_transit": vehicle.status = "available"
        if trip.load_id:
            db.get(orm.Load, trip.load_id).status = "cancelled"
    old = trip.status; trip.status = status.value
    audit(db, auth, "trip.status", "trip", trip.id, {"from": old, "to": status.value}); db.commit()
    return {"message": "Status updated"}


@api_router.post("/trips/{trip_id}/assign")
def assign_trip(trip_id: str, driver_id: str, vehicle_id: str, auth: AuthContext = Depends(require_permission("trips.assign")), db: Session = Depends(get_db)):
    trip = db.scalar(select(orm.Trip).where(orm.Trip.id == trip_id, orm.Trip.organization_id == auth.organization.id))
    driver = db.scalar(select(orm.Driver).where(orm.Driver.id == driver_id, orm.Driver.organization_id == auth.organization.id))
    vehicle = db.scalar(select(orm.Vehicle).where(orm.Vehicle.id == vehicle_id, orm.Vehicle.organization_id == auth.organization.id))
    if not trip: raise HTTPException(status_code=404, detail="Trip not found")
    if not driver: raise HTTPException(status_code=404, detail="Driver not found")
    if not vehicle: raise HTTPException(status_code=404, detail="Vehicle not found")
    if trip.status != "pending": raise HTTPException(status_code=409, detail="Only pending trips can be assigned")
    if driver.status != "available" or vehicle.status != "available": raise HTTPException(status_code=409, detail="Driver and vehicle must be available")
    assert_assignment_compliance(db, auth.organization.id, driver, vehicle)
    conflict = db.scalar(select(orm.Trip).where(orm.Trip.organization_id == auth.organization.id, orm.Trip.status.in_(["assigned", "in_progress"]), (orm.Trip.driver_id == driver_id) | (orm.Trip.vehicle_id == vehicle_id)))
    if conflict: raise HTTPException(status_code=409, detail="Driver or vehicle already has an active trip")
    trip.driver_id = driver_id; trip.vehicle_id = vehicle_id; trip.status = "assigned"
    audit(db, auth, "trip.assign", "trip", trip.id, {"driver_id": driver_id, "vehicle_id": vehicle_id})
    linked_user = driver_user_id(db, auth.organization.id, driver.id)
    if linked_user: notify(db, auth.organization.id, [linked_user], "trip_assigned", "New trip assigned", f"{trip.origin} to {trip.destination}", "trip", trip.id)
    db.commit()
    return {"message": "Trip assigned successfully"}


DRIVER_EVENT_SEQUENCE = ["accepted", "reached_pickup", "loading_started", "loaded", "departed_pickup", "reached_destination", "unloading_started"]


def event_dict(value):
    return {"event_id": value.id, "trip_id": value.trip_id, "event_type": value.event_type, "notes": value.notes, "lat": value.lat, "lng": value.lng, "created_at": value.created_at, "user_id": value.user_id}


def driver_trip(db, auth, trip_id):
    if auth.membership.role != Role.DRIVER.value or not auth.membership.driver_id:
        raise HTTPException(status_code=403, detail="Driver access required")
    trip = db.scalar(select(orm.Trip).where(orm.Trip.id == trip_id, orm.Trip.driver_id == auth.membership.driver_id, orm.Trip.organization_id == auth.organization.id))
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@api_router.get("/driver/me/trips")
def get_driver_trips(auth: AuthContext = Depends(require_permission("driver.portal")), db: Session = Depends(get_db)):
    trips = db.scalars(select(orm.Trip).where(orm.Trip.organization_id == auth.organization.id, orm.Trip.driver_id == auth.membership.driver_id).order_by(orm.Trip.scheduled_date.desc())).all()
    result = []
    for trip in trips:
        vehicle = db.get(orm.Vehicle, trip.vehicle_id) if trip.vehicle_id else None
        events = db.scalars(select(orm.TripEvent).where(orm.TripEvent.trip_id == trip.id).order_by(orm.TripEvent.created_at)).all()
        result.append({**trip_dict(trip), "vehicle": vehicle_dict(vehicle) if vehicle else None, "events": [event_dict(x) for x in events], "pre_trip_passed": passed_pre_trip_check(db, trip)})
    return result


def trip_location_dict(value):
    return {"location_id": value.id, "trip_id": value.trip_id, "driver_id": value.driver_id, "lat": value.lat, "lng": value.lng, "accuracy_meters": value.accuracy_meters, "speed_kph": value.speed_kph, "heading": value.heading, "recorded_at": value.recorded_at}


def geofence_state(db, trip, last_location):
    if not last_location:
        return {"suggestion": None, "pickup_distance_meters": None, "destination_distance_meters": None}
    pickup_distance = haversine_meters(last_location.lat, last_location.lng, trip.origin_lat, trip.origin_lng) if trip.origin_lat is not None and trip.origin_lng is not None else None
    destination_distance = haversine_meters(last_location.lat, last_location.lng, trip.destination_lat, trip.destination_lng) if trip.destination_lat is not None and trip.destination_lng is not None else None
    suggestion = None
    if pickup_distance is not None and pickup_distance <= 500 and not has_trip_event(db, trip.id, "reached_pickup"):
        suggestion = "reached_pickup"
    elif destination_distance is not None and destination_distance <= 500 and not has_trip_event(db, trip.id, "reached_destination"):
        suggestion = "reached_destination"
    return {"suggestion": suggestion, "pickup_distance_meters": round(pickup_distance) if pickup_distance is not None else None, "destination_distance_meters": round(destination_distance) if destination_distance is not None else None}


@api_router.post("/driver/me/trips/{trip_id}/location")
def update_driver_location(trip_id: str, payload: LocationUpdate, auth: AuthContext = Depends(require_permission("driver.location")), db: Session = Depends(get_db)):
    trip = driver_trip(db, auth, trip_id)
    if trip.status != "in_progress": raise HTTPException(status_code=409, detail="Location tracking is only active while the trip is in progress")
    if not (-90 <= payload.lat <= 90 and -180 <= payload.lng <= 180): raise HTTPException(status_code=400, detail="Invalid coordinates")
    recorded_at = payload.recorded_at or datetime.now(timezone.utc)
    if aware(recorded_at) > datetime.now(timezone.utc) + timedelta(minutes=2): raise HTTPException(status_code=400, detail="Location timestamp is in the future")
    last = db.scalar(select(orm.TripLocation).where(orm.TripLocation.trip_id == trip.id).order_by(orm.TripLocation.recorded_at.desc()))
    if last and (aware(recorded_at) - aware(last.recorded_at)).total_seconds() < 15:
        return {"stored": False, "reason": "sampled", "geofence": geofence_state(db, trip, last)}
    value = orm.TripLocation(id=new_id("gps"), organization_id=auth.organization.id, trip_id=trip.id, driver_id=auth.membership.driver_id, lat=payload.lat, lng=payload.lng, accuracy_meters=payload.accuracy_meters, speed_kph=payload.speed_kph, heading=payload.heading, recorded_at=recorded_at)
    db.add(value)
    vehicle = db.get(orm.Vehicle, trip.vehicle_id) if trip.vehicle_id else None
    if vehicle:
        vehicle.lat = payload.lat; vehicle.lng = payload.lng; vehicle.current_location = f"{payload.lat:.5f}, {payload.lng:.5f}"
    db.commit(); db.refresh(value)
    return {"stored": True, "location": trip_location_dict(value), "geofence": geofence_state(db, trip, value)}


@api_router.get("/tracking/active")
def get_active_tracking(auth: AuthContext = Depends(require_permission("tracking.read")), db: Session = Depends(get_db)):
    trips = db.scalars(select(orm.Trip).where(orm.Trip.organization_id == auth.organization.id, orm.Trip.status == "in_progress").order_by(orm.Trip.started_at.desc())).all()
    result = []
    now = datetime.now(timezone.utc)
    for trip in trips:
        last = db.scalar(select(orm.TripLocation).where(orm.TripLocation.trip_id == trip.id, orm.TripLocation.organization_id == auth.organization.id).order_by(orm.TripLocation.recorded_at.desc()))
        recent = db.scalars(select(orm.TripLocation).where(orm.TripLocation.trip_id == trip.id, orm.TripLocation.organization_id == auth.organization.id).order_by(orm.TripLocation.recorded_at.desc()).limit(200)).all()
        age = (now - aware(last.recorded_at)).total_seconds() if last else None
        alert = "no_signal" if not last else "stale" if age > 300 else "low_accuracy" if (last.accuracy_meters or 0) > 200 else None
        vehicle = db.get(orm.Vehicle, trip.vehicle_id) if trip.vehicle_id else None
        driver = db.get(orm.Driver, trip.driver_id) if trip.driver_id else None
        events = db.scalars(select(orm.TripEvent).where(orm.TripEvent.trip_id == trip.id).order_by(orm.TripEvent.created_at)).all()
        result.append({"trip": trip_dict(trip), "vehicle": vehicle_dict(vehicle) if vehicle else None, "driver": driver_dict(driver) if driver else None, "last_location": trip_location_dict(last) if last else None, "history": [trip_location_dict(x) for x in reversed(recent)], "last_update_seconds": round(age) if age is not None else None, "alert": alert, "geofence": geofence_state(db, trip, last), "current_milestone": events[-1].event_type if events else None})
    return result


@api_router.get("/tracking/trips/{trip_id}/history")
def get_tracking_history(trip_id: str, auth: AuthContext = Depends(require_permission("tracking.read")), db: Session = Depends(get_db)):
    tenant_entity(db, orm.Trip, trip_id, auth.organization.id, "Trip")
    values = db.scalars(select(orm.TripLocation).where(orm.TripLocation.trip_id == trip_id, orm.TripLocation.organization_id == auth.organization.id).order_by(orm.TripLocation.recorded_at)).all()
    return [trip_location_dict(x) for x in values]


@api_router.post("/driver/me/trips/{trip_id}/events")
def create_driver_trip_event(trip_id: str, payload: TripEventPayload, auth: AuthContext = Depends(require_permission("driver.portal")), db: Session = Depends(get_db)):
    trip = driver_trip(db, auth, trip_id)
    if trip.status not in {"assigned", "in_progress"}: raise HTTPException(status_code=409, detail="Trip is not active")
    if payload.event_type not in DRIVER_EVENT_SEQUENCE: raise HTTPException(status_code=400, detail="Unsupported trip milestone")
    if trip.status == "assigned" and payload.event_type != "accepted":
        raise HTTPException(status_code=409, detail="Start the trip before recording execution milestones")
    if trip.status == "in_progress" and payload.event_type == "accepted":
        raise HTTPException(status_code=409, detail="The assignment must be accepted before starting the trip")
    if has_trip_event(db, trip.id, payload.event_type): raise HTTPException(status_code=409, detail="Milestone already recorded")
    index = DRIVER_EVENT_SEQUENCE.index(payload.event_type)
    if index and not has_trip_event(db, trip.id, DRIVER_EVENT_SEQUENCE[index - 1]): raise HTTPException(status_code=409, detail=f"Record {DRIVER_EVENT_SEQUENCE[index - 1].replace('_', ' ')} first")
    value = orm.TripEvent(id=new_id("event"), organization_id=auth.organization.id, trip_id=trip.id, user_id=auth.user.id, **payload.model_dump())
    db.add(value); audit(db, auth, "trip.milestone", "trip", trip.id, {"event_type": payload.event_type}); db.commit(); db.refresh(value); return event_dict(value)


@api_router.post("/driver/me/trips/{trip_id}/start")
def start_driver_trip(trip_id: str, auth: AuthContext = Depends(require_permission("driver.portal")), db: Session = Depends(get_db)):
    driver_trip(db, auth, trip_id)
    return update_trip_status(trip_id, TripStatus.IN_PROGRESS, auth, db)


@api_router.post("/driver/me/trips/{trip_id}/proof-of-delivery")
def complete_driver_trip(trip_id: str, payload: ProofOfDeliveryPayload, auth: AuthContext = Depends(require_permission("driver.portal")), db: Session = Depends(get_db)):
    trip = driver_trip(db, auth, trip_id)
    if trip.status != "in_progress": raise HTTPException(status_code=409, detail="Trip must be in progress")
    if not payload.delivered_to.strip(): raise HTTPException(status_code=400, detail="Recipient name is required")
    if not (payload.signature or payload.photo or payload.delivery_otp): raise HTTPException(status_code=400, detail="OTP, signature or delivery photo is required")
    trip.delivered_to = payload.delivered_to.strip(); trip.delivery_otp = payload.delivery_otp; trip.pod_signature = payload.signature; trip.pod_photo = payload.photo; trip.pod_notes = payload.notes; trip.pod_lat = payload.lat; trip.pod_lng = payload.lng
    audit(db, auth, "trip.proof_of_delivery", "trip", trip.id, {"delivered_to": trip.delivered_to})
    return update_trip_status(trip.id, TripStatus.COMPLETED, auth, db)


@api_router.get("/trips/{trip_id}/events")
def get_trip_events(trip_id: str, auth: AuthContext = Depends(require_permission("trips.read")), db: Session = Depends(get_db)):
    tenant_entity(db, orm.Trip, trip_id, auth.organization.id, "Trip")
    return [event_dict(x) for x in db.scalars(select(orm.TripEvent).where(orm.TripEvent.trip_id == trip_id, orm.TripEvent.organization_id == auth.organization.id).order_by(orm.TripEvent.created_at)).all()]


def document_dict(value):
    now = datetime.now(timezone.utc); expiry = aware(value.expires_at)
    state = "expired" if expiry and expiry <= now else "expiring" if expiry and expiry <= now + timedelta(days=30) else "valid"
    return {"document_id": value.id, "entity_type": value.entity_type, "entity_id": value.entity_id, "document_type": value.document_type, "document_number": value.document_number, "issued_at": value.issued_at, "expires_at": value.expires_at, "file_name": value.file_name, "mime_type": value.mime_type, "verification_status": value.verification_status, "compliance_state": state, "notes": value.notes, "created_at": value.created_at}


def validate_document_entity(db, auth, entity_type, entity_id):
    if entity_type == "driver":
        value = tenant_entity(db, orm.Driver, entity_id, auth.organization.id, "Driver")
        if auth.membership.role == Role.DRIVER.value and auth.membership.driver_id != value.id: raise HTTPException(status_code=403, detail="You can only manage your own documents")
        return value
    if entity_type == "vehicle":
        if auth.membership.role == Role.DRIVER.value: raise HTTPException(status_code=403, detail="Drivers cannot upload vehicle master documents")
        return tenant_entity(db, orm.Vehicle, entity_id, auth.organization.id, "Vehicle")
    raise HTTPException(status_code=400, detail="Document entity must be driver or vehicle")


@api_router.get("/compliance/documents")
def get_documents(entity_type: Optional[str] = None, entity_id: Optional[str] = None, auth: AuthContext = Depends(require_permission("compliance.read")), db: Session = Depends(get_db)):
    query = select(orm.ComplianceDocument).where(orm.ComplianceDocument.organization_id == auth.organization.id)
    if auth.membership.role == Role.DRIVER.value:
        query = query.where(orm.ComplianceDocument.entity_type == "driver", orm.ComplianceDocument.entity_id == auth.membership.driver_id)
    if entity_type: query = query.where(orm.ComplianceDocument.entity_type == entity_type)
    if entity_id: query = query.where(orm.ComplianceDocument.entity_id == entity_id)
    return [document_dict(x) for x in db.scalars(query.order_by(orm.ComplianceDocument.created_at.desc())).all()]


@api_router.post("/compliance/documents")
def create_document(payload: DocumentCreate, auth: AuthContext = Depends(require_permission("compliance.create")), db: Session = Depends(get_db)):
    validate_document_entity(db, auth, payload.entity_type, payload.entity_id)
    if payload.mime_type not in {"application/pdf", "image/jpeg", "image/png", "image/webp"}: raise HTTPException(status_code=400, detail="Only PDF, JPEG, PNG or WebP files are supported")
    encoded = payload.file_data.split(",", 1)[-1]
    try: size = len(base64.b64decode(encoded, validate=True))
    except Exception: raise HTTPException(status_code=400, detail="Invalid document file")
    if size > 5 * 1024 * 1024: raise HTTPException(status_code=413, detail="Document must be 5 MB or smaller")
    value = orm.ComplianceDocument(id=new_id("doc"), organization_id=auth.organization.id, uploaded_by_user_id=auth.user.id, **payload.model_dump())
    db.add(value); audit(db, auth, "document.upload", "compliance_document", value.id, {"type": value.document_type, "entity_id": value.entity_id})
    notify(db, auth.organization.id, operational_user_ids(db, auth.organization.id), "document_uploaded", "Document awaiting verification", f"{value.document_type.replace('_',' ').title()} was uploaded", "document", value.id)
    db.commit(); db.refresh(value); return document_dict(value)


@api_router.get("/compliance/documents/{document_id}/file")
def get_document_file(document_id: str, auth: AuthContext = Depends(require_permission("compliance.read")), db: Session = Depends(get_db)):
    value = tenant_entity(db, orm.ComplianceDocument, document_id, auth.organization.id, "Document")
    if auth.membership.role == Role.DRIVER.value and not (value.entity_type == "driver" and value.entity_id == auth.membership.driver_id): raise HTTPException(status_code=403, detail="Document access denied")
    return {"file_name": value.file_name, "mime_type": value.mime_type, "file_data": value.file_data}


@api_router.patch("/compliance/documents/{document_id}/verify")
def verify_document(document_id: str, payload: DocumentVerification, auth: AuthContext = Depends(require_permission("compliance.manage")), db: Session = Depends(get_db)):
    if payload.status not in {"verified", "rejected"}: raise HTTPException(status_code=400, detail="Status must be verified or rejected")
    value = tenant_entity(db, orm.ComplianceDocument, document_id, auth.organization.id, "Document"); value.verification_status = payload.status; value.notes = payload.notes; value.verified_by_user_id = auth.user.id
    audit(db, auth, "document.verify", "compliance_document", value.id, {"status": payload.status}); db.commit(); return document_dict(value)


@api_router.delete("/compliance/documents/{document_id}")
def delete_document(document_id: str, auth: AuthContext = Depends(require_permission("compliance.manage")), db: Session = Depends(get_db)):
    value=tenant_entity(db,orm.ComplianceDocument,document_id,auth.organization.id,"Document"); audit(db,auth,"document.delete","compliance_document",value.id); db.delete(value); db.commit(); return {"message":"Document deleted"}


@api_router.get("/compliance/summary")
def compliance_summary(auth: AuthContext = Depends(require_permission("compliance.read")), db: Session = Depends(get_db)):
    documents=db.scalars(select(orm.ComplianceDocument).where(orm.ComplianceDocument.organization_id==auth.organization.id)).all(); values=[document_dict(x) for x in documents]
    return {"total":len(values),"pending":sum(x["verification_status"]=="pending" for x in values),"expired":sum(x["compliance_state"]=="expired" for x in values),"expiring":sum(x["compliance_state"]=="expiring" for x in values),"documents":values}


def smtp_configured():
    return bool(os.environ.get("SMTP_HOST", "").strip() and os.environ.get("SMTP_FROM_EMAIL", "").strip())


def deliver_email(value):
    message = EmailMessage(); message["Subject"] = value.subject
    message["From"] = os.environ.get("SMTP_FROM_EMAIL"); message["To"] = value.recipient_email
    message.set_content(value.text_body)
    if value.html_body: message.add_alternative(value.html_body, subtype="html")
    host = os.environ["SMTP_HOST"]; port = int(os.environ.get("SMTP_PORT", "465" if os.environ.get("SMTP_USE_SSL", "false").lower() == "true" else "587"))
    use_ssl = os.environ.get("SMTP_USE_SSL", "false").lower() == "true"
    client_class = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
    with client_class(host, port, timeout=20, context=ssl.create_default_context()) if use_ssl else client_class(host, port, timeout=20) as client:
        if not use_ssl and os.environ.get("SMTP_STARTTLS", "true").lower() == "true": client.starttls(context=ssl.create_default_context())
        username = os.environ.get("SMTP_USERNAME", "").strip()
        if username: client.login(username, os.environ.get("SMTP_PASSWORD", ""))
        client.send_message(message)


def process_email_outbox(db, limit=25):
    if not smtp_configured(): return {"sent": 0, "failed": 0, "configured": False}
    now = datetime.now(timezone.utc); sent = failed = 0
    values = db.scalars(select(orm.EmailOutbox).where(orm.EmailOutbox.status.in_(["queued", "retry"]), orm.EmailOutbox.next_attempt_at <= now).order_by(orm.EmailOutbox.created_at).limit(limit)).all()
    for value in values:
        value.attempts += 1
        try:
            deliver_email(value); value.status = "sent"; value.sent_at = now; value.last_error = None; sent += 1
        except Exception as error:
            logger.warning("Email delivery failed for %s: %s", value.id, error)
            value.last_error = str(error)[:1000]; value.status = "failed" if value.attempts >= 5 else "retry"
            value.next_attempt_at = now + timedelta(minutes=min(60, 2 ** value.attempts)); failed += 1
        db.commit()
    return {"sent": sent, "failed": failed, "configured": True}


def operational_emails(db, organization_id):
    rows = db.execute(select(orm.User).join(orm.Membership, orm.Membership.user_id == orm.User.id).where(orm.Membership.organization_id == organization_id, orm.Membership.status == "active", orm.Membership.role != Role.DRIVER.value)).scalars().all()
    return [(user.email, user.name) for user in rows]


def run_reminder_scan(db, organization_id=None):
    now = datetime.now(timezone.utc); queued = 0
    query = select(orm.EmailSettings).where(orm.EmailSettings.enabled.is_(True))
    if organization_id: query = query.where(orm.EmailSettings.organization_id == organization_id)
    for settings in db.scalars(query).all():
        org = settings.organization_id; operations = operational_emails(db, org)
        if settings.invoice_reminders_enabled:
            invoices = db.scalars(select(orm.Invoice).where(orm.Invoice.organization_id == org, orm.Invoice.balance_due > 0, orm.Invoice.status.in_(["issued", "partially_paid"]), orm.Invoice.due_at.is_not(None))).all()
            for invoice in invoices:
                days = (aware(invoice.due_at).date() - now.date()).days
                if days > settings.invoice_days_before_due: continue
                load = db.get(orm.Load, invoice.load_id); customer = db.get(orm.Customer, load.customer_id) if load else None
                if not customer or not customer.email: continue
                bucket = "due-soon" if days >= 0 else f"overdue-{abs(days) // 7}"
                subject = f"Invoice {invoice.invoice_number} {'is overdue' if days < 0 else 'is due soon'}"
                text = f"Hello {customer.contact_name},\nInvoice {invoice.invoice_number} has an outstanding balance of ₹{money(invoice.balance_due)} and is due on {aware(invoice.due_at).date()}."
                if enqueue_email(db, org, customer.email, subject, text, "invoice_reminder", "invoice", invoice.id, customer.contact_name, f"invoice-reminder:{invoice.id}:{bucket}"): queued += 1
        if settings.compliance_reminders_enabled:
            cutoff = now + timedelta(days=settings.compliance_days_before_expiry)
            documents = db.scalars(select(orm.ComplianceDocument).where(orm.ComplianceDocument.organization_id == org, orm.ComplianceDocument.expires_at.is_not(None), orm.ComplianceDocument.expires_at >= now, orm.ComplianceDocument.expires_at <= cutoff)).all()
            for document in documents:
                for email, name in operations:
                    if enqueue_email(db, org, email, f"Compliance document expiring: {document.document_type.replace('_',' ').title()}", f"The document for {document.entity_type} {document.entity_id} expires on {aware(document.expires_at).date()}.", "compliance_expiry", "compliance_document", document.id, name, f"compliance:{document.id}:{aware(document.expires_at).date()}:{email}"): queued += 1
        if settings.delayed_load_reminders_enabled:
            loads = db.scalars(select(orm.Load).where(orm.Load.organization_id == org, orm.Load.delivery_by < now, ~orm.Load.status.in_(["delivered", "closed", "cancelled", "rejected"]))).all()
            for load in loads:
                for email, name in operations:
                    if enqueue_email(db, org, email, f"Delayed load: {load.reference_number}", f"Load {load.reference_number} passed its delivery deadline and is currently {load.status.replace('_',' ')}.", "load_delayed", "load", load.id, name, f"delayed:{load.id}:{now.date()}:{email}"): queued += 1
        if settings.pending_expense_reminders_enabled:
            cutoff = now - timedelta(hours=settings.pending_expense_hours)
            expenses = db.scalars(select(orm.TripExpense).where(orm.TripExpense.organization_id == org, orm.TripExpense.status == "submitted", orm.TripExpense.updated_at <= cutoff)).all()
            for expense in expenses:
                for email, name in operations:
                    if enqueue_email(db, org, email, "Expense approval pending", f"{expense.description} for ₹{money(expense.actual_amount)} has been awaiting approval.", "expense_pending", "trip_expense", expense.id, name, f"expense-pending:{expense.id}:{email}"): queued += 1
        settings.last_scan_at = now
    db.commit(); return {"queued": queued, "scanned_at": now}


def email_settings_dict(value):
    fields = ["enabled", "transactional_enabled", "invoice_reminders_enabled", "invoice_days_before_due", "compliance_reminders_enabled", "compliance_days_before_expiry", "delayed_load_reminders_enabled", "pending_expense_reminders_enabled", "pending_expense_hours", "last_scan_at", "updated_at"]
    return {field: getattr(value, field) for field in fields}


@api_router.get("/email/settings")
def read_email_settings(auth: AuthContext = Depends(require_permission("notifications.read")), db: Session = Depends(get_db)):
    value = get_email_settings(db, auth.organization.id, True); db.commit()
    return {**email_settings_dict(value), "smtp_configured": smtp_configured()}


@api_router.put("/email/settings")
def update_email_settings(payload: EmailSettingsPayload, auth: AuthContext = Depends(require_permission("notifications.manage")), db: Session = Depends(get_db)):
    if not 0 <= payload.invoice_days_before_due <= 30 or not 1 <= payload.compliance_days_before_expiry <= 180 or not 1 <= payload.pending_expense_hours <= 168: raise HTTPException(status_code=400, detail="Reminder intervals are outside the allowed range")
    value = get_email_settings(db, auth.organization.id, True)
    for key, item in payload.model_dump().items(): setattr(value, key, item)
    value.updated_by_user_id = auth.user.id; audit(db, auth, "email.settings_update", "email_settings", value.id); db.commit(); return {**email_settings_dict(value), "smtp_configured": smtp_configured()}


@api_router.get("/email/outbox")
def email_outbox(auth: AuthContext = Depends(require_permission("notifications.read")), db: Session = Depends(get_db)):
    values = db.scalars(select(orm.EmailOutbox).where(orm.EmailOutbox.organization_id == auth.organization.id).order_by(orm.EmailOutbox.created_at.desc()).limit(100)).all()
    fields = ["recipient_email", "subject", "notification_type", "entity_type", "entity_id", "status", "attempts", "sent_at", "last_error", "created_at"]
    return [{"email_id": value.id, **{field: getattr(value, field) for field in fields}} for value in values]


@api_router.post("/email/test")
def send_test_email(auth: AuthContext = Depends(require_permission("notifications.manage")), db: Session = Depends(get_db)):
    value = enqueue_email(db, auth.organization.id, auth.user.email, "BookMyLoad email test", "Email notifications are configured for your organization.", "email_test", "organization", auth.organization.id, auth.user.name)
    if not value: raise HTTPException(status_code=409, detail="Enable email notifications before sending a test")
    db.commit(); result = process_email_outbox(db)
    return {"message": "Test email sent" if result["sent"] else "Test email queued", **result}


@api_router.post("/email/reminders/run")
def run_reminders_now(auth: AuthContext = Depends(require_permission("notifications.manage")), db: Session = Depends(get_db)):
    result = run_reminder_scan(db, auth.organization.id); delivery = process_email_outbox(db); audit(db, auth, "email.reminders_run", "organization", auth.organization.id, result); db.commit(); return {**result, **delivery}


@api_router.get("/notifications")
def get_notifications(auth: AuthContext = Depends(require_permission("notifications.read")), db: Session = Depends(get_db)):
    values=db.scalars(select(orm.Notification).where(orm.Notification.user_id==auth.user.id,orm.Notification.organization_id==auth.organization.id).order_by(orm.Notification.created_at.desc()).limit(100)).all()
    return [{"notification_id":x.id,"type":x.notification_type,"title":x.title,"message":x.message,"entity_type":x.entity_type,"entity_id":x.entity_id,"severity":x.severity,"read_at":x.read_at,"created_at":x.created_at} for x in values]


@api_router.patch("/notifications/{notification_id}/read")
def read_notification(notification_id: str, auth: AuthContext = Depends(require_permission("notifications.read")), db: Session = Depends(get_db)):
    value=db.scalar(select(orm.Notification).where(orm.Notification.id==notification_id,orm.Notification.user_id==auth.user.id,orm.Notification.organization_id==auth.organization.id))
    if not value: raise HTTPException(status_code=404,detail="Notification not found")
    value.read_at=datetime.now(timezone.utc); db.commit(); return {"message":"Notification read"}


@api_router.post("/notifications/read-all")
def read_all_notifications(auth: AuthContext = Depends(require_permission("notifications.read")), db: Session = Depends(get_db)):
    db.query(orm.Notification).filter(orm.Notification.user_id==auth.user.id,orm.Notification.organization_id==auth.organization.id,orm.Notification.read_at.is_(None)).update({"read_at":datetime.now(timezone.utc)}); db.commit(); return {"message":"Notifications read"}


@api_router.post("/compliance/pre-trip-check", response_model=PreTripCheck)
def create_pre_trip_check(payload: PreTripCheck, auth: AuthContext = Depends(require_permission("compliance.create")), db: Session = Depends(get_db)):
    trip = db.scalar(select(orm.Trip).where(orm.Trip.id == payload.trip_id, orm.Trip.organization_id == auth.organization.id))
    if not trip or trip.driver_id != payload.driver_id or trip.vehicle_id != payload.vehicle_id:
        raise HTTPException(status_code=400, detail="Checklist must match an assigned trip")
    if auth.membership.role == Role.DRIVER.value and auth.membership.driver_id != trip.driver_id:
        raise HTTPException(status_code=403, detail="You can only inspect your assigned trip")
    value = orm.PreTripCheck(id=payload.check_id, organization_id=auth.organization.id, **payload.model_dump(exclude={"check_id"}))
    db.add(value); audit(db, auth, "compliance.create", "pre_trip_check", value.id)
    if not all([value.tires_ok,value.brakes_ok,value.lights_ok,value.mirrors_ok,value.documents_ok]):
        notify(db,auth.organization.id,operational_user_ids(db,auth.organization.id),"inspection_failed","Pre-trip inspection failed",f"Trip {trip.id} has failed inspection items","trip",trip.id,"warning")
    db.commit()
    return payload


@api_router.get("/compliance/pre-trip-checks/{trip_id}")
def get_pre_trip_checks(trip_id: str, auth: AuthContext = Depends(require_permission("compliance.read")), db: Session = Depends(get_db)):
    values = db.scalars(select(orm.PreTripCheck).where(orm.PreTripCheck.trip_id == trip_id, orm.PreTripCheck.organization_id == auth.organization.id).order_by(orm.PreTripCheck.checked_at.desc())).all()
    return [{"check_id": x.id, "trip_id": x.trip_id, "driver_id": x.driver_id, "vehicle_id": x.vehicle_id, "tires_ok": x.tires_ok, "brakes_ok": x.brakes_ok, "lights_ok": x.lights_ok, "mirrors_ok": x.mirrors_ok, "fuel_level": x.fuel_level, "documents_ok": x.documents_ok, "notes": x.notes, "checked_at": x.checked_at} for x in values]


@api_router.get("/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(auth: AuthContext = Depends(require_permission("dashboard.read")), db: Session = Depends(get_db)):
    org = auth.organization.id
    count = lambda model, *criteria: db.scalar(select(func.count()).select_from(model).where(model.organization_id == org, *criteria)) or 0
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    completed = db.scalars(select(orm.Trip).where(orm.Trip.organization_id == org, orm.Trip.status == "completed", orm.Trip.completed_at >= today)).all()
    return DashboardStats(total_vehicles=count(orm.Vehicle), available_vehicles=count(orm.Vehicle, orm.Vehicle.status == "available"), total_drivers=count(orm.Driver), available_drivers=count(orm.Driver, orm.Driver.status == "available"), active_trips=count(orm.Trip, orm.Trip.status.in_(["assigned", "in_progress"])), completed_trips_today=len(completed), total_km_today=sum(t.distance_km or 0 for t in completed), pending_maintenance=count(orm.Vehicle, orm.Vehicle.status == "maintenance"))


@api_router.get("/analytics/trip-summary")
def get_trip_summary(auth: AuthContext = Depends(require_permission("reports.read")), db: Session = Depends(get_db)):
    rows = db.execute(select(orm.Trip.status, func.count()).where(orm.Trip.organization_id == auth.organization.id).group_by(orm.Trip.status)).all()
    return {status: count for status, count in rows}


def report_window(start_date, end_date):
    now = datetime.now(timezone.utc)
    end = aware(end_date) if end_date else now
    start = aware(start_date) if start_date else end - timedelta(days=29)
    if start > end: raise HTTPException(status_code=400, detail="Report start date must be before end date")
    if end - start > timedelta(days=730): raise HTTPException(status_code=400, detail="Report range cannot exceed two years")
    return start, end


def build_report(db, auth, start_date=None, end_date=None, customer_id=None, driver_id=None, vehicle_id=None, load_status=None, invoice_status=None, expense_category=None):
    start, end = report_window(start_date, end_date); org = auth.organization.id
    loads = db.scalars(select(orm.Load).where(orm.Load.organization_id == org, orm.Load.pickup_at >= start, orm.Load.pickup_at <= end).order_by(orm.Load.pickup_at.desc())).all()
    if customer_id: loads = [item for item in loads if item.customer_id == customer_id]
    if load_status: loads = [item for item in loads if item.status == load_status]
    load_ids = {item.id for item in loads}
    trips = db.scalars(select(orm.Trip).where(orm.Trip.organization_id == org, orm.Trip.load_id.in_(load_ids) if load_ids else False).order_by(orm.Trip.scheduled_date.desc())).all()
    if driver_id: trips = [item for item in trips if item.driver_id == driver_id]
    if vehicle_id: trips = [item for item in trips if item.vehicle_id == vehicle_id]
    trip_ids = {item.id for item in trips}; effective_load_ids = {item.load_id for item in trips if item.load_id}
    if driver_id or vehicle_id: loads = [item for item in loads if item.id in effective_load_ids]; load_ids = effective_load_ids
    invoices = db.scalars(select(orm.Invoice).where(orm.Invoice.organization_id == org, orm.Invoice.load_id.in_(load_ids) if load_ids else False)).all()
    if invoice_status:
        invoices = [item for item in invoices if invoice_dict(item, db)["status"] == invoice_status]
    invoice_ids = {item.id for item in invoices}
    payments = db.scalars(select(orm.Payment).where(orm.Payment.organization_id == org, orm.Payment.invoice_id.in_(invoice_ids) if invoice_ids else False)).all()
    expenses = db.scalars(select(orm.TripExpense).where(orm.TripExpense.organization_id == org, orm.TripExpense.trip_id.in_(trip_ids) if trip_ids else False)).all()
    if expense_category: expenses = [item for item in expenses if item.category == expense_category]
    approved_expenses = [item for item in expenses if item.status == "approved" and item.actual_amount is not None]
    revenue = sum((money(item.subtotal) for item in invoices), Decimal("0.00"))
    invoiced_total = sum((money(item.total_amount) for item in invoices), Decimal("0.00"))
    collected = sum((money(item.amount) for item in payments if start <= aware(item.paid_at) <= end), Decimal("0.00"))
    outstanding = sum((money(item.balance_due) for item in invoices), Decimal("0.00"))
    actual_cost = sum((money(item.actual_amount) for item in approved_expenses), Decimal("0.00")); profit = revenue - actual_cost
    completed = [item for item in trips if item.status == "completed"]
    load_map = {item.id: item for item in loads}; customer_map = {item.id: item for item in db.scalars(select(orm.Customer).where(orm.Customer.organization_id == org)).all()}
    driver_map = {item.id: item for item in db.scalars(select(orm.Driver).where(orm.Driver.organization_id == org)).all()}; vehicle_map = {item.id: item for item in db.scalars(select(orm.Vehicle).where(orm.Vehicle.organization_id == org)).all()}
    on_time = 0; delayed = 0
    for trip in trips:
        load = load_map.get(trip.load_id)
        if not load or not load.delivery_by: continue
        if trip.completed_at: on_time += aware(trip.completed_at) <= aware(load.delivery_by); delayed += aware(trip.completed_at) > aware(load.delivery_by)
        elif trip.status not in {"cancelled", "completed"} and datetime.now(timezone.utc) > aware(load.delivery_by): delayed += 1
    status_counts = lambda values: dict(sorted({status: sum(item.status == status for item in values) for status in {item.status for item in values}}.items()))
    category_costs = defaultdict(Decimal)
    for item in approved_expenses: category_costs[item.category] += money(item.actual_amount)
    ageing = {"current": Decimal("0.00"), "1_30_days": Decimal("0.00"), "31_60_days": Decimal("0.00"), "over_60_days": Decimal("0.00")}
    today = datetime.now(timezone.utc)
    for item in invoices:
        balance = money(item.balance_due)
        if balance <= 0: continue
        days = (today - aware(item.due_at)).days if item.due_at and aware(item.due_at) < today else 0
        ageing["current" if days == 0 else "1_30_days" if days <= 30 else "31_60_days" if days <= 60 else "over_60_days"] += balance
    trend = defaultdict(lambda: {"loads": 0, "completed_trips": 0, "revenue": Decimal("0.00"), "cost": Decimal("0.00")})
    daily = end - start <= timedelta(days=45)
    bucket = lambda value: aware(value).strftime("%Y-%m-%d" if daily else "%Y-%m")
    for item in loads: trend[bucket(item.pickup_at)]["loads"] += 1
    for item in completed: trend[bucket(item.completed_at or item.scheduled_date)]["completed_trips"] += 1
    for item in invoices:
        load = load_map.get(item.load_id)
        if load: trend[bucket(load.pickup_at)]["revenue"] += money(item.subtotal)
    trip_map = {item.id: item for item in trips}
    for item in approved_expenses:
        trip = trip_map.get(item.trip_id); load = load_map.get(trip.load_id) if trip else None
        if load: trend[bucket(load.pickup_at)]["cost"] += money(item.actual_amount)
    trend_rows = [{"period": key, **value, "profit": value["revenue"] - value["cost"]} for key, value in sorted(trend.items())]
    customers = []
    for customer_id_value in sorted({item.customer_id for item in loads}):
        customer_loads = [item for item in loads if item.customer_id == customer_id_value]; ids = {item.id for item in customer_loads}
        customer_invoices = [item for item in invoices if item.load_id in ids]; customer_trips = [item for item in trips if item.load_id in ids]; customer_trip_ids = {item.id for item in customer_trips}
        customer_cost = sum((money(item.actual_amount) for item in approved_expenses if item.trip_id in customer_trip_ids), Decimal("0.00")); customer_revenue = sum((money(item.subtotal) for item in customer_invoices), Decimal("0.00"))
        customers.append({"customer_id": customer_id_value, "customer_name": customer_map.get(customer_id_value).name if customer_map.get(customer_id_value) else "Unknown", "loads": len(customer_loads), "completed_trips": sum(item.status == "completed" for item in customer_trips), "revenue": customer_revenue, "cost": customer_cost, "profit": customer_revenue - customer_cost, "outstanding": sum((money(item.balance_due) for item in customer_invoices), Decimal("0.00"))})
    driver_rows = []
    for key in sorted({item.driver_id for item in trips if item.driver_id}):
        values = [item for item in trips if item.driver_id == key]; done = [item for item in values if item.status == "completed"]
        driver_rows.append({"driver_id": key, "driver_name": driver_map.get(key).name if driver_map.get(key) else "Unknown", "trips": len(values), "completed": len(done), "completion_rate": round(len(done) / len(values) * 100, 1) if values else 0, "distance_km": round(sum(item.distance_km or 0 for item in done), 1)})
    vehicle_rows = []
    for key in sorted({item.vehicle_id for item in trips if item.vehicle_id}):
        values = [item for item in trips if item.vehicle_id == key]; done = [item for item in values if item.status == "completed"]
        vehicle_rows.append({"vehicle_id": key, "registration_number": vehicle_map.get(key).registration_number if vehicle_map.get(key) else "Unknown", "trips": len(values), "completed": len(done), "distance_km": round(sum(item.distance_km or 0 for item in done), 1)})
    trip_rows = []
    expense_by_trip = defaultdict(Decimal)
    for item in approved_expenses: expense_by_trip[item.trip_id] += money(item.actual_amount)
    invoice_by_load = {item.load_id: item for item in invoices}
    for trip in trips:
        load = load_map.get(trip.load_id); invoice = invoice_by_load.get(trip.load_id); trip_revenue = money(invoice.subtotal) if invoice else Decimal("0.00"); cost = expense_by_trip[trip.id]
        trip_rows.append({"trip_id": trip.id, "load_id": trip.load_id, "load_reference": load.reference_number if load else None, "customer_name": customer_map.get(load.customer_id).name if load and customer_map.get(load.customer_id) else trip.customer_name, "driver_name": driver_map.get(trip.driver_id).name if driver_map.get(trip.driver_id) else None, "vehicle": vehicle_map.get(trip.vehicle_id).registration_number if vehicle_map.get(trip.vehicle_id) else None, "scheduled_date": trip.scheduled_date, "status": trip.status, "revenue": trip_revenue, "cost": cost, "profit": trip_revenue - cost})
    return {"filters": {"start_date": start, "end_date": end}, "summary": {"loads": len(loads), "trips": len(trips), "completed_trips": len(completed), "completion_rate": round(len(completed) / len(trips) * 100, 1) if trips else 0, "on_time": on_time, "delayed": delayed, "revenue": revenue, "invoiced_total": invoiced_total, "collected": collected, "outstanding": outstanding, "approved_expenses": actual_cost, "profit": profit, "margin_percent": round(float(profit / revenue * 100), 2) if revenue > 0 else None, "pending_expense_approvals": sum(item.status == "submitted" for item in expenses)}, "load_statuses": status_counts(loads), "trip_statuses": status_counts(trips), "expense_categories": [{"category": key, "amount": value} for key, value in sorted(category_costs.items())], "invoice_ageing": ageing, "trend": trend_rows, "customers": sorted(customers, key=lambda item: item["revenue"], reverse=True), "drivers": sorted(driver_rows, key=lambda item: item["completed"], reverse=True), "vehicles": sorted(vehicle_rows, key=lambda item: item["trips"], reverse=True), "trips": trip_rows}


@api_router.get("/reports/overview")
def reports_overview(start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, customer_id: Optional[str] = None, driver_id: Optional[str] = None, vehicle_id: Optional[str] = None, load_status: Optional[str] = None, invoice_status: Optional[str] = None, expense_category: Optional[str] = None, auth: AuthContext = Depends(require_permission("reports.read")), db: Session = Depends(get_db)):
    return build_report(db, auth, start_date, end_date, customer_id, driver_id, vehicle_id, load_status, invoice_status, expense_category)


@api_router.get("/reports/export.csv")
def export_report_csv(report_type: str = "trips", start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, customer_id: Optional[str] = None, driver_id: Optional[str] = None, vehicle_id: Optional[str] = None, load_status: Optional[str] = None, invoice_status: Optional[str] = None, expense_category: Optional[str] = None, auth: AuthContext = Depends(require_permission("reports.read")), db: Session = Depends(get_db)):
    report = build_report(db, auth, start_date, end_date, customer_id, driver_id, vehicle_id, load_status, invoice_status, expense_category)
    datasets = {"trips": report["trips"], "customers": report["customers"], "drivers": report["drivers"], "vehicles": report["vehicles"], "trend": report["trend"]}
    if report_type not in datasets: raise HTTPException(status_code=400, detail="Unsupported export type")
    rows = datasets[report_type]; output = io.StringIO(newline=""); fields = list(rows[0].keys()) if rows else ["message"]
    writer = csv.DictWriter(output, fieldnames=fields); writer.writeheader()
    if rows: writer.writerows(rows)
    else: writer.writerow({"message": "No data for selected filters"})
    filename = f"bookmyload-{report_type}-{datetime.now(timezone.utc).date().isoformat()}.csv"
    return Response(content="\ufeff" + output.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@api_router.post("/ai/insights", response_model=AIInsightResponse)
def get_ai_insights(request: AIInsightRequest, auth: AuthContext = Depends(require_permission("reports.read")), db: Session = Depends(get_db)):
    stats = get_dashboard_stats(auth, db)
    insights = []
    if stats.pending_maintenance: insights.append(f"Prioritize the {stats.pending_maintenance} vehicle(s) awaiting maintenance.")
    if stats.available_vehicles > stats.available_drivers: insights.append("Driver availability is limiting usable fleet capacity; review rosters and leave schedules.")
    if stats.active_trips and not stats.available_vehicles: insights.append("Fleet utilization is at capacity; consolidate loads or schedule new work after active trips finish.")
    if not insights: insights.append("Capacity is balanced. Review upcoming trips and group nearby destinations to reduce empty kilometres.")
    return AIInsightResponse(insight=" ".join(insights), generated_at=datetime.now(timezone.utc))


@api_router.get("/audit-events")
def get_audit_events(auth: AuthContext = Depends(require_permission("organization.manage")), db: Session = Depends(get_db)):
    values = db.scalars(select(orm.AuditEvent).where(orm.AuditEvent.organization_id == auth.organization.id).order_by(orm.AuditEvent.created_at.desc()).limit(200)).all()
    return [{"audit_id": x.id, "user_id": x.user_id, "action": x.action, "entity_type": x.entity_type, "entity_id": x.entity_id, "details": json.loads(x.details) if x.details else None, "created_at": x.created_at} for x in values]


@api_router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(select(1))
    return {"status": "healthy", "service": "BookMyLoad API", "database": "connected"}


@api_router.get("/")
def root():
    return {"message": "Welcome to BookMyLoad API", "version": "2.0.0"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=[x.strip() for x in os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if x.strip()],
    allow_methods=["*"], allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
initialize_database()

EMAIL_WORKER_STOP = threading.Event()
EMAIL_WORKER_THREAD = None


def email_worker_loop():
    interval = max(60, int(os.environ.get("REMINDER_SCAN_INTERVAL_SECONDS", "3600")))
    while not EMAIL_WORKER_STOP.is_set():
        try:
            with SessionLocal() as db:
                run_reminder_scan(db); process_email_outbox(db)
        except Exception:
            logger.exception("Email reminder worker failed")
        EMAIL_WORKER_STOP.wait(interval)


@app.on_event("startup")
def start_email_worker():
    global EMAIL_WORKER_THREAD
    if os.environ.get("EMAIL_WORKER_ENABLED", "true").lower() == "true" and (not EMAIL_WORKER_THREAD or not EMAIL_WORKER_THREAD.is_alive()):
        EMAIL_WORKER_STOP.clear(); EMAIL_WORKER_THREAD = threading.Thread(target=email_worker_loop, name="email-reminder-worker", daemon=True); EMAIL_WORKER_THREAD.start()


@app.on_event("shutdown")
def stop_email_worker():
    EMAIL_WORKER_STOP.set()
