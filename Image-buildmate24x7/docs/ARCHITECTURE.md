# Architecture

## Design goals

Isolate image management and public delivery from BuildMate24x7. Keep immutable identity and original bytes durable, make public serving independent from the administration interface, and keep deployment and recovery operations explicit.

## Logical components

```text
Browser admin --HTTPS--> images.buildmate24x7.com --TLS proxy--> dashboard static app
                                                       \--------> FastAPI admin API
                                                           |         |-- PostgreSQL (private)
                                                           |         |-- originals (/var/lib/.../originals)
                                                           |         |-- generated cache (/var/lib/.../cache)
BuildMate clients --HTTPS--> cdn.buildmate24x7.com --TLS proxy--> delivery service
                                                                  |-- originals (read-only mount)
                                                                  |-- generated cache
```

The proxy routes separate hostnames. The delivery service exposes only explicit original and media routes; it has no admin routes and mounts originals read-only. A delivery process may use a read-only database connection for resolving immutable asset IDs and status, or a generated manifest/index if operationally justified. It must not rely on the dashboard process. Final choice is an implementation detail to validate before Phase 1.

## Deployment topology

- Dedicated project directory `/opt/buildmate-image-cloud/`.
- Dedicated storage root `/var/lib/buildmate-image-cloud/{originals,cache,temp,backups}`.
- Dedicated Compose project, private network, database, database volume, and environment file.
- Candidate containers: `db`, `api`, `dashboard`, `delivery`; Nginx is either the existing host proxy (only after inspection) or an isolated proxy with explicitly assigned ports. Avoid binding database or internal service ports publicly.
- Admin and delivery domains route to separate application targets. Public delivery must not traverse dashboard routing.
- API and dashboard may share an internal origin behind the admin hostname; delivery has an independent backend and public route.
- No Redis in the first release. Introduce a queue only when measured processing requirements justify background jobs.
- Basic processing uses a maintained Python image library with explicit codec support; evaluate libvips before selecting implementation. imgproxy remains later-phase.

## URL and identity model

Permanent original: `https://cdn.buildmate24x7.com/original/{asset_id}.{format}`

Optimized: `https://cdn.buildmate24x7.com/media/{asset_id}?w=1080&h=1080&q=auto&format=webp`

`asset_id` is an immutable UUID. Folder paths and names are metadata, never part of canonical URLs. Replacements create a new immutable version/asset identity. Cache keys include asset/version and normalized transformation parameters. Public URLs are HTTPS-only in production.

## Request flow

1. Admin authenticates to the API and requests a short-lived upload session or direct multipart upload.
2. API streams to a private temporary path, enforces limits, sniffs/decode-checks format and dimensions, calculates SHA-256, and atomically moves bytes to an immutable original key.
3. In a database transaction, asset/version metadata and upload result become visible. A crash between file placement and DB commit is recoverable by an orphan reconciliation procedure; DB rows never point to partially written files.
4. Delivery resolves active immutable asset ID, reads original, or generates a bounded transformation on demand and caches it separately.
5. Folder changes update relations/order only; public URL remains unchanged.

## Reliability and observability

Health endpoints distinguish liveness from readiness. Logs include request ID and asset ID where safe, never credentials or secret-bearing URLs. Monitor free storage, DB health, cache size, upload failures, delivery errors, and backup age. Originals and DB are backed up separately from rebuildable cache. Restore test required before reliability claims.

## Environment inspection record (2026-11-24)

Inspection was limited to the local Windows checkout. The existing root `docker-compose.yml` declares BuildMate services on host ports 8080, 8081, and 3000 and a PostgreSQL container without a host port. Local tool resolution found no Docker CLI, Nginx, or psql; the local port query found no listeners on 80, 443, 5432, 8000, 8080, 5173. PowerShell did not expose usable free-space figures for C:. These are not VPS facts. No VPS shell, DNS zone, TLS issuer, or hosting control plane was available. Before deployment, inspect the target host read-only for running services, proxy config, port bindings, disk/inode capacity, Docker version, PostgreSQL and Nginx ownership, DNS records, and TLS issuance requirements. Do not change existing services as part of inspection.
