# BuildMate Image Cloud

Independent self-hosted image management and delivery service for BuildMate24x7. Phase 1 provides the service foundation; it does not depend on or alter the BuildMate24x7 API, catalogue, or database.

## Status

Phase 1 Foundation is implemented: independent React dashboard, FastAPI API, PostgreSQL Compose service, health checks, migration-backed admin accounts, and revocable bearer authentication.

Phase 2 adds nested folder organization, rename/move, safe empty-folder deletion, folder/subfolder counts, search, and persisted sibling ordering. The dashboard's folder manager appears after administrator sign-in.

Phase 3 adds the admin upload panel and authenticated single/bulk uploads, content-based JPEG/PNG/WebP/AVIF validation, size and pixel limits, immutable original storage and IDs, metadata, SHA-256 duplicate warnings, original URLs, and database-backed folder image counts. Image library browsing, image transformations, and a separate public delivery deployment remain later work.

## Local deployment

- Admin: `https://images.buildmate24x7.com`
- Public delivery: `https://cdn.buildmate24x7.com`
- Run from this directory with a Docker Compose v2 installation.
- Copy `.env.example` to `.env` and replace the example secrets before startup (`Copy-Item .env.example .env` in PowerShell).
- Set `IMAGE_CLOUD_DB_PASSWORD` and `IMAGE_CLOUD_DATABASE_URL` to matching credentials. URL-encode reserved characters in the database URL's username/password components.
- Replace the example JWT secret and bootstrap administrator credentials before starting.
- `docker compose --env-file .env up -d --build` (run from this project directory; its Compose project name is intentionally different from the parent BuildMate app)
- Dashboard: `http://localhost:5173`; API health endpoints: `http://localhost:8000/health/live` and `/health/ready`. API docs are disabled by default; set `IMAGE_CLOUD_ENABLE_API_DOCS=true` for local development only.
- `docker compose --env-file .env logs -f api` to inspect startup/migration.
- Uploaded originals persist in the independent `image_cloud_originals` named volume; the API stores them under `/var/lib/buildmate-image-cloud/originals` and temporary uploads under `temp`. Configure `IMAGE_CLOUD_CDN_ORIGIN` to the production HTTPS CDN origin before deployment. Defaults allow local original URLs at `http://localhost:8000`.
- `docker compose --env-file .env down` stops the stack and preserves its database and originals volumes. `down -v` deletes its database and uploaded originals.

The API and dashboard ports bind to host loopback only. Publish them through a separately configured HTTPS reverse proxy when deploying to a server. PostgreSQL has no host-published port.

DNS, TLS, ports, and coexistence with the current VPS services must be checked on the target VPS before deployment. This local workspace does not have access to that VPS. Image storage mounts and CDN delivery will be added in a later phase.

### Tests

Backend tests run in an isolated SQLite test container and do not touch the local PostgreSQL volume:

```powershell
docker compose --env-file .env --profile test run --build --rm tests
```

Upload endpoint: `POST /api/v1/uploads`, authenticated with the admin bearer token. Send repeated `files[]` fields, optional `folder_id`, and `metadata` JSON (one object for all files or an array with one object per file). The response includes per-file success/failure, UUID, dimensions, SHA-256, metadata, duplicate warning, and original URL. The maximum batch is 50 files; default size and pixel limits are 50 MiB and 80 million pixels.

Dashboard production build: from `dashboard/`, `npm ci` then `npm run build`.

## Documentation

- [Product requirements](docs/PRODUCT_REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [API contracts](docs/API_CONTRACTS.md)
- [UI guidelines](docs/UI_GUIDELINES.md)
- [Security](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Migration plan](docs/MIGRATION_PLAN.md)
- [Codex progress](docs/CODEX_PROGRESS.md)

## Approval gate

The proposed first implementation phase is a minimal deployable vertical slice: independent FastAPI service, separate PostgreSQL schema/database, health endpoints, secure single-admin sign-in, validated upload that preserves originals and records metadata, and stable original delivery URL. It excludes bulk operations, advanced optimization, exports, legacy image migration, and production VPS changes. Review the specification and explicitly approve that phase before implementation begins.
