# Kodara production release gate

The repository can be built and exercised locally without provider credentials. A public launch additionally requires the external systems below; do not promote the alpha preview or M-Pesa simulation as a live financial service.

## 1. Supabase

1. Create separate staging and production projects.
2. Apply `docs/schema.sql` to staging, run Supabase database/security advisors, and resolve every error before production.
3. Configure Phone Auth with an approved SMS provider.
4. Create owner, manager, and tenant test users. Verify isolation between two unrelated organizations.
5. Enable Realtime for `payments`, `maintenance_requests`, `messages`, and `notifications` only.
6. Verify the private `kodara-documents` bucket rejects anonymous access and cross-organization object paths.

## 2. Environment

Configure `.env.example` values in the hosting provider. `SUPABASE_SERVICE_ROLE_KEY`, Daraja credentials, and `MPESA_CALLBACK_SECRET` are server-only secrets. Rotate any secret that has previously been pasted into a browser or committed.

## 3. M-Pesa

1. Start with `MPESA_ENVIRONMENT=sandbox`.
2. Use a public HTTPS callback URL and a strong callback secret.
3. Test success, cancellation, timeout, duplicate callback, wrong amount, and unknown checkout-reference paths.
4. Reconcile the Kodara ledger against the Safaricom portal before requesting production approval.
5. Switch to production only after Safaricom shortcode, passkey, and application approval are active.

## 4. Release verification

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Complete a manual mobile pass on representative low-end Android hardware and a network-throttled connection. Confirm logs contain no access tokens, M-Pesa PINs, full callback payloads, or document URLs.

## 5. Operations

- Configure error monitoring, uptime checks, database backups/PITR, and payment reconciliation alerts.
- Publish privacy, terms, data-retention, support, and incident-response policies appropriate for Kenyan users.
- Set up a staffed support channel and an escalation owner for payment disputes before inviting alpha landlords.
