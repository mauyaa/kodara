import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config.dart';
import '../providers/providers.dart';
import '../services/api_exception.dart';
import '../theme/kodara_theme.dart';
import '../widgets/async_state_view.dart';
import '../widgets/kodara_logo.dart';

/// Phone + password authentication. New tenants must confirm the SMS OTP
/// before invitation rows become visible under database RLS.
class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _fullName = TextEditingController();
  final _phone = TextEditingController();
  final _otp = TextEditingController();

  bool _isSignUp = false;
  bool _awaitingOtp = false;
  bool _busy = false;
  String? _error;

  static final _phonePattern = RegExp(r'^254[17][0-9]{8}$');

  @override
  void dispose() {
    _password.dispose();
    _fullName.dispose();
    _phone.dispose();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    HapticFeedback.lightImpact();
    setState(() {
      _busy = true;
      _error = null;
    });

    final service = ref.read(kodaraServiceProvider);
    try {
      if (_awaitingOtp) {
        await service.verifyPhone(
          phone: _phone.text.trim(),
          token: _otp.text.trim(),
        );
      } else if (_isSignUp) {
        await service.signUp(
          password: _password.text,
          fullName: _fullName.text.trim(),
          phone: _phone.text.trim(),
        );
        if (mounted) setState(() => _awaitingOtp = true);
      } else {
        await service.signIn(
          phone: _phone.text.trim(),
          password: _password.text,
        );
      }
      // Navigation happens via the auth state stream in main.dart.
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!isSupabaseConfigured) {
      return const Scaffold(body: NotConfiguredNotice());
    }

    final heading = _awaitingOtp
        ? 'Confirm your phone number'
        : _isSignUp
            ? 'Create your tenant account'
            : 'Welcome back';

    return Scaffold(
      backgroundColor: KodaraColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(KodaraSpacing.space5),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(
                      child: KodaraLogo(size: 56, color: KodaraColors.ink),
                    ),
                    const SizedBox(height: KodaraSpacing.space3),
                    Text(
                      'Kodara',
                      textAlign: TextAlign.center,
                      style: Theme.of(context)
                          .textTheme
                          .headlineMedium
                          ?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.4,
                          ),
                    ),
                    const SizedBox(height: KodaraSpacing.space2),
                    Text(
                      heading,
                      textAlign: TextAlign.center,
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(color: KodaraColors.textSecondary),
                    ),
                    const SizedBox(height: KodaraSpacing.space6),
                    if (_error != null) ...[
                      Container(
                        padding: const EdgeInsets.all(KodaraSpacing.space3),
                        decoration: BoxDecoration(
                          color: KodaraColors.errorTint,
                          borderRadius: BorderRadius.circular(KodaraRadius.md),
                        ),
                        child: Text(
                          _error!,
                          style: const TextStyle(color: KodaraColors.error),
                        ),
                      ),
                      const SizedBox(height: KodaraSpacing.space4),
                    ],
                    if (_isSignUp && !_awaitingOtp) ...[
                      TextFormField(
                        controller: _fullName,
                        textCapitalization: TextCapitalization.words,
                        decoration:
                            const InputDecoration(labelText: 'Full name'),
                        validator: (value) =>
                            (value == null || value.trim().length < 2)
                                ? 'Enter your full name'
                                : null,
                      ),
                      const SizedBox(height: KodaraSpacing.space4),
                    ],
                    TextFormField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      readOnly: _awaitingOtp,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      decoration: const InputDecoration(
                        labelText: 'M-Pesa phone number',
                        hintText: '254712345678',
                        helperText: 'Use the number your landlord invited.',
                      ),
                      validator: (value) =>
                          _phonePattern.hasMatch(value?.trim() ?? '')
                              ? null
                              : 'Format: 2547XXXXXXXX or 2541XXXXXXXX',
                    ),
                    const SizedBox(height: KodaraSpacing.space4),
                    if (_awaitingOtp)
                      TextFormField(
                        controller: _otp,
                        keyboardType: TextInputType.number,
                        autofillHints: const [AutofillHints.oneTimeCode],
                        decoration: const InputDecoration(
                          labelText: '6-digit SMS code',
                        ),
                        validator: (value) =>
                            RegExp(r'^\d{6}$').hasMatch(value ?? '')
                                ? null
                                : 'Enter the 6-digit code',
                      )
                    else
                      TextFormField(
                        controller: _password,
                        obscureText: true,
                        autofillHints: const [AutofillHints.password],
                        decoration:
                            const InputDecoration(labelText: 'Password'),
                        validator: (value) =>
                            (value != null && value.length >= 8)
                                ? null
                                : 'At least 8 characters',
                      ),
                    const SizedBox(height: KodaraSpacing.space6),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(
                              _awaitingOtp
                                  ? 'Confirm phone'
                                  : _isSignUp
                                      ? 'Create account'
                                      : 'Sign in',
                            ),
                    ),
                    const SizedBox(height: KodaraSpacing.space4),
                    if (_awaitingOtp)
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() {
                                  _awaitingOtp = false;
                                  _otp.clear();
                                  _error = null;
                                }),
                        child: const Text('Use a different number'),
                      )
                    else
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => setState(() {
                                  _isSignUp = !_isSignUp;
                                  _error = null;
                                }),
                        child: Text(
                          _isSignUp
                              ? 'Already have an account? Sign in'
                              : 'New tenant? Create an account',
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
