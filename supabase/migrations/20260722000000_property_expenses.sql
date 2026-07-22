-- Property expense tracking. Every table up to now only records money moving
-- tenant->landlord (rent); there was no way to record money moving the other
-- direction (a repair, a management fee, property tax). Without this, a
-- landlord's dashboard can only ever show gross collection, never a real net
-- income picture -- flagged as a gap in the 2026-07-22 competitor review
-- (ROADMAP.md), alongside deposits and late fees as one coherent "real
-- financial picture" milestone. This ships the expense side first: it's
-- purely additive (new table, no changes to the payment/reconciliation path
-- this repo is most careful about) and stands alone as a complete feature.

create table public.property_expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  category text not null
    constraint property_expenses_category_check check (category in (
      'repair_maintenance', 'utility', 'tax', 'insurance', 'management_fee', 'other'
    )),
  description text not null
    constraint property_expenses_description_check check (char_length(trim(description)) between 2 and 240),
  amount numeric(12,2) not null constraint property_expenses_amount_positive check (amount > 0),
  expense_date date not null default current_date
    constraint property_expenses_date_not_future_check check (expense_date <= current_date),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index property_expenses_property_date_idx
  on public.property_expenses (property_id, expense_date desc);

create trigger property_expenses_set_updated_at
before update on public.property_expenses
for each row execute function private.set_updated_at();

alter table public.property_expenses enable row level security;

-- Landlord-only: expenses are the landlord's own financial record, unlike
-- maintenance_requests or messages which a tenant is a party to. Follows the
-- same shape as units_* (no denormalized landlord_id; is_landlord_of_property
-- already exists and is already granted to authenticated).
create policy property_expenses_select_authorized on public.property_expenses
for select to authenticated
using ((select private.is_landlord_of_property(property_id)));

create policy property_expenses_landlord_insert on public.property_expenses
for insert to authenticated
with check (
  (select private.is_landlord_of_property(property_id))
  and created_by = (select auth.uid())
);

create policy property_expenses_landlord_update on public.property_expenses
for update to authenticated
using ((select private.is_landlord_of_property(property_id)))
with check ((select private.is_landlord_of_property(property_id)));

create policy property_expenses_landlord_delete on public.property_expenses
for delete to authenticated
using ((select private.is_landlord_of_property(property_id)));
