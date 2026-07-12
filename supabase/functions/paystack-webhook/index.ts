// Paystack webhook: verified via HMAC-SHA512 of the raw request body using
// the Paystack secret key, per Paystack's documented signature scheme
// (x-paystack-signature header, hex-encoded).
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { json, requiredEnv } from "../_shared/http.ts";

async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return computed === signature;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const signature = request.headers.get("x-paystack-signature") ?? "";
    const rawBody = await request.text();
    const secretKey = requiredEnv("PAYSTACK_SECRET_KEY");

    if (!signature || !(await verifySignature(rawBody, signature, secretKey))) {
      return json({ error: "invalid_signature" }, 401);
    }

    const event = JSON.parse(rawBody) as {
      event?: string;
      data?: { reference?: string; paid_at?: string; status?: string };
    };

    const serviceClient = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const paymentId = event.data?.reference ?? "";
    if (!paymentId) return json({ error: "missing_reference" }, 400);

    if (event.event === "charge.success") {
      const { error } = await serviceClient.rpc("record_subscription_payment_success", {
        target_payment_id: paymentId,
        target_provider_reference: paymentId,
        target_paid_at: event.data?.paid_at ?? new Date().toISOString(),
      });
      if (error) {
        console.error("paystack success recording failed", { paymentId, error });
        return json({ error: "recording_failed" }, 503);
      }
    } else if (event.event === "charge.failed") {
      await serviceClient.rpc("record_subscription_payment_failure", { target_payment_id: paymentId });
    }

    return json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("paystack-webhook failed", message);
    return json({ error: "internal_error" }, 500);
  }
});
