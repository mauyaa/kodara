import {
  clearSupabaseConfig,
  isSupabaseConfigured,
  setSupabaseKeys,
  subscribeToTable,
  supabase,
} from "./supabase";
import type {
  DocumentRecord,
  KodaraUser,
  MaintenanceRequest,
  MaintenanceView,
  Message,
  Payment,
  PaymentView,
  Property,
  Role,
  TenantView,
  Unit,
} from "./types";

const DEMO_STORAGE = "kodara-alpha-demo-v1";
const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

type DemoStore = {
  properties: Property[];
  units: Unit[];
  tenants: TenantView[];
  payments: PaymentView[];
  maintenance: MaintenanceView[];
  messages: Message[];
  documents: DocumentRecord[];
};

let demoStore: DemoStore | null = null;
let demoRole: Role = "landlord";
let usingDemoFallback = false;

const now = "2026-06-29T08:00:00.000Z";

function defaultStore(): DemoStore {
  const properties: Property[] = [
    {
      id: "prop-kahawa",
      organization_id: ORGANIZATION_ID,
      landlord_id: "user-landlord",
      name: "Kahawa West Apartments",
      address: "Kahawa West, Nairobi",
      county: "Nairobi",
      town: "Kahawa West",
      latitude: null,
      longitude: null,
      property_type: "apartment",
      total_units: 6,
      year_built: 2021,
      amenities: ["Parking", "CCTV", "Borehole"],
      photos: null,
      documents: null,
      status: "active",
      created_at: "2026-01-15T00:00:00.000Z",
      updated_at: now,
    },
    {
      id: "prop-kilimani",
      organization_id: ORGANIZATION_ID,
      landlord_id: "user-landlord",
      name: "Kilimani Court",
      address: "Kindaruma Road, Nairobi",
      county: "Nairobi",
      town: "Kilimani",
      latitude: null,
      longitude: null,
      property_type: "apartment",
      total_units: 4,
      year_built: 2019,
      amenities: ["Lift", "Backup generator"],
      photos: null,
      documents: null,
      status: "active",
      created_at: "2026-02-01T00:00:00.000Z",
      updated_at: now,
    },
  ];

  const units: Unit[] = [
    unit("unit-2a", "prop-kahawa", "2A", 28500, "occupied", 2),
    unit("unit-1b", "prop-kahawa", "1B", 32000, "occupied", 1),
    unit("unit-3c", "prop-kahawa", "3C", 26000, "occupied", 3),
    unit("unit-4a", "prop-kahawa", "4A", 30000, "vacant", 4),
    unit("unit-a1", "prop-kilimani", "A1", 65000, "occupied", 1),
    unit("unit-b2", "prop-kilimani", "B2", 68000, "maintenance", 2),
  ];

  const tenants: TenantView[] = [
    tenant(
      "tenant-grace",
      "user-grace",
      "unit-2a",
      "Grace Wanjiku",
      "+254 701 234 567",
      "2A",
      "Kahawa West Apartments",
      28500,
    ),
    tenant(
      "tenant-james",
      "user-james",
      "unit-1b",
      "James Ochieng",
      "+254 722 345 678",
      "1B",
      "Kahawa West Apartments",
      0,
    ),
    tenant(
      "tenant-fatima",
      "user-fatima",
      "unit-3c",
      "Fatima Ali",
      "+254 733 822 104",
      "3C",
      "Kahawa West Apartments",
      26000,
    ),
    tenant(
      "tenant-muthoni",
      "user-muthoni",
      "unit-a1",
      "Muthoni Njeri",
      "+254 710 904 220",
      "A1",
      "Kilimani Court",
      0,
    ),
  ];

  const payments: PaymentView[] = [
    payment(
      "pay-1",
      "tenant-grace",
      "unit-2a",
      28500,
      "completed",
      "QK7B2P9X",
      "Grace Wanjiku",
      "2A",
      "Kahawa West Apartments",
      "2026-06-05",
      "2026-06-05T10:22:00.000Z",
    ),
    payment(
      "pay-2",
      "tenant-james",
      "unit-1b",
      32000,
      "completed",
      "QK7A1M4Z",
      "James Ochieng",
      "1B",
      "Kahawa West Apartments",
      "2026-06-05",
      "2026-06-05T09:11:00.000Z",
    ),
    payment(
      "pay-3",
      "tenant-muthoni",
      "unit-a1",
      65000,
      "completed",
      "QK6P8A2L",
      "Muthoni Njeri",
      "A1",
      "Kilimani Court",
      "2026-06-05",
      "2026-06-04T16:45:00.000Z",
    ),
    payment(
      "pay-4",
      "tenant-fatima",
      "unit-3c",
      26000,
      "initiated",
      null,
      "Fatima Ali",
      "3C",
      "Kahawa West Apartments",
      "2026-06-05",
      now,
    ),
  ];

  const maintenance: MaintenanceView[] = [
    maintenanceItem(
      "maint-1",
      "unit-2a",
      "tenant-grace",
      "Plumbing",
      "Kitchen sink leak",
      "Kitchen sink is leaking under the cabinet.",
      "in_progress",
      "high",
      "Grace Wanjiku",
      "2A",
      "Kahawa West Apartments",
    ),
    maintenanceItem(
      "maint-2",
      "unit-b2",
      "tenant-muthoni",
      "Electrical",
      "Intermittent power",
      "Sockets in the living room lose power intermittently.",
      "submitted",
      "medium",
      "Muthoni Njeri",
      "B2",
      "Kilimani Court",
    ),
  ];

  return {
    properties,
    units,
    tenants,
    payments,
    maintenance,
    messages: [
      {
        id: "msg-1",
        sender_id: "user-grace",
        receiver_id: "user-landlord",
        sender_name: "Grace Wanjiku",
        receiver_name: "Peter Kamau",
        subject: "Plumbing update",
        content: "The plumber can access the unit after 3 pm today.",
        attachments: [],
        read: false,
        created_at: "2026-06-29T07:42:00.000Z",
      },
      {
        id: "msg-2",
        sender_id: "user-landlord",
        receiver_id: "user-fatima",
        sender_name: "Peter Kamau",
        receiver_name: "Fatima Ali",
        subject: "Rent reminder",
        content:
          "Hi Fatima, your June rent is still outstanding. Please let me know if you need help.",
        attachments: [],
        read: true,
        created_at: "2026-06-28T13:10:00.000Z",
      },
    ],
    documents: [
      {
        id: "doc-1",
        name: "Grace Wanjiku — Lease 2026.pdf",
        type: "lease",
        property_id: "prop-kahawa",
        tenant_id: "tenant-grace",
        file_url: null,
        size_bytes: 482000,
        created_at: "2026-01-02T08:00:00.000Z",
      },
      {
        id: "doc-2",
        name: "Kahawa West — Inspection report.pdf",
        type: "inspection",
        property_id: "prop-kahawa",
        tenant_id: null,
        file_url: null,
        size_bytes: 1204000,
        created_at: "2026-06-10T11:30:00.000Z",
      },
      {
        id: "doc-3",
        name: "M-Pesa receipt — June.pdf",
        type: "receipt",
        property_id: "prop-kilimani",
        tenant_id: "tenant-muthoni",
        file_url: null,
        size_bytes: 96000,
        created_at: "2026-06-04T16:46:00.000Z",
      },
    ],
  };
}

