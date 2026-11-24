# Database schema (proposal)

This normalized design is the source of truth for future migrations. PostgreSQL, separate database and credentials from BuildMate. UUID primary keys; UTC `timestamptz`; transactions for file registration, moves, soft-delete/restore, and export snapshots. Define all FK delete behavior explicitly. Schema implementation waits for approval.

## Tables

### `users`

`id uuid PK`, `email citext UNIQUE NOT NULL`, `password_hash text NOT NULL`, `display_name text`, `is_active boolean NOT NULL DEFAULT true`, `last_login_at timestamptz`, `created_at`, `updated_at`, `deleted_at timestamptz NULL`. Password hashes use a modern adaptive password hashing algorithm; no plaintext secrets.

### `folders`

`id uuid PK`, `parent_id uuid NULL FK folders(id) ON DELETE RESTRICT`, `name text NOT NULL`, `normalized_name text NOT NULL`, `description text NULL`, `display_order bigint NOT NULL DEFAULT 0`, `created_by uuid NULL FK users`, `created_at`, `updated_at`, `deleted_at NULL`. Unique active sibling name index on `(coalesce(parent_id, zero_uuid), normalized_name)` where not deleted; index parent/order and normalized name. Cycle prevention on reparent is transactional application validation (or recursive constraint trigger only if needed).

### `assets`

`id uuid PK`, `current_version_id uuid NULL`, `folder_id uuid NULL FK folders ON DELETE SET NULL`, `original_filename text NOT NULL`, `display_name text NULL`, `media_type text NOT NULL`, `format text NOT NULL`, `width integer NOT NULL CHECK > 0`, `height integer NOT NULL CHECK > 0`, `byte_size bigint NOT NULL CHECK >= 0`, `sha256 char(64) NOT NULL`, `storage_key text UNIQUE NOT NULL` (opaque key, not user path), `product_code text NULL`, `product_name text NULL`, `brand text NULL`, `product_family text NULL`, `category text NULL`, `variant text NULL`, `status text CHECK in pending/active/failed/quarantined`, `upload_order bigint NOT NULL`, `display_order bigint NOT NULL`, `uploaded_by uuid NULL FK users`, `created_at`, `updated_at`, `deleted_at NULL`. Index active folder/order, filename search, product code/name, hash, format/dimensions/date/size/status. `current_version_id` FK added after versions table; ensure version belongs to asset.

### `asset_versions`

`id uuid PK`, `asset_id uuid NOT NULL FK assets ON DELETE RESTRICT`, `version_number integer NOT NULL CHECK > 0`, `sha256 char(64) NOT NULL`, `storage_key text UNIQUE NOT NULL`, `media_type text NOT NULL`, `format text NOT NULL`, `width integer NOT NULL`, `height integer NOT NULL`, `byte_size bigint NOT NULL`, `created_by uuid NULL FK users`, `created_at`, `is_current boolean NOT NULL DEFAULT false`; unique `(asset_id, version_number)`, partial unique current version per asset. Original versions are immutable. Storage key never contains an untrusted path.

### `tags` / `asset_tags`

`tags(id uuid PK, name text UNIQUE NOT NULL, normalized_name text UNIQUE NOT NULL, created_at, updated_at)`; `asset_tags(asset_id uuid FK assets ON DELETE CASCADE, tag_id uuid FK tags ON DELETE RESTRICT, created_at, PRIMARY KEY(asset_id,tag_id))` plus tag index.

### `asset_product_mappings`

`id uuid PK`, `asset_id uuid FK assets ON DELETE RESTRICT`, `product_code text NOT NULL`, `product_name text NULL`, `source text NOT NULL DEFAULT 'manual'`, `is_primary boolean NOT NULL DEFAULT false`, `created_at`, `updated_at`; indexes asset and product code. Do not FK to BuildMate product tables.

### `api_keys`

`id uuid PK`, `name text NOT NULL`, `key_prefix text NOT NULL`, `secret_hash text NOT NULL`, `scopes text[] NOT NULL`, `last_used_at timestamptz NULL`, `expires_at timestamptz NULL`, `revoked_at timestamptz NULL`, `created_by uuid FK users`, `created_at`, `updated_at`; unique prefix, never store reusable raw key.

### `upload_sessions`

`id uuid PK`, `created_by uuid FK users`, `folder_id uuid NULL FK folders ON DELETE SET NULL`, `original_filename text NOT NULL`, `declared_media_type text NULL`, `expected_size bigint NULL`, `state text NOT NULL`, `temp_key text UNIQUE`, `asset_id uuid NULL FK assets ON DELETE SET NULL`, `failure_code text NULL`, `expires_at timestamptz NOT NULL`, `created_at`, `updated_at`; index state/expiry. No local filesystem path exposed.

### `folder_exports`

`id uuid PK`, `requested_by uuid FK users`, `folder_id uuid NULL FK folders ON DELETE SET NULL`, `include_subfolders boolean NOT NULL`, `format text NOT NULL`, `state text NOT NULL`, `snapshot jsonb NOT NULL`, `result_key text NULL`, `expires_at timestamptz NULL`, `created_at`, `updated_at`. Snapshot captures deterministic asset ordering and URL/version values. Later phase; avoid storing a generated file in the public originals area.

### `transformations`

`id uuid PK`, `asset_version_id uuid FK asset_versions ON DELETE RESTRICT`, `normalized_parameters jsonb NOT NULL`, `cache_key char(64) UNIQUE NOT NULL`, `state text NOT NULL`, `result_key text NULL`, `result_media_type text NULL`, `result_size bigint NULL`, `created_at`, `last_accessed_at`, `expires_at NULL`; index version/creation and expiry. Cache files remain rebuildable and outside original storage.

### `usage_logs` / `audit_logs`

`usage_logs(id bigint generated PK, asset_id uuid NULL FK assets ON DELETE SET NULL, event_type text NOT NULL, request_id text NULL, client_key_id uuid NULL FK api_keys ON DELETE SET NULL, status_code integer NULL, bytes_sent bigint NULL, created_at timestamptz NOT NULL)` with time, asset, event indexes and retention policy.

`audit_logs(id bigint generated PK, actor_user_id uuid NULL FK users ON DELETE SET NULL, actor_api_key_id uuid NULL FK api_keys ON DELETE SET NULL, action text NOT NULL, entity_type text NOT NULL, entity_id uuid NULL, before_data jsonb NULL, after_data jsonb NULL, request_id text NULL, created_at timestamptz NOT NULL)` indexed by entity/time and actor/time. Redact secrets and sensitive payloads.

## Integrity and lifecycle rules

- Active folder hierarchy must be acyclic; folder hard-delete allowed only when empty and childless. Soft delete is for assets; restore checks folder validity and conflicts.
- Asset/version rows describe immutable stored bytes; changing metadata does not change a URL. New bytes produce a new immutable version/URL.
- Storage writes use opaque generated keys; never derive filesystem paths directly from input.
- Hash deduplication is advisory only; identical hashes do not auto-merge assets.
- Hard deletion is a separately confirmed operation and follows retention policy, reference checks, and audit log.
- Ordering uses stable integer ranks; tie-break by UUID for deterministic reads/exports.
