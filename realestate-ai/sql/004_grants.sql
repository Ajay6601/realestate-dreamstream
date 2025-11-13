-- Least-privilege grants for the API role. RLS decides *which rows*; grants decide *which verbs*.
-- (On Supabase, replace app_user with `authenticated`.)

GRANT USAGE ON SCHEMA app TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_user;

GRANT SELECT ON tenants, users TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON properties, leads, outreach_messages TO app_user;
GRANT SELECT ON audit_log TO app_user;   -- no INSERT/UPDATE/DELETE: only triggers write it

REVOKE ALL ON FUNCTION app.audit_row_change() FROM PUBLIC;
