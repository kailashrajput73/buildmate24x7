# Codex progress

## Phase 0 — specification and architecture (2026-11-24)

Completed. See the product, architecture, schema, API, UI, security, deployment, and migration documents in this directory. Initial environment inspection was limited to the local Windows checkout; the target VPS was not accessible. No existing BuildMate application or service was modified.

## Phase 1 — Foundation (2026-11-24)

Status: implementation complete. Dashboard production build passed and the local Compose stack has now been built and started. The backend test suite remains unrun.

Implemented inside `Image-buildmate24x7/`:

- React/Vite/TypeScript dashboard with sign-in, session display/sign-out, password change, and API/database health indicator.
- FastAPI application with separate liveness and readiness endpoints, CORS allowlist, API docs disabled by default, and login rate limiting.
- PostgreSQL 16 Compose service, private Compose network, named DB volume, migration-driven users/auth_sessions tables, and DB health check. The DB has no published port.
- Bootstrap administrator created only when absent; Argon2id password hashes; short-lived signed bearer tokens backed by revocable database sessions; login, current-user, logout, and password-change endpoints. Password changes revoke all active sessions.
- Independent API/dashboard container health checks and loopback-only host bindings.
- Focused backend tests for health, invalid/missing credentials, login/current-user/logout, and password-change revocation.

No image upload, asset, folder, storage, optimization, delivery, or BuildMate integration features were implemented.

### Verification results

- Dashboard: `npm ci --offline --no-audit --no-fund` passed using the local dependency cache; `npm run build` passed (TypeScript project build and Vite production bundle; 29 modules transformed).
- Docker Compose: configuration validated with `.env.example`; API, dashboard, and PostgreSQL images built and local stack started successfully.
- Runtime: all three containers report healthy; `/health/live` returned `{"status":"ok"}`, `/health/ready` returned `{"status":"ready"}`, and the dashboard returned HTTP 200.
- Backend tests: added under `backend/tests/`; not run from the host because PowerShell reports `python` is not recognized. They can be run in a future test-runner container.
- No target VPS deployment or production verification was performed.

### Local verification commands

From this project directory, after installing Docker Compose v2 and replacing local `.env` values:

```powershell
docker compose -p buildmate-image-cloud up -d --build
docker compose -p buildmate-image-cloud ps
Invoke-RestMethod http://localhost:8000/health/live
Invoke-RestMethod http://localhost:8000/health/ready
```

Backend test command from `backend/`: `python -m pip install -r requirements-dev.txt` then `python -m pytest -q`. Dashboard command from `dashboard/`: `npm ci` then `npm run build`.
