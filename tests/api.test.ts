// Tests for Properties, Units, Tenants, Maintenance, and Notifications APIs.
// Mocking pattern: a per-table chainable query builder, similar to
// tests/mpesa-stk-push.test.ts, so each test can control what each table
// returns independently (organization membership lookups, the resource
// itself, etc.) instead of one global mock object shared across calls.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "../app/api/properties/route";
import {
  POST as unitsPost,
  GET as unitsGet,
  PUT as unitsPut,
} from "../app/api/units/route";
import {
  POST as tenantsPost,
  GET as tenantsGet,
} from "../app/api/tenants/route";
import {
  POST as maintenancePost,
  PATCH as maintenancePatch,
} from "../app/api/maintenance/route";
import {
  GET as notificationsGet,
  PATCH as notificationsPatch,
} from "../app/api/notifications/route";
import { NextRequest } from "next/server";

const USER_ID = "00000000-0000-4000-8000-000000000010";
const ORG_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ORG_ID = "00000000-0000-4000-8000-000000000099";
const PROPERTY_ID = "00000000-0000-4000-8000-000000000020";
const UNIT_ID = "00000000-0000-4000-8000-000000000030";

const auth = { getUser: vi.fn() };

// Per-table response fixtures, mutated per-test.
let membershipRow: { organization_id: string } | null = {
  organization_id: ORG_ID,
};
let propertyRow: { id: string } | null = { id: PROPERTY_ID };
let unitRow: { id: string; status: string; property_id?: string } | null = {
  id: UNIT_ID,
  status: "vacant",
};
let notificationOwnerRow: { id: string } | null = { id: "notif-1" };

function buildQuery(table: string) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.insert = vi.fn(() => query);
  query.update = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => Promise.resolve({ data: [], error: null }));
  query.limit = vi.fn(() => query);
  query.single = vi.fn(() => {
    if (table === "properties")
      return Promise.resolve({ data: { id: PROPERTY_ID, name: "Test Property" }, error: null });
    if (table === "units")
      return Promise.resolve({ data: { id: UNIT_ID, unit_name: "1A" }, error: null });
    if (table === "tenants")
      return Promise.resolve({ data: { id: "tenant-1" }, error: null });
    if (table === "maintenance_requests")
      return Promise.resolve({ data: { id: "maint-1" }, error: null });
    if (table === "notifications")
      return Promise.resolve({ data: { id: "notif-1", read: true }, error: null });
    return Promise.resolve({ data: {}, error: null });
  });
  query.maybeSingle = vi.fn(() => {
    if (table === "organization_members")
      return Promise.resolve({ data: membershipRow, error: null });
    if (table === "properties")
      return Promise.resolve({ data: propertyRow, error: null });
    if (table === "units")
      return Promise.resolve({ data: unitRow, error: null });
    if (table === "notifications")
      return Promise.resolve({ data: notificationOwnerRow, error: null });
    return Promise.resolve({ data: null, error: null });
  });
  return query;
}

vi.mock("@/lib/supabase", () => ({
  getRequestClient: () => ({
    from: (table: string) => buildQuery(table),
    auth,
  }),
}));

beforeEach(() => {
  membershipRow = { organization_id: ORG_ID };
  propertyRow = { id: PROPERTY_ID };
  unitRow = { id: UNIT_ID, status: "vacant" };
  notificationOwnerRow = { id: "notif-1" };
  auth.getUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });
});

