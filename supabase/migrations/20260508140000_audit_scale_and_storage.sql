-- Audit trail for the valuation schema, plus the indexes the campaign
-- log needs once a tenant is sending every day.
--
-- audit_log is written only by the trigger (security definer). The API role
-- can select. Update, delete, and truncate are rejected, including for the
-- table owner, so a compromised session cannot rewrite history.
-- No-op updates and updates that only touch updated_at are not recorded.

create table valuation.audit_log (
  id              bigint generated always as identity primary key,
  table_name      text not null,
  record_id       uuid not null,
  tenant_id       uuid not null,
  action          text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_fields  jsonb not null default '[]'::jsonb,
  old_data        jsonb,
  new_data        jsonb,
  changed_by      uuid,
  changed_at      timestamptz not null default now()
);

create index audit_tenant_time_idx
  on valuation.audit_log (tenant_id, changed_at desc);

create index audit_record_idx
  on valuation.audit_log (table_name, record_id, changed_at desc);

create or replace function valuation.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = valuation, public
as $$
declare
  old_row jsonb;
  new_row jsonb;
  changed jsonb := '[]'::jsonb;
  tid uuid;
  rid uuid;
begin
  if tg_op = 'INSERT' then
    new_row := to_jsonb(new);
    tid := (new_row ->> 'tenant_id')::uuid;
    rid := (new_row ->> 'id')::uuid;
  elsif tg_op = 'DELETE' then
    old_row := to_jsonb(old);
    tid := (old_row ->> 'tenant_id')::uuid;
    rid := (old_row ->> 'id')::uuid;
  else
    old_row := to_jsonb(old);
    new_row := to_jsonb(new);
    if old_row = new_row then
      return new;
    end if;
    select coalesce(jsonb_agg(key), '[]'::jsonb)
      into changed
    from jsonb_each(new_row) as n(key, value)
    where key <> 'updated_at'
      and n.value is distinct from (old_row -> key);
    if changed = '[]'::jsonb then
      return new;
    end if;
    tid := (new_row ->> 'tenant_id')::uuid;
    rid := (new_row ->> 'id')::uuid;
  end if;

  insert into valuation.audit_log (
    table_name, record_id, tenant_id, action,
    changed_fields, old_data, new_data, changed_by
  ) values (
    tg_table_name, rid, tid, tg_op,
    changed, old_row, new_row, app.current_user_id()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function valuation.audit_row_change() from public;

create trigger properties_audit
  after insert or update or delete on valuation.properties
  for each row execute function valuation.audit_row_change();

create trigger leads_audit
  after insert or update or delete on valuation.leads
  for each row execute function valuation.audit_row_change();

create trigger outreach_audit
  after insert or update or delete on valuation.outreach_messages
  for each row execute function valuation.audit_row_change();

create or replace function valuation.reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'valuation.audit_log is append-only'
    using errcode = '42501';
end;
$$;

create trigger audit_log_no_update
  before update on valuation.audit_log
  for each row execute function valuation.reject_audit_mutation();

create trigger audit_log_no_delete
  before delete on valuation.audit_log
  for each row execute function valuation.reject_audit_mutation();

create trigger audit_log_no_truncate
  before truncate on valuation.audit_log
  for each statement execute function valuation.reject_audit_mutation();

alter table valuation.audit_log enable row level security;
alter table valuation.audit_log force row level security;

-- Agents work the book. They do not read the audit trail. Admins do, and
-- only for their own tenant.
create policy audit_admin_select on valuation.audit_log
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and app.current_role() = 'admin'
  );

grant select on valuation.audit_log to authenticated;

-- Campaign log growth. The dashboard counts replies and lists recent sends.
-- These cover the queries in lib/cache.ts once email_logs is large.
create index if not exists email_logs_unreplied_recent_idx
  on public.email_logs (sent_at desc)
  where not replied;

create index if not exists email_logs_template_idx
  on public.email_logs (template_id, campaign_day);

-- Keep opt-out lookups point-shaped. The column is already unique; this
-- comment records why we did not also index the raw email body.
comment on table public.email_logs is
  'One row per outbound message. Grows with every send. Do not full-scan for reply rate; use email_logs_replied_idx.';

comment on table valuation.properties is
  'Tenant listing used by the valuation API. Not the campaign properties table.';

comment on table public.properties is
  'Campaign target (address, decision maker, opt-out). Not a priced listing.';
