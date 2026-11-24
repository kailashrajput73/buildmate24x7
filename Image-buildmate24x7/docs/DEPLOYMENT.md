# Deployment plan

## Important status

This document describes the intended deployment. No production host was accessed and no VPS changes were made. Resolve host-specific values only after a read-only inspection with an authorized connection.

## Target layout

```text
/opt/buildmate-image-cloud/                 application/configuration
/var/lib/buildmate-image-cloud/originals/   immutable source images
/var/lib/buildmate-image-cloud/cache/       rebuildable transformed images
/var/lib/buildmate-image-cloud/temp/        restricted temporary uploads
/var/lib/buildmate-image-cloud/backups/     protected backup staging
```

Separate Compose project, DB volume, credentials, network, and restart policies. Keep `.env` outside source control and restrict permissions. Do not publish DB/internal service ports.

## Pre-deployment inspection checklist

- Identify VPS OS/version, owner/operator, Docker/Compose installation, Nginx or other TLS proxy and current configuration.
- Record existing running containers/services and host port bindings. Do not modify them during inspection.
- Check free disk space and inodes; agree capacity/reserve and backup destination for originals.
- Confirm DNS control and create admin/CDN A/AAAA records to the intended host; validate propagation.
- Confirm TLS issuance/renewal ownership and proxy routing. Keep admin and CDN hostnames isolated.
- Select unused internal/host ports or connect through an existing proxy network only after confirming no conflict.
- Confirm firewall policy, outbound access for image codecs/base images, and monitoring/alert path.
- Create isolated filesystem paths, users, and permissions only in an approved implementation/deployment phase.

## Planned operations

Once implemented: validate env values; review Compose diff; deploy under dedicated project name; verify health/readiness; verify admin auth; upload a test image; check stable original and transformed delivery; restart admin and confirm CDN availability; inspect logs and disk use; execute backup and restore test in an isolated location. Exact commands will be supplied after actual service names, proxy topology, and VPS paths are known.

## Backup/restore

Back up PostgreSQL and originals independently; cache is disposable. Encrypt and restrict backup copies, retain according to an agreed policy, and monitor last successful backup. Restore database and originals together to an isolated test environment and verify asset counts, hashes, and representative public delivery before claiming tested recovery. No backup reliability claim is made at this stage.
