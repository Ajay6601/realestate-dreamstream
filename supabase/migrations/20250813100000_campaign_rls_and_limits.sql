-- Access and the daily enrichment cap for the campaign console.
--
-- Server routes use the service role and bypass RLS. The browser client
-- (lib/cache.ts, lib/supabase/client.ts) uses the signed-in user's JWT, so
-- these policies are what the dashboard actually runs as.
-- The console is a shared operator tool: campaign rows have no owner column.
-- anon gets nothing. authenticated operators share the book.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

create trigger request_tracker_set_updated_at
  before update on public.request_tracker
  for each row execute function public.set_updated_at();

-- Same number as DAILY_REQUEST_LIMIT in lib/request-tracker.ts.
-- Enforced here so a second client cannot walk past the cap.
create or replace function public.enforce_process_properties_limit()
returns trigger
language plpgsql
as $$
declare
  daily_cap constant integer := 1500;
begin
  if new.process_properties_requests > daily_cap then
    raise exception 'process_properties daily limit of % exceeded (date %)',
      daily_cap, new.date
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger request_tracker_cap
  before insert or update on public.request_tracker
  for each row execute function public.enforce_process_properties_limit();

alter table public.properties enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_logs enable row level security;
alter table public.campaign_progress enable row level security;
alter table public.invites enable row level security;
alter table public.request_tracker enable row level security;

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.properties to authenticated;
grant select, insert, update, delete on public.email_templates to authenticated;
grant select, insert, update, delete on public.email_logs to authenticated;
grant select, insert, update, delete on public.campaign_progress to authenticated;
grant select, insert, update, delete on public.invites to authenticated;
grant select, insert, update on public.request_tracker to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- Campaign book: any signed-in operator. Service role bypasses these.
create policy properties_operator on public.properties
  for all to authenticated
  using (true) with check (true);

create policy email_templates_operator on public.email_templates
  for all to authenticated
  using (true) with check (true);

create policy email_logs_operator on public.email_logs
  for all to authenticated
  using (true) with check (true);

create policy campaign_progress_operator on public.campaign_progress
  for all to authenticated
  using (true) with check (true);

create policy request_tracker_operator on public.request_tracker
  for all to authenticated
  using (true) with check (true);

-- Invites stay with the person who sent them, plus the invited account.
create policy invites_own on public.invites
  for all to authenticated
  using (invited_by = auth.uid() or user_id = auth.uid())
  with check (invited_by = auth.uid());

-- Proposal PDFs. Bucket id must match NEXT_PUBLIC_SUPABASE_BUCKET_NAME.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proposals',
  'proposals',
  true,
  26214400, -- 25 MB
  array['application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy proposals_public_read on storage.objects
  for select to public
  using (bucket_id = 'proposals');

create policy proposals_operator_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proposals');

create policy proposals_operator_update on storage.objects
  for update to authenticated
  using (bucket_id = 'proposals')
  with check (bucket_id = 'proposals');

create policy proposals_operator_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'proposals');
