-- Undo 2026-11-02_family_cards_all_brands.sql. Refuses once a card photo or a type setting has been saved.
BEGIN;
SELECT pg_advisory_xact_lock(24071001);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM catalog_family_cards) OR EXISTS(SELECT 1 FROM product_types WHERE group_across_brands IS NOT NULL OR class_label IS NOT NULL)
 THEN RAISE EXCEPTION 'Rollback refused: card photos or type settings exist. Keep the additive schema.'; END IF;
END $$;
DROP TABLE catalog_family_cards;
ALTER TABLE product_types DROP COLUMN group_across_brands, DROP COLUMN class_label;
COMMIT;
