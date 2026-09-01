# Free client-review deployment

This repository is configured for a React static site and a FastAPI free web
service on Render, backed by a free Neon PostgreSQL database.

## Public URLs

- Client application: `https://bookmyload-review.onrender.com`
- Backend API: `https://bookmyload-review-api.onrender.com`

The client should only need the client application URL. Requests under `/api`
are forwarded to the backend by the static-site rewrite in `render.yaml`.

If Render reports that either service name is unavailable, choose two unique
names and update all occurrences of those hostnames in `render.yaml` before
creating the Blueprint.

## 1. Create the database

1. Create a free project at Neon.
2. Open **Connect**, select the pooled connection when available, and copy the
   PostgreSQL connection string.
3. SQLAlchemy uses Psycopg 3 in this project. Change only the URL scheme from
   `postgresql://` to `postgresql+psycopg://` and retain Neon's query parameters.

Example shape (never commit the real value):

```text
postgresql+psycopg://USER:PASSWORD@HOST/DATABASE?sslmode=require&channel_binding=require
```

## 2. Configure Google Sign-In

In the Google Cloud OAuth web client, add this Authorized JavaScript origin:

```text
https://bookmyload-review.onrender.com
```

Use the same OAuth client ID for the frontend and backend when prompted by
Render. A client secret is not used by this application.

## 3. Create the Render Blueprint

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and connect the repository.
3. Render reads `render.yaml` and creates both services.
4. Enter these secret values when prompted:
   - Backend `DATABASE_URL`: the adjusted Neon connection string.
   - Backend `GOOGLE_CLIENT_ID`: the Google OAuth web client ID.
   - Frontend `REACT_APP_GOOGLE_CLIENT_ID`: the same client ID.
5. Apply the Blueprint and wait for both deployments to succeed.

The backend start command applies all Alembic migrations before starting the
API. Subsequent pushes to the connected branch automatically redeploy the
affected service while preserving the same public URLs.

## 4. First review setup

1. Open the client application URL. The first backend request can take about a
   minute because a free Render web service sleeps when idle.
2. Sign in first with the intended owner Google account. On an empty database,
   the first verified user becomes the organization owner.
3. Create non-sensitive sample records for the demo.
4. Invite the client's exact Google email from Settings if they need their own
   login.

## Custom domain later

Attach the desired domain to the Render static site, then update:

1. `CORS_ORIGINS` on the backend to the new HTTPS origin.
2. The Google OAuth Authorized JavaScript origins.
3. The `/api/*` rewrite can remain unchanged because it targets the backend.

Keep the `/api` same-origin proxy: it allows the existing secure session cookie
authentication to work without exposing the backend hostname to the client.

## Operational limits

- This configuration is for review, not production.
- The free backend sleeps after inactivity and has a cold start.
- SMTP delivery is disabled because Render free web services block common SMTP
  ports. In-app notifications remain usable.
- Compliance documents and receipts are stored in PostgreSQL as base64 data, so
  use small demo files to stay within Neon's free storage allowance.
- Never add `.env` files or real credentials back to Git.
