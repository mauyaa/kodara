// Safaricom cannot send a Supabase JWT; authenticated the same way as
// mpesa-callback, via a high-entropy token embedded in the callback URL.
// `payment_id` also travels in the URL (set by kodara-subscription-stk-push)
// so this doesn't need the rent flow's checkout_request_id matching --
// there's exactly one payment per STK push here, not a multi-tenant
// reconciliation problem.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { json, readJson, requiredEnv } from "../_shared/http.ts";
import { parseStkCallback, secureEqual } from "../_shared/mpesa.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ ResultCode: 1, ResultDesc: "Method not allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const providedToken = url.searchParams.get("token") ?? "";
    const expectedToken = requiredEnv("KODARA_MPESA_CALLBACK_TOKEN");
    if (!secureEqual(providedToken, expectedToken)) {
      return json({ ResultCode: 1, ResultDesc: "Unauthorized" }, 401);
    }

    const paymentId = url.searchParams.get("payment_id") ?? "";
    if (!paymentId) {
      return json({ ResultCode: 1, ResultDesc: "Missing payment_id" }, 400);
    }

    const payload = await readJson(request, 65_536);
    const callback = parseStkCallback(payload);

    const serviceClient = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    if (callback.resultCode === 0 && callback.receipt) {
      const { error } = await serviceClient.rpc("record_subscription_payment_success", {
        target_payment_id: paymentId,
        target_provider_reference: callback.receipt,
        target_paid_at: callback.paidAt ?? new Date().toISOString(),
      });
      if (error) {
        console.error("subscription payment success recording failed", { paymentId, error });
        return json({ ResultCode: 1, ResultDesc: "Temporary failure" }, 503);
      }
    } else {
      const { error } = await serviceClient.rpc("record_subscription_payment_failure", {
        target_payment_id: paymentId,
      });
      if (error) {
        console.error("subscription payment failure recording failed", { paymentId, error });
      }
    }

    return json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("kodara-subscription-mpesa-callback rejected", message);
    if (message === "invalid_json" || message === "invalid_callback") {
      return json({ ResultCode: 1, ResultDesc: "Invalid payload" }, 400);
    }
    return json({ ResultCode: 1, ResultDesc: "Temporary failure" }, 503);
  }
});
