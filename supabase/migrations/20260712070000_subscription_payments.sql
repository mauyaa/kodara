-- Kodara's own subscription revenue, deliberately on a ledger completely
-- separate from `payments` (tenant rent). `payments`/RLS/reconciliation
-- throughout this schema assume "a payment is rent" -- mixing Kodara's own
-- collection into that table would break every one of those assumptions.
-- Supports both M-Pesa (STK to Kodara's own shortcode, env-configured --
-- there is exactly one Kodara business, unlike the per-landlord rent
-- shortcodes) and card/bank via Paystack.

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete restrict,
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  amount numeric(10,2) not null constraint subscription_payments_amount_check check (amount > 0),
  method text not null constraint subscription_payments_method_check check (method in ('mpesa_stk', 'paystack')),
  idempotency_key text constraint subscription_payments_idempotency_key_check
    check (idempotency_key is null or char_length(idempotency_key) between 8 and 100),
  provider_reference text,
  checkout_request_id text,
  status text not null default 'pending'
    constraint subscription_payments_status_check check (status in ('pending', 'succeeded', 'failed')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_payments_idempotency_key_unique unique (landlord_id, idempotency_key)
);

create unique index subscription_payments_provider_reference_idx
  on public.subscription_payments (provider_reference) where provider_reference is not null;
create index subscription_payments_landlord_created_idx
  on public.subscription_payments (landlord_id, created_at desc);
create index subscription_payments_pending_idx
  on public.subscription_payments (landlord_id, status) where status = 'pending';

create trigger subscription_payments_set_updated_at
before update on public.subscription_payments
for each row execute function private.set_updated_at();

alter table public.subscription_payments enable row level security;

create policy subscription_payments_select_own on public.subscription_payments
for select to authenticated
using (landlord_id = (select auth.uid()));

grant select on public.subscription_payments to authenticated;
grant select, insert, update on public.subscription_payments to service_role;
grant select, update on public.subscriptions to service_role;

-- Landlord-callable: reserves an idempotent M-Pesa subscription payment
-- attempt. The STK push itself happens in the edge function (needs the
-- Daraja HTTP round trip); this just does the ownership/idempotency work
-- the same way payment_attempts does for rent.
create or replace function public.reserve_subscription_payment(
  target_amount numeric,
  target_method text,
  target_idempotency_key text
)
returns public.subscription_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_subscription_id uuid;
  existing public.subscription_payments;
  result public.subscription_payments;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if target_amount <= 0 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;
  if target_method not in ('mpesa_stk', 'paystack') then
    raise exception 'invalid method' using errcode = '22023';
  end if;

  select id into caller_subscription_id from public.subscriptions where landlord_id = caller_id;
  if caller_subscription_id is null then
    raise exception 'no subscription found for caller' using errcode = '42501';
  end if;

  select * into existing
  from public.subscription_payments
  where landlord_id = caller_id and idempotency_key = target_idempotency_key;
  if existing.id is not null then
    return existing;
  end if;

  insert into public.subscription_payments (landlord_id, subscription_id, amount, method, idempotency_key)
  values (caller_id, caller_subscription_id, target_amount, target_method, target_idempotency_key)
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.reserve_subscription_payment(numeric, text, text) from public, anon;
grant execute on function public.reserve_subscription_payment(numeric, text, text) to authenticated;

-- Service-role-only: records a successful subscription payment and extends
-- the subscription period. Called from the M-Pesa callback and Paystack
-- webhook edge functions.
create or replace function public.record_subscription_payment_success(
  target_payment_id uuid,
  target_provider_reference text,
  target_paid_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.subscription_payments;
begin
  update public.subscription_payments
  set status = 'succeeded',
      provider_reference = target_provider_reference,
      paid_at = target_paid_at
  where id = target_payment_id
    and status = 'pending'
  returning * into payment_row;

  if payment_row.id is null then
    return;
  end if;

  update public.subscriptions
  set status = 'active',
      current_period_end = greatest(coalesce(current_period_end, now()), now()) + interval '30 days'
  where id = payment_row.subscription_id;
end;
$$;

revoke execute on function public.record_subscription_payment_success(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_subscription_payment_success(uuid, text, timestamptz) to service_role;

create or replace function public.record_subscription_payment_failure(target_payment_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.subscription_payments
  set status = 'failed'
  where id = target_payment_id and status = 'pending';
$$;

revoke execute on function public.record_subscription_payment_failure(uuid) from public, anon, authenticated;
grant execute on function public.record_subscription_payment_failure(uuid) to service_role;
