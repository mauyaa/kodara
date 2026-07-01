import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestClient } from "@/lib/supabase";

const createMaintenanceSchema = z.object({
  organization_id: z.string().uuid().optional(),
  unit_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().min(10).max(2000),
  priority: z.enum(["low", "medium", "high", "emergency"]).default("medium"),
});

const updateMaintenanceSchema = z
  .object({
    status: z.enum([
      "submitted",
      "in_review",
      "approved",
      "assigned",
      "in_progress",
      "completed",
      "cancelled",
      "rejected",
    ]),
    priority: z.enum(["low", "medium", "high", "emergency"]),
    vendor_id: z.string().uuid().nullable(),
    cost_estimate: z.number().nonnegative().nullable(),
    actual_cost: z.number().nonnegative().nullable(),
    scheduled_date: z.string().nullable(),
    completed_date: z.string().nullable(),
    tenant_responsibility: z.boolean(),
    tenant_cost: z.number().nonnegative().nullable(),
    landlord_cost: z.number().nonnegative().nullable(),
  })
  .partial();

const uuidSchema = z.string().uuid();

const genericError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unit_id");
  const organizationId = searchParams.get("organization_id");
  const status = searchParams.get("status");

  if (unitId && !uuidSchema.safeParse(unitId).success) {
    return genericError("Invalid unit_id", 400);
  }
  if (organizationId && !uuidSchema.safeParse(organizationId).success) {
    return genericError("Invalid organization_id", 400);
  }

  let query = client
    .from("maintenance_requests")
    .select(
      "*, tenant:tenant_id(profile:user_id(full_name, phone)), unit:unit_id(unit_name)",
    );

  if (unitId) query = query.eq("unit_id", unitId);
  if (organizationId) query = query.eq("organization_id", organizationId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    console.error("[maintenance:GET]", error);
    return genericError("Could not load maintenance requests", 500);
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

  const validated = createMaintenanceSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.error.issues },
      { status: 400 },
    );
  }

  // Resolve organization_id from the unit's property rather than trusting
  // a client-supplied value, so a request can't be filed against another
  // organization's unit.
  const { data: unit, error: unitError } = await client
    .from("units")
    .select("property_id, property:property_id(organization_id)")
    .eq("id", validated.data.unit_id)
    .maybeSingle();
  if (unitError || !unit) {
    return genericError("Unit not found or access denied", 404);
  }
  const property = unit.property as unknown as {
    organization_id: string;
  } | null;
  if (!property?.organization_id) {
    return genericError("Unit not found or access denied", 404);
  }

  const { organization_id: _ignoredOrgId, ...rest } = validated.data;
  void _ignoredOrgId;

  const { data, error } = await client
    .from("maintenance_requests")
    .insert({
      ...rest,
      organization_id: property.organization_id,
      status: "submitted",
    })
    .select()
    .single();

  if (error) {
    console.error("[maintenance:POST]", error);
    return genericError("Could not create maintenance request", 500);
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || !uuidSchema.safeParse(id).success) {
    return genericError("A valid maintenance request ID is required", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return genericError("Request body must be valid JSON", 400);
  }

  const validated = updateMaintenanceSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.error.issues },
      { status: 400 },
    );
  }
  if (Object.keys(validated.data).length === 0) {
    return genericError("No valid fields to update", 400);
  }

  const { data, error } = await client
    .from("maintenance_requests")
    .update({
      ...validated.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[maintenance:PATCH]", error);
    return genericError("Could not update maintenance request", 500);
  }

  return NextResponse.json(data);
}
