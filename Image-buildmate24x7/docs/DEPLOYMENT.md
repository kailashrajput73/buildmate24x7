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

## Phase 8 operations

- Apply the Cloudflare DNS/TLS/cache setup in [CLOUDFLARE.md](CLOUDFLARE.md) only after proxy routes and host firewall are inspected. Keep API/auth/export responses uncached; cache immutable `/original/` and `/media/` URLs.
- Configure `IMAGE_CLOUD_ALLOWED_HOSTS` with the exact admin/CDN origin hostnames. Upload is limited to 20 requests/minute per source IP; exports to 10/minute and URL copy to 30/minute. Cloudflare WAF/rate limiting is still recommended at the edge.
- On the VPS, install the scripts and invoke `bash scripts/backup.sh /var/backups/buildmate-image-cloud`; move backups off-host and encrypt them with the approved key-management method. The script produces a PostgreSQL custom dump, original archive, and SHA-256 manifest. Cache is excluded.
- Monitor with `bash scripts/disk-check.sh /var/lib/buildmate-image-cloud`; exit 1 means warn threshold (default 80%), exit 2 critical (90%). Schedule it from the host monitoring agent/cron and alert on nonzero status.
- Run `bash scripts/restore-test.sh <db.dump> <originals.tar.gz>` on a scheduled basis. It restores PostgreSQL into a temporary database, extracts originals to a temporary directory, checks registered active storage keys, reports schema/count, and drops only its temporary database. Review logs/output and remove the temporary restore directory after inspection.
- These scripts have not been executed against a production VPS. Do not represent production backup/restore or Cloudflare delivery as verified until the target host, keys, DNS, proxy, and actual restore drill are reviewed.
