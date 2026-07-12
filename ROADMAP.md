# Kodara — Gap Analysis & Path to World-Class

Written 2026-07-12. Companion to `kodara.md` (product spec), `KODARA_BACKEND_HANDOFF.md`
(backend delivery record), and `DESIGN.md` (visual system). This document is the honest
inventory of what's missing between the working v1 that exists today and a system that
can win the Kenyan property-management market outright.

## Implementation status (2026-07-12)

**Tiers 0, 1, and 3 are built and verified** (pgTAP, lint, advisors, full `npm run check`,
`flutter analyze`/`test`, a real signed release APK, and live browser walkthroughs of every
new flow). Tier 2 (competitive-parity items: CSV/PDF export, deposits, late fees, lease
documents, push notifications, WhatsApp, multi-staff accounts) and Tier 4 (ops
infrastructure: error tracking, auth rate limiting, general audit log, admin tooling) and
Tier 5 (differentiation) remain open — see those sections below unchanged.

Shipped:
- **Tier 0** — per-landlord M-Pesa credentials (Vault-encrypted, replacing the single
  shared sandbox shortcode), sandbox/mock-first eTIMS integration with a retry queue,
  published privacy policy.
- **Tier 1** — tenant-landlord messaging (web + mobile), end-of-tenancy/move-out workflow,
  a working landlord notification bell, the tenant web-signup dead end removed, an
  invitation-cancel button, a real Settings page (business profile, M-Pesa, eTIMS),
  mobile release signing with a real keystore, mobile multi-tenancy support.
- **Tier 3** — `plans`/`subscriptions`/entitlement schema (a generous trial backfilled for
  every existing landlord), Kodara's own subscription billing via both M-Pesa STK push and
  Paystack (fully separate ledger from tenant rent), and a guided onboarding wizard for new
  landlord signups.

