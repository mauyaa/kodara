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
    const expectedToken = requiredEnv("MPESA_CALLBACK_TOKEN");
    if (!secureEqual(providedToken, expectedToken)) {
      return json({ ResultCode: 1, ResultDesc: "Unauthorized" }, 401);
    }

    const payload = await readJson(request, 65_536);
    const callback = parseStkCallback(payload);

    const serviceClient = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { error } = await serviceClient.rpc("record_mpesa_stk_callback", {
      callback_checkout_request_id: callback.checkoutRequestId,
      callback_result_code: callback.resultCode,
      callback_result_description: callback.resultDescription,
      callback_receipt: callback.receipt,
      callback_amount: callback.amount,
      callback_phone: callback.phone,
      callback_paid_at: callback.paidAt,
      callback_payload: payload,
    });

    if (error) {
      console.error("M-Pesa callback transaction failed", {
        checkoutRequestId: callback.checkoutRequestId,
        code: error.code,
        message: error.message,
      });
      // A non-2xx response asks Daraja to retry instead of silently losing money.
      return json({ ResultCode: 1, ResultDesc: "Temporary failure" }, 503);
    }

    return json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("mpesa-callback rejected", message);

    if (message === "invalid_json" || message === "invalid_callback") {
      return json({ ResultCode: 1, ResultDesc: "Invalid payload" }, 400);
    }
    if (message === "request_too_large") {
      return json({ ResultCode: 1, ResultDesc: "Payload too large" }, 413);
    }
    return json({ ResultCode: 1, ResultDesc: "Temporary failure" }, 503);
  }
});