function unit(
  id: string,
  propertyId: string,
  name: string,
  rent: number,
  status: Unit["status"],
  floor: number,
): Unit {
  return {
    id,
    property_id: propertyId,
    unit_name: name,
    floor,
    bedrooms: 2,
    bathrooms: 1,
    size_sqm: null,
    monthly_rent: rent,
    deposit_amount: rent,
    service_charge_monthly: 0,
    status,
    occupied_from: status === "occupied" ? "2025-03-01" : null,
    occupied_until: null,
    utilities_config: {},
    created_at: now,
    updated_at: now,
  };
}

function tenant(
  id: string,
  userId: string,
  unitId: string,
  name: string,
  phone: string,
  unitName: string,
  propertyName: string,
  balance: number,
): TenantView {
  return {
    id,
    user_id: userId,
    unit_id: unitId,
    lease_id: `lease-${id}`,
    move_in_date: "2025-03-01",
    move_out_date: null,
    status: "active",
    outstanding_balance: balance,
    last_payment_date: balance ? null : "2026-06-05",
    created_at: now,
    updated_at: now,
    full_name: name,
    phone,
    unit_name: unitName,
    property_name: propertyName,
  };
}

function payment(
  id: string,
  tenantId: string,
  unitId: string,
  amount: number,
  status: Payment["status"],
  receipt: string | null,
  tenantName: string,
  unitName: string,
  propertyName: string,
  dueDate: string,
  createdAt: string,
): PaymentView {
  return {
    id,
    invoice_id: null,
    organization_id: ORGANIZATION_ID,
    tenant_id: tenantId,
    unit_id: unitId,
    amount,
    payment_method: "mpesa_stk",
    reference: receipt,
    mpesa_receipt: receipt,
    mpesa_sender_phone: null,
    mpesa_shortcode: null,
    status,
    failure_reason: null,
    processed_at: status === "completed" ? createdAt : null,
    callback_data: null,
    created_at: createdAt,
    updated_at: createdAt,
    tenant_name: tenantName,
    unit_name: unitName,
    property_name: propertyName,
    due_date: dueDate,
  };
}

