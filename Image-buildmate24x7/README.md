# BuildMate Image Cloud

Independent self-hosted image management and delivery service for BuildMate24x7. Phase 1 provides the service foundation; it does not depend on or alter the BuildMate24x7 API, catalogue, or database.

## Status

Phase 1 Foundation is implemented: independent React dashboard, FastAPI API, PostgreSQL Compose service, health checks, migration-backed admin accounts, and revocable bearer authentication. Image management and delivery features have not been implemented.

Phase 2 adds nested folder organization, rename/move, safe empty-folder deletion, folder/subfolder counts, search, and persisted sibling ordering. The dashboard's folder manager appears after administrator sign-in. Image counts remain zero until the later asset phase.

## Local deployment

- Admin: `https://images.buildmate24x7.com`
- Public delivery: `https://cdn.buildmate24x7.com`
- Run from this directory with a Docker Compose v2 installation.
- Copy `.env.example` to `.env` and replace the example secrets before startup (`Copy-Item .env.example .env` in PowerShell).
- Set `IMAGE_CLOUD_DB_PASSWORD` and `IMAGE_CLOUD_DATABASE_URL` to matching credentials. URL-encode reserved characters in the database URL's username/password components.
- Replace the example JWT secret and bootstrap administrator credentials before starting.
- `docker compose -p buildmate-image-cloud up -d --build`
- Dashboard: `http://localhost:5173`; API health endpoints: `http://localhost:8000/health/live` and `/health/ready`. API docs are disabled by default; set `IMAGE_CLOUD_ENABLE_API_DOCS=true` for local development only.
- `docker compose -p buildmate-image-cloud logs -f api` to inspect startup/migration.
- `docker compose -p buildmate-image-cloud down` stops the stack and preserves the named database volume. `down -v` deletes its database.

The API and dashboard ports bind to host loopback only. Publish them through a separately configured HTTPS reverse proxy when deploying to a server. PostgreSQL has no host-published port.

DNS, TLS, ports, and coexistence with the current VPS services must be checked on the target VPS before deployment. This local workspace does not have access to that VPS. Image storage mounts and CDN delivery will be added in a later phase.

### Tests

Backend tests run in an isolated SQLite test container and do not touch the local PostgreSQL volume:

```powershell
docker compose --profile test -p buildmate-image-cloud run --build --rm tests
```

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
