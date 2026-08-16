"""Migrate the prototype JSON collections into organization-owned SQL tables.

Run once after ``alembic upgrade head``. The migration is idempotent by entity
ID and leaves the legacy ``documents`` table untouched for rollback/reference.
"""

import json
from datetime import datetime

from sqlalchemy import inspect, select, text

import orm_models as orm
from application import new_id, unique_slug
from persistence import engine, initialize_database, session_scope


COLLECTION_MODELS = {
    "vehicles": (orm.Vehicle, "vehicle_id"),
    "drivers": (orm.Driver, "driver_id"),
    "trips": (orm.Trip, "trip_id"),
    "pre_trip_checks": (orm.PreTripCheck, "check_id"),
}

DATE_FIELDS = {
    "last_maintenance", "next_maintenance", "created_at", "license_expiry",
    "scheduled_date", "started_at", "completed_at", "checked_at",
}


def parse_dates(document):
    for field in DATE_FIELDS:
        value = document.get(field)
        if isinstance(value, str) and value:
            document[field] = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return document


def migrate():
    initialize_database()
    if "documents" not in inspect(engine).get_table_names():
        print("No legacy documents table found; nothing to migrate.")
        return

    with session_scope() as db:
        organization = db.scalar(select(orm.Organization).order_by(orm.Organization.created_at))
        if not organization:
            organization = orm.Organization(
                id=new_id("org"), name="BookMyLoad",
                slug=unique_slug(db, "BookMyLoad"), organization_type="operator",
            )
            db.add(organization)
            db.flush()

        rows = db.execute(text("SELECT collection, document FROM documents ORDER BY row_id")).all()
        migrated = 0
        for collection, raw_document in rows:
            mapping = COLLECTION_MODELS.get(collection)
            if not mapping:
                continue
            model, legacy_id_field = mapping
            document = parse_dates(json.loads(raw_document))
            entity_id = document.pop(legacy_id_field, None)
            document.pop("_id", None)
            if not entity_id or db.get(model, entity_id):
                continue
            valid_columns = {column.name for column in model.__table__.columns}
            values = {key: value for key, value in document.items() if key in valid_columns}
            db.add(model(id=entity_id, organization_id=organization.id, **values))
            migrated += 1

        print(f"Migrated {migrated} operational record(s) into {organization.name}.")


if __name__ == "__main__":
    migrate()
