# UI guidelines

## Product feel

Build a calm, responsive operations tool. Use a compact information hierarchy, clear upload progress, direct image previews, and predictable actions. Avoid excessive navigation and hide advanced controls until needed.

## Information architecture

Primary sections: Dashboard, Image Library, Folders, Upload, Exports, Settings. Keep folder navigation visible in library contexts. Use breadcrumbs for nesting. On mobile widths, collapse navigation and retain search/filter access.

## Core screens

- Dashboard: recent uploads, storage/asset summary, failed uploads, quick upload.
- Image library: thumbnail grid by default; list view; search, filters, sort; multi-select toolbar; detail panel with metadata and copyable URLs.
- Folders: searchable hierarchy, counts, create/rename/move, manual ordering; destructive actions require clear impact and confirmation.
- Upload: drop zone, target folder, per-file progress/status, retry failed items, duplicate warning, optional metadata without mandatory product code.
- Exports: scope, subfolder choice, format, deterministic sort, status and download.
- Settings: account, API keys, safe storage/limits/health summaries; do not render secrets after creation.

## Interaction rules

- Show original and optimized URL as separate labeled values with one-click copy and feedback.
- Keep selection across pagination only if selection semantics are clear; show selected count.
- Explain soft deletion and provide restore path. Require a second explicit confirmation for permanent deletion and protective confirmation for bulk deletion.
- Provide empty, loading, partial-failure, offline, and permission-denied states.
- Ensure keyboard access, visible focus, descriptive labels, sufficient contrast, and non-color-only status indicators.
- Display byte sizes consistently, dimensions as width × height, and dates in the user's locale while storing UTC.
