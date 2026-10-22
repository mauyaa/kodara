# 0002. Only M-Pesa work crosses an Edge Function boundary

**Status:** Accepted

## Context

Calling Safaricom Daraja needs credentials that must never reach a client,
and Daraja's callbacks arrive from the internet without a user session.

## Decision

Everything else stays in PostgreSQL under RLS. Payment work goes through
Edge Functions:

- `mpesa-stk-push` authenticates the caller, checks access to the tenancy,
  reserves a payment attempt and calls Daraja with server-held credentials.
- `mpesa-callback` authenticates Safaricom with a high-entropy token in the
  callback URL, compared in constant time, limits the body size, and hands
  the parsed payload to a single database function.

## Consequences

- Credentials and the service role key exist only in the function runtime.
- Business rules for recording a payment live in one transactional database
  function, not in the edge layer.
- The callback token must be rotated if the callback URL leaks.
