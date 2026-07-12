begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(45);

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

-- Per-landlord M-Pesa credential isolation and RPC round-trip.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select is(
  (select shortcode from public.set_landlord_mpesa_credentials('400200', 'test-consumer-key', 'test-consumer-secret-value', 'test-passkey-value', 'sandbox')),
  '400200',
  'landlord can connect their own M-Pesa credentials'
);
select is(
  (select connected from public.landlord_mpesa_connection_status()),
  true,
  'landlord sees their own M-Pesa connection as connected'
);
select is(
  (select masked_shortcode from public.landlord_mpesa_connection_status()),
  '***200',
  'connection status masks the shortcode'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is(
  (select connected from public.landlord_mpesa_connection_status()),
  false,
  'a different landlord does not see landlord A''s M-Pesa connection'
);

select ok(
  not has_table_privilege('authenticated', 'private.landlord_mpesa_credentials', 'select'),
  'authenticated role has no direct table access to M-Pesa credentials'
);
select ok(
  not has_function_privilege('authenticated', 'public.get_landlord_mpesa_credentials(uuid)', 'execute'),
  'authenticated role cannot decrypt M-Pesa credentials directly'
);

reset role;

-- eTIMS credential isolation and RPC round-trip (same shape as M-Pesa above).
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select is(
  (select kra_pin from public.set_landlord_etims_credentials('A123456789Z', 'CU-SERIAL-0001', 'oscu', 'sandbox')),
  'A123456789Z',
  'landlord can connect their own eTIMS credentials'
);
select is(
  (select connected from public.landlord_etims_connection_status()),
  true,
  'landlord sees their own eTIMS connection as connected'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is(
  (select connected from public.landlord_etims_connection_status()),
  false,
  'a different landlord does not see landlord A''s eTIMS connection'
);

select ok(
  not has_table_privilege('authenticated', 'private.landlord_etims_credentials', 'select'),
  'authenticated role has no direct table access to eTIMS credentials'
);
select ok(
  not has_function_privilege('authenticated', 'public.get_landlord_etims_credentials(uuid)', 'execute'),
  'authenticated role cannot decrypt eTIMS credentials directly'
);

reset role;

-- A matched payment automatically enqueues a pending tax invoice.
insert into public.payments (
  id, tenancy_id, landlord_id, amount, method, provider_transaction_id,
  reconciliation_status, paid_at
) values (
  '70000000-0000-4000-8000-000000000003',
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  25000, 'stk_push', 'TEST-ETIMS-ENQUEUE',
  'matched_auto', now()
);
select is(
  (select status from public.tax_invoices where payment_id = '70000000-0000-4000-8000-000000000003'),
  'pending',
  'a matched rent payment automatically enqueues a pending tax invoice'
);

-- Tenant-landlord messaging: send, landlord visibility, cross-landlord
-- isolation, and self-read-marking is blocked.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);

select is(
  (select body from public.send_message('50000000-0000-4000-8000-000000000001', 'Hello landlord')),
  'Hello landlord',
  'a tenant can send a message on their own tenancy'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is(
  (
    select count(*)::integer from public.messages m
    join public.message_threads mt on mt.id = m.thread_id
    where mt.tenancy_id = '50000000-0000-4000-8000-000000000001'
  ),
  1,
  'the owning landlord can see a message on their tenancy'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is(
  (
    select count(*)::integer from public.message_threads
    where tenancy_id = '50000000-0000-4000-8000-000000000001'
  ),
  0,
  'a different landlord cannot see a thread on a tenancy they do not own'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
update public.messages
set read_at = now()
where thread_id = (
  select id from public.message_threads
  where tenancy_id = '50000000-0000-4000-8000-000000000001'
)
and sender_id = '20000000-0000-4000-8000-000000000001';
select is(
  (
    select read_at from public.messages
    where thread_id = (
      select id from public.message_threads
      where tenancy_id = '50000000-0000-4000-8000-000000000001'
    )
    and sender_id = '20000000-0000-4000-8000-000000000001'
  ),
  null,
  'a sender cannot mark their own message as read (RLS silently excludes the row)'
);

reset role;

-- Landlord-facing notifications: the triggers added for the dead
-- notification bell actually fire for maintenance and matched payments.
select is(
  (select count(*)::integer from public.notifications where profile_id = '10000000-0000-4000-8000-000000000001' and type = 'maintenance_submitted'),
  1,
  'a submitted maintenance request notifies the owning landlord'
);
select ok(
  (select count(*)::integer from public.notifications where profile_id = '10000000-0000-4000-8000-000000000001' and type = 'payment_received') >= 1,
  'a matched payment notifies the owning landlord'
);

-- End-of-tenancy: the owning landlord can end an active tenancy, and doing
-- so frees the unit for a new one (partial unique index no longer blocks it).
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select is(
  (select status from public.end_tenancy('50000000-0000-4000-8000-000000000001', current_date, 'moved out')),
  'ended',
  'a landlord can end their own tenancy'
);
select is(
  (select count(*)::integer from public.tenancies where unit_id = '40000000-0000-4000-8000-000000000001' and status in ('pending', 'active')),
  0,
  'ending a tenancy frees the unit for a new one'
);

reset role;

-- Billing entitlements: existing landlords were backfilled onto a trialing
-- Starter subscription, and the property cap it carries is enforced by RLS.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select is(
  (select plan_name from public.landlord_subscription_status()),
  'Starter',
  'an existing landlord was backfilled onto the Starter plan'
);
select is(
  (select status from public.landlord_subscription_status()),
  'trialing',
  'the backfilled subscription starts in trial'
);
-- Message is asserted, not just the SQLSTATE: a "permission denied for
-- function" error shares 42501 with an actual RLS violation, and a bug once
-- made this test pass for the wrong reason (see landlord_can_add_property's
-- grant history in 20260712060000_billing_entitlements.sql).
select throws_ok(
  $$insert into public.properties (landlord_id, name, address)
    values ('10000000-0000-4000-8000-000000000001', 'Second Property', 'Nairobi')$$,
  '42501',
  'new row violates row-level security policy for table "properties"',
  'a landlord on the Starter plan cannot exceed its one-property cap'
);

reset role;

select * from finish();
rollback;
