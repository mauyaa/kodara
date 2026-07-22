-- Security deposits (Tier 2). No deposit_amount, no ledger, no refund/
-- deduction workflow anywhere in the schema today -- landlords have no way
-- to record what was collected at move-in or what happens to it at
-- move-out. Threads deposit terms through the same invitation -> tenancy
-- flow rent already uses, and adds a ledger (not a single mutable number)
-- so refunds and deductions leave an audit trail, matching this schema's
-- payment-reconciliation convention rather than a bare column update.

alter table public.tenant_invitations
  add column deposit_amount numeric(12,2)
    constraint tenant_invitations_deposit_amount_check check (deposit_amount is null or deposit_amount >= 0);

alter table public.tenancies
  add column deposit_amount numeric(12,2)
    constraint tenancies_deposit_amount_check check (deposit_amount is null or deposit_amount >= 0);

-- create_tenant_invitation gains a trailing optional deposit parameter.
-- Dropped and recreated rather than create-or-replace: Postgres treats an
-- added parameter as a distinct overload, not a replacement of the
-- existing function, which would leave both signatures live and risk
-- PostgREST resolving the wrong one.
drop function public.create_tenant_invitation(uuid, text, numeric, smallint, date, date);

create function public.create_tenant_invitation(
  target_unit_id uuid,
  tenant_phone text,
  tenancy_rent numeric,
  tenancy_billing_day smallint,
  tenancy_start_date date,
  tenancy_end_date date default null,
  tenancy_deposit_amount numeric default null
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
  if tenancy_deposit_amount is not null and tenancy_deposit_amount < 0 then
    raise exception 'deposit amount cannot be negative' using errcode = '22023';
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
    end_date,
    deposit_amount
  ) values (
    target_unit_id,
    caller_id,
    normalized_phone,
    tenancy_rent,
    tenancy_billing_day,
    tenancy_start_date,
    tenancy_end_date,
    tenancy_deposit_amount
  )
  returning * into invitation;

  return invitation;
end;
$$;

revoke execute on function public.create_tenant_invitation(uuid, text, numeric, smallint, date, date, numeric) from public, anon;
grant execute on function public.create_tenant_invitation(uuid, text, numeric, smallint, date, date, numeric) to authenticated;

-- accept_tenant_invitation's own signature is unchanged -- create or replace
-- is fine here, only the body needs to carry deposit_amount onto the new
-- tenancy row.
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
    deposit_amount,
    status
  ) values (
    invitation.unit_id,
    caller_id,
    invitation.rent_amount,
    invitation.billing_day,
    invitation.start_date,
    invitation.end_date,
    invitation.deposit_amount,
    'active'
  )
  returning * into tenancy;

  update public.tenant_invitations
  set status = 'accepted', accepted_by = caller_id, accepted_at = now()
  where id = invitation.id;

  return tenancy;
end;
$$;

-- The deposit ledger. Refunds and deductions only, since deposit_amount on
-- the tenancy itself already represents what was collected at move-in;
-- writes only ever happen through record_deposit_transaction below, which
-- is the only thing enforcing that a tenancy's refunds+deductions can never
-- exceed what was actually collected -- a plain RLS insert policy can't
-- express that aggregate check.
create table public.deposit_transactions (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references public.tenancies(id) on delete restrict,
  type text not null constraint deposit_transactions_type_check check (type in ('refund', 'deduction')),
  amount numeric(12,2) not null constraint deposit_transactions_amount_positive check (amount > 0),
  note text not null constraint deposit_transactions_note_check check (char_length(trim(note)) between 2 and 240),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index deposit_transactions_tenancy_idx on public.deposit_transactions (tenancy_id, created_at desc);

alter table public.deposit_transactions enable row level security;

create policy deposit_transactions_select_authorized on public.deposit_transactions
for select to authenticated
using ((select private.can_access_tenancy(tenancy_id)));

grant select on public.deposit_transactions to authenticated;

create or replace function public.record_deposit_transaction(
  target_tenancy_id uuid,
  transaction_type text,
  transaction_amount numeric,
  transaction_note text
)
returns public.deposit_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  collected numeric;
  already_settled numeric;
  result public.deposit_transactions;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (select private.is_landlord_of_tenancy(target_tenancy_id)) then
    raise exception 'tenancy is not owned by caller' using errcode = '42501';
  end if;
  if transaction_type not in ('refund', 'deduction') then
    raise exception 'invalid transaction type' using errcode = '22023';
  end if;
  if transaction_amount is null or transaction_amount <= 0 then
    raise exception 'amount must be greater than zero' using errcode = '22003';
  end if;
  if transaction_note is null or char_length(trim(transaction_note)) < 2 then
    raise exception 'a note is required' using errcode = '22023';
  end if;

  -- Row-locked so two concurrent calls against the same tenancy can't both
  -- read the same running total and together exceed the deposit.
  select deposit_amount into collected from public.tenancies where id = target_tenancy_id for update;

  if collected is null or collected <= 0 then
    raise exception 'this tenancy has no deposit on record' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into already_settled
  from public.deposit_transactions
  where tenancy_id = target_tenancy_id;

  if already_settled + transaction_amount > collected then
    raise exception 'this would exceed the deposit collected' using errcode = '22003';
  end if;

  insert into public.deposit_transactions (tenancy_id, type, amount, note, created_by)
  values (target_tenancy_id, transaction_type, transaction_amount, trim(transaction_note), caller_id)
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.record_deposit_transaction(uuid, text, numeric, text) from public, anon;
grant execute on function public.record_deposit_transaction(uuid, text, numeric, text) to authenticated;
