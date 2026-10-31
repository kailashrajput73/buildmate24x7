# Cashfree dashboard configuration

Implemented locally; no VPS deployment, production configuration changes, production migrations, real payment creation, or APK rebuild has been performed.

## Architecture and data

Dashboard → Store settings → Cashfree Payment Gateway manages independent Sandbox and Production credentials. Both fields must be supplied to replace a credential pair; omitted pairs are retained. Saved IDs and secrets are never returned, including masked suffixes. The UI clears entered credentials after saving and does not put them in browser storage or React Query mutation caches.

The API requires both a staff account and `settings.manage` permission (or the existing administrator `*` permission). Service methods also enforce authorization. Endpoints:

| Method | Route | Result |
|---|---|---|
| GET | `/api/admin/settings/cashfree` | Revision, activation, selected/effective mode, credential-presence flags only |
| PUT | `/api/admin/settings/cashfree` | Validates, saves, optionally activates; returns the same safe status DTO |
| GET | `/api/admin/settings/cashfree/audit` | Latest 50 audit records, no credentials |

PUT accepts `revision`, `mode` (`sandbox` or `production`), `activate`, `confirmLive`, and optional `sandbox` / `production` objects containing `clientId` and `clientSecret`. This request must use HTTPS outside local development. Never log its body. Live activation requires `confirmLive: true`. Stale revisions receive HTTP 409. Missing, malformed or remotely rejected credentials cannot activate a mode. Validation uses a read-only lookup of a random nonexistent Cashfree order; authentication failures, unexpected responses and network errors fail closed. A structured order-not-found response confirms authentication without creating a payment. Final verification with the merchant's actual keys remains a staging acceptance step.

No schema migration is required. The existing `settings` table has a primary key and unrestricted text value column. Private records use these namespaces:

- `payments:cashfree:state`: activation, optimistic revision and references to credential versions.
- `payments:cashfree:version:<id>`: immutable AES-256-GCM encrypted configuration, including Client ID, secret, environment, API version and callback URLs.
- `payments:cashfree:order:<sha256>`: gateway order ID → immutable credential version reference.
- `payments:cashfree:audit:<id>`: append-only administrator ID, timestamp, action, previous/new effective mode and revision. All records are retained; the API displays the latest 50.

Public store settings still read only the `store` key and do not include payment configuration. Do not add a generic endpoint exposing all settings rows. No orders or existing settings are deleted or rewritten.

## Mode and payment lifecycle

1. New dashboard state defaults to Sandbox and is **inactive**. Existing server `Cashfree:*` configuration continues controlling new payments until explicit activation; an existing production deployment never silently becomes Sandbox.
2. The first successful settings save preserves an encrypted snapshot of the original server configuration for historical, unbound payments. Until activation, new payment bindings snapshot the current server configuration.
3. Activated settings select the saved pair for new payment attempts. Activation cannot be undone by accidentally sending `activate: false`.
4. Each new gateway order ID receives an immutable binding **before** calling Cashfree. That binding commits independently of the checkout transaction, so a timeout/rollback cannot later reuse that ID in another environment. PostgreSQL transaction advisory lock `72424001` serializes binding and configuration changes across API instances. The settings revision prevents stale administrator writes.
5. Checkout responses, including resumed pending sessions, obtain `environment` from the payment's binding. Browser and Android SDK modes use that response. Unknown environments fail instead of silently selecting Sandbox.
6. Verification, refunds and webhook signature checks resolve the original binding. The webhook order ID is used only to select a key; the exact raw body must then pass HMAC verification before any payment changes occur. Existing server-to-server amount/status checks and order locking remain in place.
7. Replacing credentials creates another immutable version. It does not overwrite keys used by existing payment attempts. Keep old Cashfree credentials valid at the provider while old payments/refunds need them. Local retention cannot make a revoked provider key work.

**Historical limitation:** the old Payment schema recorded no environment/account provenance. Unbound historical payments use the server configuration preserved at the first save. Before activation, verify that this matches the account/environment that created existing Cashfree payments. If the deployment previously mixed environments or merchant accounts, reconcile historical gateway IDs and references first; this code cannot reconstruct missing provenance. Do not activate until that review is complete.

