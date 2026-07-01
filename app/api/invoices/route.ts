import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestClient, getServiceClient } from "@/lib/supabase";
import { format, addDays } from "date-fns";

const createInvoiceSchema = z.object({
  organization_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  invoice_number: z.string().trim().max(40).optional(),
  type: z.enum([
    "rent",
    "deposit",
    "service_charge",
    "late_fee",
    "utilities",
    "other",
  ]),
  amount: z.number().positive(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional(),
  description: z.string().trim().max(500).optional(),
});

const uuidSchema = z.string().uuid();

const genericError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenant_id");
  const organizationId = searchParams.get("organization_id");
  const status = searchParams.get("status");

  if (tenantId && !uuidSchema.safeParse(tenantId).success) {
    return genericError("Invalid tenant_id", 400);
  }
  if (organizationId && !uuidSchema.safeParse(organizationId).success) {
    return genericError("Invalid organization_id", 400);
  }

  let query = client
    .from("invoices")
    .select(
      "*, tenant:tenant_id(profile:user_id(full_name, phone)), unit:unit_id(unit_name)",
    );

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }
  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("due_date", { ascending: false });

  if (error) {
    console.error("[invoices:GET]", error);
    return genericError("Could not load invoices", 500);
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return genericError("Request body must be valid JSON", 400);
  }

  const validated = createInvoiceSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.error.issues },
      { status: 400 },
    );
  }

  // The organization_id supplied by the client is never trusted blindly:
  // confirm the caller actually belongs to that organization before the
  // insert is attempted (RLS also enforces this, but we fail fast with a
  // clear, non-leaky error instead of a generic 500 from a policy violation).
  const { data: membership, error: membershipError } = await client
    .from("organization_members")
    .select("organization_id")
    .eq("organization_id", validated.data.organization_id)
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) {
    return genericError("Organization not found or access denied", 403);
  }

  const invoiceNumber =
    validated.data.invoice_number ||
    `INV-${format(new Date(), "yyyyMMdd")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const dueDate =
    validated.data.due_date || format(addDays(new Date(), 5), "yyyy-MM-dd");

  const { data, error } = await client
    .from("invoices")
    .insert({
      ...validated.data,
      invoice_number: invoiceNumber,
      due_date: dueDate,
      total_amount: validated.data.amount,
    })
    .select()
    .single();

  if (error) {
    console.error("[invoices:POST]", error);
    return genericError("Could not create invoice", 500);
  }

  return NextResponse.json(data, { status: 201 });
}

// Generate monthly invoices (called by cron job)
export async function generateMonthlyInvoices(organizationId: string) {
  const client = getServiceClient();
  if (!client) return;

  const { data: activeLeases } = await client
    .from("leases")
    .select("*, tenant:tenant_id(*), unit:unit_id(*)")
    .eq("status", "active");

  if (!activeLeases) return;

  for (const lease of activeLeases) {
    const invoiceNumber = `INV-${format(new Date(), "yyyyMMdd")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    await client.from("invoices").insert({
      organization_id: organizationId,
      tenant_id: lease.tenant_id,
      unit_id: lease.unit_id,
      invoice_number: invoiceNumber,
      type: "rent",
      amount: lease.rent_amount,
      total_amount: lease.rent_amount,
      due_date: format(addDays(new Date(), 5), "yyyy-MM-dd"),
    });
  }
}
