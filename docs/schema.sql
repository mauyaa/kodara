-- Kodara v1.0 production schema for Supabase/PostgreSQL 15+
-- Apply to a new project, then run the Supabase security advisors.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  email text,
  full_name text,
  national_id text,
  role text not null default 'tenant' check (role in ('landlord','property_manager','property_agent','tenant','vendor','admin_staff')),
  permissions jsonb not null default '{}',
  avatar_url text,
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_number text,
  kra_pin text,
  phone text,
  email text,
  address text,
  subscription_tier text not null default 'starter' check (subscription_tier in ('starter','professional','enterprise')),
  subscription_expires_at timestamptz,
  mpesa_paybill_number text,
  mpesa_till_number text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','manager','agent','accountant','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  landlord_id uuid references public.profiles(id),
  name text not null,
  address text not null,
  county text,
  town text,
  latitude numeric(10,8),
  longitude numeric(11,8),
  property_type text not null default 'apartment' check (property_type in ('apartment','flat','house','commercial','land')),
  total_units integer not null default 0 check (total_units >= 0),
  year_built integer,
  amenities text[],
  photos text[],
  documents jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists properties_organization_idx on public.properties(organization_id);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_name text not null,
  floor integer,
  bedrooms integer,
  bathrooms integer,
  size_sqm numeric(8,2),
  monthly_rent numeric(12,2) not null check (monthly_rent > 0),
  deposit_amount numeric(12,2) not null default 0,
  service_charge_monthly numeric(12,2) not null default 0,
  status text not null default 'vacant' check (status in ('vacant','occupied','maintenance','reserved')),
  occupied_from date,
  occupied_until date,
  utilities_config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id, unit_name)
);
create index if not exists units_property_idx on public.units(property_id);

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  tenant_id uuid not null references public.profiles(id),
  start_date date not null,
  end_date date,
  lease_type text not null default 'month_to_month' check (lease_type in ('fixed','periodic','month_to_month')),
  rent_amount numeric(12,2) not null check (rent_amount > 0),
  deposit_paid numeric(12,2) not null default 0,
  terms text,
  document_url text,
  status text not null default 'pending' check (status in ('active','terminated','expired','pending')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  unit_id uuid not null references public.units(id),
  lease_id uuid references public.leases(id),
  move_in_date date not null,
  move_out_date date,
  status text not null default 'active' check (status in ('active','moved_out','evicted')),
  outstanding_balance numeric(12,2) not null default 0,
  last_payment_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tenants_user_idx on public.tenants(user_id);
create index if not exists tenants_unit_idx on public.tenants(unit_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  unit_id uuid not null references public.units(id),
  invoice_number text not null,
  type text not null check (type in ('rent','deposit','service_charge','late_fee','utilities','other')),
  amount numeric(12,2) not null check (amount > 0),
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null check (total_amount > 0),
  due_date date not null,
  billing_period_start date,
  billing_period_end date,
  status text not null default 'draft' check (status in ('draft','sent','paid','partially_paid','overdue','cancelled')),
  description text,
  metadata jsonb not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, invoice_number)
);
create index if not exists invoices_tenant_idx on public.invoices(tenant_id);
create index if not exists invoices_due_idx on public.invoices(due_date, status);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  unit_id uuid not null references public.units(id),
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('mpesa_stk','mpesa_paybill','bank_transfer','cash','cheque','card')),
  reference text unique,
  mpesa_receipt text unique,
  mpesa_sender_phone text,
  mpesa_shortcode text,
  status text not null default 'initiated' check (status in ('initiated','processing','completed','failed','reversed','cancelled')),
  failure_reason text,
  processed_at timestamptz,
  callback_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_tenant_idx on public.payments(tenant_id, created_at desc);
create index if not exists payments_reference_idx on public.payments(reference);

