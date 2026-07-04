# Kodara backend handoff

Updated: 2026-07-03 (Africa/Nairobi). `kodara.md` remains the product source of
truth.

## Delivered architecture

- Supabase Auth, Postgres, RLS, Storage, and Realtime are authoritative for
  `Landlord -> Property -> Unit -> Tenancy -> Payment` and maintenance.
- Next.js 16.2.9 is the landlord dashboard. Flutter is tenant-only.
- `mpesa-stk-push` authenticates the tenant, validates tenancy and amount,
  reserves an idempotent attempt, applies database concurrency/rate limits,
  and invokes Daraja.
- `mpesa-callback` requires a high-entropy token and records callbacks
  atomically. Duplicates are idempotent; receipt collisions fail; mismatches
  enter a landlord-scoped reconciliation queue.

## Security and reliability

- Explicit grants and RLS cover every exposed table and private maintenance
  photo. Security-definer helpers avoid recursive RLS without opening access.
- Invitations use only a Supabase-verified Auth phone. Signup metadata cannot
  claim another phone; authenticated users cannot edit profile phone or role.
- Tenancy validation and INSERT ... RETURNING behavior are regression-tested.
- One unresolved STK attempt is allowed per requester/tenancy; the database
  permits at most five attempts per requester in ten minutes.
- Pre-Daraja failures become `failed`; ambiguous post-request outcomes become
  `uncertain`; accepted attempts cannot remain stuck in `requesting`.
- A provider receipt cannot silently attach to a different payment attempt.
- Realtime explicitly uses the current access token and reports authorization
  or channel failures.

## Verification evidence

- `npm run check`: ESLint, route type generation, TypeScript, 26 Vitest tests,
  and the production build pass.
- Both Deno Edge Functions pass `npm run check:edge`.
- `npm audit --audit-level=high`: zero vulnerabilities.
- Fresh database reset: 22 pgTAP assertions, schema lint, and warning-level
  Security/Performance Advisors pass.
- Authenticated Realtime E2E receives a callback-created payment INSERT and a
  maintenance UPDATE under RLS.
- Daraja sandbox E2E passed a real STK request, idempotent retry, success,
  duplicate callback, mismatch reconciliation, cancellation, and leak check.
- Flutter 3.44.4: analyzer clean; 5 tests pass.
- Linked project `gonfgtovwltpynpjrzao`: local/remote schema diff is empty and
  migration `20260701000000` is recorded. Both M-Pesa functions exist remotely
  at version 2, but no M-Pesa secrets are configured there.
- Linked Security Advisor reports five reviewed warnings for the intentionally
  exposed `SECURITY DEFINER` RPCs (`register_as_landlord`, invitation create /
  accept / cancel, and reconciliation). Each validates `auth.uid()` plus its
  role, ownership, or verified-phone precondition and has an explicit
  `authenticated` grant. These atomic privilege-boundary RPCs are intentional;
  anonymous execution is revoked.

## External completion gates

Code work is complete. These require external credentials or hardware:

1. Explicit approval to upload local sandbox M-Pesa credentials to the linked
   Supabase project. The environment security reviewer blocked that transfer
   without credential-specific approval. Use callback URL
   `https://gonfgtovwltpynpjrzao.supabase.co/functions/v1/mpesa-callback`, then
   deploy both functions.
2. Configure a supported hosted Supabase SMS provider. No provider credential
   exists, so production phone OTP onboarding cannot work yet.
3. Complete Android/iOS device smoke tests and a KES 1 payment from a real
   Safaricom line. CI cannot fabricate a physical STK prompt.

## Definition of Done

| # | Requirement | Status |
|---|---|---|
| 1 | Landlord creates property/unit/tenant | Passed in browser and RLS tests |
| 2 | Real M-Pesa payment recorded and matched | Daraja sandbox passed; production phone gate remains |
| 3 | Dashboard updates without refresh | Authenticated Realtime E2E passed |
| 4 | Unmatched queue resolves under one minute | Browser flow and audit row passed |
| 5 | No cross-account access | 22 pgTAP tests, leak harness, lint/advisors passed |
| 6 | Maintenance photo and live statuses | Backend/browser passed; device gate remains |
| 7 | Duplicate webhooks create one payment | pgTAP and Daraja harness passed |
| 8 | Survives app close/reopen | Backend idempotency passed; device gate remains |