function maintenanceItem(
  id: string,
  unitId: string,
  tenantId: string,
  category: string,
  title: string,
  description: string,
  status: MaintenanceRequest["status"],
  priority: MaintenanceRequest["priority"],
  tenantName: string,
  unitName: string,
  propertyName: string,
): MaintenanceView {
  return {
    id,
    organization_id: ORGANIZATION_ID,
    unit_id: unitId,
    tenant_id: tenantId,
    category_id: null,
    vendor_id: null,
    title,
    description,
    photos: null,
    priority,
    status,
    cost_estimate: null,
    actual_cost: null,
    scheduled_date: null,
    completed_date: null,
    tenant_responsibility: false,
    tenant_cost: null,
    landlord_cost: null,
    status_updates: [{ status, at: now, by: "Kodara" }],
    created_by: tenantId,
    created_at: "2026-06-27T14:00:00.000Z",
    updated_at: now,
    tenant_name: tenantName,
    unit_name: unitName,
    property_name: propertyName,
    category_name: category,
  };
}

function loadStore(): DemoStore {
  if (demoStore) return demoStore;
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(DEMO_STORAGE);
      if (saved) demoStore = JSON.parse(saved) as DemoStore;
    } catch {
      window.localStorage.removeItem(DEMO_STORAGE);
    }
  }
  demoStore ??= defaultStore();
  return demoStore;
}

function saveStore(store: DemoStore): void {
  demoStore = store;
  if (typeof window !== "undefined")
    window.localStorage.setItem(DEMO_STORAGE, JSON.stringify(store));
}

function isSchemaOrAuthError(error: unknown): boolean {
  const value = error as { code?: string; message?: string; status?: number };
  return (
    value?.code === "PGRST205" ||
    value?.code === "42501" ||
    value?.status === 401 ||
    /schema cache|could not find|permission denied|jwt/i.test(
      value?.message ?? "",
    )
  );
}

async function liveOrDemo<T>(
  live: () => Promise<T>,
  demo: () => T | Promise<T>,
): Promise<T> {
  if (!isSupabaseConfigured() || usingDemoFallback) return demo();
  const {
    data: { session },
  } = await client().auth.getSession();
  if (!session) {
    usingDemoFallback = true;
    return demo();
  }
  try {
    return await live();
  } catch (error) {
    if (!isSchemaOrAuthError(error)) throw error;
    usingDemoFallback = true;
    return demo();
  }
}

function client() {
  const value = supabase();
  if (!value) throw new Error("Supabase is not configured");
  return value;
}

