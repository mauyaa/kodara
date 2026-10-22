# 0003. Payment attempts are idempotent and callbacks are recorded atomically

**Status:** Accepted

## Context

Tenants double-tap "Pay", networks retry, and Daraja can deliver the same
callback more than once. Recording a payment twice, or attaching one M-Pesa
receipt to two attempts, corrupts a landlord's books.

## Decision

- A payment attempt carries a client idempotency key, unique per tenancy, so
  a retried request reserves the same attempt instead of creating another.
- The callback is recorded by one PostgreSQL function that locks the attempt
  row, treats a duplicate callback as a no-op, and refuses to attach a
  provider receipt that is already attached to a different attempt.

## Consequences

- Retries are safe from the client to the database.
- A receipt collision fails loudly instead of silently double-counting.
