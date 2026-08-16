# BookMyLoad

A fleet and logistics management application with a React frontend, FastAPI
backend, Google Sign-In, organization-based access control, and SQLAlchemy
persistence. Local development uses SQLite; shared and production environments
can use PostgreSQL through `DATABASE_URL`.

The public landing page has a responsive premium redesign with an original
project-owned logistics hero image, mobile navigation, product/workflow
storytelling, a representative operations preview, clear authentication calls
to action, and accessible contact links. The authenticated workspace carries
the same identity through a responsive navigation shell, warm light content
surfaces, redesigned notifications, a real-data command dashboard, consistent
cards/forms/tables across operations modules, an updated sign-in dialog, and a
mobile-focused driver workspace treatment.

## Load-to-trip operations

The Loads workspace supports the full operational chain: create customers and
their locations, optionally register transporters, progress a load through
Draft → Submitted → Approved → Scheduled, and allocate an available driver and
capacity-compatible vehicle. Allocation creates one linked assigned trip.
Starting and completing that trip automatically moves the load to In Execution
and Delivered; an operator then closes the commercial record. All operations
are organization-scoped, role-protected, and audited.

## Driver execution workspace

An owner or operations admin can open **Drivers**, choose **Invite to driver
app**, and enter the Google email belonging to that driver. After signing in,
the driver is routed to `/driver` and can see only trips assigned to the linked
driver profile. The driver must accept the assignment and pass tyres, brakes,
lights, mirrors, and document checks before starting. Ordered execution
milestones and proof of delivery (recipient plus OTP, signature, or photo) are
required before completion. Migration `20260810_0003` adds the linkage, trip
events, and delivery evidence fields.

## Live tracking

During an in-progress trip, the driver workspace uses browser geolocation to
send sampled GPS points. The Live Tracking page uses OpenStreetMap and Leaflet
to show current vehicle markers, travelled history, pickup/destination
geofences, GPS accuracy, speed, last-update age, and stale/no-signal alerts.
Geofences suggest milestones within 500 metres but never confirm them without
the driver. New customer locations accept optional latitude/longitude values.
Migration `20260810_0004` adds organization-scoped trip location history.

Customer locations now use an interactive OpenStreetMap picker instead of
manual coordinates. Users can run an explicit address search, choose a result,
click/drag the marker, or use the browser's current position. Forward and
reverse geocoding are proxied through the backend with caching, a global
one-request-per-second limit, an identifying User-Agent, and configurable
`GEOCODING_BASE_URL`. The public Nominatim endpoint is intended for development
and moderate testing; production should configure a managed or self-hosted
provider.

## Documents, compliance and notifications

The Compliance workspace supports PDF/image uploads for driver licences,
identity/medical records, and vehicle registration, insurance, fitness,
pollution, and permit documents. Files are limited to 5 MB, organization
scoped, reviewed as pending/verified/rejected, and classified as valid,
expiring within 30 days, or expired. Expired/rejected critical documents and
expired driver licences block trip allocation. The header notification center
reports assignments, failed inspections, uploaded documents, and completed
deliveries. Migration `20260810_0005` adds document and notification storage.

## Quotations, invoices and payments

The Finance workspace connects the commercial lifecycle to each load. Owners
and operations admins can create an itemized quotation, mark it sent, and
record customer acceptance. An accepted quotation becomes the load's quoted
amount. After proof of delivery moves the load to Delivered, a draft invoice
can be generated from the accepted quotation (or a manual subtotal), issued,
and settled with one or more manually recorded cash, bank transfer, UPI,
cheque, or other payments. Partial payments, balances, due dates, overdue
display, tenant isolation, audit events, and notifications are included. No
paid payment gateway is required. Migration `20260810_0006` adds the commercial
tables.

## Trip costs and profitability

