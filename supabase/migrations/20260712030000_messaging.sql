-- Tenant-landlord messaging. Promised in kodara.md's Tenant Side feature
-- list ("Basic messaging with landlord") but never built. One thread per
-- tenancy -- mirrors the maintenance_requests access pattern exactly, since
-- a thread is just another tenancy-scoped resource both parties can reach.

create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null unique references public.tenancies(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null constraint messages_body_check check (char_length(trim(body)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_thread_created_idx on public.messages (thread_id, created_at);
create index messages_thread_unread_idx on public.messages (thread_id) where read_at is null;

alter table public.message_threads enable row level security;
alter table public.messages enable row level security;

create policy message_threads_select_authorized on public.message_threads
for select to authenticated
using ((select private.can_access_tenancy(tenancy_id)));

create policy messages_select_authorized on public.messages
for select to authenticated
using (
  exists (
    select 1 from public.message_threads mt
    where mt.id = messages.thread_id
      and (select private.can_access_tenancy(mt.tenancy_id))
  )
);

-- Only the recipient can mark a message read -- you cannot mark your own
-- messages as read, mirroring how notifications_update_own only lets a
-- profile touch its own read_at.
create policy messages_update_read on public.messages
for update to authenticated
using (
  sender_id <> (select auth.uid())
  and exists (
    select 1 from public.message_threads mt
    where mt.id = messages.thread_id
      and (select private.can_access_tenancy(mt.tenancy_id))
  )
)
with check (sender_id <> (select auth.uid()));

grant select on public.message_threads to authenticated;
grant select on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- Writes go through this RPC rather than direct INSERT grants so thread
-- creation ("first message on this tenancy") and access validation happen
-- atomically, the same reasoning as create_tenant_invitation above.
create or replace function public.send_message(target_tenancy_id uuid, message_body text)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  trimmed_body text := trim(message_body);
  target_thread_id uuid;
  result public.messages;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if char_length(trimmed_body) < 1 or char_length(trimmed_body) > 2000 then
    raise exception 'invalid message body' using errcode = '22023';
  end if;
  if not (select private.can_access_tenancy(target_tenancy_id)) then
    raise exception 'tenancy is not accessible to caller' using errcode = '42501';
  end if;

  insert into public.message_threads (tenancy_id)
  values (target_tenancy_id)
  on conflict (tenancy_id) do nothing;

  select id into target_thread_id
  from public.message_threads
  where tenancy_id = target_tenancy_id;

  insert into public.messages (thread_id, sender_id, body)
  values (target_thread_id, caller_id, trimmed_body)
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.send_message(uuid, text) from public, anon;
grant execute on function public.send_message(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
