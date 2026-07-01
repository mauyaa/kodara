# Verification

No build/analyze/test could be run in the sandbox this work was done in (the
Flutter tool's first-run snapshot build exceeds the available command time
budget). Everything below was written and reviewed by eye — file-by-file,
read before and after edit — but has **not** been compiled. Run these
locally before trusting it in CI or on a device.

## Commands to run, in order

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=SUPABASE_URL=https://<project>.supabase.co \
            --dart-define=SUPABASE_ANON_KEY=<anon-key> \
            --dart-define=API_BASE_URL=https://<your-nextjs-deployment>
```

- `flutter pub get` — pulls in the new `http: ^1.2.0` dependency added to
  `pubspec.yaml`. If this fails, check for a version conflict with
  `supabase_flutter`'s own `http` constraint.
- `flutter analyze` — the most important step. This codebase was hand-typed
  without a compiler in the loop, so treat the first `analyze` run as the
  real first compile. Expect to fix small things even if the logic is sound.
- `flutter test` — there are no widget/unit tests in this app yet (none
  existed before this change either). Worth adding at minimum a test for
  `PaymentFlowNotifier`'s state transitions and the model `fromJson` parsers
  in `lib/models/models.dart`, since those are the highest-risk, least
  visually-obvious code.
- `flutter run` without `--dart-define` flags will load the app in
  "not configured" mode (both portals show `NotConfiguredNotice` instead of
  data) — useful for a quick visual smoke test of navigation and theming
  without a real backend.

## Things I'm not fully confident about — please double-check

1. **`DropdownButtonFormField` parameter name** (`lib/widgets/maintenance_request_sheet.dart`).
   I used `value:` rather than the newer `initialValue:` because the
   pubspec's SDK floor is `>=3.4.0`, and `initialValue` was only added to
   `DropdownButtonFormField` in a later Flutter release. `value:` is the
   long-standing, broadly-compatible name, but if your local Flutter SDK is
   very recent it may emit a deprecation warning (not an error) — safe to
   leave as-is or swap to `initialValue:` if you've pinned a newer SDK.

2. **`Color.withOpacity` vs `withValues(alpha:)`** — same SDK-floor
   reasoning. I used `withOpacity()` everywhere (5 call sites across
   `async_state_view.dart`, `payment_sheet.dart`, `tenant_portal.dart`,
   `landlord_dashboard.dart`) instead of the newer `withValues(alpha:)` to
   stay compatible with Flutter 3.4. If your toolchain is on a recent stable
   release, `flutter analyze` may flag `withOpacity` as deprecated
   (info-level, not an error) — fine to ignore or migrate.

3. **Riverpod provider wiring** — double-check
   `lib/providers/payment_flow_provider.dart`. It's the most stateful piece
   (a hand-rolled state machine over a Supabase Realtime stream) and the
   trickiest to verify without running it:
   - The `for` loop in `_watchForConfirmation` polls
     `fetchPaymentsForTenant` up to 5 times (with increasing delay) to find
     the just-inserted payment row before subscribing to its realtime
     stream. If your Supabase project has realtime disabled for the
     `payments` table, this whole tail of the flow silently does nothing
     after sending the STK push — the UI stays on "waiting for
     confirmation" until the 2-minute timeout fires the soft-failure
     message. Confirm realtime is enabled on `payments` (Database →
     Replication in the Supabase dashboard) or this feature degrades to
     "fire the prompt and hope."
   - `PaymentFlowNotifier` is `StateNotifierProvider.autoDispose` — verify
     it actually resets to `idle` each time `showPaymentSheet` reopens (it
     should, since nothing keeps it alive while the sheet is closed, but
     this depends on no other widget accidentally holding a `ref.watch` on
     it).

4. **Route/screen wiring** — `main.dart` was *not* modified (the existing
   `/`, `/landlord`, `/tenant` routes already matched what the rewritten
   screens need), and `auth_screen.dart` was *not* modified. Confirm the
   `profiles.role` value read in `auth_screen.dart` after OTP verification
   really does come back as exactly `'tenant'` vs something else for
   landlords/managers/agents — the routing `if` there only branches on
   `role == 'tenant'`, sending everything else to `/landlord`, which matches
   the existing behavior and was left untouched.

5. **`tenant_directory` and other views/tables** — `lib/services/kodara_service.dart`
   queries `tenant_directory`, `properties`, `units`, `maintenance_requests`,
   `payments`, `invoices`, `messages`, and `notifications` directly via
   `supabase_flutter`, mirroring the shapes used by the Next.js API routes
   (`app/api/**/route.ts`) and `lib/types.ts`. I did not have access to the
   actual Supabase schema/RLS policies, so column names are taken on faith
   from those reference files. If any column name has drifted (e.g. a view
   migration since `API_SPEC.md` was written), the lenient `fromJson`
   parsers in `lib/models/models.dart` will silently fall back to defaults
   (`'—'`, `0`, `null`) rather than crash — which is the intended
   fail-soft behavior, but it means a schema mismatch shows up as "blank
   fields," not an error. Worth a manual check against the live schema.

6. **STK push amount rounding** — `payment_flow_provider.dart` sends
   `invoice.totalAmount.round()` as the M-Pesa amount (the Daraja API and
   the `/api/mpesa/stk-push` Zod schema both require an integer `amount`).
   If `total_amount` ever carries cents that matter, rounding could
   under/over-charge by a shilling; flagging in case partial-shilling
   invoices are a real scenario for this product.

7. **No tests added.** Given the no-build-verification constraint, I
   prioritized careful manual review over writing tests that couldn't be
   run. If you want a regression safety net, the parsers in `models.dart`
   and `PaymentFlowNotifier`'s state transitions are the two best places to
   start.

## What changed

New files:
- `lib/models/models.dart` — lean, defensively-parsed domain models
  (`TenantSummary`, `PropertySummary`, `UnitSummary`, `MaintenanceItem`,
  `PaymentRecord`, `InvoiceRecord`, `MessageItem`, `NotificationItem`).
- `lib/services/api_exception.dart`, `kodara_service.dart`,
  `payments_api.dart` — Supabase data access + the M-Pesa STK push HTTP
  client (calls the existing Next.js `/api/mpesa/stk-push` route, since
  Daraja credentials must stay server-side).
- `lib/providers/core_providers.dart`, `tenant_providers.dart`,
  `landlord_providers.dart`, `payment_flow_provider.dart` — Riverpod
  `AsyncNotifier`/`StateNotifier` providers with refresh/retry built in.
- `lib/widgets/async_state_view.dart`, `status_badge.dart`,
  `refreshable_async_list.dart`, `formatters.dart`, `payment_sheet.dart`,
  `maintenance_request_sheet.dart` — shared loading/empty/error UX, a
  status pill matching the web app's badge variants, pull-to-refresh
  wiring, and the two main bottom-sheet flows.

Rewritten:
- `lib/screens/tenant_portal.dart` — Home (balance + M-Pesa STK push +
  recent activity), Repairs (list + create + status tracking), Messages
  (list + compose) tabs via `NavigationBar`.
- `lib/screens/landlord_dashboard.dart` — Portfolio (stats + properties/units
  + recent payments), Tenants (searchable directory with rent status),
  Maintenance (triage board with status updates) tabs.

Unchanged (as of the feature-parity pass above): `lib/main.dart`, `lib/config.dart`, `lib/screens/auth_screen.dart`.

Modified: `pubspec.yaml` — added `http: ^1.2.0`.

## Design system pass (docs/DESIGN_SYSTEM.md)

A follow-up pass implemented the shared web+mobile design system:

- New `lib/theme/kodara_theme.dart` — single source of truth for color,
  typography, spacing, radius, shadow, and motion tokens, translated 1:1
  from `docs/DESIGN_SYSTEM.md`. Exposes `KodaraColors`, `KodaraSpacing`,
  `KodaraRadius`, `KodaraShadows`, `KodaraMotion`, `KodaraTypography`, a
  `KodaraThemeExtension`, and `buildKodaraTheme()`.
- `lib/main.dart` **was** modified in this pass — it now imports
  `theme/kodara_theme.dart` and sets `theme: buildKodaraTheme()` instead of
  the old `ColorScheme.fromSeed(...)` call.
- `lib/screens/auth_screen.dart` **was** modified in this pass — it now
  references `KodaraColors`/`KodaraSpacing`/`KodaraRadius` instead of
  hardcoded values.
- Every screen/widget in `lib/screens/` and `lib/widgets/` was swept for
  hardcoded `Color(0x...)` literals; all now reference `KodaraColors`. A
  repo-wide grep for `Color(0x` outside `theme/kodara_theme.dart` returns no
  matches.
- Same no-build-verification caveat applies: this was reviewed by eye,
  not compiled. Run `flutter analyze` locally before trusting it.
