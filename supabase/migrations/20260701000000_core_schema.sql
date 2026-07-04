begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'tenant'
    constraint profiles_role_check check (role in ('landlord', 'tenant')),
  full_name text not null constraint profiles_full_name_check check (char_length(trim(full_name)) between 2 and 120),
  phone text unique constraint profiles_phone_check check (phone is null or phone ~ '^254[17][0-9]{8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete restrict,
  name text not null constraint properties_name_check check (char_length(trim(name)) between 2 and 120),
  address text not null constraint properties_address_check check (char_length(trim(address)) between 2 and 240),
  county text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null constraint units_name_check check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_property_name_key unique (property_id, name)
);

create table public.tenancies (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete restrict,
  tenant_id uuid not null references public.profiles(id) on delete restrict,
  rent_amount numeric(12,2) not null constraint tenancies_rent_positive check (rent_amount > 0),
  billing_day smallint not null default 1 constraint tenancies_billing_day_check check (billing_day between 1 and 28),
  payment_reference text not null unique default (
    'KDR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  start_date date not null,
  end_date date,
  status text not null default 'active'
    constraint tenancies_status_check check (status in ('pending', 'active', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenancies_date_range_check check (end_date is null or end_date >= start_date)
);

create unique index tenancies_one_live_per_unit_idx
  on public.tenancies (unit_id)
  where status in ('pending', 'active');

create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete restrict,
  landlord_id uuid not null references public.profiles(id) on delete restrict,
  phone text not null constraint tenant_invitations_phone_check check (phone ~ '^254[17][0-9]{8}$'),
  rent_amount numeric(12,2) not null constraint tenant_invitations_rent_positive check (rent_amount > 0),
  billing_day smallint not null default 1 constraint tenant_invitations_billing_day_check check (billing_day between 1 and 28),
  start_date date not null,
  end_date date,
  status text not null default 'pending'
    constraint tenant_invitations_status_check check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  accepted_by uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_invitations_date_range_check check (end_date is null or end_date >= start_date),
  constraint tenant_invitations_acceptance_check check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or (status <> 'accepted' and accepted_by is null and accepted_at is null)
  )
);

create unique index tenant_invitations_one_pending_per_unit_idx
  on public.tenant_invitations (unit_id)
  where status = 'pending';
create index tenant_invitations_phone_status_idx
  on public.tenant_invitations (phone, status, expires_at);
create index tenant_invitations_landlord_status_idx
  on public.tenant_invitations (landlord_id, status, created_at desc);
create index tenant_invitations_unit_id_idx on public.tenant_invitations (unit_id);
create index tenant_invitations_accepted_by_idx
  on public.tenant_invitations (accepted_by) where accepted_by is not null;

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies(id) on delete restrict,
  landlord_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key text not null constraint payment_attempts_idempotency_key_check
    check (char_length(idempotency_key) between 8 and 100),
  requested_amount numeric(12,2) not null constraint payment_attempts_amount_positive check (requested_amount > 0),
  requested_phone text not null constraint payment_attempts_phone_check check (requested_phone ~ '^254[17][0-9]{8}$'),
  merchant_request_id text,
  checkout_request_id text unique,
  status text not null default 'requesting'
    constraint payment_attempts_status_check check (
      status in ('requesting', 'pending', 'succeeded', 'failed', 'uncertain')
    ),
  result_code integer,
  result_description text,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_attempts_tenancy_idempotency_key unique (tenancy_id, idempotency_key)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid references public.tenancies(id) on delete restrict,
  landlord_id uuid not null references public.profiles(id) on delete restrict,
  payment_attempt_id uuid unique references public.payment_attempts(id) on delete restrict,
  amount numeric(12,2) not null constraint payments_amount_positive check (amount > 0),
  provider text not null default 'mpesa' constraint payments_provider_check check (provider = 'mpesa'),
  method text not null constraint payments_method_check check (method in ('stk_push', 'c2b')),
  provider_transaction_id text not null unique,
  checkout_request_id text,
  sender_phone text constraint payments_sender_phone_check check (sender_phone is null or sender_phone ~ '^254[17][0-9]{8}$'),
  account_reference text,
  status text not null default 'succeeded'
    constraint payments_status_check check (status in ('succeeded', 'reversed')),
  reconciliation_status text not null
    constraint payments_reconciliation_status_check check (
      reconciliation_status in ('matched_auto', 'matched_manual', 'unmatched')
    ),
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_match_consistency_check check (
    (reconciliation_status = 'unmatched' and tenancy_id is null)
    or
    (reconciliation_status in ('matched_auto', 'matched_manual') and tenancy_id is not null)
  )
);

