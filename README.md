# Kodara

Kodara automates M-Pesa rent collection for Kenyan landlords and gives tenants a focused self-service experience. [`kodara.md`](./kodara.md) is the product source of truth.

## Backend architecture

Supabase is the backend. The web and Flutter clients read and write through Supabase Auth, PostgREST, Storage, and Realtime under PostgreSQL Row Level Security. Only M-Pesa work crosses an Edge Function boundary:

- `mpesa-stk-push` authenticates the caller, verifies access to the tenancy, reserves an idempotent payment attempt, and calls Safaricom Daraja.
- `mpesa-callback` authenticates Safaricom through a high-entropy callback URL token and passes the payload into one atomic PostgreSQL function.
- PostgreSQL records a successful transaction once, auto-matches the exact tenancy when amount and attempt agree, and places amount mismatches in the landlord's reconciliation queue.
- `resolve_unmatched_payment` locks and resolves a payment while recording who resolved it and where it was attached.

The canonical hierarchy is:

```text
Landlord → Property → Unit → Tenancy → Payment
                                  └→ MaintenanceRequest → StatusHistory
```

Payments are allowed to have a null `tenancy_id` only while their reconciliation status is `unmatched`. They retain an immutable receiving `landlord_id` so the unmatched queue remains isolated.

## Local setup

Prerequisites: Node.js 22+, Docker, Deno 2, Flutter stable (for the tenant
client), and the current Supabase CLI.

```bash
npm install
supabase start
supabase db reset
npm run check
npm run test:db
npm run check:edge
npm run test:realtime
cd mobile && flutter pub get && flutter analyze && flutter test
```

Copy [`.env.example`](./.env.example) to `.env.local` for the Next.js client. Edge Function secrets are not Next.js environment variables; set them in Supabase:

```bash
supabase secrets set --env-file supabase/functions/.env
supabase functions serve mpesa-stk-push --env-file supabase/functions/.env
supabase functions serve mpesa-callback --env-file supabase/functions/.env --no-verify-jwt
```

Deploy in this order:

```bash
supabase db push
supabase functions deploy mpesa-stk-push
supabase functions deploy mpesa-callback --no-verify-jwt
```

Then configure `MPESA_CALLBACK_URL` as the deployed callback function URL and complete Safaricom sandbox certification before using production credentials.

## Security and integrity guarantees

- Every exposed table has explicit grants and RLS. No anonymous table access exists.
- Landlords can only reach their own property hierarchy; tenants can only reach their own tenancies.
- Service-role credentials exist only in Edge Functions and never in a public client.
- Raw M-Pesa callbacks live in the unexposed `private` schema.
- Provider receipt IDs and checkout IDs are unique; client retries use a tenancy-scoped idempotency key.
- A database lock permits only one unresolved STK attempt per tenant/tenancy and
  enforces a rolling request limit even if an Edge Function instance is bypassed.
- Daraja transport ambiguity becomes an explicit `uncertain` attempt for
  reconciliation; accepted requests cannot remain stuck in `requesting`.
- Tenant invitation matching uses only the phone verified by Supabase Auth;
  user metadata and editable profile fields cannot impersonate another phone.
- Maintenance history is trigger-written and cannot be edited by clients.
- Maintenance photos use a private bucket with tenancy-derived object paths.

## Verification

`npm run check` covers lint, generated route types, TypeScript, 26 unit tests,
and the production build. The local backend gate adds 22 pgTAP assertions,
schema lint, advisors, Deno checks, and authenticated payment/maintenance
Realtime delivery. Flutter has 5 model/formatter tests and a clean analyzer.
The Daraja sandbox harness has observed a real STK request plus success,
duplicate, mismatch, and cancellation callbacks. Production still requires an
SMS provider and a real-phone payment certification.
