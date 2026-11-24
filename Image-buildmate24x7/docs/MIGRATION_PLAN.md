# Migration and compatibility plan

## Initial operation

Run BuildMate Image Cloud alongside current image providers. Do not rewrite catalogue URLs, download/migrate Cloudinary content, overwrite originals, or update the existing product database in the initial phase. New assets can be used by explicit future workflows only after URL delivery is verified.

## Stable identity

Use immutable UUID asset IDs. Folder moves and renames change metadata only. Replacing bytes creates a new immutable version or asset URL. Never recycle IDs or silently point an existing immutable path to different bytes. Return long-lived cache headers only for immutable public paths.

## Future controlled adoption

1. Inventory current URL usage and source ownership without modifying records.
2. Pilot with a small explicitly selected set, recording old URL, new asset ID/URL, hash, and verification status in a separate migration manifest.
3. Validate image bytes, dimensions, appearance, web and Flutter consumption, fallback behavior, and cache semantics.
4. Only after a separately approved change, update selected application/catalogue references through existing supported workflows and preserve rollback mapping.
5. Expand by batches; retain old Cloudinary assets and URLs until measured traffic and rollback window permit an explicit retirement decision.

No migration phase is included in Phase 1. No Cloudinary deletion or bulk catalogue update is authorized by this specification task.