create table public.payment_reconciliations (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.payments(id) on delete restrict,
  previous_tenancy_id uuid references public.tenancies(id) on delete restrict,
  tenancy_id uuid not null references public.tenancies(id) on delete restrict,
  resolved_by uuid not null references public.profiles(id) on delete restrict,
  note text constraint payment_reconciliations_note_check check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies(id) on delete restrict,
  title text not null constraint maintenance_title_check check (char_length(trim(title)) between 3 and 120),
  description text not null constraint maintenance_description_check check (char_length(trim(description)) between 10 and 2000),
  priority text not null default 'normal'
    constraint maintenance_priority_check check (priority in ('low', 'normal', 'high', 'emergency')),
  status text not null default 'pending'
    constraint maintenance_status_check check (status in ('pending', 'in_progress', 'completed')),
  photo_paths text[] not null default '{}',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maintenance_status_history (
  id bigint generated always as identity primary key,
  maintenance_request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  status text not null constraint maintenance_history_status_check
    check (status in ('pending', 'in_progress', 'completed')),
  changed_by uuid references public.profiles(id) on delete set null,
  note text constraint maintenance_history_note_check check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create table private.mpesa_webhook_events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  checkout_request_id text not null,
  result_code integer not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create index properties_landlord_id_idx on public.properties (landlord_id);
create index units_property_id_idx on public.units (property_id);
create index tenancies_tenant_id_idx on public.tenancies (tenant_id);
create index tenancies_unit_id_idx on public.tenancies (unit_id);
create index payment_attempts_tenancy_created_idx on public.payment_attempts (tenancy_id, created_at desc);
create index payment_attempts_landlord_status_idx on public.payment_attempts (landlord_id, status, created_at desc);
create index payment_attempts_requested_by_idx on public.payment_attempts (requested_by);
create index payments_tenancy_paid_idx on public.payments (tenancy_id, paid_at desc) where tenancy_id is not null;
create index payments_landlord_reconciliation_idx on public.payments (landlord_id, reconciliation_status, paid_at desc);
create index payments_checkout_request_idx
  on public.payments (checkout_request_id) where checkout_request_id is not null;
create index payment_reconciliations_payment_id_idx on public.payment_reconciliations (payment_id);
create index payment_reconciliations_previous_tenancy_id_idx
  on public.payment_reconciliations (previous_tenancy_id)
  where previous_tenancy_id is not null;
create index payment_reconciliations_tenancy_id_idx on public.payment_reconciliations (tenancy_id);
create index payment_reconciliations_resolved_by_idx on public.payment_reconciliations (resolved_by);
create index maintenance_requests_tenancy_created_idx on public.maintenance_requests (tenancy_id, created_at desc);
create index maintenance_requests_created_by_idx on public.maintenance_requests (created_by);
create index maintenance_history_request_created_idx on public.maintenance_status_history (maintenance_request_id, created_at);
create index maintenance_history_changed_by_idx
  on public.maintenance_status_history (changed_by) where changed_by is not null;
create index mpesa_webhook_checkout_idx on private.mpesa_webhook_events (checkout_request_id, received_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger properties_set_updated_at before update on public.properties
for each row execute function private.set_updated_at();
create trigger units_set_updated_at before update on public.units
for each row execute function private.set_updated_at();
create trigger tenancies_set_updated_at before update on public.tenancies
for each row execute function private.set_updated_at();
create trigger tenant_invitations_set_updated_at before update on public.tenant_invitations
for each row execute function private.set_updated_at();
create trigger payment_attempts_set_updated_at before update on public.payment_attempts
for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
for each row execute function private.set_updated_at();
create trigger maintenance_requests_set_updated_at before update on public.maintenance_requests
for each row execute function private.set_updated_at();

create or replace function private.protect_hierarchy_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'units' then
    if old.property_id is distinct from new.property_id then
      raise exception 'a unit cannot be moved between properties' using errcode = '23514';
    end if;
  end if;

  if tg_table_name = 'tenancies' then
    if old.unit_id is distinct from new.unit_id
      or old.tenant_id is distinct from new.tenant_id
      or old.rent_amount is distinct from new.rent_amount
      or old.billing_day is distinct from new.billing_day
      or old.payment_reference is distinct from new.payment_reference
      or old.start_date is distinct from new.start_date
    then
      raise exception 'tenancy identity and rent terms are immutable; end it and create a new tenancy'
        using errcode = '23514';
    end if;
  end if;

  if tg_table_name = 'maintenance_requests' then
    if old.tenancy_id is distinct from new.tenancy_id
      or old.created_by is distinct from new.created_by
    then
      raise exception 'maintenance request ownership is immutable' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger units_protect_identity
before update on public.units
for each row execute function private.protect_hierarchy_identity();
create trigger tenancies_protect_identity
before update on public.tenancies
for each row execute function private.protect_hierarchy_identity();
create trigger maintenance_protect_identity
before update on public.maintenance_requests
for each row execute function private.protect_hierarchy_identity();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_phone text := nullif(new.phone, '');
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    'tenant',
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Kodara user'),
    case
      when new.phone_confirmed_at is not null
        and coalesce(raw_phone, '') ~ '^\+?254[17][0-9]{8}$'
        then replace(raw_phone, '+', '')
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.sync_verified_user_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set phone = case
    when new.phone_confirmed_at is not null
      and coalesce(new.phone, '') ~ '^\+?254[17][0-9]{8}$'
      then replace(new.phone, '+', '')
    else null
  end
  where id = new.id;
  return new;
end;
$$;

revoke execute on function private.sync_verified_user_phone() from public, anon, authenticated;
create trigger on_auth_user_phone_verified
after update of phone, phone_confirmed_at on auth.users
for each row execute function private.sync_verified_user_phone();

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
        and p.landlord_id = (select auth.uid())
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
        and p.landlord_id = (select auth.uid())
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
        and (t.tenant_id = (select auth.uid()) or p.landlord_id = (select auth.uid()))
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
        and p.landlord_id = (select auth.uid())
    );
$$;

create or replace function private.is_tenant_of_property(target_property_id uuid)
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
      where u.property_id = target_property_id
        and t.tenant_id = (select auth.uid())
    );
$$;

create or replace function private.current_user_is_landlord()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'landlord'
  );
