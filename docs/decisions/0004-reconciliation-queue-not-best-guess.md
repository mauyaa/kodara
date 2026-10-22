# 0004. Unmatched payments go to a reconciliation queue, not a best guess

**Status:** Accepted

## Context

Tenants pay amounts that differ from the rent, or pay without a matching
attempt. Guessing which tenancy a payment belongs to produces arrears and
receipts that are wrong in ways a landlord cannot see.

## Decision

A payment is matched to a tenancy automatically only when the amount and the
attempt agree exactly. Otherwise it is recorded with a null `tenancy_id`, an
`unmatched` status and the immutable receiving `landlord_id`, which keeps it
in that landlord's queue only. `resolve_unmatched_payment` locks the payment,
attaches it, and records who resolved it and where.

## Consequences

- No payment is ever silently misattributed.
- Landlords have a small queue to work through, with an audit trail of each
  resolution.
