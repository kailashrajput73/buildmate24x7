# Cloudflare delivery configuration

Cloudflare zone credentials and DNS are operator-controlled; this repository cannot configure a live zone. Use these settings after the VPS proxy and origin certificate are confirmed.

## DNS and TLS

- Create `images` and `cdn` DNS records to the VPS. Proxy the `cdn` record through Cloudflare. Proxy `images` only if the admin hostname is intended to be Cloudflare protected.
- Set SSL/TLS encryption to **Full (strict)** and install a valid origin certificate. Enable Always Use HTTPS.
- Firewall the origin so HTTP(S) reaches it only through Cloudflare IP ranges (or an authenticated tunnel). Keep SSH separately restricted. Never expose PostgreSQL.
- Route `images` to the dashboard/admin proxy and `cdn` only to public original/media routes. The current local app serves those routes from API port 8000; production reverse-proxy routing must be explicitly configured and verified before DNS cutover.

## Cache rules

Create a Cache Rule for `http.host eq "cdn.buildmate24x7.com" and (starts_with(http.request.uri.path, "/original/") or starts_with(http.request.uri.path, "/media/"))`: eligible for cache, respect origin cache headers, cache by full URL including query string, and ignore cookies. Never cache `/api/`, auth, exports, or admin responses. Preserve `ETag` and `Cache-Control`; purge by URL only when needed (asset URLs are immutable).

Test with `curl -I https://cdn.buildmate24x7.com/original/<uuid>.<format>` and verify 200, correct content type, immutable cache header, `nosniff`, and subsequent `CF-Cache-Status: HIT`. Confirm `/api/v1/` is not cached.
