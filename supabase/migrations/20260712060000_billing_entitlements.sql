-- Kodara's own billing model. The single biggest structural gap found in
-- the world-class review: every RLS policy so far treats `role = 'landlord'`
-- as an unconditional, unmetered grant to every feature. This adds a second,
-- orthogonal entitlement axis -- but only on *creating new resources*, never
-- on reading existing data. Locking a landlord out of their own tenant and
-- payment records because a subscription lapsed is the wrong failure mode
-- for a rent system; that's a collections problem, not an access problem.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_kes_monthly numeric(10,2) not null constraint plans_price_check check (price_kes_monthly >= 0),
  max_properties integer constraint plans_max_properties_check check (max_properties is null or max_properties > 0),
  max_units integer constraint plans_max_units_check check (max_units is null or max_units > 0),
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.plans (name, price_kes_monthly, max_properties, max_units, features) values
  ('Starter', 0, 1, 5, '{"messaging": true, "etims": true}'::jsonb),
  ('Growth', 1500, 5, 50, '{"messaging": true, "etims": true}'::jsonb),
  ('Portfolio', 4000, null, null, '{"messaging": true, "etims": true}'::jsonb);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null unique references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'trialing'
    constraint subscriptions_status_check check (status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function private.set_updated_at();

-- Backfill: every landlord who existed before this migration gets a
-- generously long trial rather than being retroactively gated.
insert into public.subscriptions (landlord_id, plan_id, status, trial_ends_at)
select p.id, (select id from public.plans where name = 'Starter'), 'trialing', now() + interval '90 days'
from public.profiles p
where p.role = 'landlord'
on conflict (landlord_id) do nothing;

-- Every new landlord gets the same generous trial from the moment they
-- register, so this never becomes a retrofit problem again.
create or replace function private.start_landlord_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'landlord' and old.role is distinct from new.role then
    insert into public.subscriptions (landlord_id, plan_id, status, trial_ends_at)
    values (new.id, (select id from public.plans where name = 'Starter'), 'trialing', now() + interval '30 days')
    on conflict (landlord_id) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function private.start_landlord_trial() from public, anon, authenticated;
create trigger profiles_start_landlord_trial
after update of role on public.profiles
for each row execute function private.start_landlord_trial();

-- Whether a landlord may add another property: no subscription row (should
-- not happen post-backfill, but fails open rather than closed if it ever
-- does), an active/trialing subscription, or a past_due one still inside a
-- 7-day grace period -- and the plan's property cap isn't already reached.
create or replace function private.landlord_can_add_property(target_landlord_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      s.status in ('trialing', 'active')
        or (s.status = 'past_due' and s.current_period_end > now() - interval '7 days'),
      true
    )
    and (
      p.max_properties is null
      or (select count(*)::int from public.properties where landlord_id = target_landlord_id) < p.max_properties
    )
  from (select target_landlord_id as id) me
  left join public.subscriptions s on s.landlord_id = me.id
  left join public.plans p on p.id = s.plan_id;
$$;

-- Unlike get_landlord_mpesa_credentials (which returns secrets and must stay
-- service-role-only), this is invoked from inside the RLS policy below,
-- which evaluates as `authenticated` -- SECURITY DEFINER changes whose
-- privileges apply *inside* the function, not whether the caller may invoke
-- it at all. Revoking authenticated's execute here breaks every property
-- insert with "permission denied for function", not a policy violation.
revoke execute on function private.landlord_can_add_property(uuid) from public, anon;
grant execute on function private.landlord_can_add_property(uuid) to authenticated;

drop policy properties_landlord_insert on public.properties;
create policy properties_landlord_insert on public.properties
for insert to authenticated
with check (
  landlord_id = (select auth.uid())
  and (select private.current_user_is_landlord())
  and (select private.landlord_can_add_property((select auth.uid())))
);

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

create policy plans_select_active on public.plans
for select to authenticated
using (is_active);

create policy subscriptions_select_own on public.subscriptions
for select to authenticated
using (landlord_id = (select auth.uid()));

grant select on public.plans to authenticated;
grant select on public.subscriptions to authenticated;

create or replace function public.landlord_subscription_status()
returns table (
  plan_name text,
  price_kes_monthly numeric,
  status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  properties_used integer,
  max_properties integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pl.name,
    pl.price_kes_monthly,
    s.status,
    s.trial_ends_at,
    s.current_period_end,
    (select count(*)::int from public.properties where landlord_id = (select auth.uid())),
    pl.max_properties
  from public.subscriptions s
  join public.plans pl on pl.id = s.plan_id
  where s.landlord_id = (select auth.uid());
$$;

revoke execute on function public.landlord_subscription_status() from public, anon;
grant execute on function public.landlord_subscription_status() to authenticated;
