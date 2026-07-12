-- eTIMS (KRA electronic tax invoicing) is now legally mandatory for every
-- Kenyan landlord (Jan 2026 eRITS mandate). Each landlord's rent invoices
-- must be issued under their own KRA PIN via their own registered OSCU/VSCU
-- device -- never Kodara's. Built sandbox/mock-first, mirroring how the
-- M-Pesa integration itself was hardened before real Safaricom credentials
-- existed: schema + retry queue are real now, the KRA call is swappable
-- later without a rewrite (see supabase/functions/_shared/etims.ts).

create table private.landlord_etims_credentials (
  landlord_id uuid primary key references public.profiles(id) on delete cascade,
  kra_pin text not null
    constraint landlord_etims_credentials_kra_pin_check
    check (kra_pin ~ '^[A-Z][0-9]{9}[A-Z]$'),
  cu_type text not null default 'oscu'
    constraint landlord_etims_credentials_cu_type_check
    check (cu_type in ('oscu', 'vscu')),
  environment text not null default 'sandbox'
    constraint landlord_etims_credentials_environment_check
    check (environment in ('sandbox', 'production')),
  vault_cu_serial_id uuid not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger landlord_etims_credentials_set_updated_at
before update on private.landlord_etims_credentials
for each row execute function private.set_updated_at();

create or replace function public.set_landlord_etims_credentials(
  target_kra_pin text,
  target_cu_serial text,
  target_cu_type text default 'oscu',
  target_environment text default 'sandbox'
)
returns table (kra_pin text, cu_type text, environment text, verified_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  existing private.landlord_etims_credentials;
  serial_id uuid;
  normalized_pin text := upper(trim(target_kra_pin));
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (select private.current_user_is_landlord()) then
    raise exception 'landlord account required' using errcode = '42501';
  end if;
  if normalized_pin !~ '^[A-Z][0-9]{9}[A-Z]$' then
    raise exception 'invalid KRA PIN' using errcode = '22023';
  end if;
  if length(coalesce(target_cu_serial, '')) < 4 then
    raise exception 'invalid device serial' using errcode = '22023';
  end if;
  if target_cu_type not in ('oscu', 'vscu') then
    raise exception 'invalid device type' using errcode = '22023';
  end if;
  if target_environment not in ('sandbox', 'production') then
    raise exception 'invalid environment' using errcode = '22023';
  end if;

  select * into existing
  from private.landlord_etims_credentials
  where landlord_id = caller_id;

  if existing.landlord_id is not null then
    perform vault.update_secret(existing.vault_cu_serial_id, target_cu_serial);
    update private.landlord_etims_credentials
    set kra_pin = normalized_pin,
        cu_type = target_cu_type,
        environment = target_environment,
        verified_at = null
    where landlord_id = caller_id;
  else
    serial_id := vault.create_secret(target_cu_serial, 'etims_cu_serial:' || caller_id);
    insert into private.landlord_etims_credentials (
      landlord_id, kra_pin, cu_type, environment, vault_cu_serial_id
    ) values (
      caller_id, normalized_pin, target_cu_type, target_environment, serial_id
    );
  end if;

  return query
  select c.kra_pin, c.cu_type, c.environment, c.verified_at
  from private.landlord_etims_credentials c
  where c.landlord_id = caller_id;
end;
$$;

create or replace function public.landlord_etims_connection_status()
returns table (connected boolean, kra_pin text, cu_type text, environment text, verified_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.landlord_id is not null,
    c.kra_pin,
    c.cu_type,
    c.environment,
    c.verified_at
  from (select (select auth.uid()) as id) me
  left join private.landlord_etims_credentials c on c.landlord_id = me.id;
$$;

create or replace function public.disconnect_landlord_etims()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.landlord_etims_credentials where landlord_id = (select auth.uid());
end;
$$;

-- Service-role-only public wrapper (see the M-Pesa migration's note on why
-- this must live in `public` for PostgREST to resolve it).
create or replace function public.get_landlord_etims_credentials(target_landlord_id uuid)
returns table (kra_pin text, cu_serial text, cu_type text, environment text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.kra_pin, s.decrypted_secret, c.cu_type, c.environment
  from private.landlord_etims_credentials c
  join vault.decrypted_secrets s on s.id = c.vault_cu_serial_id
  where c.landlord_id = target_landlord_id;
$$;

create or replace function public.mark_landlord_etims_verified(target_landlord_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.landlord_etims_credentials
  set verified_at = now()
  where landlord_id = target_landlord_id;
$$;

revoke execute on function public.set_landlord_etims_credentials(text, text, text, text) from public, anon;
grant execute on function public.set_landlord_etims_credentials(text, text, text, text) to authenticated;
revoke execute on function public.landlord_etims_connection_status() from public, anon;
grant execute on function public.landlord_etims_connection_status() to authenticated;
revoke execute on function public.disconnect_landlord_etims() from public, anon;
grant execute on function public.disconnect_landlord_etims() to authenticated;
revoke execute on function public.get_landlord_etims_credentials(uuid) from public, anon, authenticated;
grant execute on function public.get_landlord_etims_credentials(uuid) to service_role;
revoke execute on function public.mark_landlord_etims_verified(uuid) from public, anon, authenticated;
grant execute on function public.mark_landlord_etims_verified(uuid) to service_role;

-- Tax invoices: one per successfully matched rent payment. Status machine
-- styled after payment_attempts. `skipped_not_configured` mirrors the exact
-- graceful-skip philosophy rent-reminders already uses when Africa's Talking
-- isn't configured -- an unconnected landlord isn't a failure state.
create table public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  landlord_id uuid not null references public.profiles(id) on delete restrict,
  tenancy_id uuid not null references public.tenancies(id) on delete restrict,
  status text not null default 'pending'
    constraint tax_invoices_status_check
    check (status in ('pending', 'submitted', 'failed', 'skipped_not_configured')),
  kra_invoice_number text,
  control_unit_invoice_number text,
  qr_code_url text,
  error text,
  retry_count integer not null default 0,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tax_invoices_set_updated_at
before update on public.tax_invoices
for each row execute function private.set_updated_at();

create index tax_invoices_landlord_status_idx on public.tax_invoices (landlord_id, status, created_at desc);
create index tax_invoices_pending_idx on public.tax_invoices (status) where status = 'pending';
create index tax_invoices_tenancy_idx on public.tax_invoices (tenancy_id);

alter table public.tax_invoices enable row level security;

create policy tax_invoices_select_authorized on public.tax_invoices
for select to authenticated
using (
  landlord_id = (select auth.uid())
  or (select private.can_access_tenancy(tenancy_id))
);

grant select on public.tax_invoices to authenticated;
grant select, insert, update on public.tax_invoices to service_role;

-- service_role has no direct grant on payments/tenancies (deliberately
-- minimal, same posture as the M-Pesa credential functions) -- the
-- etims-submit Edge Function reads pending invoices through this narrow
-- SECURITY DEFINER RPC instead of a broad table grant.
create or replace function public.fetch_pending_tax_invoices()
returns table (
  id uuid,
  payment_id uuid,
  landlord_id uuid,
  retry_count integer,
  amount numeric,
  paid_at timestamptz,
  payment_reference text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ti.id,
    ti.payment_id,
    ti.landlord_id,
    ti.retry_count,
    p.amount,
    p.paid_at,
    t.payment_reference
  from public.tax_invoices ti
  join public.payments p on p.id = ti.payment_id
  join public.tenancies t on t.id = ti.tenancy_id
  where ti.status = 'pending'
  order by ti.created_at
  limit 100;
$$;

revoke execute on function public.fetch_pending_tax_invoices() from public, anon, authenticated;
grant execute on function public.fetch_pending_tax_invoices() to service_role;

-- Enqueue a tax invoice the moment a payment becomes a matched rent payment
-- (insert with an already-matched status, or a later reconciliation match).
-- Submission itself happens out-of-band via the etims-submit Edge Function so
-- a slow/unreachable KRA endpoint can never block payment recording.
create or replace function private.enqueue_tax_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reconciliation_status in ('matched_auto', 'matched_manual') and new.tenancy_id is not null then
    insert into public.tax_invoices (payment_id, landlord_id, tenancy_id)
    values (new.id, new.landlord_id, new.tenancy_id)
    on conflict (payment_id) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function private.enqueue_tax_invoice() from public, anon, authenticated;
create trigger payments_enqueue_tax_invoice
after insert or update of reconciliation_status on public.payments
for each row execute function private.enqueue_tax_invoice();

alter publication supabase_realtime add table public.tax_invoices;