$$;

create or replace function private.current_user_verified_phone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select replace(u.phone, '+', '')
  from auth.users u
  where u.id = (select auth.uid())
    and u.phone_confirmed_at is not null
    and u.phone ~ '^\+?254[17][0-9]{8}$'
$$;

revoke execute on function private.is_landlord_of_property(uuid) from public, anon;
revoke execute on function private.is_landlord_of_unit(uuid) from public, anon;
revoke execute on function private.can_access_tenancy(uuid) from public, anon;
revoke execute on function private.is_landlord_of_tenancy(uuid) from public, anon;
revoke execute on function private.is_tenant_of_property(uuid) from public, anon;
revoke execute on function private.current_user_is_landlord() from public, anon;
revoke execute on function private.current_user_verified_phone() from public, anon;
grant execute on function private.is_tenant_of_property(uuid) to authenticated;
grant execute on function private.current_user_is_landlord() to authenticated;
grant execute on function private.current_user_verified_phone() to authenticated;
grant execute on function private.is_landlord_of_property(uuid) to authenticated;
grant execute on function private.is_landlord_of_unit(uuid) to authenticated;
grant execute on function private.can_access_tenancy(uuid) to authenticated;
grant execute on function private.is_landlord_of_tenancy(uuid) to authenticated;

create or replace function private.validate_tenancy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_role text;
begin
  select role into tenant_role from public.profiles where id = new.tenant_id;
  if tenant_role is distinct from 'tenant' then
    raise exception 'tenancy tenant must have the tenant role' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function private.validate_tenancy() from public, anon, authenticated;

