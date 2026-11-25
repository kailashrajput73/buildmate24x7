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

## Phase 2 — Folder management (2026-11-25)

Status: implemented and verified locally.

- Added the PostgreSQL `folders` table with UUID hierarchy, normalized sibling names, soft deletion, creator/timestamps, and persisted display order in Alembic migration `0002_folders`.
- Added authenticated folder list/create/update/delete/reorder endpoints. Folder moves reject self/descendant cycles; duplicate sibling names are case-insensitive; delete rejects folders with active subfolders. Writes are serialized to protect hierarchy integrity.
- Added nested folder manager to the dashboard: create, rename/move, search, direct image/subfolder counts, sibling up/down ordering, and delete confirmation.
- `image_count` is currently zero because asset storage is deliberately out of scope for this phase.
- Added an isolated Compose test profile using SQLite. `docker compose --profile test -p buildmate-image-cloud run --build --rm tests` passed: 10 tests.
- Local PostgreSQL migration advanced to `0002_folders`; API and dashboard returned healthy and HTTP 200 respectively. A cleanup-safe smoke test against the live PostgreSQL-backed API passed for nested creation/counts, cycle rejection, and deletion.
- Dashboard production build passed in Docker: TypeScript check plus Vite bundle (30 modules transformed).

### Local verification recovery note

During the first Compose rebuild, the API service briefly used the Dockerfile's test stage as its default target. That caused the test suite to drop/recreate the local Phase 1 auth tables. Inspection showed one bootstrap administrator and no folders; the mistakenly created empty folder table was removed and migration `0002_folders` then applied normally. Compose now explicitly builds the API from the `runtime` target, and the test profile uses isolated SQLite. The local administrator is seeded from `.env`; any prior local password change or active session was reset, so sign in with the current bootstrap password from `.env`.

Local verification only; no VPS deployment or existing BuildMate service was changed.

## Phase 3 — Image upload (2026-11-25)

Status: implementation complete; verification recorded below.

- Added migration `0003_assets` with asset and immutable initial-version metadata. Original files are stored outside the web root in a separate persistent Compose volume using server-generated UUID keys.
- Added an admin upload panel with multi-select and drag/drop, target-folder selection, optional product code, byte progress, per-file outcomes, stable original links, duplicate warnings, and retry of failed files. Added authenticated multipart single/bulk upload at `POST /api/v1/uploads` with batch-level or per-file optional product metadata. Each file streams to private temporary storage, enforces configurable byte and pixel limits, is decoded to validate actual JPEG/PNG/WebP/AVIF content, is hashed, and is atomically moved to originals. Original bytes are not transformed.
- Per-file outcomes retain successful uploads if another file fails. Identical SHA-256 content raises an advisory duplicate warning; each upload receives a distinct permanent UUID. Asset and first-version metadata commit alongside storage placement; failed registration cleans up the placed file.
- Added stable `/original/{uuid}.{format}` URLs and safe original retrieval headers. `IMAGE_CLOUD_CDN_ORIGIN` controls the returned origin. Delivery is currently hosted by the API process; the separate CDN deployment topology is not implemented in this phase.
- Connected Phase 2 folder image counts to active assets and updated the dashboard copy to describe the count behavior.
- Added isolated test coverage for authentication, content sniffing despite spoofed extension/MIME, metadata, originals/URL, duplicate warnings, partial bulk failure, and folder counts.

### Phase 3 verification

- Isolated Compose SQLite test profile: `16 passed, 1 warning` (Starlette TestClient deprecation notice).
- API runtime and dashboard production images built. Dashboard TypeScript check and Vite build passed (31 modules transformed).
- Local API and dashboard containers started; `/health/live` returned `{"status":"ok"}`, `/health/ready` returned `{"status":"ready"}`, and dashboard returned HTTP 200.
- PostgreSQL migration advanced to `0003_assets`; test runner remained on isolated SQLite and did not access the project PostgreSQL volume.
- Local only. Public original retrieval currently runs in the API container; a separately deployed CDN service and VPS setup remain outside this phase.

No VPS deployment, BuildMate integration, image-library browser, transformations, or optimizations were implemented.
