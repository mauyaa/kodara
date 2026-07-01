import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { z } from "zod";
import { getRequestClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  phone: z.string().min(9).max(20),
  amount: z.number().int().min(10).max(500_000),
  invoiceId: z.string().uuid(),
  accountReference: z.string().trim().max(20).optional(),
  transactionDesc: z.string().trim().max(50).optional(),
});

type DarajaResponse = {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResponseCode?: string;
  errorCode?: string;
  errorMessage?: string;
};

export async function POST(req: NextRequest) {
  const database = getRequestClient(req);
  if (!database)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const {
    data: { user },
  } = await database.auth.getUser();
  // Rate-limit on the authenticated user when available (resistant to IP
  // rotation behind shared NAT/proxies) and additionally on IP so an
  // unauthenticated burst from one network can't bypass the per-user limit.
  const limitKey = user?.id ? `mpesa-stk:user:${user.id}` : `mpesa-stk:ip:${ip}`;
  // Per docs/API_SPEC.md, /api/payments/* (which covers M-Pesa STK push) is
  // limited to 20 requests/minute — tighter than the 60/min default since
  // each call burns real Safaricom Daraja quota and can charge the tenant's
  // phone with an STK prompt.
  const limit = rateLimit(limitKey, 20);
  if (!limit.allowed)
    return NextResponse.json(
      {
        error: "Too many payment requests. Please try again shortly.",
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": limit.remaining.toString(),
          "X-RateLimit-Reset": limit.resetAt.toString(),
        },
      },
    );

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid payment request", details: parsed.error.issues },
      { status: 400 },
    );

  const phone = formatKenyanPhone(parsed.data.phone);
  if (!phone)
    return NextResponse.json(
      { error: "Use a valid Safaricom number" },
      { status: 400 },
    );

  const { data: invoice, error: invoiceError } = await database
    .from("invoices")
    .select("id, organization_id, tenant_id, unit_id, total_amount, status")
    .eq("id", parsed.data.invoiceId)
    .single();
  if (invoiceError || !invoice)
    return NextResponse.json(
      { error: "Invoice not found or access denied" },
      { status: 404 },
    );
  if (["paid", "cancelled"].includes(invoice.status))
    return NextResponse.json(
      { error: `Invoice is already ${invoice.status}` },
      { status: 409 },
    );
  if (parsed.data.amount > Number(invoice.total_amount))
    return NextResponse.json(
      { error: "Amount exceeds the invoice balance" },
      { status: 400 },
    );

  const config = getMpesaConfig();
  if (!config)
    return NextResponse.json(
      { error: "M-Pesa is not configured" },
      { status: 503 },
    );

  const token = await getDarajaAccessToken(
    config.baseUrl,
    config.consumerKey,
    config.consumerSecret,
  );
  if (!token)
    return NextResponse.json(
      { error: "Could not connect to M-Pesa" },
      { status: 503 },
    );

  const timestamp = format(new Date(), "yyyyMMddHHmmss");
  const password = Buffer.from(
    `${config.shortcode}${config.passkey}${timestamp}`,
  ).toString("base64");
  const callback = new URL(config.callbackUrl);
  callback.searchParams.set("token", config.callbackSecret);

  const response = await fetch(
    `${config.baseUrl}/mpesa/stkpush/v1/processrequest`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: config.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: parsed.data.amount,
        PartyA: phone,
        PartyB: config.shortcode,
        PhoneNumber: phone,
        CallBackURL: callback.toString(),
        AccountReference:
          parsed.data.accountReference || `INV-${invoice.id.slice(0, 8)}`,
        TransactionDesc: parsed.data.transactionDesc || "Kodara rent payment",
      }),
    },
  );
  const result = (await response.json()) as DarajaResponse;
  if (!response.ok || result.errorCode || !result.CheckoutRequestID) {
    return NextResponse.json(
      { error: result.errorMessage || "M-Pesa rejected the request" },
      { status: 502 },
    );
  }

  const { error: insertError } = await database.from("payments").insert({
    invoice_id: invoice.id,
    organization_id: invoice.organization_id,
    tenant_id: invoice.tenant_id,
    unit_id: invoice.unit_id,
    amount: parsed.data.amount,
    payment_method: "mpesa_stk",
    reference: result.CheckoutRequestID,
    status: "initiated",
    mpesa_sender_phone: phone,
    mpesa_shortcode: config.shortcode,
  });
  if (insertError)
    return NextResponse.json(
      {
        error:
          "Payment request sent, but the audit record could not be created",
      },
      { status: 500 },
    );

  return NextResponse.json(
    {
      success: true,
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      message: "Check your phone to complete payment",
    },
    { status: 202 },
  );
}

function formatKenyanPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  return null;
}

function getMpesaConfig() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const passkey = process.env.MPESA_PASSKEY;
  const shortcode = process.env.MPESA_SHORTCODE;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;
  const callbackSecret = process.env.MPESA_CALLBACK_SECRET;
  if (
    !consumerKey ||
    !consumerSecret ||
    !passkey ||
    !shortcode ||
    !callbackUrl ||
    !callbackSecret
  )
    return null;
  return {
    consumerKey,
    consumerSecret,
    passkey,
    shortcode,
    callbackUrl,
    callbackSecret,
    baseUrl:
      process.env.MPESA_ENVIRONMENT === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke",
  };
}

async function getDarajaAccessToken(
  baseUrl: string,
  key: string,
  secret: string,
): Promise<string | null> {
  const authorization = Buffer.from(`${key}:${secret}`).toString("base64");
  const response = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${authorization}` }, cache: "no-store" },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { access_token?: string };
  return body.access_token ?? null;
}