create trigger tenancies_validate_before_write
before insert or update of tenant_id on public.tenancies
for each row execute function private.validate_tenancy();

-- security definer: the Edge Function inserts attempts as service_role, which
-- intentionally has no SELECT grant on tenancies/units/properties. The trigger
-- only reads them to validate ownership, so it runs with owner privileges.
create or replace function private.validate_payment_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenancy_tenant uuid;
  tenancy_landlord uuid;
begin
  if tg_op = 'INSERT' then
    -- Serialize reservations per caller so concurrent Edge Function requests
    -- cannot bypass the in-flight check or rolling rate limit.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.requested_by::text, 0)
    );

    if exists (
      select 1
      from public.payment_attempts pa
      where pa.requested_by = new.requested_by
        and pa.tenancy_id = new.tenancy_id
        and pa.status in ('requesting', 'pending', 'uncertain')
    ) then
      raise exception 'payment attempt already in progress' using errcode = 'P0001';
    end if;

    if (
      select count(*)
      from public.payment_attempts pa
      where pa.requested_by = new.requested_by
        and pa.created_at >= now() - interval '10 minutes'
    ) >= 5 then
      raise exception 'payment attempt rate limit exceeded' using errcode = 'P0001';
    end if;
  end if;

  select t.tenant_id, p.landlord_id
  into tenancy_tenant, tenancy_landlord
  from public.tenancies t
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  where t.id = new.tenancy_id;

  if tenancy_landlord is null
    or new.landlord_id <> tenancy_landlord
    or new.requested_by not in (tenancy_tenant, tenancy_landlord) then
    raise exception 'invalid payment attempt ownership' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger payment_attempts_validate_ownership
before insert or update of tenancy_id, landlord_id, requested_by on public.payment_attempts
for each row execute function private.validate_payment_attempt();

create or replace function private.validate_payment_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  if new.tenancy_id is null then
    return new;
  end if;

  select p.landlord_id into owner_id
  from public.tenancies t
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  where t.id = new.tenancy_id;

  if owner_id is null or owner_id <> new.landlord_id then
    raise exception 'payment tenancy does not belong to receiving landlord' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger payments_validate_ownership
before insert or update of tenancy_id, landlord_id on public.payments
for each row execute function private.validate_payment_ownership();

