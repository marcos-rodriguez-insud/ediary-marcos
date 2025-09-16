e‑Diary (FastAPI + SQLModel)

Overview
- Minimal e‑Diary for clinical trials with Admin and Participant views.
- FastAPI backend with SQLModel (SQLite by default) and static frontend served by FastAPI.

Quickstart
1) Create/activate a Python 3.11+ venv
2) Install deps (uv or pip)
   - Using uv: `uv sync`
   - Using pip: `pip install -e .`
3) Run (option A): `python run.py`
   Run (option B): `uvicorn app.main:app --reload`
4) Open:
   - API docs: http://127.0.0.1:8000/docs
   - UI: http://127.0.0.1:8000/

Configuration
- `DATABASE_URL` (optional): defaults to `sqlite:///./app.db`
- `ADMIN_API_KEY` (optional): defaults to `dev-admin-key` (send as `X-Admin-Key`)

Project Layout
- app/main.py: FastAPI app, routers, static serving, startup
- app/database.py: Engine, session, create_all
- app/models.py: SQLModel tables and Pydantic request/response models
- app/routers/admin.py: Admin APIs (users, questionnaires, assignments, entries)
- app/routers/user.py: Participant APIs (fetch assigned questionnaires, submit entry)
- app/static/: Static UI (`index.html`, `admin.html`, `user.html`)
- frontend/: React Native mobile client (Expo)

Mobile App (React Native)
1) Install Node.js 18+ and pnpm/npm/yarn.
2) `cd frontend` and install deps: `npm install` (or `pnpm install`).
3) Set the backend base URL if not running on the same machine:
   - Expo will read `EXPO_PUBLIC_API_BASE_URL`; default points to `http://localhost:8000` (or `10.0.2.2:8000` on Android emulators).
4) Start Expo: `npm run start`.
5) Launch on your target: press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go.
   - If you hit `EMFILE: too many open files`, raise your file-descriptor limit (`ulimit -n 2048`) or install Watchman (`brew install watchman`) before restarting Expo.


Notes
- This is a minimal scaffold; for production add auth (OAuth/JWT), role‑based access, migrations (Alembic), auditing, validation, and scheduling logic.
 - A demo questionnaire for a vaginal ring clinical trial is seeded from `app/seed/vaginal_ring_questionnaire.json` on startup (idempotent).
