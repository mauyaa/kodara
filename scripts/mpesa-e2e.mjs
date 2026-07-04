// E2E test: landlord + tenant onboarding -> STK push (real Daraja sandbox) -> simulated callbacks.
// Runs against the local Supabase stack and is self-bootstrapping: it creates its own
// landlord, property, unit, invitation, and tenant if they do not exist, so it can run
// immediately after `supabase db reset`.
//
// Usage:
//   npx supabase start
//   npx supabase functions serve --env-file supabase/functions/.env   (in another shell)
//   MPESA_CALLBACK_TOKEN=<token from supabase/functions/.env> node scripts/mpesa-e2e.mjs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const CALLBACK_TOKEN = process.env.MPESA_CALLBACK_TOKEN;
if (!CALLBACK_TOKEN) throw new Error("MPESA_CALLBACK_TOKEN env var required");

const RUN = Date.now().toString(36).toUpperCase();
const RECEIPT_OK = `SBX${RUN}OK`;
const RECEIPT_MISMATCH = `SBX${RUN}MM`;

const LANDLORD_EMAIL = "landlord.e2e@kodara.test";
const LANDLORD_PASSWORD = "LandlordSecret123!";
const TENANT_EMAIL = "tenant.wanjiku@example.com";
const TENANT_PASSWORD = "TenantSecret123!";
const TENANT_PHONE = "254712345678";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const log = (step, data) =>
  console.log(`\n=== ${step} ===\n` + JSON.stringify(data, null, 2));

async function callbackPost(body) {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/mpesa-callback?token=${CALLBACK_TOKEN}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return { status: res.status, body: await res.json() };
}

function successCallback(checkoutRequestId, merchantRequestId, amount, receipt) {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: merchantRequestId ?? "sim-merchant-1",
        CheckoutRequestID: checkoutRequestId,
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: amount },
            { Name: "MpesaReceiptNumber", Value: receipt },
            { Name: "TransactionDate", Value: 20260702214512 },
            { Name: "PhoneNumber", Value: Number(TENANT_PHONE) },
          ],
        },
      },
    },
  };
}

function failureCallback(checkoutRequestId, merchantRequestId) {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: merchantRequestId ?? "sim-merchant-2",
        CheckoutRequestID: checkoutRequestId,
        ResultCode: 1032,
        ResultDesc: "Request cancelled by user",
      },
    },
  };
}

async function ensureUser({ email, password, phone, fullName }) {
  const { data: users } = await admin.auth.admin.listUsers();
  const existing = users?.users?.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(phone ? { phone: `+${phone}`, phone_confirm: true } : {}),
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createUser(${email}) failed: ` + error.message);
  return data.user.id;
}

async function signInClient(email, password) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signin(${email}) failed: ` + error.message);
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
  return { client, jwt: data.session.access_token, userId: data.user.id };
}

// ---------- 0. Landlord fixture: user -> role -> property -> unit -> invitation ----------
let landlord;
{
  await ensureUser({
    email: LANDLORD_EMAIL,
    password: LANDLORD_PASSWORD,
    fullName: "E2E Landlord",
  });
  ({ client: landlord } = await signInClient(LANDLORD_EMAIL, LANDLORD_PASSWORD));

  const { error: roleErr } = await landlord.rpc("register_as_landlord");
  if (roleErr) throw new Error("register_as_landlord failed: " + roleErr.message);

  let { data: property } = await landlord
    .from("properties")
    .select("id")
    .eq("name", "E2E Apartments")
    .maybeSingle();
  if (!property) {
    const { data: created, error } = await landlord
      .from("properties")
      .insert({
        landlord_id: (await landlord.auth.getUser()).data.user.id,
        name: "E2E Apartments",
        address: "Kilimani, Nairobi",
      })
      .select("id")
      .single();
    if (error) throw new Error("property insert failed: " + error.message);
    property = created;
  }

  let { data: unit } = await landlord
    .from("units")
    .select("id")
    .eq("property_id", property.id)
    .eq("name", "E2E-01")
    .maybeSingle();
  if (!unit) {
    const { data: created, error } = await landlord
      .from("units")
      .insert({ property_id: property.id, name: "E2E-01" })
      .select("id")
      .single();
    if (error) throw new Error("unit insert failed: " + error.message);
    unit = created;
  }

  const { data: occupied } = await landlord
    .from("tenancies")
    .select("id")
    .eq("unit_id", unit.id)
    .in("status", ["pending", "active"]);
  const { data: pendingInvites } = await landlord
    .from("tenant_invitations")
    .select("id")
    .eq("unit_id", unit.id)
    .eq("status", "pending");
  if (!occupied?.length && !pendingInvites?.length) {
    const { error } = await landlord.rpc("create_tenant_invitation", {
      target_unit_id: unit.id,
      tenant_phone: TENANT_PHONE,
      tenancy_rent: 25000,
      tenancy_billing_day: 5,
      tenancy_start_date: new Date().toISOString().slice(0, 10),
    });
    if (error) throw new Error("create_tenant_invitation failed: " + error.message);
  }
  log("landlord fixture ready", { propertyId: property.id, unitId: unit.id });
}