Test payments use `https://sandbox.cashfree.com/pg`; Live uses `https://api.cashfree.com/pg`. The existing API version remains `2023-08-01`; this feature does not perform an API-version migration. References: [Cashfree endpoints](https://www.cashfree.com/docs/api-reference/payments/latest/overview), [Get Order authentication](https://www.cashfree.com/docs/api-reference/payments/latest/orders/get-order), [raw-body webhook verification](https://www.cashfree.com/docs/payments/online/webhooks/signature-verification).

## Encryption key management

Provide these **API-server-only** .NET configuration entries through a managed secret store or protected service/container environment:

```text
PaymentEncryption__ActiveKeyId=k1
PaymentEncryption__Keys__k1=<base64 encoding of a cryptographically random 32-byte key>
```

Use the infrastructure secret manager's random-secret generation facility. Do not reuse JWT keys, Cashfree secrets or passwords. Never put key material in source control, the database, dashboard fields, logs, frontend build arguments or `NEXT_PUBLIC_*` / `VITE_*` variables. Restrict access to the API service identity and authorized operators. Database backups and encryption-key backups must be protected separately. All API replicas must receive the same key ring.

The AES-GCM envelope stores only the non-secret key ID, random 12-byte nonce, authentication tag and ciphertext. The immutable version ID is authenticated as associated data. Missing or incorrect keys cause an explicit failure; there is no plaintext-storage fallback.

For rotation, supply a new key under `PaymentEncryption__Keys__k2`, retain `k1`, then change `PaymentEncryption__ActiveKeyId` to `k2`. New versions use `k2`; old versions still decrypt with `k1`. Do not remove old keys while any versions, payment bindings or backups need them. Re-encryption/retirement requires a separate reviewed maintenance operation; this feature deliberately does not delete historical keys or versions.

For Docker Compose, explicitly inject these entries into the **api service** using your secret-management integration or a deployment override; the existing compose file does not automatically forward arbitrary host environment variables. Keep the legacy `Cashfree__Environment`, Client ID/Secret, return URL and webhook URL intact during rollout. No new encryption key is generated or committed by this change.

## Deployment checklist — requires owner approval

1. Back up the database and current application configuration; securely back up the encryption key ring separately. Review historical payment provenance as described above.
2. Deploy to an isolated staging environment first, with a dedicated test database. Install .NET 8 and Node dependencies, run the tests below, and exercise Sandbox checkout, confirmation, webhook, pending-session resume and refund with real **sandbox** credentials.
3. Configure shared server encryption keys and public callback URLs. Ensure request/response body capture is disabled for payment-settings routes in proxies/APM; outgoing credential headers are explicitly redacted and redirects disabled by the named Cashfree HTTP client. Do not enable EF sensitive-data logging.
4. After production approval, coordinate replacement of all API replicas with this version before saving/activating dashboard configuration. Old binaries ignore bindings and must not handle requests after activation. Roll out the admin build and checkout guard changes. There is no SQL migration to run.
5. Leave dashboard settings inactive initially. Confirm the status reports the current production environment unchanged. Save the two credential sets separately; verify the audit trail and both configured indicators. This alone does not change the active environment.
6. Confirm both Cashfree dashboards have the correct webhook URL. Verify public HTTPS return/webhook URLs and provider IP allowlisting. Live credentials must pass the production read-only authentication check.
7. Activate only the intended mode. Live activation requires a separate confirmation; do not select Sandbox on a customer-facing production store for a test. Sandbox success is a test result, not real funds.
8. Verify an older pending payment and any needed historical refunds still use their original configuration after a controlled staging switch. Retain old provider credentials and server encryption keys.

## Rollback

- **Before any dashboard save/activation:** the original environment configuration remains in place, and reverting the code is straightforward.
- **After saving, but before activation:** preserve all private payment rows and encryption keys. New code has begun recording bindings; prefer rolling back only the dashboard UI while retaining the payment resolver. Old backend code does not understand these bindings.
- **After activation or mixed-mode payments:** do **not** revert to the old global-credential backend, restore an old database snapshot, delete bindings/versions, or remove encryption keys. Those actions can break pending payments, webhooks and refunds. Roll back the dashboard UI or forward-fix the backend while retaining the version-aware resolver. If necessary, temporarily disable new checkout at the operational ingress while keeping verification/webhooks/refunds online. An administrator can restore the prior mode for *new* payments through the audited API with validated credentials; existing payments retain their bindings.
- Full rollback to a pre-feature backend requires separately reviewed reconciliation of every retained environment/account and refund obligation. Keep payment history intact throughout.

## Local validation

Results on 2026-10-30: .NET build succeeded; backend suite **75 passed, 7 skipped, 0 failed** (the seven skipped tests are existing PostgreSQL inventory tests). Browser checkout **6 passed**. Headless dashboard interaction and responsive-layout checks passed. Admin typecheck/build and storefront typecheck passed. Existing unrelated backend compiler warnings remain in the sequence SQL helper and quotation controller.

Commands (standard installed SDK, or the workspace-local `.local-tools/dotnet/dotnet.exe`):

```text
dotnet test api/tests/BuildMate.Tests/BuildMate.Tests.csproj
cd admin
npm ci
npm run typecheck
npm run build
cd ../storefront
npm ci
npm run typecheck
cd ..
node tools/test-cashfree-checkout.cjs
```

The backend tests use SQLite in-memory settings and fake Cashfree HTTP responses. They cover saving environments independently, activation/default behavior, both mode switches, credential retention/rotation, both endpoint selections, webhook signatures/tampering, durable pending-payment bindings, legacy fallback, stale revisions, encryption failure, authenticated encryption, no response/log secret leakage, and HTTP 401/403 on actual controller routes. Existing PostgreSQL-specific inventory tests require `BUILDMATE_TEST_DB` and are skipped if absent. The new settings tests do not exercise PostgreSQL advisory-lock concurrency; verify that on staging before rollout.

`tools/test-cashfree-checkout.cjs` tests actual transpiled browser checkout code with a fake SDK, including both modes and pending sessions. `tools/test-cashfree-dashboard.cjs` tests the real local dashboard in headless Edge with intercepted fake payment-settings responses; it checks live confirmation/cancel, independent credential retention, input clearing, switching back, browser-storage exclusion and mobile overflow. It needs local demo API/admin servers and `npm install --prefix .local-tools/browser playwright`. It sends no credentials to Cashfree. Screenshots are under `.local-run/cashfree/`.

The local demo backend intentionally cannot save real payment credentials; use the updated .NET API to use this module. Real Cashfree authentication, payments, webhook delivery, PostgreSQL concurrency and Android device execution are staging/device acceptance checks, not claimed by the local mocked tests.
