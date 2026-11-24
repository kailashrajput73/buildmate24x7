# Product requirements

## Objective and boundaries

BuildMate Image Cloud is an independent, self-hosted image library and stable public image delivery service. It is intended to replace Cloudinary for future uploads and integrations over time. Existing Cloudinary assets and URLs remain untouched during initial development. BuildMate's existing application, database schema, catalogue, and business logic are out of scope for modification.

## Users and primary jobs

- Administrators upload, find, preview, organize, annotate, export, restore, and delete assets.
- BuildMate web, mobile, catalogue imports, and future integrations consume durable public URLs.
- Operators deploy and back up the image service independently of the existing commerce stack.

## Functional requirements

1. Dashboard, image library, folders, upload, exports, and settings with responsive, low-friction navigation.
2. Database-backed nested folders, rename/move, deletion only when empty, manual ordering, search, and counts. Folder changes do not affect asset URLs.
3. Single/multiple drag-and-drop upload with progress, failure reporting, retry, and target-folder selection. Accept JPG/JPEG, PNG, WebP, AVIF only after content/MIME/dimension/size validation. Preserve source bytes, assign immutable UUID asset IDs, calculate SHA-256, and warn on duplicate hashes.
4. Grid/list views, preview/detail panel, selection and bulk operations, recent uploads. Show filename, ID, format, dimensions, bytes, time, folder, and optional metadata.
5. Search filename, ID, product code/name; filter folder, format, date, dimensions, size, status; deterministic sorting including persisted manual order.
6. Stable original and optimized URLs. Moving folders does not change URLs. Replacing content creates a new asset version or immutable asset URL.
7. Copy one, selected, or folder URL lists; deterministic CSV/XLSX exports with UTF-8 CSV and clickable Excel URL cells. Product code/name stay optional.
8. Optional product/brand/family/category/variant/tags metadata.
9. Generate thumbnail (150), small (300), medium (600), large (1080) presets on demand; never overwrite originals. Use an isolated cache and define transformation limits. imgproxy is a later phase.
10. Soft-delete and restore. Permanent removal requires explicit confirmation and must not couple original deletion to cache cleanup.

## Non-functional requirements

- Independent Compose project, PostgreSQL database, credentials, network, and persistent storage.
- Public delivery remains available while dashboard/admin API is unavailable.
- HTTPS at both public domains; no credential, private filesystem path, or storage-directory exposure.
- Transaction-safe database operations, health checks, structured logs, restart policies, documented backups and restore procedure.
- No claim of backup reliability until an actual restore test has passed.
- Each phase has an independently verifiable scope; do not implement future features prematurely.

## Initial release exclusions

No import/migration of Cloudinary assets, edits to BuildMate, multi-user permissions, AI matching, shared collections, advanced analytics, object storage/MinIO, multi-node storage, background job broker, arbitrary transformations, or imgproxy until separately assigned.
