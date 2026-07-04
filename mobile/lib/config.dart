/// Build-time configuration, passed with --dart-define:
///
///   flutter run \
///     --dart-define=SUPABASE_URL=https://your-project.supabase.co \
///     --dart-define=SUPABASE_ANON_KEY=sb_publishable_...
///
/// For the local Supabase stack from an Android emulator use
/// http://10.0.2.2:54321 (the emulator's alias for the host machine).
const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

bool get isSupabaseConfigured =>
    (supabaseUrl.startsWith('https://') || supabaseUrl.startsWith('http://')) &&
    supabaseAnonKey.isNotEmpty;
