import 'package:flutter/foundation.dart' show setEquals;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/models.dart';
import '../services/kodara_service.dart';

final supabaseClientProvider =
    Provider<SupabaseClient>((ref) => Supabase.instance.client);

final kodaraServiceProvider = Provider<KodaraService>(
    (ref) => KodaraService(ref.watch(supabaseClientProvider)));

/// Auth session changes drive the root router: signed out -> auth screen,
/// signed in -> tenant home.
final authStateProvider = StreamProvider<AuthState>(
    (ref) => ref.watch(supabaseClientProvider).auth.onAuthStateChange);

final currentUserProvider = Provider<User?>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(supabaseClientProvider).auth.currentUser;
});

/// The tenant's active tenancy, or null when they have none yet.
final activeTenancyProvider = FutureProvider<Tenancy?>((ref) {
  ref.watch(currentUserProvider);
  return ref.watch(kodaraServiceProvider).fetchActiveTenancy();
});

/// Pending invitations for tenants who have no active tenancy yet.
final pendingInvitationsProvider = FutureProvider<List<TenantInvitation>>(
    (ref) => ref.watch(kodaraServiceProvider).fetchPendingInvitations());

final balanceProvider =
    FutureProvider.family<TenancyBalance?, String>((ref, tenancyId) {
  // Recompute when a payment actually lands (webhook landed), but only on a
  // real change to the set of payment ids — using ref.watch here instead
  // would reset this provider to loading on every emission from the payment
  // stream, including the harmless duplicate the realtime channel replays a
  // few seconds after its initial value, which left the balance stuck
  // re-loading indefinitely instead of ever settling.
  ref.listen(paymentsStreamProvider(tenancyId), (previous, next) {
    final previousIds = previous?.valueOrNull?.map((p) => p.id).toSet();
    final nextIds = next.valueOrNull?.map((p) => p.id).toSet();
    if (previousIds != null && nextIds != null && !setEquals(previousIds, nextIds)) {
      ref.invalidateSelf();
    }
  });
  return ref.watch(kodaraServiceProvider).fetchBalance(tenancyId);
});

/// Realtime confirmed payments for the tenancy.
final paymentsStreamProvider = StreamProvider.family<List<Payment>, String>(
    (ref, tenancyId) =>
        ref.watch(kodaraServiceProvider).watchPayments(tenancyId));

/// Realtime maintenance requests with live status changes.
final maintenanceStreamProvider =
    StreamProvider.family<List<MaintenanceRequest>, String>((ref, tenancyId) =>
        ref.watch(kodaraServiceProvider).watchMaintenance(tenancyId));

/// Realtime view of a single in-flight payment attempt.
final attemptStreamProvider = StreamProvider.family<PaymentAttempt?, String>(
    (ref, attemptId) =>
        ref.watch(kodaraServiceProvider).watchAttempt(attemptId));
