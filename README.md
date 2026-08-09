# BookMyLoad

A self-contained fleet and logistics management application with a React
frontend, FastAPI backend, and a local SQLite data store. It has no external
authentication, database, analytics, or AI-service requirement.

## Prerequisites

- Node.js 20 or newer
- Python 3.11 or newer

## Run locally (PowerShell)

Backend:

```powershell
cd C:\Lancee\BML\app\backend
python -m venv .venv
.\.venv\bin\python.exe -m pip install -r requirements.txt
.\.venv\bin\python.exe -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

Frontend, in a second terminal:

```powershell
cd C:\Lancee\BML\app\frontend
npm install --legacy-peer-deps
npm start
```

Open http://localhost:3000. The first **Get Started** or sign-in action creates
a local administrator session. Application data is stored in
`backend/data/bookmyload.db`.

## Development URLs

- Web app: http://localhost:3000
- API: http://localhost:8000/api
- API documentation: http://localhost:8000/docs

Local authentication is intended for development and trusted private networks.
Configure a production identity provider before publishing the application.
