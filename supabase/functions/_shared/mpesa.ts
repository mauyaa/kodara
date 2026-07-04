export type StkCallback = {
  MerchantRequestID?: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: {
    Item?: Array<{ Name?: string; Value?: string | number }>;
  };
};

export type ParsedStkCallback = {
  checkoutRequestId: string;
  resultCode: number;
  resultDescription: string;
  receipt: string | null;
  amount: number | null;
  phone: string | null;
  paidAt: string | null;
};

const kenyaPhonePattern = /^254[17]\d{8}$/;

export function normalizeKenyanPhone(input: unknown): string {
  if (typeof input !== "string" && typeof input !== "number") {
    throw new Error("invalid_phone");
  }

  let digits = String(input).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `254${digits.slice(1)}`;
  if (digits.length === 9 && /^[17]/.test(digits)) digits = `254${digits}`;

  if (!kenyaPhonePattern.test(digits)) throw new Error("invalid_phone");
  return digits;
}

export function formatDarajaTimestamp(date = new Date()): string {
  const part = (value: number) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    part(date.getUTCMonth() + 1),
    part(date.getUTCDate()),
    part(date.getUTCHours()),
    part(date.getUTCMinutes()),
    part(date.getUTCSeconds()),
  ].join("");
}

export function parseStkCallback(payload: unknown): ParsedStkCallback {
  if (!payload || typeof payload !== "object") throw new Error("invalid_callback");

  const body = (payload as { Body?: { stkCallback?: StkCallback } }).Body;
  const callback = body?.stkCallback;
  if (
    !callback ||
    typeof callback.CheckoutRequestID !== "string" ||
    !callback.CheckoutRequestID.trim() ||
    !Number.isInteger(callback.ResultCode) ||
    typeof callback.ResultDesc !== "string"
  ) {
    throw new Error("invalid_callback");
  }

  const metadata = new Map(
    (callback.CallbackMetadata?.Item ?? [])
      .filter((item) => typeof item?.Name === "string")
      .map((item) => [item.Name as string, item.Value]),
  );

  const amountValue = metadata.get("Amount");
  const receiptValue = metadata.get("MpesaReceiptNumber");
  const phoneValue = metadata.get("PhoneNumber");
  const transactionDate = metadata.get("TransactionDate");

  let paidAt: string | null = null;
  if (transactionDate !== undefined) {
    const compact = String(transactionDate);
    if (/^\d{14}$/.test(compact)) {
      const year = Number(compact.slice(0, 4));
      const month = Number(compact.slice(4, 6)) - 1;
      const day = Number(compact.slice(6, 8));
      const hour = Number(compact.slice(8, 10));
      const minute = Number(compact.slice(10, 12));
      const second = Number(compact.slice(12, 14));
      // Daraja reports East Africa Time (UTC+3).
      paidAt = new Date(
        Date.UTC(year, month, day, hour - 3, minute, second),
      ).toISOString();
    }
  }

  const amount = amountValue === undefined ? null : Number(amountValue);

  return {
    checkoutRequestId: callback.CheckoutRequestID.trim(),
    resultCode: callback.ResultCode,
    resultDescription: callback.ResultDesc.slice(0, 500),
    receipt:
      receiptValue === undefined ? null : String(receiptValue).trim() || null,
    amount: amount !== null && Number.isFinite(amount) ? amount : null,
    phone:
      phoneValue === undefined ? null : normalizeKenyanPhone(phoneValue),
    paidAt,
  };
}

export function secureEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

