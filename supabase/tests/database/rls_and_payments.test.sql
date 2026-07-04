begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

-- Fixed identities keep failures readable.
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'landlord-a@kodara.test'),
  ('10000000-0000-4000-8000-000000000002', 'landlord-b@kodara.test'),
  ('20000000-0000-4000-8000-000000000001', 'tenant-a@kodara.test'),
  ('20000000-0000-4000-8000-000000000002', 'tenant-b@kodara.test');

update auth.users
set phone = '+254700000001', phone_confirmed_at = now()
where id = '20000000-0000-4000-8000-000000000001';
update auth.users
set phone = '+254700000002', phone_confirmed_at = now()
where id = '20000000-0000-4000-8000-000000000002';

update public.profiles
set role = 'landlord', full_name = 'Landlord A'
where id = '10000000-0000-4000-8000-000000000001';
update public.profiles
set role = 'landlord', full_name = 'Landlord B'
where id = '10000000-0000-4000-8000-000000000002';
update public.profiles
set full_name = 'Tenant A'
where id = '20000000-0000-4000-8000-000000000001';
update public.profiles
set full_name = 'Tenant B'
where id = '20000000-0000-4000-8000-000000000002';

insert into public.properties (id, landlord_id, name, address) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'A Apartments', 'Nairobi'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'B Apartments', 'Nakuru');

insert into public.units (id, property_id, name) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'A1'),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'A2'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'B1');

insert into public.tenant_invitations (
  id, unit_id, landlord_id, phone, rent_amount, billing_day, start_date
) values (
  '61000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '254700000001',
  22000,
  5,
  current_date
);

insert into public.tenancies (
  id, unit_id, tenant_id, rent_amount, billing_day, payment_reference, start_date
) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 25000, 5, 'KDR-TENANT-A', current_date - 30),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 18000, 5, 'KDR-TENANT-B', current_date - 30);

insert into public.maintenance_requests (
  id, tenancy_id, title, description, created_by
) values (
  '60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'Leaking tap',
  'The kitchen tap is leaking continuously.',
  '20000000-0000-4000-8000-000000000001'
);

insert into public.payments (
  id, landlord_id, amount, method, provider_transaction_id,
  reconciliation_status, paid_at
) values
  ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 25000, 'c2b', 'TEST-UNMATCHED-A1', 'unmatched', now()),
  ('70000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 25000, 'c2b', 'TEST-UNMATCHED-A2', 'unmatched', now());

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer from public.properties),
  1,
  'landlord sees only their property'
);
select is(
  (select count(*)::integer from public.tenancies),
  1,
  'landlord sees only tenancies in their hierarchy'
);
select is(
  (select count(*)::integer from public.payments where reconciliation_status = 'unmatched'),
  2,
  'landlord sees their unmatched queue'
);

select throws_ok(
  $$select public.resolve_unmatched_payment(
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    'cross-landlord attempt'
  )$$,
  '42501',
  'target tenancy is not owned by caller',
  'landlord cannot reconcile into another landlord tenancy'
);

select lives_ok(
  $$select public.resolve_unmatched_payment(
    '70000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'verified receipt'
  )$$,
  'landlord can reconcile into their tenancy'
);
select is(
  (select count(*)::integer from public.payment_reconciliations),
  1,
  'manual reconciliation is audited'
);

