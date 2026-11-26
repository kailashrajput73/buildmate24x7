#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_DUMP="${1:?Usage: restore-test.sh <database.dump> <originals.tar.gz> [restore-dir]}"
ORIGINALS_ARCHIVE="${2:?Usage: restore-test.sh <database.dump> <originals.tar.gz> [restore-dir]}"
DEST="${3:-$(mktemp -d)}"
TEMP_DB="restore_verify_$(date -u +%H%M%S)_$$"
cd "$ROOT"; mkdir -p "$DEST/originals"
tar -xzf "$ORIGINALS_ARCHIVE" -C "$DEST/originals"
docker compose --env-file .env exec -T db sh -ec 'createdb -U "$POSTGRES_USER" "$1"' sh "$TEMP_DB"
cleanup(){ docker compose --env-file .env exec -T db sh -ec 'dropdb -U "$POSTGRES_USER" --if-exists "$1"' sh "$TEMP_DB" >/dev/null; }
trap cleanup EXIT
docker compose --env-file .env exec -T db sh -ec 'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --exit-on-error' sh "$TEMP_DB" < "$DB_DUMP"
VERSION="$(docker compose --env-file .env exec -T db sh -ec 'psql -U "$POSTGRES_USER" -d "$1" -Atc "SELECT version_num FROM alembic_version"' sh "$TEMP_DB")"
ASSET_COUNT="$(docker compose --env-file .env exec -T db sh -ec 'psql -U "$POSTGRES_USER" -d "$1" -Atc "SELECT count(*) FROM assets"' sh "$TEMP_DB")"
while IFS= read -r key; do
  [[ -f "$DEST/originals/originals/$key" ]] || { echo "Missing restored original: $key" >&2; exit 1; }
done < <(docker compose --env-file .env exec -T db sh -ec 'psql -U "$POSTGRES_USER" -d "$1" -Atc "SELECT storage_key FROM assets WHERE deleted_at IS NULL"' sh "$TEMP_DB")
printf 'restore_test=passed schema=%s assets=%s originals_dir=%s\n' "$VERSION" "$ASSET_COUNT" "$DEST/originals/originals"
