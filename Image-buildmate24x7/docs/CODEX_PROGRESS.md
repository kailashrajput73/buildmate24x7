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

### Correct local Compose command

The parent BuildMate repository has its own Compose file. Image Cloud now uses the distinct project name `buildmate-image-cloud-app` and retains its existing `buildmate-image-cloud_image_cloud_db` and `buildmate-image-cloud_image_cloud_originals` volumes. Run all Image Cloud commands from `Image-buildmate24x7/` (or pass that directory's `.env` explicitly):

```powershell
Set-Location C:\Users\pc\Desktop\buildmate24x7\Image-buildmate24x7
docker compose --env-file .env up -d --build
docker compose --env-file .env ps
```

Do not use the old `-p buildmate-image-cloud` command from the parent directory; that selects the parent BuildMate Compose project. A final test rerun after this Compose-name update could not start because Docker Desktop's engine pipe was unavailable. The 16-test SQLite suite had passed immediately before the Compose-only isolation update.

No VPS deployment, BuildMate integration, image-library browser, transformations, or optimizations were implemented.

## Phase 4 — Gallery (2026-11-25)

Status: implemented and verified locally.

- Added authenticated asset listing with filename/product/ID search, folder and recursive-folder selection, format/date/dimension/byte filters, deterministic sorting and pagination, asset detail, and editable metadata/folder assignment.
- Added persistent manual image ordering in migration `0004_asset_order` and authenticated reorder API. Dashboard gallery supports grid/list views, selection, large preview/detail panel, filters, sort controls, and manual ordering within a folder.
- Added gallery backend coverage for authenticated upload, search/filter, detail lookup, and metadata edit.
- Verification: isolated SQLite suite passed 17 tests; dashboard TypeScript check and production build passed; API health/readiness and dashboard HTTP 200 passed; local PostgreSQL reached migration `0004_asset_order`.
- No exports, bulk delete, restore, transformations, or VPS deployment were included.
## Phase 5 — Bulk exports (2026-11-25)

Status: implemented and verified locally.

- Added authenticated bulk URL copy and CSV/XLSX export endpoints for selected images and folder scopes (including optional subfolders), with bounded export size and deterministic ordering.
- Exports include asset identity, stable original URL, dimensions, file metadata, product metadata, tags, folder and upload time. Excel URLs are clickable; CSV is UTF-8 with BOM.
- Added gallery controls for copying selected/folder/all URLs and downloading CSV or Excel.
- Verification: 18 isolated SQLite tests passed; dashboard Docker production build passed. No VPS deployment.

## Phase 6 — Product mapping (2026-11-25)

Status: implemented and verified locally.

- Reused the optional product code, product name, brand, family, and tags fields already registered on assets; existing upload and metadata edit flows preserve them.
- Added authenticated /api/v1/exports/product-mapping XLSX export for selected assets or folders, with stable original URLs, hyperlink cells, deterministic order, and catalog-matching columns.
- Added a Product mapping action to the gallery and documented the export contract.
- Verification: 19 isolated SQLite tests passed (one Starlette deprecation warning); dashboard TypeScript and production build passed. No VPS deployment.

## Phase 7 — Optimization (2026-11-25)

Status: implemented and verified locally.

- Added bounded derivative generation for thumbnail (150), small (300), medium (600), large (1080) presets, with WebP, AVIF, JPEG, and PNG output options.
- Derivative cache keys include original SHA-256 and normalized transform options. Generated files are atomically written under disposable cache/; original storage and bytes are unchanged.
- Added optional imgproxy upstream integration using IMAGE_CLOUD_IMGPROXY_BASE_URL; configured deployments redirect compatible media requests to the upstream. Without it, Pillow generates derivatives locally.
- Verification: 20 isolated SQLite tests passed (one Starlette deprecation warning); production API image build passed. No VPS deployment.

## Phase 8 — Production readiness (2026-11-26)

Status: implementation complete locally; production activation requires target-host and Cloudflare access.

- Added API trusted-host allowlisting, security response headers, no-store health/API headers, plus upload, export, and URL-copy rate limits.
- Added Cloudflare DNS/TLS/cache and origin firewall runbook; IMAGE_CLOUD_ALLOWED_HOSTS is configurable. Immutable original/media paths are the only recommended cacheable paths.
- Added PostgreSQL/original backup script with checksums, disk/inode threshold monitor, and isolated temporary-database restore script that verifies registered active originals. Cache is excluded from backups; backup directory is git-ignored.
- Verification: 21 backend tests passed in isolated SQLite (one Starlette deprecation warning). Production Cloudflare rules, VPS backup execution, disk alerts, and restore drill remain unverified because no production host/zone credentials were available.

## SaaS UI redesign (2026-11-26)

Status: implemented and locally smoke-checked.

- Replaced the stacked administration page with a responsive dark SaaS shell, grouped sidebar navigation, workspace selector foundation, breadcrumbs, global asset search, upload action, account control, and separate Dashboard, Assets, Folders, Uploads, and Settings views. Unimplemented modules are disabled and labeled planned.
- Dashboard uses real asset/folder APIs and reports storage unavailable when the loaded page cannot represent the full library. Recently accessed folders/activity are explicitly marked unavailable.
- Added recent image previews, bulk folder movement, detail drawer metadata and URL copy actions. Preview URLs are normalized to same-origin /original and /media proxy paths. Nginx now proxies these to the API and CSP permits the configured CDN host.
- Verification: dashboard TypeScript/Vite production build passed; dashboard and JS bundle returned HTTP 200; image proxy paths reached the API and returned expected 404 for nonexistent UUIDs. Existing backend suite covers uploads, folders, search/filter, exports and metadata. No separate frontend test framework or browser console automation is present; authenticated interactive browser flows were not exercised in this run.
- Planned/disabled: transformation builder/playground, API key management/docs, analytics and storage settings.

## Advanced media library and asset actions (2026-11-26)

Status: implemented locally; awaiting local stack deployment for interactive browser review.

- Replaced the Folders view with a two-panel explorer: searchable, expandable nested tree with counts, root navigation, breadcrumbs, child folders, create/rename/move/delete context actions, and selected-folder asset gallery. Folder moves leave image URLs unchanged. Folder Share remains unavailable because public folder permissions are not configured.
- Added per-asset actions for open/detail, display-name rename, original download, share/copy URL, optimized URL copy, replace, collection membership, and recoverable trash. Replacement uploads reuse image content validation and preserve the permanent asset UUID; each version is stored separately and has a version-specific immutable URL. Legacy original URLs still serve version 1.
- Added multi-select toolbar with select-all, ZIP download (bounded to 100 files/250 MiB), URL copy, metadata export, folder move, collection add, order change, and confirmed soft-delete. Added asset version indicator and retained product metadata/URL detail drawer.
- Added persistent many-to-many collections with create/search, list, view, remove membership, and CSV export. Collection membership is independent of folder placement. Added authenticated Trash view with restore and persisted audit events for asset rename/move/replace/trash/restore operations.
- Added migrations `0005_asset_actions` and `0006_audit_events`.
- Planned/unavailable actions are visibly disabled: transformation editor, access-control configuration (no permission model), image-to-video, generate-from-asset, and automation integrations. No fake processing is exposed.
- Verification: backend suite 23 passed (one Starlette deprecation warning); dashboard Docker production build passed (TypeScript and Vite). Direct `npm` was unavailable on the host, so the container build was used. Folder and asset flows were not browser-driven in this run. No Cloudinary migration was performed.
## Full-screen asset viewer and persistent sessions (2026-11-26)

Status: implementation complete locally; production deployment and interactive browser walkthrough remain outstanding.

- Added a dedicated full-screen asset viewer. Single card clicks toggle selection; double-click and the asset menu Open action open the viewer. Viewer navigation is represented in the existing hash route, preserves gallery state, supports browser Back/Forward and Escape, and closes without re-fetching the gallery.
- Added fit/actual-size controls, zoom, scroll panning, browser full-screen mode, checkerboard transparency background, responsive information tabs, technical analysis, generated derivative URL copy/open actions, and an unavailable Image to Video tab. Metadata comes from asset and version APIs; unknown fields display as unavailable.
- Added authenticated asset-version listing and restore-as-new-version. Restoring never overwrites stored originals or changes the asset ID; the original URL remains version 1 and each subsequent version uses an immutable version-specific URL.
- Persistent login now sets an HttpOnly, SameSite=Lax cookie scoped to `/api/v1`, backed by the existing PostgreSQL session table and random session ID. Logout/password change revoke sessions and clear the cookie. Cookie writes require allowed-Origin validation for CSRF protection. The dashboard restores `/auth/me` before rendering login and stores no token in browser storage. Existing bearer clients and the JSON token response remain compatible; browser sessions default to seven days and are configurable.
- Local `.env` now uses a seven-day session and `IMAGE_CLOUD_AUTH_COOKIE_SECURE=false` for HTTP. Production requires HTTPS, `IMAGE_CLOUD_AUTH_COOKIE_SECURE=true`, the public admin origin in `IMAGE_CLOUD_CORS_ORIGINS`, and a persistent signing secret/database volume.
- Verification: 26 backend tests passed (one upstream Starlette deprecation warning); production dashboard Docker build passed. PostgreSQL Compose startup applied migrations through `0006_audit_events`; API liveness/readiness returned healthy and dashboard returned HTTP 200. Tests cover cookie attributes, cookie session survival across clients, session rotation, CSRF origin rejection, secure-cookie flag, expiry, logout revocation, asset version listing, stable original URLs, and restore-as-new-version. Double-click, keyboard, back/forward, and responsive viewer interactions were not browser-automated in this run.

## Media workspace redesign and hover actions (2026-11-26)

Status: implementation in progress; local production build and regression verification underway.

- Added a narrow global navigation rail and independently collapsible secondary navigation. Secondary navigation visibility, folder tree visibility, and selected folder are persisted across refreshes. Assets and Folders now share the two-panel folder explorer and gallery workspace; retained existing route hashes and existing collection, trash, upload, and account views.
- Added responsive workspace CSS, compact media toolbar, tree panel, folder breadcrumb and counts, cards, and responsive small-screen panel behavior. Folder context menus include folder navigation, create/rename/move/order/delete and URL copy/CSV/XLSX export for this folder or nested contents. Folder copy includes filename, product code, folder path, and original URL; CSV/XLSX exports include computed folder paths with cycle protection.
- Added per-thumbnail hover quick-copy for permanent original URLs with success/error status and supported image actions for open, rename, original download, move, collection membership, validated replace, and recoverable trash. Existing multi-select bulk operations remain available.
- Folder menu provides “Upload images here” through the existing multi-file upload manager and preselects that destination. “Upload entire local folder” is omitted: the current upload API accepts a flat multi-file batch and does not preserve browser directory paths, so exposing it would misrepresent functionality.
- Verification: 26 backend tests passed (one upstream Starlette deprecation warning); the dashboard TypeScript and Vite production build passed in Docker. Tests assert nested CSV and copied folder metadata include `Catalog/Lights`. The dashboard/API/database containers are healthy and the dashboard returns HTTP 200. Windows browser screenshot capture was blocked by the computer-use browser URL policy, so no screenshot is attached and detailed browser-driven interaction review remains outstanding.

## Directory upload and workspace regression follow-up (2026-11-26)

Status: directory upload implementation and automated regression checks complete; manual Windows browser verification blocked by the browser access host.

- Added authenticated `POST /api/v1/uploads/directory` accepting up to 50 files per request plus aligned `webkitRelativePath` values. It rejects absolute paths, traversal, backslashes, colon/alternate-stream syntax, controls, malformed paths, excessive depth, and overlong segments before resolving folder records. It creates or reuses nested folders under root or the selected destination and persists files through the existing original upload pipeline.
- Folder context menus now open Windows' browser directory picker for root or a selected destination. The upload centre reports selected file and directory counts, shows per-file queued/uploading/success/failure/duplicate states, displays overall progress, sends bounded sequential batches paced under the existing API rate limit, and retries failed items only.
- Duplicate bytes remain separate assets with permanent IDs and receive a visible duplicate warning; existing originals are never overwritten. Directory uploads preserve filenames and do not change image URLs or product metadata behavior.
- Added tests for nested hierarchy below an existing destination, original filename/URL access, duplicate warnings, invalid image failures, traversal rejection, and folder/export metadata. Regression suite also covers persistent session behavior, existing upload, URL stability, folder operations, and product mapping.
- Verification: 27 backend tests passed (one upstream Starlette deprecation warning); dashboard TypeScript/Vite production build passed in Docker. API, database, and dashboard Compose services are healthy after rebuild, dashboard responds HTTP 200. Manual interaction testing for navigation, menus, clipboard, exports, viewer, session refresh, file chooser, and downloads could not be completed because Windows browser access reports that the browser access host/URL policy is unavailable. No screenshots were captured.
- Local restart: from `Image-buildmate24x7`, run `docker compose --env-file .env up -d --build`; open `http://localhost:5173`.

## Directory upload 413 diagnosis (2026-11-26)

- User reported that a directory upload completed with no images present. Nginx dashboard logs showed repeated `client intended to send too large body` errors and `413` responses on `POST /api/v1/uploads/directory` for multipart batches from approximately 8 MiB to 73 MiB. These requests were rejected by the reverse proxy before reaching FastAPI, so no assets were registered from those attempts.
- Fixed the `/api/` Nginx body limit to 64 MiB, enough for one configured 50 MiB original plus multipart overhead. Directory batches now split at both 50 files and 40 MiB, while keeping a larger single file by itself; the client reports a clear error on 413 responses.
- Dashboard Docker production build passed and the rebuilt dashboard container restarted. User must select the local directory again because the browser's failed file selection is only in memory and was not stored server-side.

## Folder create 403 diagnosis (2026-11-26)

- Latest API and dashboard logs show `POST /api/v1/folders` returning 403 while authenticated reads and `/auth/me` returned 200. This was a CSRF check rejecting same-origin cookie-authenticated POST requests when the browser omitted the `Origin` header.
- Updated CSRF validation to accept a missing `Origin` only when the browser-controlled `Sec-Fetch-Site` is exactly `same-origin`. Explicit cross-site origins and cross-site fetch metadata remain rejected. Updated `docs/SECURITY.md`.
- Added a regression test that proves cross-site folder creation is denied and a same-origin fetch-metadata folder creation succeeds. Backend suite: 28 passed (one upstream deprecation warning). The rebuilt API is running and healthy; reload the dashboard before retrying folder creation.
- Follow-up: recent logs after deployment contain no folder-create POSTs, so no new failure reached this Compose API to classify. Dashboard errors now include the server's response detail/status instead of the generic message. Dashboard rebuilt, served HTTP 200, and is healthy on port 5173.
- Reproduced follow-up: Firefox 161 requests still returned 403 when an explicit browser `Origin` mismatched the API's proxy-reconstructed base URL. CSRF validation now also accepts browser-controlled `Sec-Fetch-Site: same-origin` even when `Origin` is present but mismatched; cross-site origin plus `Sec-Fetch-Site: cross-site` remains denied. Added regression coverage for the mismatch. Backend suite: 28 passed; updated API image deployed and healthy.

## Context menu outside-click dismissal (2026-11-27)

- Root cause: image and folder menus only registered an Escape key listener. Neither menu had any outside-pointer detection. Menus render inline, so their menu subtree and trigger can be checked directly without portal coordination.
- Added capture-phase `pointerdown` handling while a menu is open in both Gallery and FolderExplorer. Pointer events cover mouse and touch. Clicks within the menu (including nested `<details>` submenus) are ignored; the active trigger is exempt so clicking it toggles closed. Clicking a different trigger dismisses the old menu before that trigger's normal click handler opens its menu. Escape and route hash/history navigation close the menu. Listener cleanup runs when the menu closes or its component unmounts.
- Verification: dashboard TypeScript check and Vite production build passed in the Docker build (`36` modules transformed). `git diff --check` passed. Actual browser interactions could not be exercised: the Windows browser access host stopped the CUA session because URL policy enforcement is unsupported for this browser. Docker service inspection also showed PostgreSQL restarting, so the current local app is not in a usable state for manual interaction testing. No unrelated services were restarted.
