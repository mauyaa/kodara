-- Caretaker / staff accounts (Tier 2, and the biggest product-breadth gap
-- identified in the 2026-07-22 review): every table and RLS policy so far
-- assumes exactly one relationship -- a landlord and their tenant. Nothing
-- models the person who actually answers the phone when a pipe bursts.
-- `profiles.role` stays exactly as it is (landlord/tenant); staff access is
-- a second, orthogonal grant layered on top, scoped per property, not a
-- third role value -- a caretaker might themselves be a tenant elsewhere,
-- or a landlord co-managing someone else's building.
--
-- Deliberately surgical: this schema already centralizes every ownership
-- check into four helper functions (is_landlord_of_property,
-- is_landlord_of_unit, is_landlord_of_tenancy, can_access_tenancy) that
-- nearly every RLS policy and RPC already calls instead of inlining
-- `landlord_id = auth.uid()`. Extending those four functions to also
-- recognize an active property_staff row extends staff access everywhere
-- those helpers are already used -- units, tenancies, maintenance,
-- messaging, manual payments, ending a tenancy, resolving unmatched
-- payments -- without touching those policies individually. What's
-- deliberately NOT touched: property creation/rename/delete, billing and
-- subscriptions, M-Pesa/eTIMS credentials, and staff management itself all
-- still check `landlord_id = auth.uid()` directly and stay owner-only.

create table public.property_staff (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  landlord_id uuid not null references public.profiles(id) on delete restrict,
  staff_id uuid references public.profiles(id) on delete cascade,
  phone text not null constraint property_staff_phone_check check (phone ~ '^254[17][0-9]{8}$'),
  status text not null default 'invited'
    constraint property_staff_status_check check (status in ('invited', 'active', 'removed')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_staff_acceptance_check check (
    (status = 'active' and staff_id is not null and accepted_at is not null)
    or (status <> 'active')
  )
);

create unique index property_staff_one_live_per_phone_per_property_idx
  on public.property_staff (property_id, phone)
  where status in ('invited', 'active');
create index property_staff_staff_id_idx on public.property_staff (staff_id) where staff_id is not null;
create index property_staff_property_id_idx on public.property_staff (property_id);

create trigger property_staff_set_updated_at
before update on public.property_staff
for each row execute function private.set_updated_at();

-- The four shared ownership-check helpers, extended to also recognize an
-- active staff assignment. Same shape as before, plus one `or exists`
-- clause each against property_staff.

create or replace function private.is_landlord_of_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.properties p
      where p.id = target_property_id
        and (
          p.landlord_id = (select auth.uid())
          or exists (
            select 1 from public.property_staff ps
            where ps.property_id = p.id
              and ps.staff_id = (select auth.uid())
              and ps.status = 'active'
          )
        )
    );
$$;

create or replace function private.is_landlord_of_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.units u
      join public.properties p on p.id = u.property_id
      where u.id = target_unit_id
        and (
          p.landlord_id = (select auth.uid())
          or exists (
            select 1 from public.property_staff ps
            where ps.property_id = p.id
              and ps.staff_id = (select auth.uid())
              and ps.status = 'active'
          )
        )
    );
$$;

create or replace function private.can_access_tenancy(target_tenancy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.tenancies t
      join public.units u on u.id = t.unit_id
      join public.properties p on p.id = u.property_id
      where t.id = target_tenancy_id
        and (
          t.tenant_id = (select auth.uid())
          or p.landlord_id = (select auth.uid())
          or exists (
            select 1 from public.property_staff ps
            where ps.property_id = p.id
              and ps.staff_id = (select auth.uid())
              and ps.status = 'active'
          )
        )
    );
$$;

create or replace function private.is_landlord_of_tenancy(target_tenancy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.tenancies t
      join public.units u on u.id = t.unit_id
      join public.properties p on p.id = u.property_id
      where t.id = target_tenancy_id
        and (
          p.landlord_id = (select auth.uid())
          or exists (
            select 1 from public.property_staff ps
            where ps.property_id = p.id
              and ps.staff_id = (select auth.uid())
              and ps.status = 'active'
          )
        )
    );
$$;

-- properties_select_authorized is the one policy that checked landlord_id
-- directly rather than through is_landlord_of_property -- without this,
-- staff could see units/tenancies on a property but not the property row
-- itself, breaking the property detail page for them.
drop policy properties_select_authorized on public.properties;
create policy properties_select_authorized on public.properties
for select to authenticated
using (
  (select private.is_landlord_of_property(id))
  or (select private.is_tenant_of_property(id))
);

alter table public.property_staff enable row level security;

create policy property_staff_select_authorized on public.property_staff
for select to authenticated
using (
  landlord_id = (select auth.uid())
  or staff_id = (select auth.uid())
  or phone = (select private.current_user_verified_phone())
);

grant select on public.property_staff to authenticated;

create or replace function public.invite_property_staff(target_property_id uuid, staff_phone text)
returns public.property_staff
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_phone text := regexp_replace(coalesce(staff_phone, ''), '[^0-9]', '', 'g');
  result public.property_staff;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if normalized_phone like '0%' then
    normalized_phone := '254' || substring(normalized_phone from 2);
  elsif char_length(normalized_phone) = 9 then
    normalized_phone := '254' || normalized_phone;
  end if;
  if normalized_phone !~ '^254[17][0-9]{8}$' then
    raise exception 'invalid Kenyan phone number' using errcode = '22023';
  end if;

  -- Deliberately checks direct ownership, not is_landlord_of_property:
  -- an existing staff member cannot invite further staff.
  if not exists (
    select 1 from public.properties where id = target_property_id and landlord_id = caller_id
  ) then
    raise exception 'property is not owned by caller' using errcode = '42501';
  end if;

  insert into public.property_staff (property_id, landlord_id, phone)
  values (target_property_id, caller_id, normalized_phone)
  returning * into result;

  return result;
end;
$$;

create or replace function public.accept_property_staff_invitation(target_property_staff_id uuid)
returns public.property_staff
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_phone text;
  invitation public.property_staff;
  result public.property_staff;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select private.current_user_verified_phone() into caller_phone;
  if caller_phone is null then
    raise exception 'a verified phone number is required' using errcode = '42501';
  end if;

  select * into invitation
  from public.property_staff
  where id = target_property_staff_id
  for update;

  if invitation.id is null or invitation.status <> 'invited' or invitation.phone <> caller_phone then
    raise exception 'invitation is unavailable' using errcode = '42501';
  end if;

  update public.property_staff
  set status = 'active', staff_id = caller_id, accepted_at = now()
  where id = invitation.id
  returning * into result;

  return result;
end;
$$;

create or replace function public.remove_property_staff(target_property_staff_id uuid)
returns public.property_staff
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  result public.property_staff;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.property_staff
  set status = 'removed'
  where id = target_property_staff_id
    and landlord_id = caller_id
  returning * into result;

  if result.id is null then
    raise exception 'staff assignment not found or not owned by caller' using errcode = '42501';
  end if;

  return result;
end;
$$;

revoke execute on function public.invite_property_staff(uuid, text) from public, anon;
grant execute on function public.invite_property_staff(uuid, text) to authenticated;
revoke execute on function public.accept_property_staff_invitation(uuid) from public, anon;
grant execute on function public.accept_property_staff_invitation(uuid) to authenticated;
revoke execute on function public.remove_property_staff(uuid) from public, anon;
grant execute on function public.remove_property_staff(uuid) to authenticated;
