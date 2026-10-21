-- Restore the direct owner check on properties_select_authorized.
--
-- 20260722040000_property_staff replaced `landlord_id = auth.uid()` with
-- private.is_landlord_of_property(id) so staff could read the property row.
-- That helper looks the property up by id, and during INSERT ... RETURNING
-- the new row is not yet visible to it, so the RETURNING check failed and
-- every `insert(...).select()` on properties was rejected with 42501
-- ("new row violates row-level security policy"). Landlord onboarding uses
-- exactly that call.
--
-- The direct column check passes for the owner on the new row itself; the
-- helper still covers active staff, and tenants keep their existing access.
drop policy properties_select_authorized on public.properties;
create policy properties_select_authorized on public.properties
for select to authenticated
using (
  landlord_id = (select auth.uid())
  or (select private.is_landlord_of_property(id))
  or (select private.is_tenant_of_property(id))
);
