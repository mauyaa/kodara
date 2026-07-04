# Kodara tenant app verification

Verified on 2026-07-03 with Flutter 3.44.4 and Dart 3.12.2:

- `flutter analyze`: no issues.
- `flutter test`: 5 tests passed.
- Supabase phone/password signup and SMS OTP APIs compile against the current
  SDK.

Run the gate with:

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
flutter run \
  --dart-define=SUPABASE_URL=https://<project>.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<publishable-key>
```

For Android against local Supabase, replace the URL with
`http://10.0.2.2:54321` and use the local publishable/anon key.

## Covered flows

- Current balance and due date from `tenancy_balances`.
- Idempotent M-Pesa STK initiation and live attempt completion, including the
  explicit `uncertain` terminal state.
- Maintenance creation, private photo upload, and live status changes.
- Confirmed payment history and phone-matched invitation acceptance.

RLS is the access-control boundary; the app contains no client-authoritative
role checks. Landlord mobile features remain outside v1 scope.

## Device checklist

1. Configure a hosted Supabase SMS provider and sign up with an invited Kenyan
   phone number.
2. Verify the SMS OTP and accept the invitation.
3. Initiate M-Pesa and confirm callback completion without manual refresh.
4. Submit maintenance with a photo; change status in the web dashboard and
   confirm the badge changes live.
5. Kill and reopen the app during a pending attempt and verify safe recovery.

The remaining checklist is physical-device dependent. A hosted SMS provider
and real Safaricom line are not present in this workspace.
