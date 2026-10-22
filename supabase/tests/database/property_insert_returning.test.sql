-- Regression test for the 2026-07-22 property-creation incident.
-- See docs/incidents/2026-07-22-property-creation-rls.md.
--
-- The web app creates a property with `insert(...).select()`, which PostgREST
-- runs as INSERT ... RETURNING. RETURNING is filtered by the SELECT policy, so
-- the SELECT policy must admit the owner on the row being inserted, not only
-- rows that a lookup by id can already see.
begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(4);

insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000001', 'onboarding-landlord@kodara.test'),
  ('a1000000-0000-4000-8000-000000000002', 'other-landlord@kodara.test');

update public.profiles set role = 'landlord'
where id in (
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$insert into public.properties (landlord_id, name, address)
    values ('a1000000-0000-4000-8000-000000000001', 'First Property', 'Nairobi')
    returning id$$,
  'a landlord can create a property and read it back in the same statement'
);

select is(
  (select count(*)::integer from public.properties where name = 'First Property'),
  1,
  'the new property is visible to its owner'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.properties where name = 'First Property'),
  0,
  'another landlord cannot see the property'
);

select throws_ok(
  $$insert into public.properties (landlord_id, name, address)
    values ('a1000000-0000-4000-8000-000000000001', 'Spoofed Owner', 'Nairobi')
    returning id$$,
  '42501',
  'new row violates row-level security policy for table "properties"',
  'a landlord cannot create a property owned by someone else'
);

reset role;

select * from finish();
rollback;
