-- Runtime role used by the API. It must NOT own tables or have BYPASSRLS, otherwise
-- row-level security would not apply to it.
--
-- Local / CI:  ALTER ROLE app_user LOGIN PASSWORD '<secret>';
-- Supabase:    skip this role and grant to `authenticated` in 004_grants.sql instead,
--              or create app_user the same way and connect the API with it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;
