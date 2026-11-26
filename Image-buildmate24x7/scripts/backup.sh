#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DEST"; chmod 700 "$DEST"
cd "$ROOT"
docker compose --env-file .env exec -T db sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DEST/db-$STAMP.dump"
docker run --rm -v buildmate-image-cloud_image_cloud_originals:/data:ro -v "$DEST:/backup" alpine:3.20 sh -ec "tar -C /data -czf /backup/originals-$STAMP.tar.gz originals"
chmod 600 "$DEST/db-$STAMP.dump" "$DEST/originals-$STAMP.tar.gz"
sha256sum "$DEST/db-$STAMP.dump" "$DEST/originals-$STAMP.tar.gz" > "$DEST/SHA256SUMS-$STAMP"
echo "Backup created: $STAMP"
