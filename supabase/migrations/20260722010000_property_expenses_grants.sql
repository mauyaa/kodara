-- Fix: 20260722000000_property_expenses.sql added RLS policies for
-- property_expenses but never granted the underlying table privileges to
-- `authenticated` -- RLS restricts which rows a role can touch, but Postgres
-- still requires the base GRANT before RLS is even evaluated. Every other
-- table in this schema has this grant (see the block of `grant select,
-- insert, update, delete on public.<table> to authenticated` statements at
-- the end of 20260701000000_core_schema.sql); this one was missed. Caught by
-- the pgTAP suite in CI ("permission denied for table property_expenses"),
-- not by local testing, since Docker wasn't available to run it locally
-- before this shipped.

grant select, insert, update, delete on public.property_expenses to authenticated;