create table if not exists public.maintenance_categories (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  name text not null, default_responsibility text not null default 'landlord' check (default_responsibility in ('landlord','tenant','shared')), created_at timestamptz not null default now()
);
create table if not exists public.maintenance_vendors (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  name text not null, phone text, email text, service_category text, hourly_rate numeric(10,2), rating numeric(3,2) not null default 0, completed_jobs integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null references public.units(id), tenant_id uuid not null references public.tenants(id), category_id uuid references public.maintenance_categories(id), vendor_id uuid references public.maintenance_vendors(id),
  title text not null, description text not null, photos text[], priority text not null default 'medium' check (priority in ('low','medium','high','emergency')),
  status text not null default 'submitted' check (status in ('submitted','in_review','approved','assigned','in_progress','completed','cancelled','rejected')),
  cost_estimate numeric(12,2), actual_cost numeric(12,2), scheduled_date date, completed_date date, tenant_responsibility boolean not null default false,
  tenant_cost numeric(12,2), landlord_cost numeric(12,2), status_updates jsonb not null default '[]', created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists maintenance_status_idx on public.maintenance_requests(organization_id, status);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id), receiver_id uuid not null references public.profiles(id), subject text, content text not null, attachments text[], read boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists messages_participants_idx on public.messages(sender_id, receiver_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id), type text not null check (type in ('payment_due','payment_received','payment_reminder','maintenance_update','maintenance_request','lease_expiry','vacancy_alert','system_alert')),
  title text not null, message text not null, data jsonb, read boolean not null default false, sent_via text[] not null default array['app']::text[], created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, type text not null check (type in ('lease','receipt','inspection','identity','other')), property_id uuid references public.properties(id), tenant_id uuid references public.tenants(id),
  file_url text, size_bytes bigint not null default 0 check (size_bytes >= 0), created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);

-- Create a profile for every Supabase Auth user. The function is private and not callable through the Data API.
create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, phone, email, full_name)
  values (new.id, new.phone, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', 'Kodara user'))
  on conflict (id) do nothing;
  return new;
end; $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.shares_organization(other_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other_user
  ) or exists (
    select 1 from public.organization_members mine
    join public.properties p on p.organization_id=mine.organization_id
    join public.units u on u.property_id=p.id
    join public.tenants t on t.unit_id=u.id
    where mine.user_id=(select auth.uid()) and t.user_id=other_user
  );
$$;
revoke all on function private.shares_organization(uuid) from public, anon;
grant execute on function private.shares_organization(uuid) to authenticated;
create or replace function private.has_org_role(org_id uuid, allowed_roles text[] default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    exists (select 1 from public.organizations o where o.id=org_id and o.created_by=(select auth.uid()))
    or exists (select 1 from public.organization_members m where m.organization_id=org_id and m.user_id=(select auth.uid()) and (allowed_roles is null or m.role=any(allowed_roles)))
  );
$$;
revoke all on function private.has_org_role(uuid,text[]) from public, anon;
grant execute on function private.has_org_role(uuid,text[]) to authenticated;
create or replace function private.tenant_belongs_to_org(org_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.tenants t
    join public.units u on u.id=t.unit_id
    join public.properties p on p.id=u.property_id
    where t.user_id=(select auth.uid()) and p.organization_id=org_id and t.status='active'
  );
$$;
revoke all on function private.tenant_belongs_to_org(uuid) from public, anon;
grant execute on function private.tenant_belongs_to_org(uuid) to authenticated;
create or replace function private.can_access_property(property_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.properties p where p.id=property_id and (
      private.has_org_role(p.organization_id) or private.tenant_belongs_to_org(p.organization_id)
    )
  );
$$;
revoke all on function private.can_access_property(uuid) from public, anon;
grant execute on function private.can_access_property(uuid) to authenticated;
create or replace function private.can_access_unit(unit_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.units u where u.id=unit_id and private.can_access_property(u.property_id)
  );
$$;
revoke all on function private.can_access_unit(uuid) from public, anon;
grant execute on function private.can_access_unit(uuid) to authenticated;

-- RLS: no anonymous access and no blanket demo policies.
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.leases enable row level security;
alter table public.tenants enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.maintenance_categories enable row level security;
alter table public.maintenance_vendors enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.documents enable row level security;

create policy "profiles_select_self_or_colleague" on public.profiles for select to authenticated using (
  id = (select auth.uid()) or private.shares_organization(id)
);
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "organizations_insert" on public.organizations for insert to authenticated with check (created_by = (select auth.uid()));
create policy "organizations_select_member" on public.organizations for select to authenticated using (private.has_org_role(id));
create policy "organizations_update_owner" on public.organizations for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "members_select_org" on public.organization_members for select to authenticated using (user_id = (select auth.uid()) or private.has_org_role(organization_id,array['owner']));
create policy "members_owner_manage" on public.organization_members for all to authenticated using (private.has_org_role(organization_id,array['owner'])) with check (private.has_org_role(organization_id,array['owner']));

create policy "properties_member_select" on public.properties for select to authenticated using (private.can_access_property(id));
create policy "properties_manager_write" on public.properties for all to authenticated using (exists (select 1 from public.organization_members m where m.organization_id = properties.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','manager'))) with check (exists (select 1 from public.organization_members m where m.organization_id = properties.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','manager')));
create policy "units_member_select" on public.units for select to authenticated using (private.can_access_unit(id));
create policy "units_manager_write" on public.units for all to authenticated using (exists (select 1 from public.properties p join public.organization_members m on m.organization_id = p.organization_id where p.id = units.property_id and m.user_id = (select auth.uid()) and m.role in ('owner','manager'))) with check (exists (select 1 from public.properties p join public.organization_members m on m.organization_id = p.organization_id where p.id = units.property_id and m.user_id = (select auth.uid()) and m.role in ('owner','manager')));

