-- =====================================================================================================
-- BuildMate — Product movement classification (Fast / Slow / Non-moving)       2026-10-28
--
-- For databases created BEFORE this change (the API created the schema with EnsureCreated, so new
-- columns are NOT added automatically). Fresh databases get these columns from the code; don't run it there.
--
-- RUN BY HAND, after a backup, on staging first:
--     pg_dump -Fc -d buildmate -f buildmate_before_movement.dump
--     psql -d buildmate -v ON_ERROR_STOP=1 -f 2026-10-28_product_movement.sql
--
-- What it changes
--   * products: two NULLable columns + two indexes. Nothing else.
--   * Backfill reads dispatches / order_items / stock_movements; it never writes to them.
--   * products.stock_qty, reserved_qty, average_cost, orders, dispatches and stock_movements are untouched.
--   * Safe to re-run: IF NOT EXISTS, and each UPDATE only fills / moves a date forward.
--
-- Rules (same as api/src/BuildMate.Services/Inventory/ProductMovement.cs)
--   last_dispatched_at = latest dispatches.dispatched_at of any order containing the product
--                        (cancelled orders never have a dispatch row; returns don't touch it)
--   aging_from_at      = earliest positive receipt in the stock ledger:
--                        PurchaseIn (1), AdjustmentIn (3), OpeningStock (6). ReturnIn (5) is excluded.
--   Products with neither keep NULLs and are aged from products.created_at by the API.
-- =====================================================================================================

\echo 'Before:'
SELECT count(*) AS products,
       sum(stock_qty) AS total_stock_qty,          -- must be identical in the "After" check
       (SELECT count(*) FROM dispatches) AS dispatches,
       (SELECT count(*) FROM stock_movements) AS stock_movements
FROM products;

BEGIN;

-- 1. Schema --------------------------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_dispatched_at timestamp with time zone NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS aging_from_at      timestamp with time zone NULL;
CREATE INDEX IF NOT EXISTS ix_products_last_dispatched_at ON products (last_dispatched_at);
CREATE INDEX IF NOT EXISTS ix_products_aging_from_at      ON products (aging_from_at);

-- 2. Backfill: last successful dispatch -----------------------------------------------------------------
UPDATE products p
SET    last_dispatched_at = x.last_at
FROM  (SELECT oi.product_id, max(d.dispatched_at) AS last_at
       FROM   order_items oi
       JOIN   dispatches d ON d.order_id = oi.order_id
       GROUP  BY oi.product_id) x
WHERE  p.id = x.product_id
  AND (p.last_dispatched_at IS NULL OR p.last_dispatched_at < x.last_at);   -- only ever moves forward

-- 3. Backfill: first stock receipt (aging reference for never-dispatched products) ----------------------
UPDATE products p
SET    aging_from_at = x.first_at
FROM  (SELECT product_id, min(created_at) AS first_at
       FROM   stock_movements
       WHERE  quantity > 0 AND type IN (1, 3, 6)          -- PurchaseIn, AdjustmentIn, OpeningStock
       GROUP  BY product_id) x
WHERE  p.id = x.product_id
  AND (p.aging_from_at IS NULL OR p.aging_from_at > x.first_at);

COMMIT;

-- 4. Checks (read-only) ---------------------------------------------------------------------------------
\echo 'After (products, total_stock_qty, dispatches and stock_movements must equal "Before"):'
SELECT count(*) AS products,
       sum(stock_qty) AS total_stock_qty,
       (SELECT count(*) FROM dispatches) AS dispatches,
       (SELECT count(*) FROM stock_movements) AS stock_movements,
       count(last_dispatched_at) AS with_last_dispatch,
       count(*) FILTER (WHERE last_dispatched_at IS NULL) AS never_dispatched,
       count(*) FILTER (WHERE last_dispatched_at IS NULL AND aging_from_at IS NULL) AS aged_from_created_at
FROM products;

\echo 'Movement classes today (India time), active products — should match the Stock page cards:'
WITH t AS (SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date AS today),
c AS (
  SELECT p.id, p.last_dispatched_at IS NULL AS never,
         (SELECT today FROM t) - (coalesce(p.last_dispatched_at, p.aging_from_at, p.created_at) AT TIME ZONE 'Asia/Kolkata')::date AS days
  FROM products p WHERE p.is_active)
SELECT CASE WHEN greatest(days, 0) <= 30 THEN 'Fast' WHEN days <= 120 THEN 'Slow' ELSE 'NonMoving' END AS movement,
       count(*) AS products, count(*) FILTER (WHERE never) AS never_dispatched
FROM c GROUP BY 1 ORDER BY 1;

-- Rollback (only if needed; the app version with this feature needs the columns):
--   BEGIN; DROP INDEX IF EXISTS ix_products_aging_from_at; DROP INDEX IF EXISTS ix_products_last_dispatched_at;
--   ALTER TABLE products DROP COLUMN IF EXISTS aging_from_at; ALTER TABLE products DROP COLUMN IF EXISTS last_dispatched_at; COMMIT;
--
-- Also pending from the earlier invoice change (orders.round_off). Run once if your database predates it:
--   ALTER TABLE orders ADD COLUMN IF NOT EXISTS round_off numeric(14,2) NOT NULL DEFAULT 0;
