# Kodara
**Property Management System for Kenya**

## Core Purpose
Kodara exists to make rent collection automatic, visible, and reliable for landlords while giving tenants a simple self-service experience. It replaces calls, WhatsApp threads, and spreadsheets with a structured system.

## Overview
Kodara is a complete property management platform with two connected experiences:
- **Landlord Web Dashboard** — for managing properties, units, tenants, rent collection, and maintenance.
- **Tenant Experience** — a clean, mobile-first interface where tenants pay rent via M-Pesa and handle their own requests.

The system is built around real-time updates and deep M-Pesa integration.

## Target Users
- **Landlords** (primary, paying users): individuals and small-to-medium property managers.
- **Professional Property Managers**: those handling multiple properties for different owners.
- **Tenants**: secondary users who interact through the self-service interface.

Landlords pay. Every tenant-facing decision is evaluated by how much it reduces the landlord's operational burden.

## Problem
Landlords in Kenya lose time and money to:
- Manual rent chasing and poor payment visibility
- Disorganized records
- Constant back-and-forth on maintenance issues
- No reliable system that works well with M-Pesa

## Solution
- Automated M-Pesa rent collection with proper recording
- Real-time visibility of payments and arrears
- Structured management of properties, units, and tenants
- A system for tenants to raise and track maintenance requests
- Clear separation between landlord management tools and tenant self-service

## Product Structure
### Landlord Side (Web Dashboard)
- Dashboard with live metrics
- Properties & Units management
- Tenants & Tenancies management
- Payments, Arrears & Reconciliation
- Maintenance requests
- Basic reports

### Tenant Side (Mobile-first, Flutter)
- Current balance and due date
- One-tap M-Pesa payment
- Maintenance request submission and status tracking
- Payment history and documents
- Basic messaging with landlord

## Data Model (Mandatory Structure)
This hierarchy must be respected by every feature, query, and permission check — no flat tables, no shortcuts:

```
Landlord (User)
  └── Property
        └── Unit
              └── Tenancy (links Tenant + Unit + rent amount + period)
                    ├── Payment (M-Pesa transaction + reconciliation status)
                    └── MaintenanceRequest (with timestamped status history)
```

**Key rules from this model:**
- Payments and MaintenanceRequests attach to a **Tenancy**, not directly to a Tenant or Unit — this preserves history when tenants move out or rent amounts change.
- Every Payment has a reconciliation status: `matched_auto`, `matched_manual`, or `unmatched`. Auto-match failures are routine (wrong reference, paid from a different phone), not an edge case — they need a resolvable queue, not a dead end.
- MaintenanceRequest status carries a full timestamped history, not just a current value.
- Access control follows this hierarchy at the database and API layer — a tenant can only reach their own Tenancy, Payments, and MaintenanceRequests; a landlord can only reach Properties they own. This is enforced server-side on every request, never inferred from a client-side role or URL param.

## Key Features (Version 1)
**Must Have:**
- Property and unit management
- Tenant onboarding and Tenancy creation
- M-Pesa STK Push payment with webhook recording
- Real-time payment updates on landlord dashboard
- Maintenance request submission and status tracking (with history)
- Payment reconciliation queue for unmatched payments
- Role-based access control enforced server-side

**Out of Scope for v1:**
- Advanced analytics and AI
- Team accounts / multi-staff management
- Landlord mobile app (web first)
- Complex financial products (Trial Balance, P&L, eTIMS)

## Core Flows
### Rent Payment Flow
1. Landlord creates a Tenancy with a rent amount
2. Tenant sees their balance
3. Tenant initiates M-Pesa STK Push
4. Webhook receives and records the payment
5. Landlord dashboard updates in real time
6. Unmatched payments go into a resolvable queue

### Maintenance Flow
1. Tenant submits a request with photos
2. Request appears on landlord dashboard
3. Landlord updates status (Pending → In Progress → Completed)
4. Tenant sees each status change in real time

## Technology Stack
- **Database & Backend: Supabase (Postgres)**
  - Row Level Security enforces the Landlord → Property → Unit → Tenancy access rules at the database layer, not just in application code — a tenant's query is structurally restricted to their own Tenancy, Payments, and MaintenanceRequests.
  - Supabase Realtime streams row changes (Payments, MaintenanceRequests) to the landlord dashboard and tenant app without polling.
  - Edge Functions handle the M-Pesa Daraja webhook — receiving the STK Push callback, validating it, and writing the Payment row. Idempotency (via a unique constraint on M-Pesa's transaction ID) and the unmatched-payment queue logic must be built and tested explicitly — Supabase provides the execution environment, not the reconciliation correctness itself.
- **Landlord Web Dashboard: Next.js**
- **Tenant App: Flutter**
  - Single codebase for iOS and Android.
  - Talks to Supabase directly via the `supabase_flutter` SDK for auth, data access (governed by the same RLS policies as the web dashboard — no separate access-control logic to keep in sync), and Realtime subscriptions for live balance and maintenance-status updates.
  - STK Push flow: tenant taps pay in the Flutter app → app calls a Supabase Edge Function to trigger Daraja's STK Push → tenant confirms on their phone's M-Pesa prompt → Safaricom hits the webhook → Realtime pushes the confirmed balance back to the Flutter app.

## Guiding Principles
- The data model (Landlord → Property → Unit → Tenancy → Payment/Maintenance) is non-negotiable.
- The M-Pesa payment flow, including reconciliation, is the highest-priority feature.
- Access control is enforced server-side and at the database level — never trusted from the client.
- Query parameters may be used for view switching but **never** for access control.
- A feature is either fully working — including its realistic failure cases — or it does not exist in v1. There is no partial credit for a screen that calls an endpoint with no auth check, or a payment flow that only works if the webhook arrives once and on time.

## This Is a Working Application, Not an MVP
"MVP" gets read as "prototype, cut corners, fix it later in production." That's not this. Small in scope, not small in reliability.

For each Must Have feature, "working" specifically means:
- The happy path works.
- The realistic failure paths work: payment doesn't auto-match, webhook fires twice, tenant loses connection mid-payment, photo upload fails.
- Data integrity holds: no double-counted payments, no orphaned records, no tenant able to see another tenant's or landlord's data.
- Core logic (payment matching, balance calculation, access control) has at least basic automated test coverage — not just manual click-testing.

## Definition of Done (Version 1)
Version 1 is complete only when **all** of the following are true with real data:

1. A landlord can create a property, unit, and tenant.
2. A tenant can make a real M-Pesa payment that gets recorded and matched automatically.
3. The landlord sees the payment update on their dashboard within seconds, with no manual refresh.
4. Payments that fail to auto-match go into a queue the landlord can resolve correctly in under a minute.
5. A tenant cannot access another tenant's or landlord's data under any request they craft.
6. A maintenance request can be submitted with a photo and moved through statuses, with real-time updates visible to the tenant.
7. Duplicate webhooks do not create duplicate payment records.
8. Core flows remain functional even if the app is closed and reopened mid-process.

If any of the above is missing or broken, v1 is not done — regardless of how many screens exist.

## Current Focus
Build on a correct data model with a working, end-to-end M-Pesa payment flow, including reconciliation handling. Everything else is secondary.
