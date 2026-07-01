import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestClient } from "@/lib/supabase";

const createTenantSchema = z.object({
  user_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  lease_id: z.string().uuid(),
  move_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});

const uuidSchema = z.string().uuid();

const genericError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const unitId = searchParams.get("unit_id");
  const organizationId = searchParams.get("organization_id");

  if (unitId && !uuidSchema.safeParse(unitId).success) {
    return genericError("Invalid unit_id", 400);
  }
  if (organizationId && !uuidSchema.safeParse(organizationId).success) {
    return genericError("Invalid organization_id", 400);
  }

  let query = client.from("tenant_directory").select("*");

  if (unitId) {
    query = query.eq("unit_id", unitId);
  }
  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query.order("move_in_date", {
    ascending: false,
  });

  if (error) {
    console.error("[tenants:GET]", error);
    return genericError("Could not load tenants", 500);
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

  const validated = createTenantSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.error.issues },
      { status: 400 },
    );
  }

  // Confirm the unit is visible to the caller (RLS-scoped) before creating
  // a tenant record against it.
  const { data: unit, error: unitError } = await client
    .from("units")
    .select("id, status")
    .eq("id", validated.data.unit_id)
    .maybeSingle();
  if (unitError || !unit) {
    return genericError("Unit not found or access denied", 404);
  }
  if (unit.status === "occupied") {
    return genericError("This unit is already occupied", 409);
  }

  const { data, error } = await client
    .from("tenants")
    .insert({
      ...validated.data,
      status: "active",
      outstanding_balance: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("[tenants:POST]", error);
    return genericError("Could not create tenant", 500);
  }

  // Update unit status to occupied
  const { error: unitUpdateError } = await client
    .from("units")
    .update({ status: "occupied", occupied_from: validated.data.move_in_date })
    .eq("id", validated.data.unit_id);
  if (unitUpdateError) {
    console.error("[tenants:POST] unit status update failed", unitUpdateError);
    // Tenant record was created; surface a partial-success warning rather
    // than a misleading 500 (the tenant write already succeeded).
    return NextResponse.json(
      {
        ...data,
        warning: "Tenant created, but the unit status could not be updated",
      },
      { status: 201 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || !uuidSchema.safeParse(id).success) {
    return genericError("A valid tenant ID is required", 400);
  }

  const { error } = await client
    .from("tenants")
    .update({
      status: "moved_out",
      move_out_date: new Date().toISOString().split("T")[0],
    })
    .eq("id", id);

  if (error) {
    console.error("[tenants:DELETE]", error);
    return genericError("Could not update tenant", 500);
  }

  return NextResponse.json({ success: true });
}
