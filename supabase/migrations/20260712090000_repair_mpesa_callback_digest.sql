-- Second piece of schema drift found on the production project (see
-- 20260712055000's note): the deployed record_mpesa_stk_callback had an
-- unqualified `digest(...)` call that cannot resolve under this function's
-- `set search_path = ''`, silently breaking the single most important code
-- path in the product -- recording a successful M-Pesa payment. The
-- migration source (20260701000000) already schema-qualifies this call
-- correctly as `extensions.digest(...)`; this recreates the function
-- verbatim from that source to bring the live definition back in line.
-- Locally this was always correct (a fresh `db reset` always applies the
-- migration file's own text), which is why it was never caught until
-- `supabase db lint --linked` was run against the live project.

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
