# Local Cashfree settings: 404 diagnosis and fix

Verified locally on 2026-10-30. No VPS, production database, production settings or Live-mode activation was performed.

## Root cause

The dashboard at `http://127.0.0.1:5173/settings` requested `GET /api/admin/settings/cashfree` through Vite's proxy. The proxy targeted port 5080, where `node tools/mock-api/server.mjs` was running. That mock has no Cashfree configuration endpoint and returned HTTP 404 with `{"status":404,"title":"Not found"}`.

The .NET routes were already implemented and registered through `AddControllers` / `MapControllers`:

- `GET /api/admin/settings/cashfree`
- `PUT /api/admin/settings/cashfree`
- `GET /api/admin/settings/cashfree/audit`

The controller inherits staff authorization and requires `settings.manage`. Service-level authorization checks provide a second guard. There was no path or HTTP-method mismatch; the wrong backend process was receiving the request.

## Running local services

| Component | Address |
|---|---|
| Dashboard | `http://127.0.0.1:5173/settings` |
| Real .NET API | `http://127.0.0.1:5081` |
| API health | `http://127.0.0.1:5081/health` |
| API Swagger | `http://127.0.0.1:5081/swagger` |
| Storefront | `http://127.0.0.1:3000` |
| Isolated PostgreSQL | `127.0.0.1:55432`, database `buildmate_local` |

The existing PostgreSQL service on 5432 and mock process on 5080 were left intact. Neither is the payment-settings backend. The real application uses a **new, separate local database**; existing orders and data were not reset, copied or deleted. Demo data was not seeded into the new database.

`tools/start-local-real-api.ps1` uses the installed PostgreSQL binaries at `E:\Psql\bin` (override with `-PostgresBin`) and the workspace .NET 8 SDK. It initializes only a missing isolated cluster, reuses the database on subsequent runs, builds the current API, and restarts only its recorded API process. It refuses to regenerate encryption keys if an existing cluster has lost its key file.

Local database/JWT/encryption secrets are randomly generated, persist in `.local-run/real-backend/server-secrets.dpapi`, and are encrypted with Windows DPAPI for the current user. The runtime directory has restricted user ACLs. Cashfree credentials are **not** generated or hardcoded. Once entered in the dashboard, Cashfree credentials are encrypted by the backend in PostgreSQL. Retain both this local data directory and its protected key file; do not copy the DPAPI file to another Windows account and expect it to decrypt.

To restart the real API from the project root:

```powershell
./tools/start-local-real-api.ps1
```

Start the dashboard with `npm run dev` in `admin`, and the storefront with `npm run dev` in `storefront`, if they are not already running. Their gitignored `.env.development.local` files point to `http://127.0.0.1:5081`. Vite now reads proxy settings from local environment files as well as process environment variables. A process-level `VITE_API_PROXY` explicitly overrides the file; remove stale shell overrides before starting it.

## Sandbox entry

Sign out of any old mock session and sign in to the real API with the local development administrator: `admin@buildmate24x7.in` / `Admin@12345`. These are the repository's existing development login values, not Cashfree credentials.

Under Store settings → Cashfree Payment Gateway:

1. Keep **Test Mode** selected.
2. Enter the Test Client ID and Test Client Secret directly in the dashboard.
3. Select **Activate dashboard settings** and save to use the validated pair for new Sandbox payments.
4. Reload: the inputs remain blank, the configured indicator remains, and the effective mode remains Sandbox.

Live credentials are not available and Live Mode must remain inactive. An incomplete Live configuration cannot be activated. No production Cashfree authentication or transactions were attempted during this fix.

The local Sandbox configuration now accepts an HTTP loopback **return URL** and an omitted webhook URL. Payment confirmation still verifies the order server-to-server. An actual remote webhook requires a public reachable endpoint; a loopback webhook URL is rejected. Live activation still requires both public HTTPS callback URLs. No publicly reachable webhook tunnel has been created.

## Database migration

There is no new Cashfree schema migration: the module uses private namespaced records in the existing `settings` table. The fresh isolated local database was initialized by the existing development `EnsureCreated` startup path. Its `settings` table was verified. No migration was applied to the pre-existing PostgreSQL instance or production.

## Verification

- Original proxied request: HTTP 404 from the Node mock.
- Fixed unauthenticated request: HTTP 401 from Kestrel, as expected.
- Authenticated GET through the dashboard proxy: HTTP 200.
- Authenticated audit endpoint: HTTP 200.
- Malformed credentials PUT: HTTP 400; not persisted.
- PUT of non-secret, inactive Sandbox setup: HTTP 200; revision persisted in PostgreSQL.
- Real browser navigation and reload: HTTP 200, Test Mode displayed, no “Not found”, no saved credentials in inputs or response DTOs.
- Swagger confirms GET/PUT/audit routes in the running .NET application.
- Storefront proxy reaches the same Kestrel backend.
- Full backend suite: **83 passed, 0 failed, 0 skipped**, including the previously skipped PostgreSQL integration tests against disposable databases in the isolated cluster.
- Browser checkout SDK tests: **6 passed**; they verify backend-selected modes without making real payments.
- Admin TypeScript check passed.

Run `node tools/test-local-cashfree-endpoints.cjs` for real local HTTP/browser checks. It never supplies real Cashfree keys or activates a mode. The older `test-cashfree-dashboard.cjs` uses intercepted test responses and is not evidence of real backend connectivity.

**Pending user action:** valid Sandbox credentials have not been supplied to the agent; the owner will enter them directly in the dashboard. Successful merchant credential validation, a real Sandbox payment and its provider callback therefore remain acceptance checks after that entry. Live credential saving and Live activation were intentionally not attempted. Existing automated credential/mode tests use fake provider responses in isolated test fixtures, not a production fallback.

Changed files for this fix:

- `admin/vite.config.ts`
- `admin/.env.development.local` (local, gitignored)
- `admin/src/components/CashfreeSettings.tsx`
- `storefront/.env.development.local` (local, gitignored)
- `api/src/BuildMate.Services/Payments/Cashfree.cs`
- `api/tests/BuildMate.Tests/CashfreeSettingsTests.cs`
- `tools/start-local-real-api.ps1`
- `tools/test-local-cashfree-endpoints.cjs`
- This report.

See `CASHFREE_CONFIGURATION.md` for the underlying encryption, payment binding, deployment and rollback design.
