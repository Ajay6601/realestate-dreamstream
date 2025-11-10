-- Tenant isolation via Row-Level Security.
--
-- The caller's identity is resolved from, in order:
--   1. Supabase JWT claims   (request.jwt.claims -> app_metadata.{tenant_id,role}, sub)
--   2. Session settings      (app.tenant_id / app.role / app.user_id), which the
--                            FastAPI layer sets per transaction after verifying its JWT.
-- With neither present the helpers return NULL, every policy evaluates to NULL,
-- and the caller sees (and can write) nothing - isolation fails closed.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.jwt_claims() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION app.current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(COALESCE(
    app.jwt_claims() -> 'app_metadata' ->> 'tenant_id',
    current_setting('app.tenant_id', true)
  ), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(COALESCE(
    app.jwt_claims() ->> 'sub',
    current_setting('app.user_id', true)
  ), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(COALESCE(
    app.jwt_claims() -> 'app_metadata' ->> 'role',
    current_setting('app.role', true)
  ), '')
$$;

-- ---- tenants / users: read-only for the API role (signup uses the service role) ----
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants FOR SELECT USING (id = app.current_tenant_id());

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT USING (tenant_id = app.current_tenant_id());

-- ---- tenant-owned tables ------------------------------------------------------------
-- Everyone in a tenant can read/insert/update; only admins can delete.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['properties', 'leads', 'outreach_messages'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (tenant_id = app.current_tenant_id())',
                   t || '_select', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (tenant_id = app.current_tenant_id())',
                   t || '_insert', t);

    -- WITH CHECK stops a row being "moved" into another tenant by an UPDATE.
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (tenant_id = app.current_tenant_id()) '
                   'WITH CHECK (tenant_id = app.current_tenant_id())', t || '_update', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING '
                   '(tenant_id = app.current_tenant_id() AND app.current_role() = ''admin'')',
                   t || '_delete', t);
  END LOOP;
END
$$;

-- ---- audit_log: admins of the tenant can read; nobody can write directly ---------------
-- (rows are inserted by the SECURITY DEFINER trigger function, which runs as the owner
--  and is therefore not subject to RLS - deliberately NOT forced on this table.)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (tenant_id = app.current_tenant_id() AND app.current_role() = 'admin');
