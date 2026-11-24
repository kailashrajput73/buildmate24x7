# API contracts (proposal)

Version admin endpoints under `/api/v1`. JSON is UTF-8. UUIDs are canonical strings. List endpoints use cursor pagination, stable sorting, and return `next_cursor`. Errors follow a common problem response: `{ "type", "title", "status", "code", "detail", "request_id" }`; never include stack traces or filesystem paths. Contracts below guide implementation and may be refined before schema freeze.

## Authentication and health

- `POST /api/v1/auth/login` `{email,password}` -> `{access_token,token_type,expires_in,user}`. Rate limited; generic invalid-credential response.
- `POST /api/v1/auth/logout` -> 204 (or revoke refresh session if selected).
- `POST /api/v1/auth/password` `{current_password,new_password}` -> 204, requires the current session and revokes all existing sessions after changing the password.
- `GET /api/v1/auth/me` -> current user summary.
- `GET /health/live` -> process liveness; `GET /health/ready` -> DB and required storage readiness. Delivery has its own health routes.

Admin routes require authenticated user/session. Integration routes require scoped API keys. Never place bearer tokens in URLs.

## Folders

- `GET /api/v1/folders?query=&parent_id=` -> folder page, count and ordering.
- `POST /api/v1/folders` `{name,parent_id?,description?}` -> 201 folder.
- `PATCH /api/v1/folders/{id}` `{name?,parent_id?,description?,display_order?}` -> updated folder; reject cycles and invalid parent.
- `DELETE /api/v1/folders/{id}` -> 204 only if empty and childless; otherwise 409.
- `POST /api/v1/folders/reorder` `{items:[{id,display_order}]}` -> 204, transactionally validate same scope.

Folder membership is not embedded into public URLs.

## Uploads and assets

- `POST /api/v1/uploads` multipart `files[]`, optional `folder_id`, optional per-file metadata. Returns per-file result with status, asset, duplicate warning, and stable URL; partial failures do not hide successful files.
- `POST /api/v1/upload-sessions` `{filename,media_type?,size?,folder_id?}` -> short-lived signed/opaque session metadata (future resumable mode).
- `PUT /api/v1/upload-sessions/{id}/content` -> streamed upload; session is one-use and authenticated.
- `GET /api/v1/assets` query `q,folder_id,recursive,format,date_from,date_to,min_width,max_width,min_height,max_height,min_bytes,max_bytes,status,sort,direction,cursor,limit` -> asset page.
- `GET /api/v1/assets/{id}` -> metadata, version summary, URL fields.
- `PATCH /api/v1/assets/{id}` -> editable metadata, folder, order; folder move leaves URLs stable.
- `POST /api/v1/assets/bulk-move` `{asset_ids,folder_id}` -> per-item outcome; atomic policy defined in implementation.
- `POST /api/v1/assets/bulk-delete` `{asset_ids}` -> soft-delete outcome; requires confirmation token/header for bulk action.
- `POST /api/v1/assets/{id}/restore` -> restored asset.
- `DELETE /api/v1/assets/{id}/permanent` -> hard delete only after retention and explicit admin confirmation.

## Public delivery

- `GET|HEAD /original/{asset_id}.{format}` -> immutable original, content type sniffed/stored, ETag, cache headers, `X-Content-Type-Options: nosniff`.
- `GET|HEAD /media/{asset_id}?w=&h=&q=&format=` -> bounded transformation; parameters normalized and validated against pixel/quality/format limits; cache key includes asset version and normalized params.
- Unknown, inactive, or deleted assets return a safe 404. No folder browsing or storage listing endpoint.

## Exports and URL copy

- `POST /api/v1/exports` `{scope:{asset_ids?|folder_id?|all?},include_subfolders,format:csv|xlsx|urls, url_kind:original|optimized|both, filters?,sort?}` -> 202 export job or immediate response for small data sets.
- `GET /api/v1/exports/{id}` -> status/expiry.
- `GET /api/v1/exports/{id}/download` -> authenticated expiring download.
- `POST /api/v1/urls/copy-list` `{asset_ids|folder_id,include_subfolders,url_kind,transformation?,sort?}` -> deterministic UTF-8 text. Bound response size; large requests use export job.

## API key administration

- `GET|POST /api/v1/api-keys`, `POST /api/v1/api-keys/{id}/revoke`; show secret only once at creation, store hash only, support scopes and expiry.

## Compatibility and contract rules

Keep public asset IDs and URL semantics stable. Use additive API changes where possible. Product code/name stay nullable. Return precise validation errors for unsupported format, corrupt decode, dimension/pixel limit, and upload size. Never report successful upload until original placement and metadata commit both succeed.
