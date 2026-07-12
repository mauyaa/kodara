-- The landlord notification bell in components/layout/topbar.tsx has always
-- been dead UI: `notifications` (from the rent-reminders migration) only
-- ever got populated for tenants. The table, RLS, and grants already work
-- for any profile_id -- only the landlord-facing trigger wiring was missing.

alter table public.notifications
  drop constraint notifications_type_check,
  add constraint notifications_type_check
  check (type in (
    'rent_due_soon', 'rent_due_today', 'rent_overdue', 'system',
    'payment_received', 'payment_unmatched', 'maintenance_submitted',
    'new_message', 'etims_failed'
  ));

create or replace function private.notify(
  target_profile_id uuid,
  notification_type text,
  notification_title text,
  notification_body text,
  target_tenancy_id uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (profile_id, tenancy_id, type, title, body, dedupe_key)
  values (
    target_profile_id, target_tenancy_id, notification_type, notification_title, notification_body,
    notification_type || ':' || target_profile_id || ':' || gen_random_uuid()
  );
$$;

revoke execute on function private.notify(uuid, text, text, text, uuid) from public, anon, authenticated;

create or replace function private.notify_payment_recorded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

revoke execute on function private.notify_payment_recorded() from public, anon, authenticated;
create trigger payments_notify_landlord
after insert or update of reconciliation_status on public.payments
for each row execute function private.notify_payment_recorded();

create or replace function private.notify_maintenance_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_landlord uuid;
begin
  select p.landlord_id into target_landlord
  from public.tenancies t
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  where t.id = new.tenancy_id;

  if target_landlord is not null then
    perform private.notify(target_landlord, 'maintenance_submitted', 'New maintenance request', new.title, new.tenancy_id);
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_maintenance_submitted() from public, anon, authenticated;
create trigger maintenance_notify_landlord
after insert on public.maintenance_requests
for each row execute function private.notify_maintenance_submitted();

create or replace function private.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_tenancy_id uuid;
  tenancy_tenant uuid;
  tenancy_landlord uuid;
  recipient uuid;
begin
  select mt.tenancy_id into target_tenancy_id
  from public.message_threads mt
  where mt.id = new.thread_id;

  select t.tenant_id, p.landlord_id into tenancy_tenant, tenancy_landlord
  from public.tenancies t
  join public.units u on u.id = t.unit_id
  join public.properties p on p.id = u.property_id
  where t.id = target_tenancy_id;

  recipient := case when new.sender_id = tenancy_tenant then tenancy_landlord else tenancy_tenant end;

  if recipient is not null then
    perform private.notify(recipient, 'new_message', 'New message', new.body, target_tenancy_id);
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_new_message() from public, anon, authenticated;
create trigger messages_notify_recipient
after insert on public.messages
for each row execute function private.notify_new_message();

create or replace function private.notify_tax_invoice_failed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'failed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.notify(
      new.landlord_id, 'etims_failed', 'eTIMS submission failed',
      coalesce(new.error, 'KRA submission failed and needs attention.'),
      new.tenancy_id
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_tax_invoice_failed() from public, anon, authenticated;
create trigger tax_invoices_notify_landlord
after insert or update of status on public.tax_invoices
for each row execute function private.notify_tax_invoice_failed();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
