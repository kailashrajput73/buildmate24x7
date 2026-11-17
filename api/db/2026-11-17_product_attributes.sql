-- =====================================================================================================
-- BuildMate — product Module / Color / Series / Current rating                                2026-11-17
--
-- The API adds these columns itself on startup (BuildMate.Data/CatalogColumns20261117.cs). This script is for
-- adding them by hand beforehand; running both is harmless. Fresh databases get them from the code.
--
-- RUN BY HAND, after a backup, on staging first:
--     pg_dump -Fc -d buildmate -f buildmate_before_2026-11-17.dump
--     psql -d buildmate -v ON_ERROR_STOP=1 -f 2026-11-17_product_attributes.sql
--
-- What it changes (additive only — existing rows stay NULL, no data is rewritten or deleted)
--   * products: + module varchar(60), + color varchar(60), + series varchar(120), + current_rating varchar(10)
--   * products: + check constraint ck_products_current_rating (NULL or 'volt' / 'watt' / 'amp')
--
-- ROLLBACK (removes the four columns and any values entered in them):
--     BEGIN;
--     ALTER TABLE products DROP CONSTRAINT IF EXISTS ck_products_current_rating;
--     ALTER TABLE products DROP COLUMN IF EXISTS current_rating, DROP COLUMN IF EXISTS series,
--                          DROP COLUMN IF EXISTS color, DROP COLUMN IF EXISTS module;
--     COMMIT;
-- =====================================================================================================
BEGIN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS module varchar(60) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS color varchar(60) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS series varchar(120) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS current_rating varchar(10) NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_products_current_rating') THEN
    ALTER TABLE products ADD CONSTRAINT ck_products_current_rating
      CHECK (current_rating IS NULL OR current_rating IN ('volt', 'watt', 'amp'));
  END IF;
END $$;
COMMIT;

\echo 'Check (expect: every product, none with the new fields set yet):'
SELECT count(*) AS products, count(module) AS with_module, count(color) AS with_color,
       count(series) AS with_series, count(current_rating) AS with_current_rating FROM products;
