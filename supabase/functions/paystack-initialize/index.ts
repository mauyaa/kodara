// Starts a card/bank subscription payment via Paystack. The reserved
// subscription_payments row's own id is used as the Paystack transaction
// reference, so the webhook can tie a payment back without extra state.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders, json, readJson, requiredEnv } from "../_shared/http.ts";

type Request_ = { amount?: unknown; idempotencyKey?: unknown };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "authentication_required" }, 401);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const publicKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
      requiredEnv("SUPABASE_ANON_KEY");

    const callerClient = createClient(supabaseUrl, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser(authorization.slice("Bearer ".length));
    if (userError || !user || !user.email) {
      return json({ error: "invalid_session" }, 401);
    }

    const body = (await readJson(request)) as Request_;
    const idempotencyKey =
      typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const amount = Number(body.amount);
    if (idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      return json({ error: "invalid_idempotency_key" }, 400);
    }
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) {
      return json({ error: "invalid_amount" }, 400);
    }

    const { data: reserved, error: reserveError } = await callerClient.rpc(
      "reserve_subscription_payment",
      { target_amount: amount, target_method: "paystack", target_idempotency_key: idempotencyKey },
    );
    if (reserveError) {
      console.error("Could not reserve subscription payment", reserveError);
      return json({ error: "subscription_payment_unavailable" }, 503);
    }

    const paystackSecretKey = requiredEnv("PAYSTACK_SECRET_KEY");
    const callbackUrl = requiredEnv("PAYSTACK_CALLBACK_URL");

    const initResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        authorization: `Bearer ${paystackSecretKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: Math.round(amount * 100),
        currency: "KES",
        reference: reserved.id,
        callback_url: callbackUrl,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const initPayload = (await initResponse.json()) as {
      status?: boolean;
      data?: { authorization_url?: string; access_code?: string; reference?: string };
      message?: string;
    };

    if (!initResponse.ok || !initPayload.status || !initPayload.data?.authorization_url) {
      await callerClient.rpc("record_subscription_payment_failure", { target_payment_id: reserved.id });
      console.error("Paystack initialize failed", initPayload.message);
      return json({ error: "paystack_initialize_failed" }, 502);
    }

    return json({
      paymentId: reserved.id,
      authorizationUrl: initPayload.data.authorization_url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("paystack-initialize failed", message);
    if (message === "invalid_json") return json({ error: message }, 400);
    if (message === "request_too_large") return json({ error: message }, 413);
    return json({ error: "subscription_payment_service_unavailable" }, 503);
  }
});