The Trip Costs workspace records estimated and actual fuel, toll, parking,
allowance, transporter, loading, unloading, repair, fine, and miscellaneous
costs. Each expense can include vendor details, a reference, and a PDF/image
receipt. Draft expenses are submitted for owner/operations-admin approval;
pending and rejected claims do not reduce realized profit. Profitability uses
pre-tax invoice revenue (falling back to an accepted quotation or load price),
and shows estimated cost, approved actual cost, pending exposure, profit, and
margin for every trip. Migration `20260810_0007` adds expense storage.

## Reporting, analytics and exports

The Reports workspace now uses live tenant data rather than demo charts. It
supports date, customer, driver, vehicle, load-status, invoice-status, and
expense-category filters. KPIs and drill-down tables cover loads, completion,
on-time delivery, pre-tax revenue, collections, outstanding balances, approved
expenses, profit, margin, customer performance, driver performance, vehicle
activity, expense categories, and invoice ageing. The active trip, customer,
driver, vehicle, or trend table can be exported to UTF-8 CSV. The print layout
can be saved as PDF from the browser, using the exact same filtered dataset.

## Email notifications and scheduled reminders

Organization owners and operations admins can configure email behavior from
**Settings → Email notifications & reminders**. Transactional in-app events can
also queue email, while the background worker checks invoice due dates,
compliance expiry, delayed loads, and pending expense approvals. A durable
outbox records queued, sent, retry, and failed deliveries; retry attempts use
increasing delays and reminder deduplication prevents repeated hourly emails.

Email delivery is provider-neutral and uses SMTP. Configure these backend
environment values for Gmail SMTP, the client's mail host, Amazon SES, Brevo,
SendGrid SMTP, or another compatible service:

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-user
SMTP_PASSWORD=your-smtp-password-or-app-password
SMTP_FROM_EMAIL=notifications@example.com
SMTP_STARTTLS=true
SMTP_USE_SSL=false
EMAIL_WORKER_ENABLED=true
REMINDER_SCAN_INTERVAL_SECONDS=3600
```

Without SMTP credentials, the feature remains safe to test: messages stay
queued and the Settings page clearly reports that delivery is not configured.
Migration `20260811_0008` adds organization settings and email outbox storage.

## Prerequisites

- Node.js 20 or newer
- Python 3.11 or newer

## Run locally (PowerShell)

Backend:

```powershell
cd C:\Lancee\BML\app\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
.\.venv\Scripts\python.exe -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

Frontend, in a second terminal:

```powershell
cd C:\Lancee\BML\app\frontend
npm install --legacy-peer-deps
npm start
```

Create a Google OAuth 2.0 Web application in Google Cloud, add
`http://localhost:3000` as an authorized JavaScript origin, and set the same
client ID in both configuration files:

```text
backend/.env:  GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
frontend/.env: REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Restart both servers after changing environment variables, then open
http://localhost:3000 and use **Sign in with Google**. Application data is
stored in `backend/data/bookmyload.db`.

## Organizations and roles

The first verified Google user bootstraps the first organization and becomes
its `organization_owner`. After that, new users need an invitation created in
**Dashboard → Settings** for their exact Google email address.

Available roles:

- `organization_owner`: organization and member management plus all operations
- `operations_admin`: fleet, drivers, trips, compliance, finance, dashboard, and reports
- `dispatcher`: manage operations and read finance records
- `viewer`: read-only operational and finance access

Every vehicle, driver, trip, checklist, dashboard statistic, and report query is
scoped to the active organization. Users with multiple memberships can switch
organizations from the dashboard sidebar.

For a shared PostgreSQL database, set for example:

```text
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/bookmyload
```

Then apply migrations with:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
```

To copy records from the prototype `documents` table into the first
organization, run `python migrate_legacy_data.py` once after applying the
migration. The legacy table is retained.

## Development URLs

- Web app: http://localhost:3000
- API: http://localhost:8000/api
- API documentation: http://localhost:8000/docs

For production, use HTTPS, set `COOKIE_SECURE=true`, and configure the production
origin in the Google OAuth client. Optionally restrict access with a
comma-separated `GOOGLE_ALLOWED_DOMAINS` backend environment variable.
