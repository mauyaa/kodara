# Kodara M-Pesa callback handling

Safaricom Daraja STK callbacks do not provide the custom `x-hub-signature-256` header used by some webhook providers. Kodara authenticates its callback URL with a high-entropy `MPESA_CALLBACK_SECRET` query token, transmitted only over HTTPS:

```text
https://app.kodara.co.ke/api/mpesa/callback?token=<secret>
```

The STK route appends this token server-side. It must never be exposed to the browser or stored in source control.

## Processing contract

`POST /api/mpesa/callback` performs these checks in order:

1. Constant-time comparison of the callback token.
2. Structural validation of `Body.stkCallback`.
3. Lookup by the unique `CheckoutRequestID` stored in `payments.reference`.
4. Idempotency: an already-completed payment returns success without changing balances twice.
5. Exact amount comparison against the initiated payment.
6. Payment update, followed by invoice and tenant-balance updates.

Unknown checkout references intentionally return an accepted response so Safaricom does not retry indefinitely. They should be captured by monitoring and reconciled manually.

## Required sandbox cases

- successful payment;
- customer cancellation;
- insufficient funds;
- request timeout;
- duplicate success callback;
- incorrect callback token;
- unknown checkout reference;
- amount mismatch;
- database outage during callback processing.

## Operational controls

- Rotate the callback secret independently from the Daraja passkey.
- Restrict logs to checkout IDs and result codes; do not log PINs, access tokens, or full callback payloads.
- Alert when initiated payments remain unresolved beyond the reconciliation window.
- Reconcile Kodara completed payments against Safaricom settlement reports every day.
- Use separate secrets and shortcodes for staging and production.