async function ensureCurrentOrganization(): Promise<{
  organizationId: string;
  userId: string;
}> {
  const database = client();
  const {
    data: { user },
    error: userError,
  } = await database.auth.getUser();
  if (userError || !user) throw new Error("An authenticated user is required");

  const { data: membership } = await database
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership?.organization_id) {
    return { organizationId: membership.organization_id, userId: user.id };
  }

  const { data: tenantHome } = await database
    .from("tenant_directory")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (tenantHome?.organization_id) {
    return { organizationId: tenantHome.organization_id, userId: user.id };
  }

  const { data: existingOrganization } = await database
    .from("organizations")
    .select("id")
    .eq("created_by", user.id)
    .limit(1)
    .maybeSingle();
  let organizationId = existingOrganization?.id as string | undefined;

  if (!organizationId) {
    const { data: organization, error: organizationError } = await database
      .from("organizations")
      .insert({
        name: `${user.user_metadata.full_name ?? "My"} portfolio`,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (organizationError || !organization) {
      throw organizationError ?? new Error("Could not create workspace");
    }
    organizationId = organization.id;
  }

  if (!organizationId) throw new Error("Could not resolve workspace");

  const { error: membershipError } = await database
    .from("organization_members")
    .upsert({
      organization_id: organizationId,
      user_id: user.id,
      role: "owner",
    });
  if (membershipError) throw membershipError;
  return { organizationId, userId: user.id };
}

export function isUsingDemoFallback(): boolean {
  return usingDemoFallback || !isSupabaseConfigured();
}
export function resetFullDemo(): void {
  saveStore(defaultStore());
  usingDemoFallback = !isSupabaseConfigured();
}
export function getCurrentDemoUser(): KodaraUser {
  const users: Record<Role, KodaraUser> = {
    landlord: {
      id: "user-landlord",
      full_name: "Peter Kamau",
      phone: "+254 712 345 678",
      role: "landlord",
    },
    property_manager: {
      id: "user-manager",
      full_name: "Amina Hassan",
      phone: "+254 711 340 221",
      role: "property_manager",
    },
    property_agent: {
      id: "user-agent",
      full_name: "John Mwangi",
      phone: "+254 723 811 100",
      role: "property_agent",
    },
    tenant: {
      id: "user-grace",
      full_name: "Grace Wanjiku",
      phone: "+254 701 234 567",
      role: "tenant",
    },
    vendor: {
      id: "user-vendor",
      full_name: "Daniel Kariuki",
      phone: "+254 724 222 321",
      role: "vendor",
    },
    admin_staff: {
      id: "user-admin",
      full_name: "Njeri Muthoni",
      phone: "+254 720 100 100",
      role: "admin_staff",
    },
  };
  return users[demoRole];
}
export function setDemoUserRole(role: Role): void {
  demoRole = role;
}

export async function getProperties(): Promise<Property[]> {
  return liveOrDemo(
    async () => {
      const { data, error } = await client()
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Property[];
    },
    () => loadStore().properties,
  );
}
export async function getUnits(propertyId?: string): Promise<Unit[]> {
  return liveOrDemo(
    async () => {
      let query = client().from("units").select("*");
      if (propertyId) query = query.eq("property_id", propertyId);
      const { data, error } = await query.order("unit_name");
      if (error) throw error;
      return data as Unit[];
    },
    () =>
      loadStore().units.filter(
        (item) => !propertyId || item.property_id === propertyId,
      ),
  );
}
export async function getTenants(): Promise<TenantView[]> {
  return liveOrDemo(
    async () => {
      const { data, error } = await client()
        .from("tenant_directory")
        .select("*");
      if (error) throw error;
      return data as TenantView[];
    },
    () => loadStore().tenants,
  );
}
export async function getPayments(): Promise<PaymentView[]> {
  return liveOrDemo(
    async () => {
      const { data, error } = await client()
        .from("payment_directory")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PaymentView[];
    },
    () => loadStore().payments,
  );
}
export async function getMaintenanceRequests(): Promise<MaintenanceView[]> {
  return liveOrDemo(
    async () => {
      const { data, error } = await client()
        .from("maintenance_directory")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MaintenanceView[];
    },
    () => loadStore().maintenance,
  );
}
export async function getMessages(): Promise<Message[]> {
  return liveOrDemo(
    async () => {
      const { data, error } = await client()
        .from("message_directory")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Message[];
    },
    () => loadStore().messages,
  );
}
export async function getDocuments(): Promise<DocumentRecord[]> {
  return liveOrDemo(
    async () => {
      const { data, error } = await client()
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentRecord[];
    },
    () => loadStore().documents,
  );
}

export async function createProperty(
  input: Pick<Property, "name" | "address"> & Partial<Property>,
): Promise<Property> {
  const fallback = () => {
    const store = loadStore();
    const created: Property = {
      id: crypto.randomUUID(),
      organization_id: ORGANIZATION_ID,
      landlord_id: "user-landlord",
      name: input.name,
      address: input.address,
      county: input.county ?? "Nairobi",
      town: input.town ?? null,
      latitude: null,
      longitude: null,
      property_type: input.property_type ?? "apartment",
      total_units: input.total_units ?? 1,
      year_built: input.year_built ?? null,
      amenities: input.amenities ?? [],
      photos: null,
      documents: null,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.properties.unshift(created);
    saveStore(store);
    return created;
  };
  return liveOrDemo(async () => {
    const { organizationId, userId } = await ensureCurrentOrganization();
    const { data, error } = await client()
      .from("properties")
      .insert({
        ...input,
        organization_id: organizationId,
        landlord_id: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Property;
  }, fallback);
}

export async function createUnit(
  input: Pick<Unit, "property_id" | "unit_name" | "monthly_rent"> &
    Partial<Unit>,
): Promise<Unit> {
  const fallback = () => {
    const store = loadStore();
    const created = unit(
      crypto.randomUUID(),
      input.property_id,
      input.unit_name,
      input.monthly_rent,
      input.status ?? "vacant",
      input.floor ?? 0,
    );
    store.units.push(created);
    const property = store.properties.find(
      (item) => item.id === input.property_id,
    );
    if (property) property.total_units += 1;
    saveStore(store);
    return created;
  };
  return liveOrDemo(async () => {
    const { data, error } = await client()
      .from("units")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Unit;
  }, fallback);
}

export async function createTenant(input: {
  unit_id: string;
  full_name: string;
  phone: string;
}): Promise<TenantView> {
  const fallback = () => {
    const store = loadStore();
    const selectedUnit = store.units.find(
      (item) => item.id === input.unit_id,
    );
    const selectedProperty = store.properties.find(
      (item) => item.id === selectedUnit?.property_id,
    );
    const created = tenant(
      crypto.randomUUID(),
      crypto.randomUUID(),
      input.unit_id,
      input.full_name,
      input.phone,
      selectedUnit?.unit_name ?? "—",
      selectedProperty?.name ?? "—",
      selectedUnit?.monthly_rent ?? 0,
    );
    store.tenants.push(created);
    if (selectedUnit) selectedUnit.status = "occupied";
    saveStore(store);
    return created;
  };

  // Against real Supabase, a tenant record requires a profile (backed by an
  // auth.users row) and is normally created once the tenant has signed up
  // via phone OTP (see /api/auth) and a manager links their existing
  // profile to a unit/lease. This client-side service cannot create an
  // auth.users row itself (that needs the service-role key, which never
  // ships to the browser). So the live path here looks up an existing
  // profile by phone number rather than minting one. If no matching
  // profile exists yet, we surface a clear, actionable error instead of
  // silently writing to local demo storage only.
  return liveOrDemo(async () => {
    const database = client();
    const { data: existingProfile, error: profileError } = await database
      .from("profiles")
      .select("id")
      .eq("phone", input.phone)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!existingProfile) {
      throw new Error(
        "This tenant has not signed up yet. Ask them to sign in with their phone number first, then add them to a unit.",
      );
    }

    const { data: unit, error: unitError } = await database
      .from("units")
      .select("monthly_rent")
      .eq("id", input.unit_id)
      .single();
    if (unitError || !unit) throw unitError ?? new Error("Unit not found");

    const { data: lease, error: leaseError } = await database
      .from("leases")
      .insert({
        unit_id: input.unit_id,
        tenant_id: existingProfile.id,
        start_date: new Date().toISOString().slice(0, 10),
        lease_type: "month_to_month",
        rent_amount: unit.monthly_rent,
        status: "active",
      })
      .select("id")
      .single();
    if (leaseError || !lease)
      throw leaseError ?? new Error("Could not create lease");

    const {
      data: { session },
    } = await database.auth.getSession();
    if (!session) throw new Error("Authentication required");

    const response = await fetch("/api/tenants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        user_id: existingProfile.id,
        unit_id: input.unit_id,
        lease_id: lease.id,
        move_in_date: new Date().toISOString().slice(0, 10),
      }),
    });
    const result = (await response.json()) as
      | TenantView
      | { error: string };
    if (!response.ok) {
      throw new Error(
        "error" in result ? result.error : "Could not add tenant",
      );
    }

    const refreshed = await getTenants();
    return (
      refreshed.find((item) => item.user_id === existingProfile.id) ??
      (result as TenantView)
    );
  }, fallback);
}