// ---------- 1. Tenant user ----------
const tenantId = await ensureUser({
  email: TENANT_EMAIL,
  password: TENANT_PASSWORD,
  phone: TENANT_PHONE,
  fullName: "Wanjiku Tenant",
});
log("tenant user ready", { tenantId });

// ---------- 2. Tenant session ----------
const { client: tenant, jwt: tenantJwt } = await signInClient(
  TENANT_EMAIL,
  TENANT_PASSWORD,
);
log("tenant signed in", { userId: tenantId });

// ---------- 3. Accept invitation ----------
let tenancyId;
{
  const { data: myTenancies } = await tenant
    .from("tenancies")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("status", "active");
  if (myTenancies?.length) {
    tenancyId = myTenancies[0].id;
    log("tenancy already active", { tenancyId });
  } else {
    const { data: invitations, error: invErr } = await tenant
      .from("tenant_invitations")
      .select("id, phone, status")
      .eq("status", "pending");
    if (invErr) throw new Error("invitation lookup failed: " + invErr.message);
    if (!invitations?.length) throw new Error("no pending invitation visible to tenant");
    const { data: tenancy, error: acceptErr } = await tenant.rpc(
      "accept_tenant_invitation",
      { target_invitation_id: invitations[0].id },
    );
    if (acceptErr) throw new Error("accept failed: " + acceptErr.message);
    tenancyId = tenancy.id;
    log("invitation accepted -> tenancy", tenancy);
  }
}

// ---------- 4. Balance before ----------
{
  const { data: balance } = await tenant
    .from("tenancy_balances")
    .select("*")
    .eq("tenancy_id", tenancyId)
    .single();
  log("balance before payment", balance);
}

