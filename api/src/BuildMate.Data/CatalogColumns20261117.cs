using Microsoft.EntityFrameworkCore;

namespace BuildMate.Data;

/// <summary>
/// 2026-11-17 catalogue additions for databases created before them (EnsureCreated doesn't add columns to an existing
/// database). Additive only: new nullable columns, existing rows stay NULL, nothing is rewritten or deleted. Each step
/// does nothing when already applied. Same as api/db/2026-11-17_product_attributes.sql and
/// api/db/2026-11-17_product_type_image.sql (those files also hold the rollback).
/// </summary>
public static class CatalogColumns20261117
{
    public static Task EnsureAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (!db.Database.IsNpgsql()) return Task.CompletedTask;
        return db.Database.ExecuteSqlRawAsync("""
            DO $$
            BEGIN
              IF to_regclass('products') IS NOT NULL THEN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'module') THEN
                  ALTER TABLE products ADD COLUMN module varchar(60) NULL;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'color') THEN
                  ALTER TABLE products ADD COLUMN color varchar(60) NULL;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'series') THEN
                  ALTER TABLE products ADD COLUMN series varchar(120) NULL;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'current_rating') THEN
                  ALTER TABLE products ADD COLUMN current_rating varchar(10) NULL;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_products_current_rating') THEN
                  ALTER TABLE products ADD CONSTRAINT ck_products_current_rating
                    CHECK (current_rating IS NULL OR current_rating IN ('volt', 'watt', 'amp'));
                END IF;
              END IF;
              IF to_regclass('product_types') IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'product_types' AND column_name = 'image_url') THEN
                ALTER TABLE product_types ADD COLUMN image_url varchar(2048) NULL;
              END IF;
            END $$;
            """, ct);
    }
}