export async function createMaintenanceRequest(input: {
  unit_id: string;
  tenant_id: string;
  category: string;
  description: string;
}): Promise<MaintenanceView> {
  const fallback = () => {
    const store = loadStore();
    const selectedTenant =
      store.tenants.find((item) => item.id === input.tenant_id) ??
      store.tenants[0];
    const selectedUnit = store.units.find((item) => item.id === input.unit_id);
    const selectedProperty = store.properties.find(
      (item) => item.id === selectedUnit?.property_id,
    );
    const created = maintenanceItem(
      crypto.randomUUID(),
      input.unit_id,
      selectedTenant.id,
      input.category,
      input.category,
      input.description,
      "submitted",
      "medium",
      selectedTenant.full_name,
      selectedUnit?.unit_name ?? "—",
      selectedProperty?.name ?? "—",
    );
    store.maintenance.unshift(created);
    saveStore(store);
    return created;
  };
  return liveOrDemo(async () => {
    const { data: selectedUnit, error: unitError } = await client()
      .from("units")
      .select("property_id")
      .eq("id", input.unit_id)
      .single();
    if (unitError || !selectedUnit)
      throw unitError ?? new Error("Unit not found");
    const { data: selectedProperty, error: propertyError } = await client()
      .from("properties")
      .select("organization_id")
      .eq("id", selectedUnit.property_id)
      .single();
    if (propertyError || !selectedProperty) {
      throw propertyError ?? new Error("Property not found");
    }
    const payload = {
      organization_id: selectedProperty.organization_id,
      unit_id: input.unit_id,
      tenant_id: input.tenant_id,
      title: input.category,
      description: input.description,
      status: "submitted",
    };
    const { data, error } = await client()
      .from("maintenance_requests")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as MaintenanceView;
  }, fallback);
}

