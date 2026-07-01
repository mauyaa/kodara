import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config.dart';
import '../theme/kodara_theme.dart';

class AuthScreen extends StatefulWidget { const AuthScreen({super.key}); @override State<AuthScreen> createState() => _AuthScreenState(); }

class _AuthScreenState extends State<AuthScreen> {
  final phone = TextEditingController(); final otp = TextEditingController();
  bool codeSent = false; bool loading = false; String? error;
  @override void dispose() { phone.dispose(); otp.dispose(); super.dispose(); }
  String normalizePhone(String value) { final digits = value.replaceAll(RegExp(r'\D'), ''); if (digits.startsWith('254')) return '+$digits'; if (digits.startsWith('0')) return '+254${digits.substring(1)}'; return '+254$digits'; }
  Future<void> sendOtp() async { setState(() { loading = true; error = null; }); try { await Supabase.instance.client.auth.signInWithOtp(phone: normalizePhone(phone.text)); if (mounted) setState(() => codeSent = true); } on AuthException catch (exception) { setState(() => error = exception.message); } finally { if (mounted) setState(() => loading = false); } }
  Future<void> verifyOtp() async { setState(() { loading = true; error = null; }); try { final response = await Supabase.instance.client.auth.verifyOTP(type: OtpType.sms, phone: normalizePhone(phone.text), token: otp.text.trim()); final user = response.user; if (user == null) throw const AuthException('Verification failed'); final profile = await Supabase.instance.client.from('profiles').select('role').eq('id', user.id).maybeSingle(); final role = profile?['role'] as String? ?? 'tenant'; if (mounted) context.go(role == 'tenant' ? '/tenant' : '/landlord'); } on AuthException catch (exception) { setState(() => error = exception.message); } finally { if (mounted) setState(() => loading = false); } }
  @override Widget build(BuildContext context) => Scaffold(body: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(KodaraSpacing.space5), child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Container(width: 52, height: 52, alignment: Alignment.center, decoration: BoxDecoration(color: KodaraColors.ink, borderRadius: BorderRadius.circular(KodaraRadius.lg)), child: const Icon(Icons.home_rounded, color: KodaraColors.accentTintStrong)),
    const SizedBox(height: KodaraSpacing.space5), Text('Welcome to Kodara', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)), const SizedBox(height: KodaraSpacing.space2), const Text('Your rent, repairs, messages, and documents—together.'), const SizedBox(height: KodaraSpacing.space6),
    if (!isSupabaseConfigured) ...[const Card(child: Padding(padding: EdgeInsets.all(KodaraSpacing.space4), child: Text('This build has no Supabase configuration. Provide SUPABASE_URL and SUPABASE_ANON_KEY with --dart-define.'))), const SizedBox(height: KodaraSpacing.space4), FilledButton(onPressed: () => context.go('/tenant'), child: const Text('Explore tenant preview'))]
    else if (!codeSent) ...[TextField(controller: phone, keyboardType: TextInputType.phone, autofillHints: const [AutofillHints.telephoneNumber], decoration: const InputDecoration(labelText: 'Mobile number', hintText: '0712 345 678')), const SizedBox(height: KodaraSpacing.space4), FilledButton(onPressed: loading ? null : sendOtp, child: Text(loading ? 'Sending…' : 'Send verification code'))]
    else ...[TextField(controller: otp, keyboardType: TextInputType.number, autofillHints: const [AutofillHints.oneTimeCode], maxLength: 6, decoration: const InputDecoration(labelText: '6-digit code')), const SizedBox(height: KodaraSpacing.space2), FilledButton(onPressed: loading ? null : verifyOtp, child: Text(loading ? 'Verifying…' : 'Verify and continue')), TextButton(onPressed: () => setState(() => codeSent = false), child: const Text('Use a different number'))],
    if (error != null) Padding(padding: const EdgeInsets.only(top: KodaraSpacing.space3), child: Text(error!, style: const TextStyle(color: KodaraColors.error))),
  ]))))));
}