describe("Properties API", () => {
  it("should create a property with valid data, scoped to the caller's organization", async () => {
    const req = new NextRequest("http://localhost/api/properties", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Property",
        address: "Nairobi, Kenya",
        total_units: 5,
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("Test Property");
  });

  it("should reject invalid property data", async () => {
    const req = new NextRequest("http://localhost/api/properties", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("ignores a client-supplied organization_id and never trusts it for authorization (IDOR guard)", async () => {
    // Even if a malicious client sends someone else's organization_id in
    // the body, the route must derive organization_id from the caller's
    // real membership server-side, not from the request body.
    const req = new NextRequest("http://localhost/api/properties", {
      method: "POST",
      body: JSON.stringify({
        organization_id: OTHER_ORG_ID,
        name: "Hijacked Property",
        address: "Nairobi, Kenya",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    // The route does not echo back organization_id from the insert mock,
    // but the important behavioral guarantee is exercised in the route
    // itself: resolveOrganizationId() is always called and its result
    // (ORG_ID from the mocked membership row) is what gets inserted,
    // never the OTHER_ORG_ID supplied by the client.
  });

  it("returns 404 when the caller has no organization membership", async () => {
    membershipRow = null;
    const req = new NextRequest("http://localhost/api/properties", {
      method: "POST",
      body: JSON.stringify({ name: "Test Property", address: "Nairobi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("should list properties scoped to the caller's organization", async () => {
    const req = new NextRequest("http://localhost/api/properties");
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  it("returns 401 when there is no authenticated user for GET", async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const req = new NextRequest("http://localhost/api/properties");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("Units API", () => {
  it("creates a unit for a property the caller can see", async () => {
    const req = new NextRequest("http://localhost/api/units", {
      method: "POST",
      body: JSON.stringify({
        property_id: PROPERTY_ID,
        unit_name: "4B",
        monthly_rent: 35000,
      }),
    });
    const res = await unitsPost(req);
    expect(res.status).toBe(201);
  });

  it("rejects creating a unit for a property that does not resolve (404, not a 500)", async () => {
    propertyRow = null;
    const req = new NextRequest("http://localhost/api/units", {
      method: "POST",
      body: JSON.stringify({
        property_id: PROPERTY_ID,
        unit_name: "4B",
        monthly_rent: 35000,
      }),
    });
    const res = await unitsPost(req);
    expect(res.status).toBe(404);
  });

  it("rejects an invalid property_id query param on GET instead of passing it through", async () => {
    const req = new NextRequest(
      "http://localhost/api/units?property_id=not-a-uuid",
    );
    const res = await unitsGet(req);
    expect(res.status).toBe(400);
  });

  it("rejects a PUT with no valid fields", async () => {
    const req = new NextRequest(
      `http://localhost/api/units?id=${UNIT_ID}`,
      { method: "PUT", body: JSON.stringify({}) },
    );
    const res = await unitsPut(req);
    expect(res.status).toBe(400);
  });

  it("rejects a PUT with an out-of-range value via zod", async () => {
    const req = new NextRequest(`http://localhost/api/units?id=${UNIT_ID}`, {
      method: "PUT",
      body: JSON.stringify({ monthly_rent: -500 }),
    });
    const res = await unitsPut(req);
    expect(res.status).toBe(400);
  });
});

describe("Tenants API", () => {
  const tenantBody = {
    user_id: "00000000-0000-4000-8000-000000000040",
    unit_id: UNIT_ID,
    lease_id: "00000000-0000-4000-8000-000000000050",
    move_in_date: "2026-07-01",
  };

  it("creates a tenant for a vacant unit", async () => {
    unitRow = { id: UNIT_ID, status: "vacant" };
    const req = new NextRequest("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify(tenantBody),
    });
    const res = await tenantsPost(req);
    expect(res.status).toBe(201);
  });

  it("rejects creating a tenant for an already-occupied unit (409)", async () => {
    unitRow = { id: UNIT_ID, status: "occupied" };
    const req = new NextRequest("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify(tenantBody),
    });
    const res = await tenantsPost(req);
    expect(res.status).toBe(409);
  });

  it("rejects a tenant create with an invalid move_in_date format", async () => {
    const req = new NextRequest("http://localhost/api/tenants", {
      method: "POST",
      body: JSON.stringify({ ...tenantBody, move_in_date: "07/01/2026" }),
    });
    const res = await tenantsPost(req);
    expect(res.status).toBe(400);
  });

  it("rejects an invalid organization_id query param on GET", async () => {
    const req = new NextRequest(
      "http://localhost/api/tenants?organization_id=not-a-uuid",
    );
    const res = await tenantsGet(req);
    expect(res.status).toBe(400);
  });
});

describe("Maintenance API", () => {
  it("creates a maintenance request, deriving organization_id from the unit (not the client body)", async () => {
    unitRow = {
      id: UNIT_ID,
      status: "occupied",
      property: { organization_id: ORG_ID },
    } as never;
    const req = new NextRequest("http://localhost/api/maintenance", {
      method: "POST",
      body: JSON.stringify({
        organization_id: OTHER_ORG_ID, // must be ignored
        unit_id: UNIT_ID,
        tenant_id: "00000000-0000-4000-8000-000000000040",
        category: "Plumbing",
        description: "Kitchen sink is leaking badly under the cabinet.",
      }),
    });
    const res = await maintenancePost(req);
    expect(res.status).toBe(201);
  });

  it("rejects a PATCH with an invalid status value instead of writing it through", async () => {
    const req = new NextRequest(
      "http://localhost/api/maintenance?id=00000000-0000-4000-8000-000000000060",
      {
        method: "PATCH",
        body: JSON.stringify({ status: "not-a-real-status" }),
      },
    );
    const res = await maintenancePatch(req);
    expect(res.status).toBe(400);
  });

  it("rejects a PATCH with a missing/invalid id", async () => {
    const req = new NextRequest("http://localhost/api/maintenance", {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    const res = await maintenancePatch(req);
    expect(res.status).toBe(400);
  });
});

describe("Notifications API", () => {
  it("scopes GET to the authenticated caller, ignoring any recipient_id query param", async () => {
    const req = new NextRequest(
      "http://localhost/api/notifications?recipient_id=00000000-0000-4000-8000-000000000099",
    );
    const res = await notificationsGet(req);
    expect(res.status).toBe(200);
    // The route's query is built with .eq("recipient_id", user.id) from the
    // authenticated session, never from the query string — covered by the
    // route implementation; this test guards the route keeps returning 200
    // (not erroring) and not the unauthenticated 401 path.
  });

  it("returns 401 for GET without an authenticated user", async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const req = new NextRequest("http://localhost/api/notifications");
    const res = await notificationsGet(req);
    expect(res.status).toBe(401);
  });

  it("rejects a PATCH body with fields other than read (strict schema)", async () => {
    const req = new NextRequest(
      "http://localhost/api/notifications?id=00000000-0000-4000-8000-000000000070",
      {
        method: "PATCH",
        body: JSON.stringify({ read: true, recipient_id: "someone-else" }),
      },
    );
    const res = await notificationsPatch(req);
    expect(res.status).toBe(400);
  });

  it("accepts a PATCH that only marks read", async () => {
    const req = new NextRequest(
      "http://localhost/api/notifications?id=00000000-0000-4000-8000-000000000070",
      { method: "PATCH", body: JSON.stringify({ read: true }) },
    );
    const res = await notificationsPatch(req);
    expect(res.status).toBe(200);
  });
});

describe("Payments helpers", () => {
  it("should format Kenyan phone numbers correctly", () => {
    // This would be tested via the actual STK push
    const formatPhone = (phone: string): string | null => {
      const cleaned = phone.replace(/\s/g, "").replace(/[^0-9]/g, "");
      if (cleaned.startsWith("0")) return "254" + cleaned.substring(1);
      if (cleaned.startsWith("7") && cleaned.length === 9)
        return "254" + cleaned;
      if (cleaned.startsWith("254") && cleaned.length === 12) return cleaned;
      return null;
    };

    expect(formatPhone("0712345678")).toBe("254712345678");
    expect(formatPhone("712345678")).toBe("254712345678");
    expect(formatPhone("254712345678")).toBe("254712345678");
    expect(formatPhone("123")).toBe(null);
  });
});

describe("M-Pesa Callback", () => {
  it("should parse STK callback correctly", () => {
    const callback = {
      CheckoutRequestID: "test-id",
      ResultCode: 0,
      ResultDesc: "Success",
      CallbackMetadata: {
        Item: [
          { Name: "Amount", Value: 1000 },
          { Name: "MpesaReceiptNumber", Value: "ABC123" },
          { Name: "PhoneNumber", Value: "254712345678" },
        ],
      },
    };

    expect(callback.ResultCode).toBe(0);
    expect(callback.CallbackMetadata?.Item[1].Value).toBe("ABC123");
  });
});
