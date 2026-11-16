-- =====================================================================================================
-- BuildMate — sub category image (Dashboard › Categories › Sub categories › Image)          2026-11-16
--
-- The API now adds this column itself on startup (BuildMate.Data/SubCategoryImageColumn.cs). This script is only
-- for adding it by hand beforehand; running both is harmless.
-- Fresh databases get this column from the code; don't run it there.
--
-- RUN BY HAND, after a backup, on staging first:
--     pg_dump -Fc -d buildmate -f buildmate_before_2026-11-16.dump
--     psql -d buildmate -v ON_ERROR_STOP=1 -f 2026-11-16_subcategory_image.sql
--
-- What it changes (additive only — no data is deleted or rewritten)
--   * sub_categories: + image_url (NULL = no image; the website shows nothing for that sub category)
--   * Categories, products, prices, stock, orders and customers are untouched. Safe to re-run.
--
-- Rollback (removes any sub category images that were set):
--     ALTER TABLE sub_categories DROP COLUMN IF EXISTS image_url;
-- =====================================================================================================
BEGIN;
ALTER TABLE sub_categories ADD COLUMN IF NOT EXISTS image_url text NULL;
COMMIT;

\echo 'Check (expect: every sub category, none with an image yet):'
SELECT count(*) AS sub_categories, count(image_url) AS with_image FROM sub_categories;
