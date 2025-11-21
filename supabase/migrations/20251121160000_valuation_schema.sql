-- Valuation API (FastAPI, realestate-ai/).
--
-- Separate schema on purpose. public.properties is a campaign target
-- (decision maker, opt-out code). valuation.properties is a listing
-- (price, sqft, beds) owned by a tenant.
--
-- Identity comes from a Supabase JWT (app_metadata.tenant_id / role, sub)
-- or from session settings the API sets after it verifies its own JWT.
-- No identity => helpers return null => policies fail closed.

create schema if not exists valuation;
create schema if not exists app;

create or replace function app.jwt_claims()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

create or replace function app.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(coalesce(
    app.jwt_claims() -> 'app_metadata' ->> 'tenant_id',
    current_setting('app.tenant_id', true)
  ), '')::uuid
$$;

create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(coalesce(
    app.jwt_claims() ->> 'sub',
    current_setting('app.user_id', true)
  ), '')::uuid
$$;

create or replace function app.current_role()
returns text
language sql
stable
as $$
  select nullif(coalesce(
    app.jwt_claims() -> 'app_metadata' ->> 'role',
    current_setting('app.role', true)
  ), '')
$$;

create table valuation.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table valuation.users (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references valuation.tenants (id) on delete cascade,
  email          text not null,
  password_hash  text not null,
  role           text not null default 'agent' check (role in ('admin', 'agent')),
  created_at     timestamptz not null default now()
);

create unique index users_email_lower_key on valuation.users (lower(email));
create index users_tenant_idx on valuation.users (tenant_id);

create table valuation.properties (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references valuation.tenants (id) on delete cascade,
  address        text not null,
  city           text not null,
  state          text not null,
  zip_code       text not null,
  property_type  text not null check (property_type in ('single_family', 'condo', 'townhouse', 'multi_family')),
  beds           integer not null check (beds between 0 and 20),
  baths          numeric(4, 1) not null check (baths between 0 and 20),
  sqft           integer not null check (sqft > 0),
  lot_sqft       integer not null default 0 check (lot_sqft >= 0),
  year_built     integer not null check (year_built between 1800 and 2100),
  garage_spaces  integer not null default 0 check (garage_spaces >= 0),
  condition      integer not null default 3 check (condition between 1 and 5),
  list_price     numeric(14, 2) not null check (list_price > 0),
  owner_name     text,
  owner_email    text,
  status         text not null default 'active' check (status in ('active', 'pending', 'sold', 'withdrawn')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Tenant-scoped search: city / status / price, the filters the API whitelists.
create index properties_search_idx
  on valuation.properties (tenant_id, lower(city), status, list_price);

create index properties_tenant_status_idx
  on valuation.properties (tenant_id, status)
  where status = 'active';

create table valuation.leads (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references valuation.tenants (id) on delete cascade,
  name                text not null,
  email               text not null,
  budget_min          numeric(14, 2),
  budget_max          numeric(14, 2),
  min_beds            integer,
  min_baths           numeric(4, 1),
  preferred_cities    jsonb not null default '[]'::jsonb,
  property_types      jsonb not null default '[]'::jsonb,
  liked_property_ids  jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint leads_budget_order check (
    budget_min is null or budget_max is null or budget_min <= budget_max
  )
);

create index leads_tenant_idx on valuation.leads (tenant_id);

create table valuation.outreach_messages (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references valuation.tenants (id) on delete cascade,
  property_id      uuid not null references valuation.properties (id) on delete cascade,
  lead_id          uuid references valuation.leads (id) on delete set null,
  audience         text not null check (audience in ('owner', 'lead')),
  recipient_email  text,
  subject          text not null,
  body             text not null,
  generated_by     text not null default 'template',
  status           text not null default 'draft' check (status in ('draft', 'sent')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  sent_at          timestamptz
);

-- Bulk-draft idempotency and the status filter on the list endpoint.
create unique index outreach_open_draft_key
  on valuation.outreach_messages (
    tenant_id,
    property_id,
    audience,
    (coalesce(lead_id, '00000000-0000-0000-0000-000000000000'::uuid))
  )
  where status = 'draft';

create index outreach_tenant_status_idx
  on valuation.outreach_messages (tenant_id, status, created_at desc);

create trigger valuation_properties_set_updated_at
  before update on valuation.properties
  for each row execute function public.set_updated_at();

create trigger valuation_leads_set_updated_at
  before update on valuation.leads
  for each row execute function public.set_updated_at();

create trigger valuation_outreach_set_updated_at
  before update on valuation.outreach_messages
  for each row execute function public.set_updated_at();

-- Signup and login use the service role (ADMIN_DATABASE_URL). The API role
-- can read tenants/users and can write listings, leads, and drafts.
alter table valuation.tenants enable row level security;
alter table valuation.tenants force row level security;
alter table valuation.users enable row level security;
alter table valuation.users force row level security;
alter table valuation.properties enable row level security;
alter table valuation.properties force row level security;
alter table valuation.leads enable row level security;
alter table valuation.leads force row level security;
alter table valuation.outreach_messages enable row level security;
alter table valuation.outreach_messages force row level security;

create policy tenants_select on valuation.tenants
  for select to authenticated
  using (id = app.current_tenant_id());

create policy users_select on valuation.users
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy properties_select on valuation.properties
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy properties_insert on valuation.properties
  for insert to authenticated
  with check (tenant_id = app.current_tenant_id());

create policy properties_update on valuation.properties
  for update to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy properties_delete on valuation.properties
  for delete to authenticated
  using (tenant_id = app.current_tenant_id() and app.current_role() = 'admin');

create policy leads_select on valuation.leads
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy leads_insert on valuation.leads
  for insert to authenticated
  with check (tenant_id = app.current_tenant_id());

create policy leads_update on valuation.leads
  for update to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy leads_delete on valuation.leads
  for delete to authenticated
  using (tenant_id = app.current_tenant_id() and app.current_role() = 'admin');

create policy outreach_select on valuation.outreach_messages
  for select to authenticated
  using (tenant_id = app.current_tenant_id());

create policy outreach_insert on valuation.outreach_messages
  for insert to authenticated
  with check (tenant_id = app.current_tenant_id());

create policy outreach_update on valuation.outreach_messages
  for update to authenticated
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy outreach_delete on valuation.outreach_messages
  for delete to authenticated
  using (tenant_id = app.current_tenant_id() and app.current_role() = 'admin');

grant usage on schema valuation, app to authenticated;
grant execute on all functions in schema app to authenticated;

grant select on valuation.tenants, valuation.users to authenticated;
grant select, insert, update, delete on
  valuation.properties,
  valuation.leads,
  valuation.outreach_messages
  to authenticated;