create or replace function private.capture_maintenance_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and not (
    (old.status = 'pending' and new.status = 'in_progress')
    or (old.status = 'in_progress' and new.status = 'completed')
    or old.status = new.status
  ) then
    raise exception 'invalid maintenance status transition: % to %', old.status, new.status
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.maintenance_status_history (
      maintenance_request_id,
      status,
      changed_by
    )
    values (new.id, new.status, (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke execute on function private.capture_maintenance_status() from public, anon, authenticated;
create trigger maintenance_capture_status
after insert or update of status on public.maintenance_requests
for each row execute function private.capture_maintenance_status();

create or replace function public.register_as_landlord()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  result public.profiles;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if exists (select 1 from public.tenancies where tenant_id = caller_id) then
    raise exception 'a tenant with tenancy history cannot become a landlord account'
      using errcode = '42501';
  end if;

  update public.profiles
  set role = 'landlord'
  where id = caller_id and role = 'tenant'
  returning * into result;

  if result.id is null then
    select * into result from public.profiles where id = caller_id and role = 'landlord';
  end if;

  if result.id is null then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke execute on function public.register_as_landlord() from public, anon;
grant execute on function public.register_as_landlord() to authenticated;

create or replace function public.resolve_unmatched_payment(
  target_payment_id uuid,
  target_tenancy_id uuid,
  resolution_note text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  payment_row public.payments;
  target_owner uuid;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if resolution_note is not null and char_length(resolution_note) > 500 then
    raise exception 'resolution note is too long' using errcode = '22001';
  end if;

  select * into payment_row
  from public.payments
  where id = target_payment_id
  for update;

  if payment_row.id is null
    or payment_row.landlord_id <> caller_id
    or payment_row.reconciliation_status <> 'unmatched' then
    raise exception 'payment is not available for reconciliation' using errcode = '42501';
  end if;

  select p.landlord_id into target_owner
  from public.tenancies t
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  where t.id = target_tenancy_id;

  if target_owner is distinct from caller_id then
    raise exception 'target tenancy is not owned by caller' using errcode = '42501';
  end if;

  update public.payments
  set tenancy_id = target_tenancy_id,
      reconciliation_status = 'matched_manual'
  where id = target_payment_id
  returning * into payment_row;

  insert into public.payment_reconciliations (
    payment_id,
    previous_tenancy_id,
    tenancy_id,
    resolved_by,
    note
  )
  values (target_payment_id, null, target_tenancy_id, caller_id, resolution_note);

  return payment_row;
end;
$$;

create or replace function public.create_tenant_invitation(
  target_unit_id uuid,
  tenant_phone text,
  tenancy_rent numeric,
  tenancy_billing_day smallint,
  tenancy_start_date date,
  tenancy_end_date date default null
)
returns public.tenant_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_phone text := regexp_replace(coalesce(tenant_phone, ''), '[^0-9]', '', 'g');
  property_owner uuid;
  invitation public.tenant_invitations;
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
  if tenancy_rent <= 0 or tenancy_billing_day not between 1 and 28 then
    raise exception 'invalid tenancy terms' using errcode = '22023';
  end if;
  if tenancy_end_date is not null and tenancy_end_date < tenancy_start_date then
    raise exception 'invalid tenancy date range' using errcode = '22023';
  end if;

  select p.landlord_id into property_owner
  from public.units u
  join public.properties p on p.id = u.property_id
  where u.id = target_unit_id;

  if property_owner is distinct from caller_id then
    raise exception 'unit is not owned by caller' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.tenancies
    where unit_id = target_unit_id and status in ('pending', 'active')
  ) then
    raise exception 'unit already has a live tenancy' using errcode = '23505';
  end if;

  update public.tenant_invitations
  set status = 'expired'
  where unit_id = target_unit_id
    and status = 'pending'
    and expires_at <= now();

  insert into public.tenant_invitations (
    unit_id,
    landlord_id,
    phone,
    rent_amount,
    billing_day,
    start_date,
    end_date
  ) values (
    target_unit_id,
    caller_id,
    normalized_phone,
    tenancy_rent,
    tenancy_billing_day,
    tenancy_start_date,
    tenancy_end_date
  )
  returning * into invitation;

  return invitation;
end;
$$;

create or replace function public.accept_tenant_invitation(target_invitation_id uuid)
returns public.tenancies
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_phone text;
  invitation public.tenant_invitations;
  tenancy public.tenancies;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select private.current_user_verified_phone() into caller_phone;

  if not exists (
    select 1 from public.profiles where id = caller_id and role = 'tenant'
  ) then
    raise exception 'tenant account required' using errcode = '42501';
  end if;

  if caller_phone is null then
    raise exception 'verified tenant phone is required' using errcode = '42501';
  end if;

  select * into invitation
  from public.tenant_invitations
  where id = target_invitation_id
  for update;

  if invitation.id is null
    or invitation.status <> 'pending'
    or invitation.expires_at <= now()
    or invitation.phone <> caller_phone then
    raise exception 'invitation is unavailable' using errcode = '42501';
  end if;

  insert into public.tenancies (
    unit_id,
    tenant_id,
    rent_amount,
    billing_day,
    start_date,
    end_date,
    status
  ) values (
    invitation.unit_id,
    caller_id,
    invitation.rent_amount,
    invitation.billing_day,
    invitation.start_date,
    invitation.end_date,
    'active'
  )
  returning * into tenancy;

  update public.tenant_invitations
  set status = 'accepted', accepted_by = caller_id, accepted_at = now()
  where id = invitation.id;

  return tenancy;
end;
$$;

create or replace function public.cancel_tenant_invitation(target_invitation_id uuid)
returns public.tenant_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  invitation public.tenant_invitations;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.tenant_invitations
  set status = 'cancelled'
  where id = target_invitation_id
    and landlord_id = caller_id
    and status = 'pending'
  returning * into invitation;

  if invitation.id is null then
    raise exception 'invitation is unavailable' using errcode = '42501';
  end if;
  return invitation;
end;
$$;

revoke execute on function public.resolve_unmatched_payment(uuid, uuid, text) from public, anon;
grant execute on function public.resolve_unmatched_payment(uuid, uuid, text) to authenticated;
revoke execute on function public.create_tenant_invitation(uuid, text, numeric, smallint, date, date) from public, anon;
grant execute on function public.create_tenant_invitation(uuid, text, numeric, smallint, date, date) to authenticated;
revoke execute on function public.accept_tenant_invitation(uuid) from public, anon;
grant execute on function public.accept_tenant_invitation(uuid) to authenticated;
revoke execute on function public.cancel_tenant_invitation(uuid) from public, anon;
grant execute on function public.cancel_tenant_invitation(uuid) to authenticated;

create or replace function public.record_mpesa_stk_callback(
  callback_checkout_request_id text,
  callback_result_code integer,
  callback_result_description text,
  callback_receipt text,
  callback_amount numeric,
  callback_phone text,
  callback_paid_at timestamptz,
  callback_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id bigint;
  v_event_key text;
  attempt public.payment_attempts;
  payment_id uuid;
  existing_payment public.payments;
  match_status text;
  matched_tenancy uuid;
begin
  if callback_checkout_request_id is null
    or callback_result_code is null
    or callback_payload is null then
    raise exception 'invalid callback' using errcode = '22023';
  end if;

  v_event_key := encode(
    extensions.digest(
      callback_checkout_request_id || ':' || callback_result_code::text || ':' || coalesce(callback_receipt, ''),
      'sha256'
    ),
    'hex'
  );

  insert into private.mpesa_webhook_events (
    event_key,
    checkout_request_id,
    result_code,
    payload
  )
  values (
    v_event_key,
    callback_checkout_request_id,
    callback_result_code,
    callback_payload
  )
  on conflict (event_key) do nothing
  returning id into event_id;

  if event_id is null then
    select p.id into payment_id
    from public.payments p
    where p.checkout_request_id = callback_checkout_request_id
    order by p.created_at desc
    limit 1;
    return payment_id;
  end if;

  select * into attempt
  from public.payment_attempts
  where checkout_request_id = callback_checkout_request_id
  for update;

  if attempt.id is null then
    raise exception 'unknown checkout request' using errcode = 'P0002';
  end if;

  if callback_result_code <> 0 then
    update public.payment_attempts
    set status = 'failed',
        result_code = callback_result_code,
        result_description = left(callback_result_description, 500)
    where id = attempt.id;

    update private.mpesa_webhook_events set processed_at = now() where id = event_id;
    return null;
  end if;

  if callback_receipt is null or callback_amount is null or callback_amount <= 0 or callback_paid_at is null then
    update private.mpesa_webhook_events
    set processed_at = now(),
        processing_error = 'successful callback is missing required metadata'
    where id = event_id;
    raise exception 'successful callback is missing required metadata' using errcode = '22023';
  end if;

  if callback_amount = attempt.requested_amount then
    match_status := 'matched_auto';
    matched_tenancy := attempt.tenancy_id;
  else
    match_status := 'unmatched';
    matched_tenancy := null;
  end if;

  insert into public.payments (
    tenancy_id,
    landlord_id,
    payment_attempt_id,
    amount,
    method,
    provider_transaction_id,
    checkout_request_id,
    sender_phone,
    account_reference,
    status,
    reconciliation_status,
    paid_at
  )
  values (
    matched_tenancy,
    attempt.landlord_id,
    attempt.id,
    callback_amount,
    'stk_push',
    callback_receipt,
    callback_checkout_request_id,
    callback_phone,
    null,
    'succeeded',
    match_status,
    callback_paid_at
  )
  on conflict (provider_transaction_id) do nothing
  returning id into payment_id;

  if payment_id is null then
    select * into existing_payment
    from public.payments
    where provider_transaction_id = callback_receipt;

    if existing_payment.payment_attempt_id is distinct from attempt.id
      or existing_payment.checkout_request_id is distinct from callback_checkout_request_id then
      raise exception 'provider receipt is already attached to another payment attempt'
        using errcode = '23505';
    end if;

    payment_id := existing_payment.id;
  end if;

  update public.payment_attempts
  set status = 'succeeded',
      result_code = callback_result_code,
      result_description = left(callback_result_description, 500)
  where id = attempt.id;

  update private.mpesa_webhook_events set processed_at = now() where id = event_id;
  return payment_id;
exception
  when others then
    if event_id is not null then
      update private.mpesa_webhook_events
      set processing_error = left(sqlerrm, 1000)
      where id = event_id;
    end if;
    raise;
end;
$$;

revoke execute on function public.record_mpesa_stk_callback(text, integer, text, text, numeric, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_mpesa_stk_callback(text, integer, text, text, numeric, text, timestamptz, jsonb)
  to service_role;

create or replace view public.tenancy_balances
with (security_invoker = true)
as
with rent_due as (
  select
    t.id as tenancy_id,
    count(month_start)::numeric * t.rent_amount as total_due
  from public.tenancies t
  left join lateral generate_series(
    date_trunc('month', t.start_date::timestamptz),
    date_trunc('month', least(current_date, coalesce(t.end_date, current_date))::timestamptz),
    interval '1 month'
  ) month_start on
    t.start_date <= current_date
    and (month_start + make_interval(days => t.billing_day - 1))::date >= t.start_date
    and (month_start + make_interval(days => t.billing_day - 1))::date
      <= least(current_date, coalesce(t.end_date, current_date))
  group by t.id, t.rent_amount
),
paid as (
  select
    p.tenancy_id,
    coalesce(sum(p.amount) filter (where p.status = 'succeeded'), 0) as total_paid
  from public.payments p
  where p.tenancy_id is not null
  group by p.tenancy_id
)
select
  t.id as tenancy_id,
  t.tenant_id,
  t.unit_id,
  coalesce(r.total_due, 0)::numeric(12,2) as total_due,
  coalesce(p.total_paid, 0)::numeric(12,2) as total_paid,
  greatest(coalesce(r.total_due, 0) - coalesce(p.total_paid, 0), 0)::numeric(12,2) as balance
from public.tenancies t
left join rent_due r on r.tenancy_id = t.id
left join paid p on p.tenancy_id = t.id;

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenancies enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payments enable row level security;
alter table public.payment_reconciliations enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_status_history enable row level security;

create policy profiles_select_authorized on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.tenancies t
    join public.units u on u.id = t.unit_id
    join public.properties p on p.id = u.property_id
    where t.tenant_id = profiles.id
      and p.landlord_id = (select auth.uid())
  )
);

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Tenants can read the property row their unit belongs to (name/address for
-- their lease view, and required for the STK push tenancy->property join).
-- A single permissive policy avoids evaluating two policies for every row.
create policy properties_select_authorized on public.properties
for select to authenticated
using (
  landlord_id = (select auth.uid())
  or (select private.is_tenant_of_property(id))
);

create policy properties_landlord_insert on public.properties
for insert to authenticated
with check (
  landlord_id = (select auth.uid())
  and (select private.current_user_is_landlord())
);

create policy properties_landlord_update on public.properties
for update to authenticated
using (landlord_id = (select auth.uid()))
with check (landlord_id = (select auth.uid()));

create policy properties_landlord_delete on public.properties
for delete to authenticated
using (landlord_id = (select auth.uid()));

create policy units_select_authorized on public.units
for select to authenticated
using (
  (select private.is_landlord_of_property(property_id))
  or exists (
    select 1 from public.tenancies t
    where t.unit_id = units.id and t.tenant_id = (select auth.uid())
  )
);

create policy units_landlord_insert on public.units
for insert to authenticated
with check ((select private.is_landlord_of_property(property_id)));

create policy units_landlord_update on public.units
for update to authenticated
using ((select private.is_landlord_of_property(property_id)))
with check ((select private.is_landlord_of_property(property_id)));

create policy units_landlord_delete on public.units
for delete to authenticated
using ((select private.is_landlord_of_property(property_id)));

create policy tenancies_select_authorized on public.tenancies
for select to authenticated
using (
  tenant_id = (select auth.uid())
  or (select private.is_landlord_of_unit(unit_id))
);

create policy tenancies_landlord_insert on public.tenancies
for insert to authenticated
with check ((select private.is_landlord_of_unit(unit_id)));

create policy tenancies_landlord_update on public.tenancies
for update to authenticated
using ((select private.is_landlord_of_tenancy(id)))
with check ((select private.is_landlord_of_unit(unit_id)));

create policy tenant_invitations_select_authorized on public.tenant_invitations
for select to authenticated
using (
  landlord_id = (select auth.uid())
  or phone = (select private.current_user_verified_phone())
);

create policy payment_attempts_select_authorized on public.payment_attempts
for select to authenticated
using (
  landlord_id = (select auth.uid())
  or (select private.can_access_tenancy(tenancy_id))
);

create policy payments_select_authorized on public.payments
for select to authenticated
using (
  landlord_id = (select auth.uid())
  or (tenancy_id is not null and (select private.can_access_tenancy(tenancy_id)))
);

create policy payment_reconciliations_landlord_select on public.payment_reconciliations
for select to authenticated
using (
  exists (
    select 1
    from public.payments p
    where p.id = payment_id and p.landlord_id = (select auth.uid())
  )
);

create policy maintenance_select_authorized on public.maintenance_requests
for select to authenticated
using ((select private.can_access_tenancy(tenancy_id)));

create policy maintenance_tenant_insert on public.maintenance_requests
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.tenancies t
    where t.id = tenancy_id
      and t.tenant_id = (select auth.uid())
      and t.status = 'active'
  )
);

