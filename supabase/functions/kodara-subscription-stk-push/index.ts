// Collects Kodara's own subscription fee via STK push to Kodara's own
// shortcode -- entirely separate credentials and ledger from any landlord's
// connected rent-collection Paybill (see mpesa-stk-push).
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders, json, readJson, requiredEnv } from "../_shared/http.ts";
import { formatDarajaTimestamp, normalizeKenyanPhone } from "../_shared/mpesa.ts";

type Request_ = {
  phone?: unknown;
  amount?: unknown;
  idempotencyKey?: unknown;
};

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
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const callerClient = createClient(supabaseUrl, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser(authorization.slice("Bearer ".length));
    if (userError || !user) return json({ error: "invalid_session" }, 401);

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

    let phone: string;
    try {
      phone = normalizeKenyanPhone(body.phone);
    } catch {
      return json({ error: "invalid_phone" }, 400);
    }

    const { data: reserved, error: reserveError } = await callerClient.rpc(
      "reserve_subscription_payment",
      { target_amount: amount, target_method: "mpesa_stk", target_idempotency_key: idempotencyKey },
    );
    if (reserveError) {
      console.error("Could not reserve subscription payment", reserveError);
      return json({ error: "subscription_payment_unavailable" }, 503);
    }
    if (reserved.checkout_request_id) {
      return json({ paymentId: reserved.id, status: reserved.status, duplicate: true });
    }

    const consumerKey = requiredEnv("KODARA_MPESA_CONSUMER_KEY");
    const consumerSecret = requiredEnv("KODARA_MPESA_CONSUMER_SECRET");
    const shortcode = requiredEnv("KODARA_MPESA_SHORTCODE");
    const passkey = requiredEnv("KODARA_MPESA_PASSKEY");
    const callbackBaseUrl = requiredEnv("KODARA_MPESA_CALLBACK_URL");
    const callbackToken = requiredEnv("KODARA_MPESA_CALLBACK_TOKEN");
    const environment = (Deno.env.get("KODARA_MPESA_ENVIRONMENT") ?? "sandbox").trim().toLowerCase();
    const darajaBaseUrl =
      environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const tokenResponse = await fetch(
      `${darajaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}`, accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!tokenResponse.ok) throw new Error(`daraja_oauth_failed:${tokenResponse.status}`);
    const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenPayload.access_token) throw new Error("daraja_oauth_missing_token");

    const timestamp = formatDarajaTimestamp();
    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    const callbackUrl = new URL(callbackBaseUrl);
    callbackUrl.searchParams.set("token", callbackToken);
    callbackUrl.searchParams.set("payment_id", reserved.id);

    const stkResponse = await fetch(`${darajaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenPayload.access_token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl.toString(),
        AccountReference: `KODARA-${user.id.slice(0, 8)}`,
        TransactionDesc: "Kodara subscription",
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const stkPayload = (await stkResponse.json()) as {
      CheckoutRequestID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };

    if (!stkResponse.ok || stkPayload.ResponseCode !== "0" || !stkPayload.CheckoutRequestID) {
      await serviceClient.rpc("record_subscription_payment_failure", { target_payment_id: reserved.id });
      return json({ error: "stk_push_rejected" }, 502);
    }

    await serviceClient
      .from("subscription_payments")
      .update({ checkout_request_id: stkPayload.CheckoutRequestID })
      .eq("id", reserved.id);

    return json({ paymentId: reserved.id, status: "pending" }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("kodara-subscription-stk-push failed", message);
    if (message === "invalid_json") return json({ error: message }, 400);
    if (message === "request_too_large") return json({ error: message }, 413);
    return json({ error: "subscription_payment_service_unavailable" }, 503);
  }
});
