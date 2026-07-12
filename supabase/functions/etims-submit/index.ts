// Sweeps pending tax_invoices and submits each to eTIMS under the owning
// landlord's own KRA credentials. Runs out-of-band from payment recording
// (triggered daily, same operational shape as rent-reminders) so a slow or
// unreachable KRA endpoint can never block or delay recording a payment.
//   POST /functions/v1/etims-submit?token=<ETIMS_CRON_TOKEN>
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { json, requiredEnv } from "../_shared/http.ts";
import { secureEqual } from "../_shared/mpesa.ts";
import { submitInvoice } from "../_shared/etims.ts";

type PendingInvoice = {
  id: string;
  payment_id: string;
  landlord_id: string;
  retry_count: number;
  amount: number;
  paid_at: string;
  payment_reference: string;
};

// Raw shape of get_landlord_etims_credentials' SQL row (snake_case columns).
type EtimsCredentialRow = {
  kra_pin: string;
  cu_serial: string;
  cu_type: string;
  environment: string;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const providedToken = url.searchParams.get("token") ?? "";
    const expectedToken = requiredEnv("ETIMS_CRON_TOKEN");
    if (!secureEqual(providedToken, expectedToken)) {
      return json({ error: "unauthorized" }, 401);
    }

    const serviceClient = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: pendingData, error: pendingError } = await serviceClient.rpc(
      "fetch_pending_tax_invoices",
    );

    if (pendingError) {
      console.error("pending tax invoice fetch failed", pendingError);
      return json({ error: "pending_fetch_failed" }, 500);
    }

    const pending = pendingData as PendingInvoice[] | null;

    let submitted = 0;
    let skipped = 0;
    let failed = 0;

    for (const invoice of pending ?? []) {
      const { data: credentialRows, error: credentialError } = await serviceClient.rpc(
        "get_landlord_etims_credentials",
        { target_landlord_id: invoice.landlord_id },
      );
      if (credentialError) {
        console.error("eTIMS credential lookup failed", { id: invoice.id, credentialError });
        continue;
      }
      const credentialRow = (credentialRows as EtimsCredentialRow[] | null)?.[0];

      if (!credentialRow) {
        await serviceClient
          .from("tax_invoices")
          .update({ status: "skipped_not_configured" })
          .eq("id", invoice.id)
          .eq("status", "pending");
        skipped += 1;
        continue;
      }

      const result = await submitInvoice(
        {
          kraPin: credentialRow.kra_pin,
          cuSerial: credentialRow.cu_serial,
          cuType: credentialRow.cu_type,
          environment: credentialRow.environment,
        },
        {
          paymentId: invoice.payment_id,
          tenancyReference: invoice.payment_reference,
          amount: invoice.amount,
          paidAt: invoice.paid_at,
        },
      );

      if (result.status === "submitted") {
        const { error: updateError } = await serviceClient
          .from("tax_invoices")
          .update({
            status: "submitted",
            kra_invoice_number: result.kraInvoiceNumber,
            control_unit_invoice_number: result.controlUnitInvoiceNumber,
            qr_code_url: result.qrCodeUrl,
            submitted_at: new Date().toISOString(),
            error: null,
          })
          .eq("id", invoice.id)
          .eq("status", "pending");
        if (updateError) {
          console.error("tax invoice update failed", { id: invoice.id, updateError });
          continue;
        }
        submitted += 1;
      } else {
        await serviceClient
          .from("tax_invoices")
          .update({
            status: "failed",
            error: result.error,
            retry_count: invoice.retry_count + 1,
          })
          .eq("id", invoice.id)
          .eq("status", "pending");
        failed += 1;
      }
    }

    return json({ submitted, skipped, failed });
  } catch (error) {
    console.error("etims-submit failed", error);
    return json({ error: "internal_error" }, 500);
  }
});
