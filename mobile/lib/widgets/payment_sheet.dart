import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../providers/providers.dart';
import '../services/api_exception.dart';
import '../theme/kodara_theme.dart';
import 'formatters.dart';

/// One-tap M-Pesa payment flow:
///
///   confirm amount -> STK push -> "check your phone" -> live result.
///
/// The idempotency key is generated once when the sheet opens and reused for
/// every retry inside this sheet, so a dropped connection or an app restart
/// mid-flow can never double-charge: the Edge Function returns the existing
/// attempt for a repeated key instead of calling Daraja again.
class PaymentSheet extends ConsumerStatefulWidget {
  const PaymentSheet({
    super.key,
    required this.tenancy,
    required this.suggestedAmount,
    this.prefilledPhone,
  });

  final Tenancy tenancy;
  final double suggestedAmount;
  final String? prefilledPhone;

  static Future<void> show(
    BuildContext context, {
    required Tenancy tenancy,
    required double suggestedAmount,
    String? prefilledPhone,
  }) =>
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => Padding(
          padding:
              EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: PaymentSheet(
            tenancy: tenancy,
            suggestedAmount: suggestedAmount,
            prefilledPhone: prefilledPhone,
          ),
        ),
      );

  @override
  ConsumerState<PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends ConsumerState<PaymentSheet> {
  late final TextEditingController _amount;
  late final TextEditingController _phone;

  /// One key per payment intent (per sheet open). Survives retries.
  late final String _idempotencyKey;

  String? _attemptId;
  bool _busy = false;
  String? _error;

  static final _phonePattern = RegExp(r'^254[17][0-9]{8}$');

  @override
  void initState() {
    super.initState();
    _amount = TextEditingController(
        text: widget.suggestedAmount > 0
            ? widget.suggestedAmount.toStringAsFixed(0)
            : '');
    _phone = TextEditingController(text: widget.prefilledPhone ?? '');
    final rand = Random.secure();
    _idempotencyKey = List.generate(24, (_) => rand.nextInt(36))
        .map((n) => n.toRadixString(36))
        .join();
  }

  @override
  void dispose() {
    _amount.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _pay() async {
    final amount = int.tryParse(_amount.text.trim());
    final phone = _phone.text.trim();
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter a whole amount of at least KSh 1.');
      return;
    }
    if (!_phonePattern.hasMatch(phone)) {
      setState(() =>
          _error = 'Enter your M-Pesa number as 2547XXXXXXXX or 2541XXXXXXXX.');
      return;
    }

    HapticFeedback.lightImpact();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final attempt = await ref.read(kodaraServiceProvider).initiateStkPush(
            tenancyId: widget.tenancy.id,
            phone: phone,
            amount: amount,
            idempotencyKey: _idempotencyKey,
          );
      HapticFeedback.mediumImpact();
      if (mounted) setState(() => _attemptId = attempt.id);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(KodaraSpacing.space5),
      child: _attemptId == null ? _buildForm(context) : _buildProgress(context),
    );
  }

  Widget _buildForm(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Pay rent',
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: KodaraSpacing.space2),
        Text(
          '${widget.tenancy.propertyName ?? 'Your home'} — Unit ${widget.tenancy.unitName ?? ''}',
          style: Theme.of(context)
              .textTheme
              .bodyMedium
              ?.copyWith(color: context.kodara.textSecondary),
        ),
        const SizedBox(height: KodaraSpacing.space5),
        if (_error != null) ...[
          Container(
            padding: const EdgeInsets.all(KodaraSpacing.space3),
            decoration: BoxDecoration(
              color: context.kodara.errorTint,
              borderRadius: BorderRadius.circular(KodaraRadius.md),
            ),
            child: Text(_error!, style: TextStyle(color: context.kodara.error)),
          ),
          const SizedBox(height: KodaraSpacing.space4),
        ],
        TextField(
          controller: _amount,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Amount (KES)',
            prefixText: 'KES ',
          ),
        ),
        const SizedBox(height: KodaraSpacing.space4),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
            labelText: 'M-Pesa phone',
            hintText: '254712345678',
          ),
        ),
        const SizedBox(height: KodaraSpacing.space5),
        FilledButton(
          onPressed: _busy ? null : _pay,
          child: _busy
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Send M-Pesa prompt'),
        ),
        const SizedBox(height: KodaraSpacing.space3),
        Text(
          'You will get an M-Pesa prompt on your phone to confirm.',
          textAlign: TextAlign.center,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: context.kodara.textSecondary),
        ),
      ],
    );
  }

  Widget _buildProgress(BuildContext context) {
    final attemptAsync = ref.watch(attemptStreamProvider(_attemptId!));
    final attempt = attemptAsync.valueOrNull;

    final Widget body;
    if (attempt == null || !attempt.isTerminal) {
      body = Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: KodaraSpacing.space4),
          Text('Check your phone',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: KodaraSpacing.space2),
          Text(
            'Enter your M-Pesa PIN on the prompt to complete the payment. '
            'This screen updates automatically.',
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: context.kodara.textSecondary),
          ),
        ],
      );
    } else if (attempt.status == 'succeeded') {
      body = Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check_circle_rounded,
              color: context.kodara.success, size: 56),
          const SizedBox(height: KodaraSpacing.space4),
          Text('Payment received',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: KodaraSpacing.space2),
          Text(
            '${formatKes(attempt.requestedAmount)} confirmed. Thank you!',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: KodaraSpacing.space5),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Done'),
          ),
        ],
      );
    } else {
      body = Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_rounded, color: context.kodara.error, size: 56),
          const SizedBox(height: KodaraSpacing.space4),
          Text('Payment not completed',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: KodaraSpacing.space2),
          Text(
            attempt.resultDescription ??
                'The M-Pesa request was cancelled or timed out.',
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: context.kodara.textSecondary),
          ),
          const SizedBox(height: KodaraSpacing.space5),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space5),
      child: body,
    );
  }
}
