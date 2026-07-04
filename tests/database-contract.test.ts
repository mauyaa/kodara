import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260701000000_core_schema.sql"),
  "utf8",
).toLowerCase();

describe("Kodara database contract", () => {
  it.each([
    "properties",
    "units",
    "tenancies",
    "tenant_invitations",
    "payment_attempts",
    "payments",
    "payment_reconciliations",
    "maintenance_requests",
    "maintenance_status_history",
  ])("enables RLS on %s", (table) => {
    expect(migration).toContain(
      `alter table public.${table} enable row level security`,
    );
  });

  it("enforces the tenancy hierarchy on payments and maintenance", () => {
    expect(migration).toContain(
      "tenancy_id uuid references public.tenancies(id) on delete restrict",
    );
    expect(migration).toContain(
      "tenancy_id uuid not null references public.tenancies(id) on delete restrict",
    );
    expect(migration).toContain("payments_match_consistency_check");
  });

  it("contains atomic callback and reconciliation functions", () => {
    expect(migration).toContain("public.record_mpesa_stk_callback");
    expect(migration).toContain("on conflict (event_key) do nothing");
    expect(migration).toContain("provider receipt is already attached");
    expect(migration).toContain("public.resolve_unmatched_payment");
    expect(migration).toContain("for update");
    expect(migration).toContain("'uncertain'");
    expect(migration).toContain("payment attempt already in progress");
    expect(migration).toContain("payment attempt rate limit exceeded");
  });

  it("supports secure tenant invitation acceptance", () => {
    expect(migration).toContain("public.create_tenant_invitation");
    expect(migration).toContain("public.accept_tenant_invitation");
    expect(migration).toContain("invitation.phone <> caller_phone");
    expect(migration).toContain("tenant_invitations_one_pending_per_unit_idx");
    expect(migration).toContain("private.current_user_verified_phone()");
    expect(migration).toContain("private.is_landlord_of_unit(unit_id)");
    expect(migration).toContain("phone_confirmed_at is not null");
    expect(migration).toContain("grant update (full_name) on public.profiles");
    expect(migration).not.toContain(
      "grant update (full_name, phone) on public.profiles",
    );
  });

  it("keeps raw callbacks private and grants Data API access explicitly", () => {
    expect(migration).toContain("private.mpesa_webhook_events");
    expect(migration).toContain(
      "revoke all on schema private from public, anon, authenticated",
    );
    expect(migration).toContain("grant usage on schema public to authenticated");
    expect(migration).toContain("grant usage on schema private to authenticated");
    expect(migration).toContain(
      "grant select, insert, update on public.payment_attempts to service_role",
    );
  });

  it("configures private maintenance photos and realtime tables", () => {
    expect(migration).toContain("'maintenance-photos'");
    expect(migration).toContain("maintenance_photos_tenant_insert");
    expect(migration).toContain(
      "alter publication supabase_realtime add table public.payments",
    );
  });
});
