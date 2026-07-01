// Tests for lib/kodara-service.ts's demo-fallback vs live-Supabase parity.
// Focus: createTenant(), which used to be demo-only (never called Supabase
// at all), silently no-op-ing against a real backend. This guards the fix:
// the live path now requires an existing profile (phone signup) before
// creating a lease + tenant record, and falls back to local demo storage
// only when Supabase isn't configured/authenticated.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getSession = vi.fn();
const getUser = vi.fn();
const maybeSingle = vi.fn();
const leaseSingle = vi.fn();
const tenantDirectoryRows = vi.fn(() =>
  Promise.resolve<{ data: Array<{ id: string; user_id: string }>; error: null }>({
    data: [],
    error: null,
  }),
);

function chain(table: string) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {};
  q.eq = vi.fn(() => q);
  q.insert = vi.fn(() => q);
  q.maybeSingle = vi.fn(() => maybeSingle());
  q.single = vi.fn(() => leaseSingle());
  // tenant_directory's select() is awaited directly with no further
  // chaining in getTenants(), so it must itself behave like a promise.
  q.select = vi.fn(() =>
    table === "tenant_directory" ? tenantDirectoryRows() : q,
  );
  return q;
}

const fromMock = vi.fn((table: string) => chain(table));

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  setSupabaseKeys: vi.fn(),
  clearSupabaseConfig: vi.fn(),
  subscribeToTable: () => () => {},
  supabase: () => ({
    auth: { getSession, getUser },
    from: fromMock,
  }),
}));

const originalFetch = global.fetch;

import {
  createTenant,
  setDemoUserRole,
  resetFullDemo,
} from "../lib/kodara-service";

beforeEach(() => {
  vi.clearAllMocks();
  tenantDirectoryRows.mockResolvedValue({ data: [], error: null });
  setDemoUserRole("landlord");
  resetFullDemo();
  getSession.mockResolvedValue({
    data: { session: { access_token: "token-abc" } },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("createTenant live-Supabase path", () => {
  it("throws a clear error when no profile exists yet for that phone (no silent local-only write)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      createTenant({
        unit_id: "unit-1",
        full_name: "New Tenant",
        phone: "+254700000000",
      }),
    ).rejects.toThrow(/has not signed up yet/);
  });

  it("creates a lease and posts to /api/tenants with the session bearer token when a profile exists", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: "profile-1" }, error: null }); // profiles lookup
    leaseSingle
      .mockResolvedValueOnce({ data: { monthly_rent: 30000 }, error: null }) // units lookup
      .mockResolvedValueOnce({ data: { id: "lease-1" }, error: null }); // leases insert
    tenantDirectoryRows.mockResolvedValue({
      data: [{ id: "tenant-1", user_id: "profile-1" }],
      error: null,
    });

    global.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain("/api/tenants");
      expect((init?.headers as Record<string, string>)?.Authorization).toBe(
        "Bearer token-abc",
      );
      return new Response(
        JSON.stringify({ id: "tenant-1", user_id: "profile-1" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await createTenant({
      unit_id: "unit-1",
      full_name: "New Tenant",
      phone: "+254700000000",
    });

    expect(result).toBeTruthy();
    expect(global.fetch).toHaveBeenCalled();
  });
});
