-- Core multi-tenant schema (PostgreSQL 13+ / Supabase).

CREATE TABLE IF NOT EXISTS tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email          text NOT NULL,
  password_hash  text NOT NULL,
  role           text NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id);

CREATE TABLE IF NOT EXISTS properties (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  address        text NOT NULL,
  city           text NOT NULL,
  state          text NOT NULL,
  zip_code       text NOT NULL,
  property_type  text NOT NULL CHECK (property_type IN ('single_family','condo','townhouse','multi_family')),
  beds           integer NOT NULL CHECK (beds BETWEEN 0 AND 20),
  baths          numeric(4,1) NOT NULL CHECK (baths BETWEEN 0 AND 20),
  sqft           integer NOT NULL CHECK (sqft > 0),
  lot_sqft       integer NOT NULL DEFAULT 0 CHECK (lot_sqft >= 0),
  year_built     integer NOT NULL CHECK (year_built BETWEEN 1800 AND 2100),
  garage_spaces  integer NOT NULL DEFAULT 0 CHECK (garage_spaces >= 0),
  condition      integer NOT NULL DEFAULT 3 CHECK (condition BETWEEN 1 AND 5),
  list_price     numeric(14,2) NOT NULL CHECK (list_price > 0),
  owner_name     text,
  owner_email    text,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','sold','withdrawn')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS properties_tenant_idx ON properties (tenant_id);
CREATE INDEX IF NOT EXISTS properties_search_idx ON properties (tenant_id, city, status, list_price);

CREATE TABLE IF NOT EXISTS leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                text NOT NULL,
  email               text NOT NULL,
  budget_min          numeric(14,2),
  budget_max          numeric(14,2),
  min_beds            integer,
  min_baths           numeric(4,1),
  preferred_cities    jsonb NOT NULL DEFAULT '[]'::jsonb,
  property_types      jsonb NOT NULL DEFAULT '[]'::jsonb,
  liked_property_ids  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)
);
CREATE INDEX IF NOT EXISTS leads_tenant_idx ON leads (tenant_id);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id      uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  audience         text NOT NULL CHECK (audience IN ('owner','lead')),
  recipient_email  text,
  subject          text NOT NULL,
  body             text NOT NULL,
  generated_by     text NOT NULL DEFAULT 'template',
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz
);
CREATE INDEX IF NOT EXISTS outreach_tenant_idx ON outreach_messages (tenant_id, status);

-- Append-only change history, populated exclusively by triggers (003_audit.sql).
CREATE TABLE IF NOT EXISTS audit_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name      text NOT NULL,
  record_id       uuid NOT NULL,
  tenant_id       uuid NOT NULL,
  action          text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_fields  jsonb NOT NULL DEFAULT '[]'::jsonb,
  old_data        jsonb,
  new_data        jsonb,
  changed_by      uuid,
  changed_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_tenant_time_idx ON audit_log (tenant_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS audit_record_idx ON audit_log (table_name, record_id);

-- Keep updated_at honest regardless of which client wrote the row.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS properties_set_updated_at ON properties;
CREATE TRIGGER properties_set_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS leads_set_updated_at ON leads;
CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS outreach_set_updated_at ON outreach_messages;
CREATE TRIGGER outreach_set_updated_at BEFORE UPDATE ON outreach_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
