-- End-of-tenancy / move-out. Tenancies are immutable by design
-- (private.protect_hierarchy_identity blocks unit_id/tenant_id/rent_amount/
-- billing_day/payment_reference/start_date changes) but status and end_date
-- were never blocked -- there was simply no RPC or UI that ever set them,
-- so a unit could never be freed for re-letting without direct SQL.

create or replace function public.end_tenancy(
  target_tenancy_id uuid,
  target_end_date date,
  note text default null
)
returns public.tenancies
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  result public.tenancies;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (select private.is_landlord_of_tenancy(target_tenancy_id)) then
    raise exception 'tenancy is not owned by caller' using errcode = '42501';
  end if;
  if note is not null and char_length(note) > 500 then
    raise exception 'note is too long' using errcode = '22001';
  end if;

  update public.tenancies
  set status = 'ended',
      end_date = target_end_date
  where id = target_tenancy_id
    and status in ('active', 'pending')
    and target_end_date >= start_date
  returning * into result;

  if result.id is null then
    raise exception 'tenancy cannot be ended (already ended, or end date is before the start date)'
      using errcode = '42501';
  end if;

  return result;
end;
$$;

revoke execute on function public.end_tenancy(uuid, date, text) from public, anon;
grant execute on function public.end_tenancy(uuid, date, text) to authenticated;