create policy "tenants_read_authorized" on public.tenants for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.units u join public.properties p on p.id=u.property_id join public.organization_members m on m.organization_id=p.organization_id where u.id=tenants.unit_id and m.user_id=(select auth.uid())));
create policy "tenants_manager_write" on public.tenants for all to authenticated using (exists (select 1 from public.units u join public.properties p on p.id=u.property_id join public.organization_members m on m.organization_id=p.organization_id where u.id=tenants.unit_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager'))) with check (exists (select 1 from public.units u join public.properties p on p.id=u.property_id join public.organization_members m on m.organization_id=p.organization_id where u.id=tenants.unit_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager')));
create policy "leases_read_authorized" on public.leases for select to authenticated using (tenant_id=(select auth.uid()) or exists (select 1 from public.units u join public.properties p on p.id=u.property_id join public.organization_members m on m.organization_id=p.organization_id where u.id=leases.unit_id and m.user_id=(select auth.uid())));
create policy "leases_manager_write" on public.leases for all to authenticated using (exists (select 1 from public.units u join public.properties p on p.id=u.property_id join public.organization_members m on m.organization_id=p.organization_id where u.id=leases.unit_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager'))) with check (exists (select 1 from public.units u join public.properties p on p.id=u.property_id join public.organization_members m on m.organization_id=p.organization_id where u.id=leases.unit_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager')));

create policy "invoices_read_authorized" on public.invoices for select to authenticated using (exists (select 1 from public.tenants t where t.id=invoices.tenant_id and t.user_id=(select auth.uid())) or exists (select 1 from public.organization_members m where m.organization_id=invoices.organization_id and m.user_id=(select auth.uid())));
create policy "invoices_manager_write" on public.invoices for all to authenticated using (exists (select 1 from public.organization_members m where m.organization_id=invoices.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','accountant'))) with check (exists (select 1 from public.organization_members m where m.organization_id=invoices.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','accountant')));
create policy "payments_read_authorized" on public.payments for select to authenticated using (exists (select 1 from public.tenants t where t.id=payments.tenant_id and t.user_id=(select auth.uid())) or exists (select 1 from public.organization_members m where m.organization_id=payments.organization_id and m.user_id=(select auth.uid())));
create policy "payments_tenant_initiate" on public.payments for insert to authenticated with check (status='initiated' and exists (select 1 from public.tenants t where t.id=payments.tenant_id and t.user_id=(select auth.uid())));
create policy "payments_manager_insert" on public.payments for insert to authenticated with check (exists (select 1 from public.organization_members m where m.organization_id=payments.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','accountant')));

create policy "maintenance_read_authorized" on public.maintenance_requests for select to authenticated using (exists (select 1 from public.tenants t where t.id=maintenance_requests.tenant_id and t.user_id=(select auth.uid())) or exists (select 1 from public.organization_members m where m.organization_id=maintenance_requests.organization_id and m.user_id=(select auth.uid())));
create policy "maintenance_tenant_create" on public.maintenance_requests for insert to authenticated with check (status='submitted' and exists (select 1 from public.tenants t where t.id=maintenance_requests.tenant_id and t.user_id=(select auth.uid())));
create policy "maintenance_manager_write" on public.maintenance_requests for all to authenticated using (exists (select 1 from public.organization_members m where m.organization_id=maintenance_requests.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','agent'))) with check (exists (select 1 from public.organization_members m where m.organization_id=maintenance_requests.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','agent')));
create policy "maintenance_categories_select" on public.maintenance_categories for select to authenticated using (private.has_org_role(organization_id) or private.tenant_belongs_to_org(organization_id));
create policy "maintenance_categories_manager_write" on public.maintenance_categories for all to authenticated using (private.has_org_role(organization_id, array['owner','manager'])) with check (private.has_org_role(organization_id, array['owner','manager']));
create policy "maintenance_vendors_select" on public.maintenance_vendors for select to authenticated using (private.has_org_role(organization_id));
create policy "maintenance_vendors_manager_write" on public.maintenance_vendors for all to authenticated using (private.has_org_role(organization_id, array['owner','manager'])) with check (private.has_org_role(organization_id, array['owner','manager']));
create policy "messages_participant_access" on public.messages for select to authenticated using (sender_id=(select auth.uid()) or receiver_id=(select auth.uid()));
create policy "messages_sender_insert" on public.messages for insert to authenticated with check (sender_id=(select auth.uid()) and (private.has_org_role(organization_id) or private.tenant_belongs_to_org(organization_id)));
create policy "messages_receiver_update" on public.messages for update to authenticated using (receiver_id=(select auth.uid())) with check (receiver_id=(select auth.uid()));
create policy "notifications_recipient_select" on public.notifications for select to authenticated using (recipient_id=(select auth.uid()));
create policy "notifications_recipient_update" on public.notifications for update to authenticated using (recipient_id=(select auth.uid())) with check (recipient_id=(select auth.uid()));
create policy "documents_read_authorized" on public.documents for select to authenticated using (exists (select 1 from public.tenants t where t.id=documents.tenant_id and t.user_id=(select auth.uid())) or exists (select 1 from public.organization_members m where m.organization_id=documents.organization_id and m.user_id=(select auth.uid())));
create policy "documents_manager_write" on public.documents for all to authenticated using (exists (select 1 from public.organization_members m where m.organization_id=documents.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','agent'))) with check (created_by=(select auth.uid()) and exists (select 1 from public.organization_members m where m.organization_id=documents.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','manager','agent')));

