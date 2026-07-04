import { describe, expect, it } from "vitest";
import {
  formatDarajaTimestamp,
  normalizeKenyanPhone,
  parseStkCallback,
  secureEqual,
} from "../supabase/functions/_shared/mpesa";

describe("M-Pesa domain handling", () => {
  it.each([
    ["0712345678", "254712345678"],
    ["+254712345678", "254712345678"],
    [712345678, "254712345678"],
  ])("normalizes Kenyan phone %s", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(["", "123", "254212345678", "25471234567x"])(
    "rejects invalid phone %s",
    (input) => {
      expect(() => normalizeKenyanPhone(input)).toThrow("invalid_phone");
    },
  );

  it("uses the UTC Daraja timestamp format", () => {
    expect(formatDarajaTimestamp(new Date("2026-07-01T09:08:07.000Z"))).toBe(
      "20260701090807",
    );
  });

  it("parses a successful callback and converts EAT to UTC", () => {
    const result = parseStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: "ws_CO_123",
          ResultCode: 0,
          ResultDesc: "Success",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 25000 },
              { Name: "MpesaReceiptNumber", Value: "TGA123ABC" },
              { Name: "PhoneNumber", Value: 254712345678 },
              { Name: "TransactionDate", Value: 20260701120807 },
            ],
          },
        },
      },
    });

    expect(result).toEqual({
      checkoutRequestId: "ws_CO_123",
      resultCode: 0,
      resultDescription: "Success",
      receipt: "TGA123ABC",
      amount: 25000,
      phone: "254712345678",
      paidAt: "2026-07-01T09:08:07.000Z",
    });
  });

  it("parses a cancellation without inventing metadata", () => {
    expect(
      parseStkCallback({
        Body: {
          stkCallback: {
            CheckoutRequestID: "ws_CO_cancelled",
            ResultCode: 1032,
            ResultDesc: "Request cancelled by user",
          },
        },
      }),
    ).toMatchObject({
      resultCode: 1032,
      receipt: null,
      amount: null,
      phone: null,
      paidAt: null,
    });
  });

  it("rejects malformed callbacks", () => {
    expect(() => parseStkCallback({ Body: {} })).toThrow("invalid_callback");
  });

  it("compares callback tokens without early length exits", () => {
    expect(secureEqual("same-token", "same-token")).toBe(true);
    expect(secureEqual("same-token", "wrong-token")).toBe(false);
    expect(secureEqual("short", "a-much-longer-token")).toBe(false);
  });
});
