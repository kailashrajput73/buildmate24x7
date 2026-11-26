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

- `GET /api/v1/folders?query=&parent_id=` -> `{items,total}` in persisted sibling order. Omitting `parent_id` returns the active folder hierarchy as a flat list with parent IDs; supplying it returns direct children. Each item includes `image_count` and `children_count`.
- `POST /api/v1/folders` `{name,parent_id?,description?}` -> 201 folder.
- `PATCH /api/v1/folders/{id}` `{name?,parent_id?,description?,display_order?}` -> updated folder; reject cycles, invalid parents, and duplicate active sibling names. A move appends to the destination sibling order unless an order is explicitly supplied.
- `DELETE /api/v1/folders/{id}` -> soft-delete and return 204 only if empty and childless; otherwise 409.
- `POST /api/v1/folders/reorder` `{items:[{id,display_order}]}` -> 204, transactionally validate that all active siblings are included and order values are unique.

Folder names are trimmed, Unicode-normalized, case-insensitive among siblings, and limited to 120 characters. Phase 2 reports `image_count: 0` because assets are intentionally introduced in a later phase; the count field is already part of the response contract.

Folder membership is not embedded into public URLs.

## Uploads and assets

- `POST /api/v1/uploads` multipart repeated `files[]`, optional `folder_id`, optional `metadata` JSON object shared by the batch or JSON array with one object per file. Allowed metadata: `product_code`, `product_name`, `brand`, `product_family`, `category`, `variant`, `tags`. Returns per-file result with status, asset, duplicate warning, and stable URL; partial failures do not hide successful files. A batch can contain at most 50 files.
- Images are decoded and validated by content as JPEG, PNG, WebP, or AVIF; defaults are 50 MiB and 80 million pixels and are configurable. Original bytes are stored unchanged under generated UUID storage keys. SHA-256 equality is a warning only; duplicate uploads receive distinct IDs.
- `GET /original/{asset_id}.{format}` serves an immutable original with stored MIME, ETag, immutable cache headers, and `nosniff`. `IMAGE_CLOUD_CDN_ORIGIN` defines the public URL origin; set it to the HTTPS public delivery host in deployment.
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
- Supported presets: `thumbnail` (150), `small` (300), `medium` (600), and `large` (1080); output format may be `webp`, `avif`, `jpeg`, or `png`. The Python image pipeline stores derivatives in the disposable `cache/` tree. When `IMAGE_CLOUD_IMGPROXY_BASE_URL` is set, requests redirect to that configured imgproxy service instead.
- Unknown, inactive, or deleted assets return a safe 404. No folder browsing or storage listing endpoint.

## Exports and URL copy

- `POST /api/v1/exports` `{asset_ids?|folder_id?,include_subfolders,format:csv|xlsx,sort,direction}` -> authenticated CSV or XLSX attachment with stable original URLs and product metadata. Folder scope can include descendants; selected IDs preserve submitted order. Bounded to 5,000 images per download.
- `GET /api/v1/exports/{id}` -> status/expiry.
- `GET /api/v1/exports/{id}/download` -> authenticated expiring download.
- `POST /api/v1/urls/copy-list` `{asset_ids|folder_id?,include_subfolders,url_kind,sort,direction}` -> deterministic UTF-8 URL text for clipboard copy; selected IDs preserve request order. Bound response size.
- `POST /api/v1/exports/product-mapping` `{asset_ids?|folder_id?,include_subfolders,sort,direction}` -> authenticated Excel workbook for external catalog matching. Includes asset ID, filename, stable URL, and optional product code/name, brand, family, and tags; selected ID order is preserved.

## API key administration

- `GET|POST /api/v1/api-keys`, `POST /api/v1/api-keys/{id}/revoke`; show secret only once at creation, store hash only, support scopes and expiry.

## Compatibility and contract rules

Keep public asset IDs and URL semantics stable. Use additive API changes where possible. Product code/name stay nullable. Return precise validation errors for unsupported format, corrupt decode, dimension/pixel limit, and upload size. Never report successful upload until original placement and metadata commit both succeed.