Three real bugs were caught and fixed during verification, all instructive: PostgREST only
resolves functions in schemas listed in `config.toml`'s `api.schemas` (not `private`),
service-role read access must go through narrow RPCs rather than broad table grants (this
repo's existing convention, initially violated by a new function), and a
`SECURITY DEFINER` function invoked from inside an RLS policy still needs `EXECUTE` granted
to the *querying* role, not just internal elevated privileges — the last of these had a
pgTAP test passing for the wrong reason (same SQLSTATE, different error) until a live
browser walkthrough caught it.

## How to read this

Findings come from two passes: a full read-only audit of every page, schema table, RLS
policy, Edge Function, and mobile screen in this repo, plus market research into Kenya's
proptech competitors and the regulatory environment landlords now operate under. Tiers
are ordered by *what breaks trust or the law first*, not by build effort.

---

## The headline finding

**v1's hardest problem — M-Pesa reconciliation — is genuinely done well.** Idempotent
STK push, dedupe-keyed webhook handling, amount-mismatch queueing, row-locked resolution,
RLS on every table, realtime with explicit auth, 22 pgTAP assertions that actually try to
break cross-tenant access. This is more rigorous than what competitor marketing pages
suggest they've built. Don't regress it.

**But the product has drifted behind two things it can't ignore: its own spec, and the
law.** `kodara.md` promises tenant-landlord messaging — never built. The Kenya Revenue
Authority made eTIMS invoicing mandatory for every landlord in January 2026 — not built,
and explicitly marked "out of scope" in the spec written before that mandate existed. At
least one direct competitor (Nyumba Zetu) already auto-syncs rent invoices to eTIMS. That
is no longer a differentiator gap, it's a compliance gap: a landlord who adopts Kodara
today is adopting a tool that leaves them personally exposed to KRA penalties (up to
KES 1,000,000 or 200% of tax due for non-registration).

There's also a structural gap underneath everything else: **Kodara has no model for how
it gets paid.** Every table assumes the only money that matters is rent moving
tenant→landlord. There's no `plans`/`subscriptions`/`billing_status` concept anywhere,
and `role = 'landlord'` grants unconditional, un-metered access to every feature in RLS.
kodara.md says "landlords pay" — nothing in the delivered system enforces that. This
isn't a screen to bolt on later; it's a second enforcement axis that has to be threaded
through RLS policies that were never built to carry it.

---

## Market position (2026)

- Kenya's proptech field is more crowded than it looks from inside this repo: Nyumba
  Zetu, Silqu, Blocks PMS, Bomahut, RentalDesk, Majengo, Sapama, pms.co.ke, and an
  AI-marketed entrant ("The Property") are all live, and **all of them already do M-Pesa
  reconciliation** — so M-Pesa integration itself is table stakes, not a moat. Kodara's
  moat has to be reconciliation *quality* (the unmatched-queue UX, the auditability, the
  realtime dashboard) plus product completeness competitors skip.
  [Nyumba Zetu](https://www.nyumbazetu.com/) · [Silqu](https://silqu.com/) ·
  [Bomahut](https://www.bomahut.com/) · [Pangoni Kenya PMS guide 2026](https://pangoni.io/blog/guides/property-management-software-kenya)
- Global category leaders (AppFolio, Buildium, DoorLoop) compete on accounting depth,
  late-fee automation, and owner reporting — none are M-Pesa-native, so they aren't
  direct competitors, but they're the feature bar for "world class."
  [DoorLoop comparison 2026](https://www.doorloop.com/blog/appfolio-vs-buildium) ·
  [AppFolio 2026 comparison](https://www.appfolio.com/blog/best-property-management-softwares-compared-2026)
- **eTIMS is now a legal floor, not a feature.** As of January 2026 every landlord above
  KES 24,000/month rental income must register and issue an eTIMS-compliant invoice per
  rent payment, enforced via the new eRITS portal, with steep penalties for
  non-compliance. KRA has already issued 140,000+ compliance notices.
  [Pangoni eTIMS landlord guide](https://pangoni.io/blog/compliance/kra-etims-landlords-kenya) ·
  [Techweez on eTIMS enforcement](https://techweez.com/2026/02/18/kra-etims-digital-tax-rules-kenya/) ·
  [Huduma Global on the 10% rate](https://hudumaglobal.com/blog/kenya-rental-income-tax-2026-rate-rose-10-percent)
- Third-party OSCU/VSCU SDKs already exist for exactly this integration (TypeScript,
  Python, PHP) — this is buildable in days, not months.
  [KRA eTIMS system-to-system docs](https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/etims-system-to-system-integration) ·
  [paybill.ke SDKs on GitHub](https://github.com/paybillke)
- **Kodara is also a Data Protection Act 2019 data controller/processor by definition**
  (handles financial + personal data at scale) and financial-services processors must
  register with the ODPC **regardless of size** — this is a business/legal action, not
  code, but the product should support it (privacy policy, DPO contact, processing
  register, breach-notification path).
  [ODPC compliance guide](https://hudumaglobal.com/blog/odpc-data-protection-act-kenya-compliance-guide)
- **Underserved segment: diaspora landlords.** Kenya's diaspora sent home a record
  KES 650 billion in 2025 and diaspora investors are simultaneously the most active
  property buyers and the most defrauded — remote visibility and trust are their core
  pain point. Kodara's realtime dashboard + immutable audit trail is a near-perfect fit
  for this segment and isn't being marketed as one anywhere in the product.
  [Afriqahome diaspora investment guide](https://www.afriqahome.com/guides/kenya-diaspora-property-investment)
- **WhatsApp reaches 97% of Kenyan internet users**, API access costs roughly
  KES 0.25/message and onboards in 24–72 hours — a materially bigger reach and lower
  cost than the SMS-only reminder channel Kodara has today.
  [WhatsApp Business API Kenya 2026](https://helloduty.com/blogs/how-whatsapp-is-transforming-business-communication-in-kenya)

---

## Tier 0 — Compliance. Do first, no exceptions.

These aren't features a landlord might want; they're the difference between "Kodara is a
tool I can trust with my rent" and "Kodara is exposing me to KRA penalties."

1. **eTIMS / eRITS integration.** Issue a KRA-compliant e-invoice (via OSCU or VSCU) on
   every successfully matched rent payment. This slots naturally after
   `record_mpesa_stk_callback` commits a `matched_auto`/`matched_manual` payment — treat
   it as a required side effect of the payment-recording transaction, with its own
   retry/failure queue (mirroring the reconciliation-queue pattern already built for
   M-Pesa mismatches, since eTIMS submission can fail independently of the payment
   itself).
2. **ODPC registration support** — privacy policy page, DPO contact, and an internal
   data-processing register. Business action for the user, but the product should expose
   what it's legally required to.
3. **Close the M-Pesa production gates already flagged in `KODARA_BACKEND_HANDOFF.md`**:
   upload sandbox-certified credentials to the linked Supabase project, configure a
   production SMS provider (tenant phone OTP — the *only* tenant auth path — cannot work
   in production without one), and certify one real KES 1 Safaricom payment. Until these
   close, the single most important feature in the product has never run outside a
   sandbox.

## Tier 1 — Close the gap between the spec and what shipped

`kodara.md` promises these or the current behavior actively breaks the product's own
data model. None of this is speculative scope — it's already-agreed v1 work that's
missing or broken.

4. **Tenant-landlord messaging** — explicitly listed under "Tenant Side" in `kodara.md`
   ("Basic messaging with landlord"). Zero implementation: no table, no thread UI on web
   or mobile.
5. **End-of-tenancy / move-out workflow.** Tenancies are immutable by design (correct —
   preserves history), but there is currently no way to *end* one anywhere in the
   product — not in the UI, not via any RPC called from web or mobile. A unit can only be
   freed for re-letting by hand-editing the database. This blocks the single most common
   real-world event after "a payment happened": a tenant moving out. It also blocks any
   future lease-renewal flow, since renewal = end one tenancy + create the next.
6. **Wire the landlord notification bell.** `components/layout/topbar.tsx` renders a
   bell with no handler, no dropdown, no unread count — pure decoration. The
   `notifications` table only ever populates for tenants today; extend it to
   landlord-facing events (payment received, payment unmatched, maintenance submitted,
   reminder sent) and wire the bell to it.
7. **Fix the tenant web-signup dead end.** `app/(auth)/signup/page.tsx` offers a "Tenant"
   account type via email/password, but `accept_tenant_invitation` hard-requires a
   Supabase-verified **phone**, which the web form never collects. A tenant who signs up
   this way can never accept an invitation. Either remove the tenant option from web
   signup (funnel to the Flutter app / phone flow, which is the only real tenant path
   today) or add phone verification to web signup.
8. **Cancel-invitation button.** `cancel_tenant_invitation` is fully built and granted
   server-side and is never called from anywhere in the product. Today, a landlord who
   mistypes a tenant's phone number has that unit locked to the bad invitation for the
   full 14-day expiry with no recourse. This is a small, high-value fix.
9. **Build the settings page.** `/settings` is listed as a protected route in
   `lib/supabase/middleware.ts` but no page exists — it 404s for an authenticated user.
   Needs, at minimum: business/profile details, notification preferences, and a visible
   place to eventually surface plan/billing state (Tier 3).
10. **Fix mobile release signing.** `mobile/android/app/build.gradle.kts` signs release
    builds with the **debug keystore** — this cannot ship to the Play Store as-is. Needs
    a real signing config before any store submission, plus resolving the stale
    application-ID template comment alongside it.
11. **Support tenants with more than one active tenancy on mobile.**
    `kodara_service.dart`'s `fetchActiveTenancy` takes the first active tenancy and
    silently ignores any others. A tenant renting two units — from the same or different
    landlords — only ever sees one. Needs a unit switcher.

## Tier 2 — Competitive parity / what "world class" requires

Every serious competitor (local and global) already has these. Missing them isn't
embarrassing yet, but it caps how far up-market Kodara can move.

12. **CSV/PDF export** — payment ledger, arrears report, tenant list. Landlords need
    this for their own records and (now, per Tier 0 item 1) for tax substantiation
    alongside eTIMS.
13. **Security deposit tracking and refund workflow** — no `deposit_amount`, no deposit
    ledger, no refund/deduction flow anywhere in the schema today.
14. **Late fee automation** — `tenancy_balances` computes straight rent-due-minus-paid
    with no penalty accrual. This is one of AppFolio/Buildium's most-cited features.
15. **Lease document generation** — even a templated PDF (no e-signature required at
    first) turns tenancy terms from structured rows a landlord can't hand a tenant into
    something real.
16. **Paginate the dashboard ledger and payments list.** Both currently `.limit(10)` or
    return everything unbounded — fine at today's scale, will degrade silently the
    moment a landlord has real transaction volume.
17. **Mobile push notifications.** No `firebase_messaging` or equivalent in
    `pubspec.yaml` — a tenant only learns about a rent reminder or payment confirmation
    if they happen to open the app or read an SMS. This is a bigger gap than it looks:
    it's the difference between "automatic" collection (the product's core promise) and
    "automatic if the tenant happens to check."
18. **WhatsApp as a reminder/receipt channel**, alongside (not instead of) SMS. Given
    97% Kenyan WhatsApp penetration and near-zero marginal cost, this is likely the
    single highest-leverage item in this tier for actual collection-rate improvement.
19. **Multi-staff/team accounts.** Explicitly deferred in `kodara.md`, and correctly so
    for a true v1 — but it will be the first thing a landlord with a caretaker or a
    property manager with multiple owners asks for. Worth scoping (even if not building)
    before Tier 3's billing model locks in per-seat vs. per-property pricing
    assumptions.

## Tier 3 — Business viability

20. **A billing/subscription model for Kodara itself.** This is the biggest structural
    gap found in the audit. Needs: a `plans`/`subscriptions` table, an entitlement check
    layered as a second, orthogonal axis onto the existing RLS policies (which today
    treat `role = 'landlord'` as an unconditional grant), and Kodara's own collection
    flow (M-Pesa paybill or card) separate from the tenant-rent-collection flow that
    already exists. Do this *after* Tier 0–1 close, but before scaling marketing —
    there's currently no mechanism to charge a single landlord for using the product.
21. **A real onboarding flow.** Replace generic signup → empty dashboard with a guided
    "add your first property" wizard. Directly affects activation rate once there's
    anything to activate into.

## Tier 4 — Trust, ops, and scale infrastructure

22. **Production error tracking** (Sentry or equivalent) across web, Edge Functions, and
    the Flutter app. Today everything is `console.error`-only — there is no production
    visibility into failures a landlord or tenant hits after deploy.
23. **Rate limiting / CAPTCHA on login and signup.** Only payment attempts are
    rate-limited today (well — 5 per 10 minutes, DB-enforced). Auth endpoints have no
    equivalent protection.
24. **A general audit log**, beyond the existing payment-reconciliation and
    maintenance-status trails, covering property/unit/tenancy edits and admin actions.
25. **Internal admin tooling** for investigating disputes or manually intervening in
    reconciliation across landlords — today that requires direct database access.

## Tier 5 — Differentiation, once there's usage data to prioritize from

26. **Diaspora-landlord positioning**: optional multi-currency display for context
    (KES stays authoritative), scheduled monthly statement emails, a trusted read-only
    caretaker role. This targets a specific, large, underserved, high-trust-need segment
    identified in the market research above — and Kodara's realtime/audit architecture
    is already most of the way there technically.
27. **Lightweight arrears-risk signal** — flag tenants whose payment pattern suggests a
    likely miss, based on their own history. `kodara.md` correctly defers "advanced
    analytics and AI" for v1, but competitors are already marketing "AI-powered"
    positioning, so this is worth a cheap, honest version once there's enough payment
    history per tenant to make it real rather than decorative.
28. **Vacancy/listing management and applicant intake** — extends Kodara from
    "post-lease operations" into full-cycle property management.
29. **Utility/sub-metering split billing** — a commonly cited landlord pain point this
    repo's schema doesn't touch at all today (`rent_amount` is the only billable line
    item on a tenancy).

---

## Recommended sequencing

**Phase A — make v1 defensible.** Tier 0 (compliance) + Tier 1 (close spec gaps, fix the
dead ends). Nothing in Phase B matters if a real landlord's first eTIMS-less invoice or
first "how do I end this tenancy" moment breaks trust in the product.

**Phase B — reach competitive parity and turn on revenue.** Tier 2 + Tier 3 item 20
(billing model) together, since pricing decisions (per-unit? per-property? staff seats?)
should account for Tier 2 features like multi-staff before the entitlement model is cast
in RLS.

**Phase C — ops maturity**, ideally threaded through Phases A/B rather than sequenced
after them (observability in particular is cheap now, expensive to retrofit after
production traffic exists).

**Phase D — differentiation.** Once there's real landlord usage, let actual behavior
(which tier-2 features get used, where landlords drop off, what tenants complain about)
reprioritize this tier rather than guessing further from here.

## What's already excellent — protect this while building the rest

- The M-Pesa reconciliation architecture (idempotency, dedupe, amount-mismatch queueing,
  row-locked resolution) and the RLS/testing rigor behind it (22 pgTAP assertions that
  actively try to break cross-tenant access).
- The realtime layer's explicit auth handling — most Supabase apps get this wrong.
- `DESIGN.md`'s visual system — genuinely differentiated; most Kenyan proptech
  competitor products look like generic dashboard templates.
- The staged CI/CD pipeline with a manual production approval gate — more mature than
  most products at this stage ship with.