create policy maintenance_landlord_update on public.maintenance_requests
for update to authenticated
using ((select private.is_landlord_of_tenancy(tenancy_id)))
with check ((select private.is_landlord_of_tenancy(tenancy_id)));

create policy maintenance_history_select_authorized on public.maintenance_status_history
for select to authenticated
using (
  exists (
    select 1
    from public.maintenance_requests m
    where m.id = maintenance_request_id
      and (select private.can_access_tenancy(m.tenancy_id))
  )
);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant usage on schema public to authenticated;
grant usage on schema public to service_role;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.properties to authenticated;
grant select, insert, update, delete on public.units to authenticated;
grant select, insert, update on public.tenancies to authenticated;
grant select on public.tenant_invitations to authenticated;
grant select on public.payment_attempts, public.payments, public.payment_reconciliations to authenticated;
grant select, insert, update on public.payment_attempts to service_role;
grant select, insert, update on public.maintenance_requests to authenticated;
grant select on public.maintenance_status_history, public.tenancy_balances to authenticated;
grant usage, select on sequence public.payment_reconciliations_id_seq to service_role;
grant usage, select on sequence public.maintenance_status_history_id_seq to service_role;

grant execute on function public.register_as_landlord() to authenticated;
grant execute on function public.resolve_unmatched_payment(uuid, uuid, text) to authenticated;
grant execute on function public.create_tenant_invitation(uuid, text, numeric, smallint, date, date) to authenticated;
grant execute on function public.accept_tenant_invitation(uuid) to authenticated;
grant execute on function public.cancel_tenant_invitation(uuid) to authenticated;
grant execute on function public.record_mpesa_stk_callback(text, integer, text, text, numeric, text, timestamptz, jsonb)
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-photos',
  'maintenance-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy maintenance_photos_select_authorized on storage.objects
for select to authenticated
using (
  bucket_id = 'maintenance-photos'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (select private.can_access_tenancy(((storage.foldername(name))[1])::uuid))
);

create policy maintenance_photos_tenant_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'maintenance-photos'
  and array_length(storage.foldername(name), 1) >= 2
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.tenancies t
    where t.id = ((storage.foldername(name))[1])::uuid
      and t.tenant_id = (select auth.uid())
      and t.status = 'active'
  )
);

create policy maintenance_photos_tenant_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'maintenance-photos'
  and owner_id = (select auth.uid()::text)
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'maintenance_requests'
  ) then
    alter publication supabase_realtime add table public.maintenance_requests;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'maintenance_status_history'
  ) then
    alter publication supabase_realtime add table public.maintenance_status_history;
  end if;
end;
$$;

commit;
