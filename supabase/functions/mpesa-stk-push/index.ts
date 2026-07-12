import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders, json, readJson, requiredEnv } from "../_shared/http.ts";
import {
  formatDarajaTimestamp,
  normalizeKenyanPhone,
} from "../_shared/mpesa.ts";

type StkRequest = {
  tenancyId?: unknown;
  phone?: unknown;
  amount?: unknown;
  idempotencyKey?: unknown;
};

type TenancyRecord = {
  id: string;
  rent_amount: number;
  payment_reference: string;
  tenant_id: string;
  unit: {
    property: {
      landlord_id: string;
    };
  };
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function persistAttemptState(
  client: SupabaseClient,
  attemptId: string,
  values: Record<string, unknown>,
  expectedStatus?: string,
) {
  const delays = [0, 150, 500];
  let lastError: unknown = null;

  for (const delay of delays) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    let query = client.from("payment_attempts").update(values).eq("id", attemptId);
    if (expectedStatus) query = query.eq("status", expectedStatus);
    const { error } = await query;
    if (!error) return null;
    lastError = error;
  }

  return lastError;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let serviceClient: SupabaseClient | null = null;
  let reservedAttemptId: string | null = null;
  let darajaRequestStarted = false;

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
    serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authorization.slice("Bearer ".length);
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser(token);
    if (userError || !user) return json({ error: "invalid_session" }, 401);

    const body = (await readJson(request)) as StkRequest;
    const tenancyId =
      typeof body.tenancyId === "string" ? body.tenancyId.trim() : "";
    const idempotencyKey =
      typeof body.idempotencyKey === "string"
        ? body.idempotencyKey.trim()
        : "";
    const amount = Number(body.amount);

    if (!uuidPattern.test(tenancyId)) {
      return json({ error: "invalid_tenancy_id" }, 400);
    }
    if (idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      return json({ error: "invalid_idempotency_key" }, 400);
    }
    if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000_000) {
      return json({ error: "invalid_amount" }, 400);
    }

    let phone: string;
    try {
      phone = normalizeKenyanPhone(body.phone);
    } catch {
      return json({ error: "invalid_phone" }, 400);
    }

    const { data: tenancyData, error: tenancyError } = await callerClient
      .from("tenancies")
      .select(
        "id, rent_amount, payment_reference, tenant_id, unit:units!inner(property:properties!inner(landlord_id))",
      )
      .eq("id", tenancyId)
      .eq("status", "active")
      .maybeSingle();

    if (tenancyError || !tenancyData) {
      return json({ error: "tenancy_not_found" }, 404);
    }

    const tenancy = tenancyData as unknown as TenancyRecord;
    const landlordId = tenancy.unit.property.landlord_id;

    const { data: credentialRows, error: credentialError } = await serviceClient
      .rpc("get_landlord_mpesa_credentials", { target_landlord_id: landlordId });

    if (credentialError) {
      console.error("Could not load landlord M-Pesa credentials", credentialError);
      return json({ error: "payment_service_unavailable" }, 503);
    }
    const credentials = (credentialRows as Array<{
      shortcode: string;
      consumer_key: string;
      consumer_secret: string;
      passkey: string;
      environment: string;
    }> | null)?.[0];
    if (!credentials) {
      return json({ error: "landlord_mpesa_not_connected" }, 409);
    }

    const { data: existingAttempt } = await serviceClient
      .from("payment_attempts")
      .select(
        "id, status, checkout_request_id, merchant_request_id, result_code, result_description",
      )
      .eq("tenancy_id", tenancyId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingAttempt) {
      return json({
        attemptId: existingAttempt.id,
        status: existingAttempt.status,
        checkoutRequestId: existingAttempt.checkout_request_id,
        merchantRequestId: existingAttempt.merchant_request_id,
        resultCode: existingAttempt.result_code,
        resultDescription: existingAttempt.result_description,
        duplicate: true,
      });
    }

    const { data: attempt, error: attemptError } = await serviceClient
      .from("payment_attempts")
      .insert({
        tenancy_id: tenancyId,
        landlord_id: landlordId,
        idempotency_key: idempotencyKey,
        requested_amount: amount,
        requested_phone: phone,
        requested_by: user.id,
        status: "requesting",
      })
      .select("id")
      .single();

    if (attemptError) {
      if (attemptError.code === "23505") {
        const { data: racedAttempt, error: racedAttemptError } =
          await serviceClient
            .from("payment_attempts")
            .select(
              "id, status, checkout_request_id, merchant_request_id, result_code, result_description",
            )
            .eq("tenancy_id", tenancyId)
            .eq("idempotency_key", idempotencyKey)
            .single();

        if (!racedAttemptError) {
          return json({ ...racedAttempt, duplicate: true });
        }
      }
      if (attemptError.message.includes("payment attempt already in progress")) {
        return json({ error: "payment_attempt_in_progress" }, 409);
      }
      if (attemptError.message.includes("payment attempt rate limit exceeded")) {
        return json({ error: "payment_rate_limit_exceeded" }, 429);
      }
      console.error("Could not reserve payment attempt", attemptError);
      return json({ error: "payment_attempt_unavailable" }, 503);
    }
    reservedAttemptId = attempt.id;

    const consumerKey = credentials.consumer_key;
    const consumerSecret = credentials.consumer_secret;
    const shortcode = credentials.shortcode;
    const passkey = credentials.passkey;
    const callbackBaseUrl = requiredEnv("MPESA_CALLBACK_URL");
    const callbackToken = requiredEnv("MPESA_CALLBACK_TOKEN");
    const darajaBaseUrl =
      credentials.environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const tokenResponse = await fetch(
      `${darajaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!tokenResponse.ok) {
      throw new Error(`daraja_oauth_failed:${tokenResponse.status}`);
    }
    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
    };
    if (!tokenPayload.access_token) throw new Error("daraja_oauth_missing_token");

    const timestamp = formatDarajaTimestamp();
    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    const callbackUrl = new URL(callbackBaseUrl);
    callbackUrl.searchParams.set("token", callbackToken);

    darajaRequestStarted = true;
    const stkResponse = await fetch(
      `${darajaBaseUrl}/mpesa/stkpush/v1/processrequest`,
      {
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
          AccountReference: tenancy.payment_reference,
          TransactionDesc: "Kodara rent",
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    const stkPayload = (await stkResponse.json()) as {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResponseCode?: string;
      ResponseDescription?: string;
      errorCode?: string;
      errorMessage?: string;
    };

    if (
      !stkResponse.ok ||
      stkPayload.ResponseCode !== "0" ||
      !stkPayload.CheckoutRequestID
    ) {
      const rejectionUpdateError = await persistAttemptState(
        serviceClient,
        attempt.id,
        {
          status: "failed",
          result_description:
            stkPayload.errorMessage ||
            stkPayload.ResponseDescription ||
            "Daraja rejected the request",
        },
        "requesting",
      );
      if (rejectionUpdateError) {
        console.error("Could not persist rejected STK attempt", {
          attemptId: attempt.id,
          error: rejectionUpdateError,
        });
      }
      return json({ error: "stk_push_rejected" }, 502);
    }

    const updateError = await persistAttemptState(
      serviceClient,
      attempt.id,
      {
        status: "pending",
        merchant_request_id: stkPayload.MerchantRequestID ?? null,
        checkout_request_id: stkPayload.CheckoutRequestID,
      },
      "requesting",
    );

    if (updateError) {
      console.error("STK accepted but attempt update failed", {
        attemptId: attempt.id,
        checkoutRequestId: stkPayload.CheckoutRequestID,
        error: updateError,
      });
      await persistAttemptState(
        serviceClient,
        attempt.id,
        {
          status: "uncertain",
          merchant_request_id: stkPayload.MerchantRequestID ?? null,
          checkout_request_id: stkPayload.CheckoutRequestID,
          result_description:
            "M-Pesa accepted the request but Kodara could not confirm local state. Do not retry this payment yet.",
        },
        "requesting",
      );
      return json(
        {
          error: "stk_push_state_uncertain",
          attemptId: attempt.id,
        },
        503,
      );
    }

    return json(
      {
        attemptId: attempt.id,
        status: "pending",
        checkoutRequestId: stkPayload.CheckoutRequestID,
        merchantRequestId: stkPayload.MerchantRequestID ?? null,
      },
      202,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("mpesa-stk-push failed", message);
    if (serviceClient && reservedAttemptId) {
      const uncertain = darajaRequestStarted;
      const persistenceError = await persistAttemptState(
        serviceClient,
        reservedAttemptId,
        {
          status: uncertain ? "uncertain" : "failed",
          result_description: uncertain
            ? "The M-Pesa request outcome is uncertain. Do not retry this payment yet."
            : "The payment service failed before M-Pesa accepted the request.",
        },
        "requesting",
      );
      if (persistenceError) {
        console.error("Could not persist terminal payment attempt state", {
          attemptId: reservedAttemptId,
          error: persistenceError,
        });
      }
    }
    if (message === "invalid_json") return json({ error: message }, 400);
    if (message === "request_too_large") return json({ error: message }, 413);
    return json({ error: "payment_service_unavailable" }, 503);
  }
});
