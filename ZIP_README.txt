BuildMate updated source - 2026-10-30

Includes API, admin dashboard, customer website, Flutter mobile source,
product catalog workbooks, migrations, tests and setup documentation.
Dashboard query fix and all-record overview cards are included.

Dependencies, build output, local environment overrides, private keys,
local database/runtime files and APKs are excluded. Reinstall dependencies
and configure your environment before running; see README.md,
MSG91_SETUP.md and mobile/README.md. Phone-auth credentials are configured
only on the API server.

The local runtime database is not included. The supplied product import
workbooks are under data/; review and import them for your target database.
Latest validation: backend 109 tests passed, admin build and dashboard
browser verification passed. Mobile suite: 11 passed.
