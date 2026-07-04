-- Rent reminders: durable notifications + daily generator + cron schedule.
-- Tenants see reminders in the portal; the rent-reminders edge function
-- dispatches pending ones via SMS when a provider is configured.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tenancy_id uuid references public.tenancies(id) on delete cascade,
  type text not null
    constraint notifications_type_check
    check (type in ('rent_due_soon', 'rent_due_today', 'rent_overdue', 'system')),
  title text not null,
  body text not null,
  dedupe_key text not null unique,
  -- Phone snapshot taken at generation time so the SMS dispatcher never needs
  -- read access to profiles.
  sms_phone text,
  sms_status text not null default 'pending'
    constraint notifications_sms_status_check
    check (sms_status in ('pending', 'sent', 'skipped', 'failed')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_created_idx
  on public.notifications (profile_id, created_at desc);
create index notifications_sms_pending_idx
  on public.notifications (sms_status)
  where sms_status = 'pending';

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
for select to authenticated
using (profile_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

grant select, update (read_at) on public.notifications to authenticated;
grant select, insert, update on public.notifications to service_role;

-- Daily generator. Security definer so it can read balances across tenants.
create or replace function private.generate_rent_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer := 0;
begin
  with owing as (
    select
      t.id as tenancy_id,
      t.tenant_id,
      t.billing_day,
      t.rent_amount,
      b.balance,
      p.phone
    from public.tenancies t
    join public.tenancy_balances b on b.tenancy_id = t.id
    join public.profiles p on p.id = t.tenant_id
    where t.status = 'active'
      and b.balance > 0
  ),
  candidates as (
    -- Due in 3 days
    select
      tenant_id,
      tenancy_id,
      'rent_due_soon'::text as type,
      'Rent due soon' as title,
      format(
        'Your rent of Ksh %s is due on %s. Pay early from your Kodara portal.',
        to_char(rent_amount, 'FM999,999,999'),
        to_char(current_date + 3, 'FMDD Month')
      ) as body,
      'due_soon:' || tenancy_id || ':' || to_char(current_date + 3, 'YYYY-MM') as dedupe_key,
      phone
    from owing
    where billing_day = extract(day from current_date + 3)::int

    union all

    -- Due today
    select
      tenant_id,
      tenancy_id,
      'rent_due_today',
      'Rent due today',
      format(
        'Your rent of Ksh %s is due today. Open your Kodara portal to pay with M-Pesa.',
        to_char(rent_amount, 'FM999,999,999')
      ),
      'due_today:' || tenancy_id || ':' || to_char(current_date, 'YYYY-MM'),
      phone
    from owing
    where billing_day = extract(day from current_date)::int

    union all

    -- Overdue: at most one nudge per ISO week, skipped on due-day messages
    select
      tenant_id,
      tenancy_id,
      'rent_overdue',
      'Outstanding balance',
      format(
        'You have an outstanding balance of Ksh %s. Open your Kodara portal to pay with M-Pesa.',
        to_char(balance, 'FM999,999,999')
      ),
      'overdue:' || tenancy_id || ':' || to_char(current_date, 'IYYY-IW'),
      phone
    from owing
    where billing_day <> extract(day from current_date)::int
      and billing_day <> extract(day from current_date + 3)::int
  )
  insert into public.notifications (profile_id, tenancy_id, type, title, body, dedupe_key, sms_phone)
  select tenant_id, tenancy_id, type, title, body, dedupe_key, phone
  from candidates
  on conflict (dedupe_key) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke execute on function private.generate_rent_reminders() from public, anon, authenticated;

-- Service-only public wrapper so the edge function can trigger a run via PostgREST.
create or replace function public.run_rent_reminders()
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.generate_rent_reminders();
$$;

revoke execute on function public.run_rent_reminders() from public, anon, authenticated;
grant execute on function public.run_rent_reminders() to service_role;

-- Daily schedule at 04:00 UTC (07:00 EAT). pg_cron ships with Supabase;
-- guarded so environments without it still migrate cleanly.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'kodara-rent-reminders',
    '0 4 * * *',
    'select private.generate_rent_reminders()'
  );
exception
  when others then
    raise notice 'pg_cron unavailable, skipping schedule: %', sqlerrm;
end;
$$;
