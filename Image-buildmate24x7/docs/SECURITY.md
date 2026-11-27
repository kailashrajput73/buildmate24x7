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

## Browser administrator sessions

- The same-origin dashboard uses a signed session cookie backed by the existing PostgreSQL `auth_sessions` record. Its identifier (`jti`) is generated with a cryptographically random UUID; the server checks revocation, user state, JWT expiry, and the database expiry on every authenticated request. Backend restarts do not clear session rows.
- Cookie name defaults to `buildmate_image_session`; attributes are `HttpOnly`, `SameSite=Lax`, `Path=/api/v1`, and `Max-Age` matches `IMAGE_CLOUD_JWT_TTL_MINUTES`. Local `.env` uses `IMAGE_CLOUD_AUTH_COOKIE_SECURE=false` for plain HTTP. Set `IMAGE_CLOUD_AUTH_COOKIE_SECURE=true` behind production HTTPS. Use a persistent signing secret and PostgreSQL volume.
- Default session duration is seven days (10,080 minutes), configurable from 5 to 43,200 minutes. Expired and revoked database sessions are rejected. Login always creates a fresh random session ID; logout revokes the row and clears the cookie. Password changes revoke every active session and clear the current cookie.
- Cookie-authenticated unsafe requests require an `Origin` matching the request origin or one of `IMAGE_CLOUD_CORS_ORIGINS`, or the browser-controlled `Sec-Fetch-Site: same-origin` metadata. This metadata covers requests where a proxy reconstructs the internal origin differently; cross-site metadata is rejected. SameSite=Lax is also set. Configure the production admin origin in `IMAGE_CLOUD_CORS_ORIGINS`; do not use wildcards. Bearer-token API clients remain supported for compatibility.
- The dashboard restores the user with `GET /api/v1/auth/me` before showing the login screen. It keeps no bearer token in localStorage or sessionStorage. Login remains rate-limited and passwords use the existing adaptive Argon2 password hash.
