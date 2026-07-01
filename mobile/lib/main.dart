import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';
import 'screens/auth_screen.dart';
import 'screens/landlord_dashboard.dart';
import 'screens/tenant_portal.dart';
import 'theme/kodara_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (isSupabaseConfigured) await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
  runApp(const ProviderScope(child: KodaraApp()));
}

final routerProvider = Provider<GoRouter>((ref) => GoRouter(initialLocation: '/', routes: [
  GoRoute(path: '/', builder: (context, state) => const AuthScreen()),
  GoRoute(path: '/landlord', builder: (context, state) => const LandlordDashboard()),
  GoRoute(path: '/tenant', builder: (context, state) => const TenantPortal()),
]));

class KodaraApp extends ConsumerWidget {
  const KodaraApp({super.key});
  @override Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: 'Kodara', debugShowCheckedModeBanner: false, routerConfig: ref.watch(routerProvider),
    theme: buildKodaraTheme(),
  );
}
