import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestClient } from "@/lib/supabase";

const createPropertySchema = z.object({
  name: z.string().trim().min(1, "Property name is required").max(200),
  address: z.string().trim().min(1, "Address is required").max(300),
  county: z.string().trim().max(100).optional(),
  town: z.string().trim().max(100).optional(),
  total_units: z.number().int().min(1).max(10_000).default(1),
  property_type: z
    .enum(["apartment", "flat", "house", "commercial", "land"])
    .default("apartment"),
  year_built: z.number().int().min(1900).max(2100).optional(),
  amenities: z.array(z.string().trim().max(60)).max(50).optional(),
});

const genericError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

/** Resolves the caller's organization membership server-side. Never trust a
 * client-supplied organization_id for authorization decisions. */
async function resolveOrganizationId(
  client: ReturnType<typeof getRequestClient>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await client!
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.organization_id as string;
}

export async function GET(req: NextRequest) {
  const client = getRequestClient(req);
  if (!client) return genericError("Authentication required", 401);

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) return genericError("Authentication required", 401);

  const organizationId = await resolveOrganizationId(client, user.id);
  if (!organizationId) return genericError("No workspace found", 404);

  const { data, error } = await client
    .from("properties")
    .select("*, units(*)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[properties:GET]", error);
    return genericError("Could not load properties", 500);
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

  const validated = createPropertySchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.error.issues },
      { status: 400 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) return genericError("Authentication required", 401);

  const organizationId = await resolveOrganizationId(client, user.id);
  if (!organizationId)
    return genericError("No workspace found for this account", 404);

  const { data, error } = await client
    .from("properties")
    .insert({
      ...validated.data,
      organization_id: organizationId,
      landlord_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("[properties:POST]", error);
    return genericError("Could not create property", 500);
  }

  return NextResponse.json(data, { status: 201 });
}