export async function updateMaintenanceStatus(
  id: string,
  status: MaintenanceRequest["status"],
): Promise<void> {
  return liveOrDemo(
    async () => {
      const { error } = await client()
        .from("maintenance_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    () => {
      const store = loadStore();
      const item = store.maintenance.find((entry) => entry.id === id);
      if (item) {
        item.status = status;
        item.updated_at = new Date().toISOString();
        item.status_updates.push({
          status,
          at: item.updated_at,
          by: getCurrentDemoUser().full_name,
        });
      }
      saveStore(store);
    },
  );
}

export async function payCurrentTenantRent(
  tenantId: string,
): Promise<PaymentView | null> {
  const fallback = () => {
    const store = loadStore();
    const selectedTenant = store.tenants.find((item) => item.id === tenantId);
    if (!selectedTenant || selectedTenant.outstanding_balance <= 0) return null;
    const amount = selectedTenant.outstanding_balance;
    const receipt = `RK${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const created = payment(
      crypto.randomUUID(),
      selectedTenant.id,
      selectedTenant.unit_id,
      amount,
      "completed",
      receipt,
      selectedTenant.full_name,
      selectedTenant.unit_name,
      selectedTenant.property_name,
      new Date().toISOString().slice(0, 10),
      new Date().toISOString(),
    );
    store.payments.unshift(created);
    selectedTenant.outstanding_balance = 0;
    selectedTenant.last_payment_date = new Date().toISOString().slice(0, 10);
    saveStore(store);
    return created;
  };

  return liveOrDemo(async () => {
    const database = client();
    const { data: tenant, error: tenantError } = await database
      .from("tenant_directory")
      .select("*")
      .eq("id", tenantId)
      .single();
    if (tenantError || !tenant || Number(tenant.outstanding_balance) <= 0)
      return null;
    const { data: invoice, error: invoiceError } = await database
      .from("invoices")
      .select("id,due_date")
      .eq("tenant_id", tenantId)
      .in("status", ["sent", "partially_paid", "overdue"])
      .order("due_date")
      .limit(1)
      .maybeSingle();
    if (invoiceError || !invoice)
      throw invoiceError ?? new Error("No payable invoice found");
    const {
      data: { session },
    } = await database.auth.getSession();
    if (!session) throw new Error("Authentication required");
    const response = await fetch("/api/mpesa/stk-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        phone: tenant.phone,
        amount: Number(tenant.outstanding_balance),
        invoiceId: invoice.id,
      }),
    });
    const result = (await response.json()) as {
      checkoutRequestId?: string;
      error?: string;
    };
    if (!response.ok || !result.checkoutRequestId)
      throw new Error(result.error ?? "Could not start M-Pesa payment");
    return payment(
      result.checkoutRequestId,
      tenant.id,
      tenant.unit_id,
      Number(tenant.outstanding_balance),
      "initiated",
      null,
      tenant.full_name,
      tenant.unit_name,
      tenant.property_name,
      invoice.due_date,
      new Date().toISOString(),
    );
  }, fallback);
}

export async function sendMessage(input: {
  receiver_id: string;
  receiver_name: string;
  subject: string;
  content: string;
}): Promise<Message> {
  const fallback = () => {
    const store = loadStore();
    const sender = getCurrentDemoUser();
    const created: Message = {
      id: crypto.randomUUID(),
      sender_id: sender.id,
      receiver_id: input.receiver_id,
      sender_name: sender.full_name,
      receiver_name: input.receiver_name,
      subject: input.subject || null,
      content: input.content,
      attachments: [],
      read: false,
      created_at: new Date().toISOString(),
    };
    store.messages.unshift(created);
    saveStore(store);
    return created;
  };
  return liveOrDemo(async () => {
    const { organizationId, userId } = await ensureCurrentOrganization();
    const { data, error } = await client()
      .from("messages")
      .insert({
        organization_id: organizationId,
        sender_id: userId,
        receiver_id: input.receiver_id,
        subject: input.subject || null,
        content: input.content,
        attachments: [],
      })
      .select(
        "id,sender_id,receiver_id,subject,content,attachments,read,created_at",
      )
      .single();
    if (error || !data) throw error ?? new Error("Could not send message");
    const { data: profile } = await client()
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();
    return {
      ...data,
      sender_name: profile?.full_name ?? "Kodara user",
      receiver_name: input.receiver_name,
    } as Message;
  }, fallback);
}

export async function addDocument(
  input: Pick<
    DocumentRecord,
    "name" | "type" | "property_id" | "tenant_id" | "size_bytes"
  >,
): Promise<DocumentRecord> {
  const fallback = () => {
    const store = loadStore();
    const created: DocumentRecord = {
      ...input,
      id: crypto.randomUUID(),
      file_url: null,
      created_at: new Date().toISOString(),
    };
    store.documents.unshift(created);
    saveStore(store);
    return created;
  };
  return liveOrDemo(async () => {
    const { organizationId, userId } = await ensureCurrentOrganization();
    const { data, error } = await client()
      .from("documents")
      .insert({
        ...input,
        organization_id: organizationId,
        created_by: userId,
        file_url: null,
      })
      .select(
        "id,name,type,property_id,tenant_id,file_url,size_bytes,created_at",
      )
      .single();
    if (error || !data) throw error ?? new Error("Could not save document");
    return data as DocumentRecord;
  }, fallback);
}

export async function sendRentReminder(tenantId: string): Promise<void> {
  const target = (await getTenants()).find((item) => item.id === tenantId);
  if (!target) return;
  await sendMessage({
    receiver_id: target.user_id,
    receiver_name: target.full_name,
    subject: "Rent reminder",
    content: `Your outstanding Kodara balance is KES ${target.outstanding_balance.toLocaleString("en-KE")}. Please pay through M-Pesa or contact your property manager.`,
  });
}

export {
  clearSupabaseConfig,
  isSupabaseConfigured,
  setSupabaseKeys,
  subscribeToTable,
};
