-- Manual "Mark as paid" recording. Every payment today requires a working
-- M-Pesa Daraja connection (method in ('stk_push', 'c2b')) -- there was no
-- way for a landlord to record rent collected by cash, bank transfer, or a
-- personal till without one. Most small landlords will never set up Daraja
-- API credentials, so this adds a manual path as the default, low-friction
-- way to track rent: no credentials, no provider, just amount + date.

alter table public.payments
  drop constraint payments_method_check,
  add constraint payments_method_check check (method in ('stk_push', 'c2b', 'manual'));

alter table public.payments
  drop constraint payments_provider_check,
  add constraint payments_provider_check check (provider in ('mpesa', 'manual'));

create or replace function public.record_manual_payment(
  target_tenancy_id uuid,
  payment_amount numeric,
  payment_date date,
  payment_note text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_landlord_id uuid;
  result public.payments;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (select private.is_landlord_of_tenancy(target_tenancy_id)) then
    raise exception 'tenancy is not owned by caller' using errcode = '42501';
  end if;
  if payment_amount is null or payment_amount <= 0 then
    raise exception 'amount must be greater than zero' using errcode = '22003';
  end if;
  if payment_date is null or payment_date > current_date then
    raise exception 'payment date cannot be in the future' using errcode = '22007';
  end if;
  if payment_note is not null and char_length(payment_note) > 500 then
    raise exception 'note is too long' using errcode = '22001';
  end if;

  select p.landlord_id into target_landlord_id
  from public.tenancies t
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  where t.id = target_tenancy_id;

  insert into public.payments (
    tenancy_id,
    landlord_id,
    amount,
    provider,
    method,
    provider_transaction_id,
    account_reference,
    status,
    reconciliation_status,
    paid_at
  )
  values (
    target_tenancy_id,
    target_landlord_id,
    payment_amount,
    'manual',
    'manual',
    'MANUAL-' || to_char(payment_date, 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
    payment_note,
    'succeeded',
    'matched_manual',
    payment_date::timestamptz
  )
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.record_manual_payment(uuid, numeric, date, text) from public, anon;
grant execute on function public.record_manual_payment(uuid, numeric, date, text) to authenticated;

-- A landlord recording their own manual payment doesn't need to be told
-- about it -- that notification only makes sense for payments that arrived
-- through a channel the landlord wasn't watching in the moment.
create or replace function private.notify_payment_recorded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.method = 'manual' then
    return new;
  end if;
  if tg_op = 'INSERT' or old.reconciliation_status is distinct from new.reconciliation_status then
    if new.reconciliation_status = 'unmatched' then
      perform private.notify(
        new.landlord_id, 'payment_unmatched', 'Payment needs review',
        format('A payment of Ksh %s could not be matched automatically.', to_char(new.amount, 'FM999,999,999')),
        null
      );
    elsif new.reconciliation_status in ('matched_auto', 'matched_manual')
      and (tg_op = 'INSERT' or old.reconciliation_status = 'unmatched') then
      perform private.notify(
        new.landlord_id, 'payment_received', 'Payment received',
        format('Ksh %s received and matched.', to_char(new.amount, 'FM999,999,999')),
        new.tenancy_id
      );
    end if;
  end if;
  return new;
end;
$$;
