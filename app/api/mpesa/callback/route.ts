import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

type MetadataItem = { Name: string; Value?: string | number };
type STKCallback = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: { Item: MetadataItem[] };
};

export async function POST(req: NextRequest) {
  if (!isAuthorizedCallback(req))
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Unauthorized" },
      { status: 401 },
    );
  const database = getAdminClient();
  if (!database)
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Service unavailable" },
      { status: 503 },
    );

  let callback: STKCallback | undefined;
  try {
    callback = (await req.json())?.Body?.stkCallback as STKCallback | undefined;
  } catch {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Invalid JSON" },
      { status: 400 },
    );
  }
  if (!callback?.CheckoutRequestID || typeof callback.ResultCode !== "number")
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Invalid payload" },
      { status: 400 },
    );

  const { data: payment, error: lookupError } = await database
    .from("payments")
    .select("id, invoice_id, tenant_id, amount, status")
    .eq("reference", callback.CheckoutRequestID)
    .single();
  if (lookupError || !payment)
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  if (payment.status === "completed")
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Already processed",
    });

  if (callback.ResultCode !== 0) {
    // User cancellation (1032), timeout (1037), insufficient funds, etc.
    // Guard against completing concurrently with another callback.
    await database
      .from("payments")
      .update({
        status: "failed",
        failure_reason: callback.ResultDesc,
        callback_data: callback,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .neq("status", "completed");
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const items = callback.CallbackMetadata?.Item ?? [];
  const amount = numeric(items, "Amount");
  const receipt = text(items, "MpesaReceiptNumber");
  const phone = text(items, "PhoneNumber");
  if (!receipt || amount !== Number(payment.amount)) {
    // Record the mismatch instead of leaving the payment stuck in
    // "initiated" forever with no audit trail. Safaricom already debited
    // (or claims to have debited) the customer, so this must be flagged
    // for manual reconciliation rather than silently dropped.
    await database
      .from("payments")
      .update({
        status: "failed",
        failure_reason: !receipt
          ? "Missing M-Pesa receipt in callback"
          : `Amount mismatch: expected ${payment.amount}, received ${amount}`,
        callback_data: callback,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .neq("status", "completed");
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Payment verification failed" },
      { status: 400 },
    );
  }

  const processedAt = new Date().toISOString();
  const { data: updatedRows, error: updateError } = await database
    .from("payments")
    .update({
      status: "completed",
      mpesa_receipt: receipt,
      mpesa_sender_phone: phone,
      processed_at: processedAt,
      callback_data: callback,
      updated_at: processedAt,
    })
    .eq("id", payment.id)
    .neq("status", "completed")
    .select("id");
  if (updateError)
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Processing failed" },
      { status: 500 },
    );
  // The .neq("status", "completed") guard means a concurrent/duplicate
  // callback that already completed this payment updates zero rows here.
  // Without this check we would fall through and re-apply the invoice and
  // tenant-balance side effects a second time on every duplicate delivery
  // (Safaricom retries callbacks), which is exactly the double-credit bug
  // idempotency is supposed to prevent.
  if (!updatedRows || updatedRows.length === 0)
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Already processed",
    });

  if (payment.invoice_id)
    await database
      .from("invoices")
      .update({ status: "paid", updated_at: processedAt })
      .eq("id", payment.invoice_id);
  await database
    .from("tenants")
    .update({
      outstanding_balance: 0,
      last_payment_date: processedAt.slice(0, 10),
      updated_at: processedAt,
    })
    .eq("id", payment.tenant_id);
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}

function isAuthorizedCallback(req: NextRequest): boolean {
  const expected = process.env.MPESA_CALLBACK_SECRET;
  const actual = req.nextUrl.searchParams.get("token");
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
function text(items: MetadataItem[], name: string): string {
  return items.find((item) => item.Name === name)?.Value?.toString() ?? "";
}
function numeric(items: MetadataItem[], name: string): number {
  return Number(items.find((item) => item.Name === name)?.Value ?? 0);
}