-- Read models used by the web and Flutter clients. security_invoker keeps base-table RLS active.
create or replace view public.tenant_directory with (security_invoker=true) as
select t.*, pr.full_name, pr.phone, u.unit_name, p.name as property_name, p.organization_id from public.tenants t join public.profiles pr on pr.id=t.user_id join public.units u on u.id=t.unit_id join public.properties p on p.id=u.property_id;
create or replace view public.payment_directory with (security_invoker=true) as
select pay.*, pr.full_name as tenant_name, u.unit_name, p.name as property_name, coalesce(i.due_date,pay.created_at::date) as due_date from public.payments pay join public.tenants t on t.id=pay.tenant_id join public.profiles pr on pr.id=t.user_id join public.units u on u.id=pay.unit_id join public.properties p on p.id=u.property_id left join public.invoices i on i.id=pay.invoice_id;
create or replace view public.maintenance_directory with (security_invoker=true) as
select mr.*, pr.full_name as tenant_name, u.unit_name, p.name as property_name, coalesce(mc.name,mr.title) as category_name from public.maintenance_requests mr join public.tenants t on t.id=mr.tenant_id join public.profiles pr on pr.id=t.user_id join public.units u on u.id=mr.unit_id join public.properties p on p.id=u.property_id left join public.maintenance_categories mc on mc.id=mr.category_id;
create or replace view public.message_directory with (security_invoker=true) as
select m.*, sender.full_name as sender_name, receiver.full_name as receiver_name from public.messages m join public.profiles sender on sender.id=m.sender_id join public.profiles receiver on receiver.id=m.receiver_id;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.tenant_directory, public.payment_directory, public.maintenance_directory, public.message_directory to authenticated;
revoke all on all tables in schema public from anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('kodara-documents','kodara-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

-- private.object_org(name) safely extracts the leading path segment of a
-- storage.objects key as the organization id, returning null instead of
-- raising for objects with no folder prefix or a non-uuid first segment
-- (e.g. a misrouted upload to the bucket root). A raw `(storage.foldername(name))[1])::uuid`
-- cast throws on those paths; since that exception is not the same thing as
-- "access denied", relying on it to fail closed is fragile. This function
-- makes the rejection explicit and intentional instead of accidental.
create or replace function private.object_org(name text) returns uuid
language plpgsql immutable set search_path = '' as $$
declare
  segment text;
begin
  segment := (storage.foldername(name))[1];
  if segment is null then
    return null;
  end if;
  return segment::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create policy "document_objects_manager_write" on storage.objects for insert to authenticated with check (bucket_id='kodara-documents' and private.object_org(name) is not null and exists (select 1 from public.organization_members m where m.organization_id=private.object_org(name) and m.user_id=(select auth.uid()) and m.role in ('owner','manager','agent')));
create policy "document_objects_manager_delete" on storage.objects for delete to authenticated using (bucket_id='kodara-documents' and private.object_org(name) is not null and exists (select 1 from public.organization_members m where m.organization_id=private.object_org(name) and m.user_id=(select auth.uid()) and m.role in ('owner','manager')));

-- Defense in depth: storage.objects/buckets RLS already blocks anon (no
-- anon policy exists, and the bucket is non-public), but revoke the
-- underlying table privileges too so a future permissive policy add can't
-- accidentally expose objects to unauthenticated requests.
revoke all on storage.objects, storage.buckets from anon;
