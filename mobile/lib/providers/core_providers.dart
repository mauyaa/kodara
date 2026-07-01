import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config.dart';
import '../services/kodara_service.dart';
import '../services/payments_api.dart';

/// Exposes the Supabase client only when configured; screens should always
/// check [isSupabaseConfigured] before reading this so we fail gracefully
/// (per the existing config.dart pattern) instead of throwing.
final supabaseClientProvider = Provider<SupabaseClient?>((ref) {
  if (!isSupabaseConfigured) return null;
  return Supabase.instance.client;
});

final kodaraServiceProvider = Provider<KodaraService?>((ref) {
  final client = ref.watch(supabaseClientProvider);
  if (client == null) return null;
  return KodaraService(client);
});

final paymentsApiProvider = Provider<PaymentsApi?>((ref) {
  final client = ref.watch(supabaseClientProvider);
  if (client == null) return null;
  return PaymentsApi(client);
});

/// Re-emits whenever Supabase auth state changes so dependent providers can
/// react to sign-in/sign-out without a manual refresh.
final authStateProvider = StreamProvider<AuthState>((ref) {
  final client = ref.watch(supabaseClientProvider);
  if (client == null) return const Stream.empty();
  return client.auth.onAuthStateChange;
});

final currentUserIdProvider = Provider<String?>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(supabaseClientProvider)?.auth.currentUser?.id;
});
