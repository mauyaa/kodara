// Rent reminder dispatch. Trigger daily (pg_cron already inserts the
// notifications; this function delivers pending ones via SMS and can also
// force a generation run). Secured with a shared token like mpesa-callback:
//   POST /functions/v1/rent-reminders?token=<REMINDERS_CRON_TOKEN>
//
// SMS goes out through Africa's Talking when AT_USERNAME and AT_API_KEY are
// set; otherwise pending notifications are marked "skipped" (they still show
// in the tenant portal).
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { json, requiredEnv } from "../_shared/http.ts";
import { secureEqual } from "../_shared/mpesa.ts";

type PendingNotification = {
  id: string;
  title: string;
  body: string;
  sms_phone: string | null;
};

async function sendSms(phone: string, message: string): Promise<boolean> {
  const username = Deno.env.get("AT_USERNAME")?.trim();
  const apiKey = Deno.env.get("AT_API_KEY")?.trim();
  if (!username || !apiKey) return false;

  const endpoint = username === "sandbox"
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const params = new URLSearchParams({
    username,
    to: `+${phone}`,
    message,
  });
  const senderId = Deno.env.get("AT_SENDER_ID")?.trim();
  if (senderId) params.set("from", senderId);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apiKey,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: params.toString(),
  });

  if (!response.ok) return false;
  const result = await response.json().catch(() => null);
  const status = result?.SMSMessageData?.Recipients?.[0]?.status;
  return typeof status === "string" && status.toLowerCase() === "success";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const providedToken = url.searchParams.get("token") ?? "";
    const expectedToken = requiredEnv("REMINDERS_CRON_TOKEN");
    if (!secureEqual(providedToken, expectedToken)) {
      return json({ error: "unauthorized" }, 401);
    }

    const serviceClient = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Generate today's reminders (idempotent — dedupe keys absorb reruns).
    const { data: generated, error: generateError } = await serviceClient.rpc(
      "run_rent_reminders",
    );
    if (generateError) {
      console.error("reminder generation failed", generateError);
      return json({ error: "generation_failed" }, 500);
    }

    // Dispatch pending SMS.
    const { data: pending, error: pendingError } = await serviceClient
      .from("notifications")
      .select("id, title, body, sms_phone")
      .eq("sms_status", "pending")
      .limit(200)
      .returns<PendingNotification[]>();

    if (pendingError) {
      console.error("pending fetch failed", pendingError);
      return json({ error: "pending_fetch_failed" }, 500);
    }

    const smsConfigured = Boolean(
      Deno.env.get("AT_USERNAME")?.trim() && Deno.env.get("AT_API_KEY")?.trim(),
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const notification of pending ?? []) {
      const phone = notification.sms_phone;
      let status: "sent" | "skipped" | "failed" = "skipped";

      if (smsConfigured && phone) {
        try {
          status = (await sendSms(phone, `${notification.title}: ${notification.body}`))
            ? "sent"
            : "failed";
        } catch (error) {
          console.error("sms dispatch failed", { id: notification.id, error });
          status = "failed";
        }
      }

      const { error: updateError } = await serviceClient
        .from("notifications")
        .update({ sms_status: status })
        .eq("id", notification.id)
        .eq("sms_status", "pending");

      if (updateError) {
        console.error("status update failed", { id: notification.id, updateError });
        continue;
      }

      if (status === "sent") sent += 1;
      else if (status === "failed") failed += 1;
      else skipped += 1;
    }

    return json({
      generated: generated ?? 0,
      sms: { configured: smsConfigured, sent, skipped, failed },
    });
  } catch (error) {
    console.error("rent-reminders failed", error);
    return json({ error: "internal_error" }, 500);
  }
});
