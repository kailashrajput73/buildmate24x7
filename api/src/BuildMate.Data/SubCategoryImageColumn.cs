using Microsoft.EntityFrameworkCore;

namespace BuildMate.Data;

/// <summary>
/// Sub category image (2026-11-16): adds the empty, nullable <c>sub_categories.image_url</c> column to a database
/// created before this feature (EnsureCreated doesn't add columns to an existing database). Additive only, no data
/// is changed; does nothing when the column is already there. Same as api/db/2026-11-16_subcategory_image.sql.
/// </summary>
public static class SubCategoryImageColumn
{
    public static Task EnsureAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (!db.Database.IsNpgsql()) return Task.CompletedTask;
        return db.Database.ExecuteSqlRawAsync("""
            DO $$
            BEGIN
              IF to_regclass('sub_categories') IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name = 'sub_categories' AND column_name = 'image_url')
              THEN
                ALTER TABLE sub_categories ADD COLUMN image_url text NULL;
              END IF;
            END $$;
            """, ct);
    }
}
