import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestClient } from "@/lib/supabase";
import { POST as initiateStkPush } from "@/app/api/mpesa/stk-push/route";

const uuidSchema = z.string().uuid();

const genericError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  const tenantId = req.nextUrl.searchParams.get("tenant_id");
  const invoiceId = req.nextUrl.searchParams.get("invoice_id");
  const status = req.nextUrl.searchParams.get("status");

  if (tenantId && !uuidSchema.safeParse(tenantId).success) {
    return genericError("Invalid tenant_id", 400);
  }
  if (invoiceId && !uuidSchema.safeParse(invoiceId).success) {
    return genericError("Invalid invoice_id", 400);
  }

  let query = client
    .from("payments")
    .select(
      "*, invoice:invoice_id(*), tenant:tenant_id(profile:user_id(full_name, phone))",
    );
  if (tenantId) query = query.eq("tenant_id", tenantId);
  if (invoiceId) query = query.eq("invoice_id", invoiceId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("created_at", {
    ascending: false,
  });
  if (error) {
    console.error("[payments:GET]", error);
    return genericError("Could not load payments", 500);
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  return initiateStkPush(req);
}
