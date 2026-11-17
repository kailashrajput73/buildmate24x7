-- =====================================================================================================
-- BuildMate — Product Type image (Catalog › Types & family images › Product Types › Image)    2026-11-17
--
-- The API adds this column itself on startup (BuildMate.Data/CatalogColumns20261117.cs). This script is for
-- adding it by hand beforehand; running both is harmless. Fresh databases get it from the code.
--
-- RUN BY HAND, after a backup, on staging first:
--     psql -d buildmate -v ON_ERROR_STOP=1 -f 2026-11-17_product_type_image.sql
--
-- What it changes (additive only): product_types + image_url varchar(2048) NULL (NULL = no type image).
-- Product images and family images are not touched.
--
-- ROLLBACK (removes any type images that were set):
--     ALTER TABLE product_types DROP COLUMN IF EXISTS image_url;
-- =====================================================================================================
BEGIN;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS image_url varchar(2048) NULL;
COMMIT;

\echo 'Check (expect: every type, none with an image yet):'
SELECT count(*) AS product_types, count(image_url) AS with_image FROM product_types;
