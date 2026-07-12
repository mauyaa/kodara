-- Repairs schema drift discovered on the production project while pushing
-- Tier 0/1/3: five private-schema helper functions and one trigger from the
-- original core migration (20260701000000) were missing from the live
-- database despite that migration being recorded as applied -- breaking
-- property/unit/tenancy creation and phone-verification syncing entirely,
-- predating this session's work. Recreated verbatim from that migration
-- file; every definition here is unchanged from the original and has been
-- exercised by the 45 pgTAP assertions in supabase/tests/database.

create or replace function private.is_landlord_of_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.units u
      join public.properties p on p.id = u.property_id
      where u.id = target_unit_id
        and p.landlord_id = (select auth.uid())
    );
$$;

create or replace function private.is_tenant_of_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.tenancies t
      join public.units u on u.id = t.unit_id
      where u.property_id = target_property_id
        and t.tenant_id = (select auth.uid())
    );
$$;

create or replace function private.current_user_is_landlord()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'landlord'
  );
$$;

create or replace function private.current_user_verified_phone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select replace(u.phone, '+', '')
  from auth.users u
  where u.id = (select auth.uid())
    and u.phone_confirmed_at is not null
    and u.phone ~ '^\+?254[17][0-9]{8}$'
$$;

revoke execute on function private.is_landlord_of_unit(uuid) from public, anon;
revoke execute on function private.is_tenant_of_property(uuid) from public, anon;
revoke execute on function private.current_user_is_landlord() from public, anon;
revoke execute on function private.current_user_verified_phone() from public, anon;
grant execute on function private.is_landlord_of_unit(uuid) to authenticated;
grant execute on function private.is_tenant_of_property(uuid) to authenticated;
grant execute on function private.current_user_is_landlord() to authenticated;
grant execute on function private.current_user_verified_phone() to authenticated;

create or replace function private.sync_verified_user_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set phone = case
    when new.phone_confirmed_at is not null
      and coalesce(new.phone, '') ~ '^\+?254[17][0-9]{8}$'
      then replace(new.phone, '+', '')
    else null
  end
  where id = new.id;
  return new;
end;
$$;

revoke execute on function private.sync_verified_user_phone() from public, anon, authenticated;

drop trigger if exists on_auth_user_phone_verified on auth.users;
create trigger on_auth_user_phone_verified
after update of phone, phone_confirmed_at on auth.users
for each row execute function private.sync_verified_user_phone();