// ---------- 5. STK push against real Daraja sandbox ----------
async function stkPushRaw(amount, idempotencyKey) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/mpesa-stk-push`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${tenantJwt}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ tenancyId, phone: TENANT_PHONE, amount, idempotencyKey }),
  });
  return { status: res.status, body: await res.json() };
}

// The Daraja sandbox rate-limits rapid consecutive pushes ("System is busy").
// A rejected attempt is terminal (marked failed), so each retry uses a fresh
// idempotency key — exactly what the real app does when the user retries.
async function stkPushWithRetry(amount, label, tries = 4, delayMs = 20_000) {
  for (let i = 1; i <= tries; i++) {
    const key = `e2e-${label}-${Date.now()}`;
    const { status, body } = await stkPushRaw(amount, key);
    if (status === 202) return { ...body, idempotencyKey: key };
    log(`stk-push attempt ${i}/${tries} rejected (${label})`, { status, ...body });
    if (i < tries) await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`stk push (${label}) still rejected after ${tries} tries`);
}

const first = await stkPushWithRetry(25000, "ok");
log("stk-push response (real Daraja sandbox)", first);
const { checkoutRequestId, merchantRequestId, idempotencyKey } = first;

// ---------- 5b. Idempotency: same key returns same attempt, no new Daraja call ----------
{
  const { status, body } = await stkPushRaw(25000, idempotencyKey);
  log("stk-push retry with same idempotency key", { status, ...body });
  if (!body.duplicate) throw new Error("idempotency retry was not flagged duplicate");
}

// ---------- 6. Successful callback (exact amount -> matched_auto) ----------
{
  const cb = await callbackPost(
    successCallback(checkoutRequestId, merchantRequestId, 25000, RECEIPT_OK),
  );
  log("success callback", cb);
  if (cb.status !== 200) throw new Error("success callback rejected");
}

// ---------- 7. Duplicate callback (must not double-record) ----------
{
  const cb = await callbackPost(
    successCallback(checkoutRequestId, merchantRequestId, 25000, RECEIPT_OK),
  );
  log("duplicate callback", cb);
  if (cb.status !== 200) throw new Error("duplicate callback errored");
}

// ---------- 8. Verify payment state as tenant ----------
{
  // Scope to this run's receipt so re-runs against a dirty database stay valid.
  const { data: payments } = await tenant
    .from("payments")
    .select("id, amount, status, reconciliation_status, provider_transaction_id, checkout_request_id")
    .eq("tenancy_id", tenancyId)
    .eq("provider_transaction_id", RECEIPT_OK);
  log("payments after success+duplicate (this run)", payments);
  if (payments.length !== 1) throw new Error(`expected 1 payment, got ${payments.length}`);
  if (payments[0].reconciliation_status !== "matched_auto")
    throw new Error("payment not matched_auto");
}

// ---------- 9. Balance after ----------
{
  const { data: balance } = await tenant
    .from("tenancy_balances")
    .select("*")
    .eq("tenancy_id", tenancyId)
    .single();
  log("balance after payment", balance);
}

// ---------- 10. Second attempt: amount mismatch -> unmatched queue ----------
{
  const body = await stkPushWithRetry(20000, "mismatch");
  log("second stk-push (will mismatch)", body);

  // Callback pays a DIFFERENT amount than requested -> unmatched.
  const cb = await callbackPost(
    successCallback(body.checkoutRequestId, body.merchantRequestId, 18500, RECEIPT_MISMATCH),
  );
  log("mismatch callback", cb);

  // The landlord's own queue is the product surface for unmatched payments.
  const { data: unmatched, error: unmatchedErr } = await landlord
    .from("payments")
    .select("id, amount, reconciliation_status, tenancy_id, landlord_id")
    .eq("provider_transaction_id", RECEIPT_MISMATCH);
  if (unmatchedErr) throw new Error("landlord unmatched lookup failed: " + unmatchedErr.message);
  log("unmatched payment row (landlord view)", unmatched);
  if (unmatched?.[0]?.reconciliation_status !== "unmatched")
    throw new Error("mismatch payment was not routed to unmatched queue");
  if (unmatched[0].tenancy_id !== null)
    throw new Error("unmatched payment should have null tenancy");
}

// ---------- 11. Third attempt: user cancels (failure callback) ----------
{
  const body = await stkPushWithRetry(25000, "cancel");
  log("third stk-push (will cancel)", { attemptId: body.attemptId });

  const cb = await callbackPost(failureCallback(body.checkoutRequestId, body.merchantRequestId));
  log("cancellation callback", cb);

  // The tenant sees their own attempt status; this is what the Flutter app polls.
  const { data: attempt, error: attemptErr } = await tenant
    .from("payment_attempts")
    .select("status, result_code, result_description")
    .eq("id", body.attemptId)
    .single();
  if (attemptErr) throw new Error("attempt lookup failed: " + attemptErr.message);
  log("attempt after cancellation (tenant view)", attempt);
  if (attempt.status !== "failed") throw new Error("cancelled attempt not marked failed");

  const { data: cancelPayments, error: cancelErr } = await landlord
    .from("payments")
    .select("id")
    .eq("checkout_request_id", body.checkoutRequestId);
  if (cancelErr) throw new Error("cancel payment lookup failed: " + cancelErr.message);
  if (cancelPayments.length !== 0) throw new Error("cancellation created a payment!");
}

// ---------- 12. RLS spot-check: tenant cannot see the unmatched payment ----------
{
  const { data: visible } = await tenant
    .from("payments")
    .select("id, provider_transaction_id");
  const leaked = visible?.some((p) => p.provider_transaction_id === RECEIPT_MISMATCH);
  log("tenant-visible payments", { count: visible?.length, leakedUnmatched: leaked });
  if (leaked) throw new Error("RLS LEAK: tenant can see landlord-scoped unmatched payment");
}

console.log("\nALL E2E ASSERTIONS PASSED");
