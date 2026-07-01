import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestClient, getServiceClient } from "@/lib/supabase";

const createNotificationSchema = z.object({
  organization_id: z.string().uuid().optional(),
  recipient_id: z.string().uuid(),
  type: z.enum([
    "payment_due",
    "payment_received",
    "payment_reminder",
    "maintenance_update",
    "maintenance_request",
    "lease_expiry",
    "vacancy_alert",
    "system_alert",
  ]),
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
  data: z.record(z.string(), z.unknown()).optional(),
});

const updateNotificationSchema = z
  .object({
    read: z.boolean(),
  })
  .strict();

const uuidSchema = z.string().uuid();

const genericError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) return genericError("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const unread = searchParams.get("unread") === "true";

  // Notifications are always scoped to the authenticated caller — a
  // recipient_id query param is never trusted to look up someone else's
  // notifications.
  let query = client
    .from("notifications")
    .select("*")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false });

  if (unread) {
    query = query.eq("read", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[notifications:GET]", error);
    return genericError("Could not load notifications", 500);
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

  const validated = createNotificationSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.error.issues },
      { status: 400 },
    );
  }

  const { data, error } = await client
    .from("notifications")
    .insert(validated.data)
    .select()
    .single();

  if (error) {
    console.error("[notifications:POST]", error);
    return genericError("Could not create notification", 500);
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) return genericError("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || !uuidSchema.safeParse(id).success) {
    return genericError("A valid notification ID is required", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return genericError("Request body must be valid JSON", 400);
  }

  const validated = updateNotificationSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.error.issues },
      { status: 400 },
    );
  }

  // Only the recipient may mark their own notification read/unread.
  const { data, error } = await client
    .from("notifications")
    .update(validated.data)
    .eq("id", id)
    .eq("recipient_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("[notifications:PATCH]", error);
    return genericError("Could not update notification", 500);
  }

  return NextResponse.json(data);
}

// Send payment reminder notifications
export async function sendPaymentReminders(organizationId: string) {
  const client = getServiceClient();
  if (!client) return;

  const today = new Date().toISOString().split("T")[0];
  const upcomingDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: dueInvoices } = await client
    .from("invoices")
    .select("*, tenant:tenant_id(profile:user_id(full_name))")
    .eq("organization_id", organizationId)
    .eq("status", "sent")
    .lte("due_date", upcomingDate);

  if (!dueInvoices) return;

  for (const invoice of dueInvoices) {
    if (new Date(invoice.due_date) <= new Date(today)) {
      await client.from("notifications").insert({
        organization_id: organizationId,
        recipient_id: invoice.tenant_id,
        type: "payment_reminder",
        title: "Rent Payment Overdue",
        message: `Your rent payment of KES ${invoice.amount} was due on ${invoice.due_date}`,
        data: { invoice_id: invoice.id },
      });
    }
  }
}
