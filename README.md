# Kodara

Kodara is a Kenyan property-management operating system for owners, property managers, and tenants. The repository contains a Next.js 16 web app, Supabase/PostgreSQL backend specification, Safaricom Daraja M-Pesa routes, and a Flutter mobile client.

## Product surfaces

- Owner and manager workspace: portfolio overview, properties and units, tenant directory, rent collection, maintenance, messaging, documents, and reports.
- Tenant self-service: current balance, M-Pesa payment flow, maintenance requests, status tracking, messages, and lease/payment documents.
- Backend: authenticated route handlers, organization-scoped row-level security, private document storage, real-time read models, notifications, and idempotent M-Pesa callbacks.
- Alpha preview: when no authenticated Supabase workspace is available, the web app runs against persistent browser-local sample data. The interface labels this state explicitly.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the role switcher to inspect owner, manager, and tenant experiences.

Quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Production setup

1. Create a Supabase project and apply [`docs/schema.sql`](docs/schema.sql).
2. Configure the variables in [`.env.example`](.env.example) through the deployment platform. Never paste service-role or M-Pesa secrets into the browser.
3. Configure Supabase Phone Auth and an SMS provider, then validate owner, manager, and tenant policies with separate test accounts.
4. Complete Safaricom sandbox certification before setting `MPESA_ENVIRONMENT=production`.
5. Follow [`docs/FINAL_SETUP.md`](docs/FINAL_SETUP.md) for the release gate.

External provider approval, production credentials, domain/DNS configuration, app-store signing, and live payment certification are deployment dependencies and are not simulated as “complete.”
