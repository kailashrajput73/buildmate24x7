using Microsoft.EntityFrameworkCore;

namespace BuildMate.Data;

/// <summary>Database guard so concurrent staff edits cannot grant Administrator to a second staff account.</summary>
public static class AdministratorRoleGuard
{
    public static Task EnsureAsync(AppDbContext db, CancellationToken ct = default) => db.Database.ExecuteSqlRawAsync("""
        CREATE OR REPLACE FUNCTION enforce_single_administrator_user() RETURNS trigger AS $$
        DECLARE
            new_is_admin boolean := false;
            old_is_admin boolean := false;
            other_admin_exists boolean := false;
        BEGIN
            PERFORM pg_advisory_xact_lock(24071101);
            IF NEW.role_id IS NOT NULL AND NEW.user_type = 1 THEN
                SELECT name = 'Administrator' INTO new_is_admin FROM roles WHERE id = NEW.role_id;
            END IF;
            IF TG_OP = 'UPDATE' AND OLD.role_id IS NOT NULL AND OLD.user_type = 1 THEN
                SELECT name = 'Administrator' INTO old_is_admin FROM roles WHERE id = OLD.role_id;
            END IF;
            IF new_is_admin THEN
                SELECT EXISTS (
                    SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id
                    WHERE u.user_type = 1 AND u.id <> NEW.id AND r.name = 'Administrator'
                ) INTO other_admin_exists;
                IF other_admin_exists THEN
                    RAISE EXCEPTION 'Only one staff user can hold the Administrator role.' USING ERRCODE = '23514';
                END IF;
            END IF;
            IF old_is_admin AND NOT new_is_admin THEN
                SELECT EXISTS (
                    SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id
                    WHERE u.user_type = 1 AND u.id <> OLD.id AND r.name = 'Administrator'
                ) INTO other_admin_exists;
                IF NOT other_admin_exists THEN
                    RAISE EXCEPTION 'The last Administrator cannot be removed.' USING ERRCODE = '23514';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_single_administrator') THEN
                CREATE TRIGGER users_single_administrator
                BEFORE INSERT OR UPDATE OF role_id, user_type ON users
                FOR EACH ROW EXECUTE FUNCTION enforce_single_administrator_user();
            END IF;
        END;
        $$;
        """, ct);
}
