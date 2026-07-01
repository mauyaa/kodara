import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestClient } from "@/lib/supabase";

const createUnitSchema = z.object({
  property_id: z.string().uuid(),
  unit_name: z.string().trim().min(1, "Unit name is required").max(50),
  floor: z.number().int().min(-5).max(200).optional(),
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  size_sqm: z.number().positive().optional(),
  monthly_rent: z.number().positive("Monthly rent must be positive"),
  deposit_amount: z.number().nonnegative().default(0),
  service_charge_monthly: z.number().nonnegative().default(0),
});

const updateUnitSchema = z
  .object({
    unit_name: z.string().trim().min(1).max(50),
    floor: z.number().int().min(-5).max(200).nullable(),
    bedrooms: z.number().int().min(0).max(20).nullable(),
    bathrooms: z.number().int().min(0).max(20).nullable(),
    size_sqm: z.number().positive().nullable(),
    monthly_rent: z.number().positive(),
    deposit_amount: z.number().nonnegative(),
    service_charge_monthly: z.number().nonnegative(),
    status: z.enum(["vacant", "occupied", "maintenance", "reserved"]),
    occupied_from: z.string().nullable(),
    occupied_until: z.string().nullable(),
  })
  .partial();

const uuidSchema = z.string().uuid();

const genericError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const propertyIdRaw = searchParams.get("property_id");
  const status = searchParams.get("status");

  if (propertyIdRaw && !uuidSchema.safeParse(propertyIdRaw).success) {
    return genericError("Invalid property_id", 400);
  }

  let query = client.from("units").select("*, property:property_id(name)");

  if (propertyIdRaw) {
    query = query.eq("property_id", propertyIdRaw);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("unit_name", { ascending: true });

  if (error) {
    console.error("[units:GET]", error);
    return genericError("Could not load units", 500);
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

  const validated = createUnitSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.error.issues },
      { status: 400 },
    );
  }

  // Confirm the property is visible to the caller (RLS-scoped) before
  // allowing a unit to be attached to it — prevents attaching units to a
  // property the caller cannot see/own.
  const { data: property, error: propertyError } = await client
    .from("properties")
    .select("id")
    .eq("id", validated.data.property_id)
    .maybeSingle();
  if (propertyError || !property) {
    return genericError("Property not found or access denied", 404);
  }

  const { data, error } = await client
    .from("units")
    .insert({
      ...validated.data,
      status: "vacant",
    })
    .select()
    .single();

  if (error) {
    console.error("[units:POST]", error);
    return genericError("Could not create unit", 500);
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || !uuidSchema.safeParse(id).success) {
    return genericError("A valid unit ID is required", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return genericError("Request body must be valid JSON", 400);
  }

  const validated = updateUnitSchema.safeParse(body);
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
    .from("units")
    .update({ ...validated.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[units:PUT]", error);
    return genericError("Could not update unit", 500);
  }

  return NextResponse.json(data);
}
