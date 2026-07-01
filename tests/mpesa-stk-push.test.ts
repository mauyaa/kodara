// Tests for the M-Pesa STK push initiation route.
// Covers: phone normalization, amount bounds, and per-user rate limiting
// (each call burns real Safaricom Daraja quota and money).
//
// Note: lib/rate-limit.ts keeps its counters in a module-level Map that
// persists for the lifetime of this test file, so each describe block below
// uses its own user id to avoid one block's requests counting against
// another block's rate-limit budget.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../app/api/mpesa/stk-push/route";
import { NextRequest } from "next/server";

const INVOICE_ID = "00000000-0000-4000-8000-000000000099";

const auth = { getUser: vi.fn() };

function buildQuery() {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.single = vi.fn(() =>
    Promise.resolve({
      data: {
        id: INVOICE_ID,
        organization_id: "org-1",
        tenant_id: "tenant-1",
        unit_id: "unit-1",
        total_amount: 5000,
        status: "sent",
      },
      error: null,
    }),
  );
  query.insert = vi.fn(() => Promise.resolve({ error: null }));
  return query;
}

vi.mock("@/lib/supabase", () => ({
  getRequestClient: () => ({ from: () => buildQuery(), auth }),
}));

const originalFetch = global.fetch;

function setUser(userId: string) {
  auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
}

beforeEach(() => {
  process.env.MPESA_CONSUMER_KEY = "key";
  process.env.MPESA_CONSUMER_SECRET = "secret";
  process.env.MPESA_PASSKEY = "passkey";
  process.env.MPESA_SHORTCODE = "174379";
  process.env.MPESA_CALLBACK_URL = "https://app.kodara.co.ke/api/mpesa/callback";
  process.env.MPESA_CALLBACK_SECRET = "cb-secret";
  process.env.MPESA_ENVIRONMENT = "sandbox";

  global.fetch = vi.fn(async (url: string | URL) => {
    const href = url.toString();
    if (href.includes("/oauth/v1/generate")) {
      return new Response(JSON.stringify({ access_token: "token-123" }), {
        status: 200,
      });
    }
    if (href.includes("/stkpush/v1/processrequest")) {
      return new Response(
        JSON.stringify({
          MerchantRequestID: "merchant-1",
          CheckoutRequestID: "ws_CO_test_1",
          ResponseCode: "0",
        }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected fetch to ${href}`);
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/mpesa/stk-push", {
    method: "POST",
    headers: { Authorization: "Bearer test-token" },
    body: JSON.stringify(body),
  });
}

describe("STK push phone normalization", () => {
  beforeEach(() => setUser("00000000-0000-4000-8000-000000000001"));

  it.each([
    ["0712345678", true],
    ["712345678", true],
    ["254712345678", true],
    ["0112345678", true],
    ["+254712345678", true],
    // Structurally long enough to pass the zod length check, but not a
    // valid Kenyan MSISDN, so these must be rejected by formatKenyanPhone
    // specifically (not by the upstream schema's min-length check).
    ["999999999", false],
    ["025712345678", false],
    ["abcdefghij", false],
  ])("phone %s -> accepted: %s", async (phone, shouldAccept) => {
    const res = await POST(makeRequest({ phone, amount: 1000, invoiceId: INVOICE_ID }));
    const data = await res.json();
    if (shouldAccept) {
      expect(data.error).not.toBe("Use a valid Safaricom number");
    } else {
      expect(res.status).toBe(400);
      expect(data.error).toBe("Use a valid Safaricom number");
    }
  });

  it("rejects a phone number too short to be valid (schema-level rejection)", async () => {
    const res = await POST(makeRequest({ phone: "12345", amount: 1000, invoiceId: INVOICE_ID }));
    expect(res.status).toBe(400);
  });
});

describe("STK push amount validation", () => {
  beforeEach(() => setUser("00000000-0000-4000-8000-000000000002"));

  it("rejects amounts above the invoice balance", async () => {
    const res = await POST(
      makeRequest({ phone: "0712345678", amount: 999999, invoiceId: INVOICE_ID }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects amounts at or below zero via schema validation", async () => {
    const res = await POST(
      makeRequest({ phone: "0712345678", amount: 0, invoiceId: INVOICE_ID }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects amounts above the absolute sanity ceiling", async () => {
    const res = await POST(
      makeRequest({ phone: "0712345678", amount: 600_000, invoiceId: INVOICE_ID }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts a valid in-bounds amount", async () => {
    const res = await POST(
      makeRequest({ phone: "0712345678", amount: 1000, invoiceId: INVOICE_ID }),
    );
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.checkoutRequestId).toBe("ws_CO_test_1");
  });
});

describe("STK push rate limiting", () => {
  beforeEach(() => setUser("00000000-0000-4000-8000-000000000003"));

  it("returns 429 once the per-user limit (20/min) is exceeded", async () => {
    let lastStatus = 200;
    for (let i = 0; i < 25; i++) {
      const res = await POST(
        makeRequest({ phone: "0712345678", amount: 1000, invoiceId: INVOICE_ID }),
      );
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  it("includes rate-limit headers in the 429 response", async () => {
    setUser("00000000-0000-4000-8000-000000000004");
    let res;
    for (let i = 0; i < 25; i++) {
      res = await POST(
        makeRequest({ phone: "0712345678", amount: 1000, invoiceId: INVOICE_ID }),
      );
      if (res.status === 429) break;
    }
    expect(res!.status).toBe(429);
    expect(res!.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("does not rate-limit a different user after one user is throttled", async () => {
    setUser("00000000-0000-4000-8000-000000000005");
    for (let i = 0; i < 20; i++) {
      await POST(makeRequest({ phone: "0712345678", amount: 1000, invoiceId: INVOICE_ID }));
    }
    const throttled = await POST(
      makeRequest({ phone: "0712345678", amount: 1000, invoiceId: INVOICE_ID }),
    );
    expect(throttled.status).toBe(429);

    setUser("00000000-0000-4000-8000-000000000006");
    const otherUser = await POST(
      makeRequest({ phone: "0712345678", amount: 1000, invoiceId: INVOICE_ID }),
    );
    expect(otherUser.status).toBe(202);
  });
});

describe("STK push request body handling", () => {
  beforeEach(() => setUser("00000000-0000-4000-8000-000000000007"));

  it("rejects non-JSON bodies with 400 instead of throwing", async () => {
    const req = new NextRequest("http://localhost/api/mpesa/stk-push", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