select lives_ok(
  $$insert into public.tenancies (
      id, unit_id, tenant_id, rent_amount, billing_day, payment_reference, start_date, status
    ) values (
      '50000000-0000-4000-8000-000000000003',
      '40000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000002',
      22000, 5, 'KDR-RLS-INSERT', current_date, 'pending'
    ) returning id$$,
  'landlord can create a tenancy without recursive RLS evaluation'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.tenant_invitations),
  0,
  'tenant cannot see an invitation for another verified phone'
);
select throws_ok(
  $$select public.accept_tenant_invitation('61000000-0000-4000-8000-000000000001')$$,
  '42501',
  'invitation is unavailable',
  'tenant cannot accept an invitation for another verified phone'
);
select is(
  has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE'),
  false,
  'authenticated users cannot rewrite their verified profile phone'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select is(
  (select count(*)::integer from public.tenancies),
  1,
  'tenant sees only their tenancy'
);
select is(
  (select count(*)::integer from public.properties),
  1,
  'tenant sees the property containing their unit and no others'
);
select is(
  (select name from public.properties),
  'A Apartments',
  'tenant sees exactly their own property row'
);
select is(
  (select count(*)::integer from public.payments),
  1,
  'tenant sees only matched payments on their tenancy'
);

update public.maintenance_requests
set status = 'in_progress'
where id = '60000000-0000-4000-8000-000000000001';
select is(
  (select status from public.maintenance_requests where id = '60000000-0000-4000-8000-000000000001'),
  'pending',
  'tenant cannot change maintenance status'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

update public.maintenance_requests
set status = 'in_progress'
where id = '60000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.maintenance_status_history where maintenance_request_id = '60000000-0000-4000-8000-000000000001'),
  2,
  'landlord status change appends immutable history'
);

select throws_ok(
  $$update public.maintenance_requests
    set status = 'completed'
    where id = '60000000-0000-4000-8000-000000000001';
    update public.maintenance_requests
    set status = 'pending'
    where id = '60000000-0000-4000-8000-000000000001'$$,
  '23514',
  'invalid maintenance status transition: completed to pending',
  'maintenance status cannot move backwards'
);

reset role;
insert into public.payment_attempts (
  id, tenancy_id, landlord_id, idempotency_key, requested_amount,
  requested_phone, checkout_request_id, status, requested_by
) values (
  '80000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'test-idempotency-key',
  25000,
  '254712345678',
  'ws_CO_TEST_DUPLICATE',
  'pending',
  '20000000-0000-4000-8000-000000000001'
);

select throws_ok(
  $$insert into public.payment_attempts (
    tenancy_id, landlord_id, idempotency_key, requested_amount,
    requested_phone, status, requested_by
  ) values (
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'concurrent-payment-key', 25000, '254712345678', 'requesting',
    '20000000-0000-4000-8000-000000000001'
  )$$,
  'P0001',
  'payment attempt already in progress',
  'a caller cannot create a second unresolved payment attempt'
);

set local role service_role;
select public.record_mpesa_stk_callback(
  'ws_CO_TEST_DUPLICATE', 0, 'Success', 'TEST-RECEIPT-001',
  25000, '254712345678', now(), '{"test":true}'::jsonb
);
select public.record_mpesa_stk_callback(
  'ws_CO_TEST_DUPLICATE', 0, 'Success', 'TEST-RECEIPT-001',
  25000, '254712345678', now(), '{"test":true}'::jsonb
);

reset role;
select is(
  (select count(*)::integer from public.payments where provider_transaction_id = 'TEST-RECEIPT-001'),
  1,
  'duplicate callbacks create one payment'
);
select is(
  (select reconciliation_status from public.payments where provider_transaction_id = 'TEST-RECEIPT-001'),
  'matched_auto',
  'matching STK callback attaches to the exact attempt tenancy'
);

insert into public.payment_attempts (
  id, tenancy_id, landlord_id, idempotency_key, requested_amount,
  requested_phone, checkout_request_id, status, requested_by
) values (
  '80000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'test-second-attempt-key',
  25000,
  '254712345678',
  'ws_CO_TEST_RECEIPT_COLLISION',
  'pending',
  '20000000-0000-4000-8000-000000000001'
);

select throws_ok(
  $$select public.record_mpesa_stk_callback(
    'ws_CO_TEST_RECEIPT_COLLISION', 0, 'Success', 'TEST-RECEIPT-001',
    25000, '254712345678', now(), '{"test":"receipt-collision"}'::jsonb
  )$$,
  '23505',
  'provider receipt is already attached to another payment attempt',
  'a provider receipt cannot silently complete a different payment attempt'
);

insert into public.payment_attempts (
  tenancy_id, landlord_id, idempotency_key, requested_amount,
  requested_phone, status, requested_by, created_at
)
select
  '50000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'rate-limit-key-' || n,
  18000,
  '254700000002',
  'failed',
  '20000000-0000-4000-8000-000000000002',
  now()
from generate_series(1, 5) n;

select throws_ok(
  $$insert into public.payment_attempts (
    tenancy_id, landlord_id, idempotency_key, requested_amount,
    requested_phone, status, requested_by
  ) values (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'rate-limit-key-6', 18000, '254700000002', 'failed',
    '20000000-0000-4000-8000-000000000002'
  )$$,
  'P0001',
  'payment attempt rate limit exceeded',
  'payment attempt rate limiting is enforced in the database'
);

select * from finish();
rollback;
