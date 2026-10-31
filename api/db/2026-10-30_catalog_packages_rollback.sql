-- Retain additive schema on rollback. After box sales exist, do NOT run old checkout/order writers; use maintenance mode and a compatible hotfix.
-- Physical rollback is allowed only BEFORE structured/package data has been used.
-- This guard deliberately refuses to discard any configured master/family/purchase information.
BEGIN;
SELECT pg_advisory_xact_lock(24071001);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM product_types) OR EXISTS(SELECT 1 FROM catalog_families)
 OR EXISTS(SELECT 1 FROM products WHERE product_type_id IS NOT NULL OR catalog_family_id IS NOT NULL OR product_class IS NOT NULL OR size IS NOT NULL OR length IS NOT NULL OR pack_size IS NOT NULL OR pack_mrp IS NOT NULL OR box_discount_value<>0)
 OR EXISTS(SELECT 1 FROM cart_items WHERE purchase_unit<>'Piece')
 OR EXISTS(SELECT 1 FROM order_items WHERE purchase_unit<>'Piece' OR pack_size_snapshot IS NOT NULL OR base_unit_snapshot IS NOT NULL)
 OR EXISTS(SELECT 1 FROM quotation_items WHERE purchase_unit<>'Piece' OR pack_size_snapshot IS NOT NULL OR base_unit_snapshot IS NOT NULL)
 THEN RAISE EXCEPTION 'Rollback refused: catalogue/package data exists. Retain additive schema. Use maintenance mode and compatible application code; old checkout/order writers cannot safely process package orders.'; END IF;
END $$;
ALTER TABLE order_items DROP COLUMN purchase_unit, DROP COLUMN pack_size_snapshot, DROP COLUMN pack_mrp_snapshot, DROP COLUMN box_price_snapshot, DROP COLUMN base_unit_snapshot;
ALTER TABLE quotation_items DROP COLUMN purchase_unit, DROP COLUMN pack_size_snapshot, DROP COLUMN pack_mrp_snapshot, DROP COLUMN box_price_snapshot, DROP COLUMN base_unit_snapshot;
ALTER TABLE cart_items DROP COLUMN purchase_unit;
CREATE UNIQUE INDEX ix_cart_items_user_id_product_id ON cart_items(user_id,product_id);
ALTER TABLE products DROP COLUMN product_type_id, DROP COLUMN catalog_family_id, DROP COLUMN product_class,
 DROP COLUMN size, DROP COLUMN size_value, DROP COLUMN size_unit, DROP COLUMN size_dimension, DROP COLUMN size_normalized,
 DROP COLUMN length, DROP COLUMN length_value, DROP COLUMN length_unit, DROP COLUMN length_normalized,
 DROP COLUMN pack_size, DROP COLUMN pack_mrp, DROP COLUMN box_discount_type, DROP COLUMN box_discount_value;
DROP TABLE product_type_sub_categories;
DROP TABLE product_types;
DROP TABLE catalog_families;
COMMIT;
