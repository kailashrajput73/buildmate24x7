# Security

## Trust boundaries

Admin hostname, delivery hostname, API, database, storage, and operators have separate trust boundaries. Public delivery is read-only and has no administrative capabilities. Original storage is private to the host and never mounted into a web root.

## Authentication and secrets

- Require secure admin authentication; hash passwords using Argon2id or an equivalently maintained adaptive hash. Use secure, HttpOnly, SameSite cookies or short-lived bearer tokens with refresh/session protections selected during implementation.
- Enforce login throttling, session invalidation, and CSRF protection when cookies are used.
- Require current-password confirmation for password changes, enforce a minimum passphrase length, and revoke active sessions after a change.
- Integration API keys are scoped, expiring/revocable, displayed once, and stored as hashes.
- All secrets come from environment/secret files outside version control. Use distinct strong DB/admin/signing secrets per environment; rotate credentials. Never log secrets.

## Upload validation and storage

- Enforce request size, pixel/dimension, decode time, and rate limits at proxy and application layers.
- Verify detected type by parsing/decoding bytes, compare allowed MIME and format, reject malformed or unsupported files, and guard decompression bombs.
- Generate opaque UUID identifiers and server-controlled storage keys. Strip path semantics from filenames; store original filename only as metadata with output encoding.
- Stream to a private temp area, atomically commit, apply restrictive filesystem permissions, and never execute uploaded content.
- Preserve original bytes; transformations use isolated cache paths and bounded parameters.

## Public delivery and abuse controls

- Serve only active registered asset IDs. No directory listing, traversal, upload, or admin routes on CDN host.
- Restrict transform dimensions, pixel count, quality, accepted formats, and parameter combinations. Rate-limit and cache requests; set timeouts and `nosniff`.
- Use HTTPS, safe cache headers, ETags, and no permissive CORS unless a measured integration requires it.
- Keep admin origins separated and apply security headers. Avoid leaking whether private or deleted IDs exist beyond generic responses.

## Operations

Database is private-network-only; no public DB port. Back up DB separately from originals and cache. Encrypt backups at rest and restrict access. Define retention and test restore before claiming reliability. Audit security-sensitive actions while redacting credentials and private content. Patch base images/dependencies and document incident response and key rotation.
