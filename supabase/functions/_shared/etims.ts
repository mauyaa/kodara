// KRA eTIMS (OSCU/VSCU) invoice submission. Built mock-first: no real KRA
// device/cert credentials exist yet (same posture the M-Pesa integration had
// before real Safaricom sandbox credentials existed). Sandbox environment
// synthesizes a realistic-shaped response so the rest of the product
// (status badges, retry queue) can be built and tested against it today.
// Swapping in the real KRA OSCU/VSCU HTTP calls later only touches this file.

export type EtimsCredentials = {
  kraPin: string;
  cuSerial: string;
  cuType: string;
  environment: string;
};

export type EtimsSubmission = {
  paymentId: string;
  tenancyReference: string;
  amount: number;
  paidAt: string;
};

export type EtimsResult =
  | {
      status: "submitted";
      kraInvoiceNumber: string;
      controlUnitInvoiceNumber: string;
      qrCodeUrl: string | null;
    }
  | { status: "failed"; error: string };

export async function submitInvoice(
  credentials: EtimsCredentials,
  submission: EtimsSubmission,
): Promise<EtimsResult> {
  if (credentials.environment === "production") {
    // KRA OSCU/VSCU system-to-system integration is not yet certified for
    // any landlord. Fail closed rather than fabricate a production invoice.
    return {
      status: "failed",
      error: "etims_production_not_yet_certified",
    };
  }

  // Sandbox: no external call. A short delay keeps call sites honest about
  // this being async I/O once the real KRA endpoint is wired in.
  await new Promise((resolve) => setTimeout(resolve, 10));

  const shortPaymentId = submission.paymentId.replace(/-/g, "").slice(0, 12).toUpperCase();
  return {
    status: "submitted",
    kraInvoiceNumber: `MOCK-${shortPaymentId}`,
    controlUnitInvoiceNumber: `${credentials.cuSerial}-${Date.now()}`,
    qrCodeUrl: null,
  };
}
