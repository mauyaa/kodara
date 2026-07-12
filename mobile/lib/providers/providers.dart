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

/// Every unit the signed-in tenant currently rents (usually one, but the
/// data model allows more).
final activeTenanciesProvider = FutureProvider<List<Tenancy>>((ref) {
  ref.watch(currentUserProvider);
  return ref.watch(kodaraServiceProvider).fetchActiveTenancies();
});

/// Which tenancy is currently shown in the UI. Null means "no explicit
/// choice yet" -- [activeTenancyProvider] then defaults to the first one.
final selectedTenancyIdProvider = StateProvider<String?>((ref) => null);

/// The tenant's current active tenancy, resolved against
/// [selectedTenancyIdProvider]. Kept as a single value (rather than exposing
/// the list everywhere) so screens that only ever cared about "the" active
/// tenancy don't need to change -- a unit switcher only needs to appear
/// where multiple tenancies actually exist.
final activeTenancyProvider = Provider<AsyncValue<Tenancy?>>((ref) {
  final tenanciesAsync = ref.watch(activeTenanciesProvider);
  final selectedId = ref.watch(selectedTenancyIdProvider);
  return tenanciesAsync.whenData((tenancies) {
    if (tenancies.isEmpty) return null;
    if (selectedId == null) return tenancies.first;
    return tenancies.firstWhere(
      (t) => t.id == selectedId,
      orElse: () => tenancies.first,
    );
  });
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

/// Realtime conversation with the landlord for one tenancy.
final messagesStreamProvider = StreamProvider.family<List<ChatMessage>, String>(
    (ref, tenancyId) => ref.watch(kodaraServiceProvider).watchMessages(tenancyId));
