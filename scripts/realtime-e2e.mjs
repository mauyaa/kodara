// Authenticated Supabase Realtime integration test.
//
// Proves that a landlord receives the two events used by the web dashboard
// under RLS: payment INSERT and maintenance request UPDATE. The test creates
// isolated local fixtures and rejects Realtime payload authorization errors.
// Run `supabase db reset --local` afterward when a pristine database is needed.
//
// Usage: node scripts/realtime-e2e.mjs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? LOCAL_ANON_KEY;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const localUrl = new URL(SUPABASE_URL);
if (
  !["127.0.0.1", "localhost", "::1"].includes(localUrl.hostname) &&
  process.env.ALLOW_REMOTE_REALTIME_E2E !== "1"
) {
  throw new Error("Refusing to create Realtime E2E fixtures outside local Supabase");
}

const publicKey = ANON_KEY;
const run = Date.now().toString(36);
const landlordEmail = `realtime-landlord-${run}@kodara.test`;
const tenantEmail = `realtime-tenant-${run}@kodara.test`;
const password = "RealtimeSecret123!";
const payerPhone = `2547${String(Date.now()).slice(-8)}`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient(SUPABASE_URL, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tenantClient = createClient(SUPABASE_URL, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let landlordId;
let tenantId;
let propertyId;
let unitId;
let tenancyId;
let maintenanceId;
let channel;
const checkoutRequestId = `ws_CO_RT_${run}`;
const receipt = `RT${run.toUpperCase()}`;

function timeout(label, milliseconds = 12_000) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds),
  );
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertAuthorizedPayload(payload, label) {
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new Error(`${label} rejected: ${payload.errors.join(", ")}`);
  }
}

async function cleanup() {
  if (channel) await authClient.removeChannel(channel);
}

try {
  const { data: landlordResult, error: landlordError } =
    await admin.auth.admin.createUser({
      email: landlordEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Realtime Landlord" },
    });
  if (landlordError) throw landlordError;
  landlordId = landlordResult.user.id;

  const { data: tenantResult, error: tenantError } =
    await admin.auth.admin.createUser({
      email: tenantEmail,
      password,
      email_confirm: true,
      phone: `+${payerPhone}`,
      phone_confirm: true,
      user_metadata: { full_name: "Realtime Tenant" },
    });
  if (tenantError) throw tenantError;
  tenantId = tenantResult.user.id;

  const { data: session, error: signInError } =
    await authClient.auth.signInWithPassword({
      email: landlordEmail,
      password,
    });
  if (signInError || !session.session) throw signInError ?? new Error("no session");

  const { error: tenantSignInError } = await tenantClient.auth.signInWithPassword({
    email: tenantEmail,
    password,
  });
  if (tenantSignInError) throw tenantSignInError;

  const { error: roleError } = await authClient.rpc("register_as_landlord");
  if (roleError) throw roleError;

  const { data: property, error: propertyError } = await authClient
    .from("properties")
    .insert({
      landlord_id: landlordId,
      name: `Realtime Apartments ${run}`,
      address: "Nairobi",
    })
    .select("id")
    .single();
  if (propertyError) throw propertyError;
  propertyId = property.id;

  const { data: unit, error: unitError } = await authClient
    .from("units")
    .insert({ property_id: propertyId, name: "RT-01" })
    .select("id")
    .single();
  if (unitError) throw unitError;
  unitId = unit.id;

  const { data: tenancy, error: tenancyError } = await authClient
    .from("tenancies")
    .insert({
      unit_id: unitId,
      tenant_id: tenantId,
      rent_amount: 25_000,
      billing_day: 5,
      payment_reference: `KDR-RT-${run}`,
      start_date: new Date().toISOString().slice(0, 10),
      status: "active",
    })
    .select("id")
    .single();
  if (tenancyError) throw tenancyError;
  tenancyId = tenancy.id;

  const { data: maintenance, error: maintenanceError } = await tenantClient
    .from("maintenance_requests")
    .insert({
      tenancy_id: tenancyId,
      title: "Realtime verification",
      description: "Verifies authenticated landlord maintenance updates.",
      priority: "normal",
      created_by: tenantId,
    })
    .select("id")
    .single();
  if (maintenanceError) throw maintenanceError;
  maintenanceId = maintenance.id;

  await authClient.realtime.setAuth(session.session.access_token);

  let resolvePayment;
  let rejectPayment;
  const paymentEvent = new Promise((resolve, reject) => {
    resolvePayment = resolve;
    rejectPayment = reject;
  });
  let resolveMaintenance;
  let rejectMaintenance;
  const maintenanceEvent = new Promise((resolve, reject) => {
    resolveMaintenance = resolve;
    rejectMaintenance = reject;
  });

  const subscribed = new Promise((resolve, reject) => {
    channel = authClient
      .channel(`kodara-realtime-e2e-${run}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payments" },
        (payload) => {
          console.log("Realtime payment event received", payload.eventType);
          try {
            assertAuthorizedPayload(payload, "payment event");
            if (payload.new?.checkout_request_id === checkoutRequestId) {
              resolvePayment(payload.new);
            }
          } catch (error) {
            rejectPayment(error);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "maintenance_requests" },
        (payload) => {
          console.log("Realtime maintenance event received", payload.eventType);
          try {
            assertAuthorizedPayload(payload, "maintenance event");
            if (payload.new?.id === maintenanceId) resolveMaintenance(payload.new);
          } catch (error) {
            rejectMaintenance(error);
          }
        },
      )
      .subscribe((status, error) => {
        console.log("Realtime channel status", status, error?.message ?? "");
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(error ?? new Error(`channel ${status.toLowerCase()}`));
        }
      });
  });

  await Promise.race([subscribed, timeout("Realtime subscription")]);
  // The local Realtime gateway can report SUBSCRIBED just before its CDC
  // subscription transaction is visible to the replication worker.
  await delay(1_000);

  const attemptId = crypto.randomUUID();
  const { error: attemptError } = await admin.from("payment_attempts").insert({
    id: attemptId,
    tenancy_id: tenancyId,
    landlord_id: landlordId,
    idempotency_key: `realtime-${run}`,
    requested_amount: 100,
    requested_phone: payerPhone,
    checkout_request_id: checkoutRequestId,
    status: "pending",
    requested_by: tenantId,
  });
  if (attemptError) throw attemptError;

  const { error: callbackError } = await admin.rpc("record_mpesa_stk_callback", {
    callback_checkout_request_id: checkoutRequestId,
    callback_result_code: 0,
    callback_result_description: "Realtime E2E success",
    callback_receipt: receipt,
    callback_amount: 100,
    callback_phone: payerPhone,
    callback_paid_at: new Date().toISOString(),
    callback_payload: { test: "realtime-e2e" },
  });
  if (callbackError) throw callbackError;

  const { error: updateError } = await authClient
    .from("maintenance_requests")
    .update({ status: "in_progress" })
    .eq("id", maintenanceId);
  if (updateError) throw updateError;

  const [paymentPayload, maintenancePayload] = await Promise.all([
    Promise.race([paymentEvent, timeout("payment Realtime event")]),
    Promise.race([maintenanceEvent, timeout("maintenance Realtime event")]),
  ]);

  console.log(
    JSON.stringify(
      {
        subscribed: true,
        payment: {
          id: paymentPayload.id,
          amount: paymentPayload.amount,
        },
        maintenance: {
          id: maintenancePayload.id,
          status: maintenancePayload.status,
        },
      },
      null,
      2,
    ),
  );
  console.log("REALTIME E2E PASSED");
} finally {
  await cleanup();
}
