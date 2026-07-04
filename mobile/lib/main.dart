import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config.dart';
import 'providers/providers.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'theme/kodara_theme.dart';
import 'widgets/async_state_view.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (isSupabaseConfigured) {
    await Supabase.initialize(
      url: supabaseUrl,
      publishableKey: supabaseAnonKey,
    );
  }
  runApp(const ProviderScope(child: KodaraApp()));
}

class KodaraApp extends ConsumerWidget {
  const KodaraApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'Kodara',
      debugShowCheckedModeBanner: false,
      theme: buildKodaraTheme(),
      home: isSupabaseConfigured
          ? const _AuthGate()
          : const Scaffold(body: NotConfiguredNotice()),
    );
  }
}

/// Session-driven root: the Supabase auth stream decides which tree renders,
/// so sign-in, sign-out, and token refresh all route correctly with no
/// imperative navigation.
class _AuthGate extends ConsumerWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(authStateProvider);
    final user = ref.watch(currentUserProvider);
    return user == null ? const AuthScreen() : const HomeScreen();
  }
}
