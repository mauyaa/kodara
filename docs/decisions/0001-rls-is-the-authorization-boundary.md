# 0001. PostgreSQL row-level security is the authorization boundary

**Status:** Accepted

## Context

Two clients, the Next.js landlord dashboard and the Flutter tenant app, read
and write the same data. Authorization implemented in each client, or in a
custom API in front of the database, would have to be kept identical in
several places, and any path that bypassed it would leak another landlord's
tenants and payments.

## Decision

Both clients talk to Supabase directly (Auth, PostgREST, Storage, Realtime),
and every exposed table has explicit grants and RLS policies. Access rules
follow the hierarchy `Landlord → Property → Unit → Tenancy → Payment`, using
`security definer` helpers in a private schema so policies stay short.
Realtime subscriptions are filtered by the same policies.

## Consequences

- One place to reason about who can see what, and it applies to every
  client, including ones not written yet.
- Policies are code and need tests. pgTAP covers cross-landlord isolation,
  tenant scoping and plan limits.
- PostgreSQL applies the SELECT policy to `INSERT ... RETURNING`. A policy
  that is correct for reads can still block writes; see the
  [2026-07-22 incident](../incidents/2026-07-22-property-creation-rls.md).
