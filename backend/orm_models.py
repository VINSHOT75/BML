from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from persistence import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    google_sub: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    picture: Mapped[str | None] = mapped_column(Text, nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(30), default="google")
    is_platform_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    organization_type: Mapped[str] = mapped_column(String(40), default="operator")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "organization_id", name="uq_membership_user_org"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    driver_id: Mapped[str | None] = mapped_column(ForeignKey("drivers.id", ondelete="SET NULL"), nullable=True)
    role: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    role: Mapped[str] = mapped_column(String(40))
    driver_id: Mapped[str | None] = mapped_column(ForeignKey("drivers.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    invited_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[str] = mapped_column(String(80), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class Vehicle(Base):
    __tablename__ = "vehicles"
    __table_args__ = (UniqueConstraint("organization_id", "registration_number", name="uq_vehicle_org_registration"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    registration_number: Mapped[str] = mapped_column(String(80))
    vehicle_type: Mapped[str] = mapped_column(String(80))
    make: Mapped[str] = mapped_column(String(100))
    model: Mapped[str] = mapped_column(String(100))
    year: Mapped[int] = mapped_column(Integer)
    capacity_tons: Mapped[float] = mapped_column(Float)
    fuel_type: Mapped[str] = mapped_column(String(40), default="diesel")
    current_location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="available", index=True)
    last_maintenance: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_maintenance: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_trips: Mapped[int] = mapped_column(Integer, default=0)
    total_km: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Driver(Base):
    __tablename__ = "drivers"
    __table_args__ = (UniqueConstraint("organization_id", "license_number", name="uq_driver_org_license"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    license_number: Mapped[str] = mapped_column(String(100))
    license_expiry: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_contact: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="available", index=True)
    assigned_vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True)
    total_trips: Mapped[int] = mapped_column(Integer, default=0)
    total_km: Mapped[float] = mapped_column(Float, default=0)
    rating: Mapped[float] = mapped_column(Float, default=5.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (Index("ix_trip_org_status", "organization_id", "status"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    load_id: Mapped[str | None] = mapped_column(ForeignKey("loads.id", ondelete="SET NULL"), nullable=True, unique=True)
    origin: Mapped[str] = mapped_column(String(300))
    origin_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    origin_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    destination: Mapped[str] = mapped_column(String(300))
    destination_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    destination_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    cargo_type: Mapped[str] = mapped_column(String(100))
    cargo_weight_tons: Mapped[float] = mapped_column(Float)
    customer_name: Mapped[str] = mapped_column(String(200))
    customer_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    scheduled_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True)
    driver_id: Mapped[str | None] = mapped_column(ForeignKey("drivers.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_duration_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_duration_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    pod_signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    pod_photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    pod_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivered_to: Mapped[str | None] = mapped_column(String(200), nullable=True)
    delivery_otp: Mapped[str | None] = mapped_column(String(12), nullable=True)
    pod_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    pod_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PreTripCheck(Base):
    __tablename__ = "pre_trip_checks"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    trip_id: Mapped[str] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    driver_id: Mapped[str] = mapped_column(ForeignKey("drivers.id"))
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"))
    tires_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    brakes_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    lights_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    mirrors_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    fuel_level: Mapped[str] = mapped_column(String(30), default="full")
    documents_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TripEvent(Base):
    __tablename__ = "trip_events"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    trip_id: Mapped[str] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class TripLocation(Base):
    __tablename__ = "trip_locations"
    __table_args__ = (Index("ix_trip_location_trip_recorded", "trip_id", "recorded_at"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    trip_id: Mapped[str] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    driver_id: Mapped[str] = mapped_column(ForeignKey("drivers.id"), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    accuracy_meters: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed_kph: Mapped[float | None] = mapped_column(Float, nullable=True)
    heading: Mapped[float | None] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class ComplianceDocument(Base):
    __tablename__ = "compliance_documents"
    __table_args__ = (Index("ix_compliance_document_org_expiry", "organization_id", "expires_at"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    entity_type: Mapped[str] = mapped_column(String(20), index=True)
    entity_id: Mapped[str] = mapped_column(String(40), index=True)
    document_type: Mapped[str] = mapped_column(String(50), index=True)
    document_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    file_data: Mapped[str] = mapped_column(Text)
    verification_status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    verified_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notification_user_read", "user_id", "read_at"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    notification_type: Mapped[str] = mapped_column(String(50), index=True)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    entity_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    severity: Mapped[str] = mapped_column(String(20), default="info")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class EmailSettings(Base):
    __tablename__ = "email_settings"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    transactional_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    invoice_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    invoice_days_before_due: Mapped[int] = mapped_column(Integer, default=3)
    compliance_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    compliance_days_before_expiry: Mapped[int] = mapped_column(Integer, default=30)
    delayed_load_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    pending_expense_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    pending_expense_hours: Mapped[int] = mapped_column(Integer, default=24)
    last_scan_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class EmailOutbox(Base):
    __tablename__ = "email_outbox"
    __table_args__ = (Index("ix_email_outbox_status_next", "status", "next_attempt_at"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    recipient_email: Mapped[str] = mapped_column(String(320), index=True)
    recipient_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    subject: Mapped[str] = mapped_column(String(300))
    text_body: Mapped[str] = mapped_column(Text)
    html_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    notification_type: Mapped[str] = mapped_column(String(60), index=True)
    entity_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    dedup_key: Mapped[str | None] = mapped_column(String(300), unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="uq_customer_org_name"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    contact_name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    gst_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    billing_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CustomerLocation(Base):
    __tablename__ = "customer_locations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    address: Mapped[str] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Transporter(Base):
    __tablename__ = "transporters"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="uq_transporter_org_name"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    contact_name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    gst_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    service_areas: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Load(Base):
    __tablename__ = "loads"
    __table_args__ = (Index("ix_load_org_status", "organization_id", "status"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    reference_number: Mapped[str] = mapped_column(String(80))
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"), index=True)
    pickup_location_id: Mapped[str] = mapped_column(ForeignKey("customer_locations.id", ondelete="RESTRICT"))
    delivery_location_id: Mapped[str] = mapped_column(ForeignKey("customer_locations.id", ondelete="RESTRICT"))
    transporter_id: Mapped[str | None] = mapped_column(ForeignKey("transporters.id", ondelete="SET NULL"), nullable=True)
    cargo_type: Mapped[str] = mapped_column(String(100))
    cargo_weight_tons: Mapped[float] = mapped_column(Float)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    pickup_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    delivery_by: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    quoted_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Quotation(Base):
    __tablename__ = "quotations"
    __table_args__ = (
        UniqueConstraint("organization_id", "load_id", name="uq_quotation_org_load"),
        UniqueConstraint("organization_id", "quotation_number", name="uq_quotation_org_number"),
        Index("ix_quotation_org_status", "organization_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    load_id: Mapped[str] = mapped_column(ForeignKey("loads.id", ondelete="RESTRICT"), index=True)
    quotation_number: Mapped[str] = mapped_column(String(80))
    base_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    fuel_surcharge: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    toll_charges: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    handling_charges: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2))
    tax_rate: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("organization_id", "load_id", name="uq_invoice_org_load"),
        UniqueConstraint("organization_id", "invoice_number", name="uq_invoice_org_number"),
        Index("ix_invoice_org_status", "organization_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    load_id: Mapped[str] = mapped_column(ForeignKey("loads.id", ondelete="RESTRICT"), index=True)
    quotation_id: Mapped[str | None] = mapped_column(ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True)
    invoice_number: Mapped[str] = mapped_column(String(80))
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2))
    tax_rate: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    amount_paid: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    balance_due: Mapped[float] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (Index("ix_payment_org_invoice", "organization_id", "invoice_id"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="RESTRICT"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    payment_method: Mapped[str] = mapped_column(String(40), default="bank_transfer")
    reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TripExpense(Base):
    __tablename__ = "trip_expenses"
    __table_args__ = (Index("ix_trip_expense_org_trip_status", "organization_id", "trip_id", "status"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    trip_id: Mapped[str] = mapped_column(ForeignKey("trips.id", ondelete="RESTRICT"), index=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    description: Mapped[str] = mapped_column(String(300))
    estimated_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    actual_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    expense_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    vendor: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    receipt_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    receipt_mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    receipt_file_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    reviewed_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
