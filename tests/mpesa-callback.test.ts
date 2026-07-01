// Tests for the M-Pesa STK callback webhook handler.
// Covers: signature/token verification, idempotency (duplicate callback),
// wrong amount, unknown checkout reference, and user cancellation/timeout.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../app/api/mpesa/callback/route";
import { NextRequest } from "next/server";

const CALLBACK_SECRET = "test-callback-secret-value";

type PaymentRow = {
  id: string;
  invoice_id: string | null;
  tenant_id: string;
  amount: number;
  status: string;
};

let paymentRow: PaymentRow | null = null;
let lookupError: unknown = null;
// Tracks how many rows the guarded `.neq("status","completed")` update
// would actually affect, so tests can simulate a row already completed by
// a concurrent/duplicate callback.
let updateAffectsRow = true;

function buildQuery() {
  // Tracks whether this query chain started with .update(), so the
  // terminal .select() call (used by the route to read back affected rows
  // after the guarded `.neq("status","completed")` update) resolves with
  // the simulated "rows changed" result instead of the lookup result.
  let isUpdateChain = false;

  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.eq = vi.fn(() => query);
  query.neq = vi.fn(() => query);
  query.single = vi.fn(() =>
    Promise.resolve({ data: paymentRow, error: lookupError }),
  );
  query.update = vi.fn(() => {
    isUpdateChain = true;
    return query;
  });
  query.select = vi.fn(() => {
    if (isUpdateChain) {
      return Promise.resolve({
        data: updateAffectsRow && paymentRow ? [{ id: paymentRow.id }] : [],
        error: null,
      });
    }
    return query;
  });
  return query;
}

vi.mock("@/lib/supabase", () => ({
  getAdminClient: () => ({
    from: () => buildQuery(),
  }),
}));

function makeRequest(body: unknown, token: string | null = CALLBACK_SECRET) {
  const url = new URL("http://localhost/api/mpesa/callback");
  if (token !== null) url.searchParams.set("token", token);
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function stkCallback(overrides: Record<string, unknown> = {}) {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: "merchant-1",
        CheckoutRequestID: "ws_CO_test_1",
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: 1000 },
            { Name: "MpesaReceiptNumber", Value: "ABC123XYZ" },
            { Name: "TransactionDate", Value: 20260701123456 },
            { Name: "PhoneNumber", Value: 254712345678 },
          ],
        },
        ...overrides,
      },
    },
  };
}

beforeEach(() => {
  process.env.MPESA_CALLBACK_SECRET = CALLBACK_SECRET;
  paymentRow = {
    id: "payment-1",
    invoice_id: "invoice-1",
    tenant_id: "tenant-1",
    amount: 1000,
    status: "initiated",
  };
  lookupError = null;
  updateAffectsRow = true;
});

describe("M-Pesa callback authenticity", () => {
  it("rejects requests with no token query param", async () => {
    const res = await POST(makeRequest(stkCallback(), null));
    expect(res.status).toBe(401);
  });

  it("rejects requests with the wrong token", async () => {
    const res = await POST(makeRequest(stkCallback(), "wrong-token"));
    expect(res.status).toBe(401);
  });

  it("defensively rejects when MPESA_CALLBACK_SECRET is not configured, instead of skipping verification", async () => {
    delete process.env.MPESA_CALLBACK_SECRET;
    const res = await POST(makeRequest(stkCallback(), CALLBACK_SECRET));
    expect(res.status).toBe(401);
  });

  it("accepts requests with the correct token", async () => {
    const res = await POST(makeRequest(stkCallback()));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ResultCode).toBe(0);
  });
});

describe("M-Pesa callback idempotency", () => {
  it("does not double-credit when the same CheckoutRequestID is already completed", async () => {
    paymentRow!.status = "completed";
    const res = await POST(makeRequest(stkCallback()));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ResultDesc).toBe("Already processed");
  });

  it("does not re-apply invoice/tenant side effects when a concurrent duplicate callback already completed the row", async () => {
    // payment looks "initiated" at lookup time (simulating a race where a
    // concurrent duplicate callback completed it between lookup and update)
    paymentRow!.status = "initiated";
    updateAffectsRow = false;
    const res = await POST(makeRequest(stkCallback()));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ResultDesc).toBe("Already processed");
  });
});

describe("M-Pesa callback amount verification", () => {
  it("flags and fails the payment on amount mismatch instead of leaving it stuck", async () => {
    const res = await POST(
      makeRequest(stkCallback({ CallbackMetadata: { Item: [
        { Name: "Amount", Value: 500 },
        { Name: "MpesaReceiptNumber", Value: "ABC123XYZ" },
        { Name: "PhoneNumber", Value: 254712345678 },
      ] } })),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ResultDesc).toBe("Payment verification failed");
  });

  it("rejects a callback missing the M-Pesa receipt", async () => {
    const res = await POST(
      makeRequest(stkCallback({ CallbackMetadata: { Item: [
        { Name: "Amount", Value: 1000 },
        { Name: "PhoneNumber", Value: 254712345678 },
      ] } })),
    );
    expect(res.status).toBe(400);
  });
});

describe("M-Pesa callback result handling", () => {
  it("marks the payment failed on user cancellation (ResultCode 1032)", async () => {
    const res = await POST(
      makeRequest(
        stkCallback({
          ResultCode: 1032,
          ResultDesc: "Request cancelled by user",
          CallbackMetadata: undefined,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ResultCode).toBe(0);
  });

  it("marks the payment failed on timeout (ResultCode 1037)", async () => {
    const res = await POST(
      makeRequest(
        stkCallback({
          ResultCode: 1037,
          ResultDesc: "Timeout in completing transaction",
          CallbackMetadata: undefined,
        }),
      ),
    );
    expect(res.status).toBe(200);
  });

  it("accepts (so Safaricom does not retry) but does not error on an unknown checkout reference", async () => {
    paymentRow = null;
    const res = await POST(makeRequest(stkCallback()));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ResultCode).toBe(0);
  });

  it("rejects structurally invalid payloads", async () => {
    const res = await POST(makeRequest({ Body: {} }));
    expect(res.status).toBe(400);
  });

  it("rejects non-JSON bodies", async () => {
    const url = new URL("http://localhost/api/mpesa/callback");
    url.searchParams.set("token", CALLBACK_SECRET);
    const req = new NextRequest(url, { method: "POST", body: "not json" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
