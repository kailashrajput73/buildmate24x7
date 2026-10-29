# Product movement classification (Fast / Slow / Non-moving)

## Rules

| Class | Days since last successful dispatch (India-time calendar days) |
|---|---|
| Fast moving | 0–30 |
| Slow moving | 31–120 |
| Non-moving | 121 or more |

- **Movement** = a successful dispatch/handover: `Dispatch.DispatchedAt`. Order creation, payment, delivery
  confirmation, cancellations and returns never count.
- **Days** = today in India (IST) − the IST date of the movement. A dispatch at 11:50 pm is 1 day old at midnight.
- **Never dispatched**: aged from the first stock receipt (purchase, opening stock or stock-in adjustment; returns
  excluded), else the product's creation date — and always shown with a **Never dispatched** tag.
- **Returns** don't change the last dispatch date. Until a returns workflow exists, record them as a stock-in adjustment.
- The class is computed when data is loaded, so it moves on day by day with no background job. The stored inputs are
  `products.last_dispatched_at` (set inside the dispatch transaction, only ever moved forward) and
  `products.aging_from_at` (first receipt).

One implementation is used everywhere: `api/src/BuildMate.Services/Inventory/ProductMovement.cs` (stock list,
summary cards, product list, filters, movement history, Excel export). The demo API mirrors it in
`tools/mock-api/server.mjs` (`movementOf`).

## API

| Change | Endpoint |
|---|---|
| Extended (backward compatible) | `GET api/admin/stock` — new optional `search`, `movement` (`Fast`/`Slow`/`NonMoving`), `neverDispatched`; rows gain `movement`, `daysSinceMovement`, `neverDispatched`, `lastDispatchedAt`, `movementReferenceAt` |
| Extended | `GET api/admin/stock/export` — same filters; adds Movement, Last dispatch, Days since movement, Aging from columns |
| New | `GET api/admin/stock/movement-summary` — counts, never-dispatched counts, stock qty and value per class |
| New | `GET api/admin/stock/{productId}/movement` — product-wise history: class, aging reference, quantities in last 30/120 days, every dispatch |
| Extended | `GET api/admin/products` — optional `movement`, `neverDispatched`; items gain `movement`, `daysSinceMovement`, `neverDispatched`, `lastDispatchedAt` |

All under the existing `StockView` / `CatalogView` permissions.

## Deploying (needs explicit approval — nothing has been deployed)

1. **Back up** the database: `pg_dump -Fc -d buildmate -f buildmate_before_movement.dump`.
2. **Staging first.** Restore the backup into a staging database and run
   `psql -d <staging_db> -v ON_ERROR_STOP=1 -f api/db/2026-10-28_product_movement.sql`.
   Check the printed "Before"/"After" totals are identical (products, total stock qty, dispatches, ledger rows) and
   the class counts look right.
3. Run the database tests against a throwaway server (see below).
4. In a maintenance window: run the same script on production, then deploy the new API and admin builds.
   The script must run **before** the new API starts — the new code reads the two columns.
5. Open Admin → Stock and compare the three cards with the script's last query.

Rollback: redeploy the previous API/admin build. The two columns are nullable and unused by the old build, so they
can stay; the script's footer has the `DROP` statements if they must go.

Databases created fresh by the new build (`EnsureCreated`) already have the columns — don't run the script there.
If you generate the first EF migration later (`dotnet ef migrations add Initial`), it will include these columns.

## Tests

```bash
cd api
dotnet test tests/BuildMate.Tests                                   # rule tests (no database)
BUILDMATE_TEST_DB="Host=localhost;Username=postgres;Password=postgres" dotnet test tests/BuildMate.Tests
```

With `BUILDMATE_TEST_DB` set, the dispatch tests create a throwaway database `buildmate_test_<random>`, run the real
dispatch, counter sale, cancel and stock-adjustment services against it, and drop it. Never point it at production.
