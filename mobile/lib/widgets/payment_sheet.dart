import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../providers/payment_flow_provider.dart';
import '../theme/kodara_theme.dart';
import 'formatters.dart';

/// Bottom sheet driving the M-Pesa STK push flow end to end: confirm amount
/// -> sending prompt -> waiting for the phone confirmation -> success or
/// failure. This is the single highest-value mobile interaction per the
/// product brief, so it gets a dedicated, carefully sequenced UX rather than
/// a single button + snackbar.
Future<void> showPaymentSheet(
  BuildContext context, {
  required TenantSummary tenant,
  required InvoiceRecord invoice,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    isDismissible: true,
    enableDrag: false,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(KodaraRadius.xl)),
    ),
    builder: (_) => PaymentSheetContent(tenant: tenant, invoice: invoice),
  );
}

class PaymentSheetContent extends ConsumerWidget {
  const PaymentSheetContent({super.key, required this.tenant, required this.invoice});

  final TenantSummary tenant;
  final InvoiceRecord invoice;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final flow = ref.watch(paymentFlowProvider);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: KodaraSpacing.space5,
          right: KodaraSpacing.space5,
          top: KodaraSpacing.space5,
          bottom: MediaQuery.of(context).viewInsets.bottom + KodaraSpacing.space5,
        ),
        child: AnimatedSize(
          duration: KodaraMotion.slow,
          curve: KodaraMotion.easeSpring,
          child: _buildForStatus(context, ref, flow),
        ),
      ),
    );
  }

  Widget _buildForStatus(BuildContext context, WidgetRef ref, PaymentFlowState flow) {
    switch (flow.status) {
      case PaymentFlowStatus.idle:
        return _ConfirmStep(tenant: tenant, invoice: invoice);
      case PaymentFlowStatus.sendingPrompt:
        return const _LoadingStep(message: 'Sending the M-Pesa prompt…');
      case PaymentFlowStatus.waitingForConfirmation:
        return _WaitingStep(phone: tenant.phone);
      case PaymentFlowStatus.success:
        return _SuccessStep(amount: flow.amount ?? invoice.totalAmount, reference: flow.reference);
      case PaymentFlowStatus.failure:
        return _FailureStep(
          message: flow.errorMessage ?? 'The payment could not be completed.',
          onRetry: () {
            ref.read(paymentFlowProvider.notifier).reset();
          },
        );
    }
  }
}

class _ConfirmStep extends ConsumerWidget {
  const _ConfirmStep({required this.tenant, required this.invoice});
  final TenantSummary tenant;
  final InvoiceRecord invoice;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Confirm payment',
                style: TextStyle(fontSize: KodaraTypography.xl, fontWeight: FontWeight.w600),
              ),
            ),
            IconButton(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.close_rounded),
            ),
          ],
        ),
        const SizedBox(height: KodaraSpacing.space2),
        Container(
          padding: const EdgeInsets.all(KodaraSpacing.space5),
          decoration: BoxDecoration(
            color: KodaraColors.accentTint,
            borderRadius: BorderRadius.circular(KodaraRadius.lg),
          ),
          child: Column(
            children: [
              const Text('Amount', style: TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary)),
              const SizedBox(height: KodaraSpacing.space1),
              Text(
                formatKes(invoice.totalAmount),
                style: const TextStyle(
                  fontSize: KodaraTypography.display,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.5,
                  color: KodaraColors.textPrimary,
                ),
              ),
              const SizedBox(height: KodaraSpacing.space2),
              Text(
                'to ${tenant.propertyName}',
                style: const TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary),
              ),
            ],
          ),
        ),
        const SizedBox(height: KodaraSpacing.space5),
        FilledButton.icon(
          onPressed: () {
            ref.read(paymentFlowProvider.notifier).startPayment(tenant: tenant, invoice: invoice);
          },
          icon: const Icon(Icons.phone_iphone_rounded, size: 18),
          label: Text('Send prompt to ${tenant.phone}'),
        ),
        const SizedBox(height: KodaraSpacing.space3),
        const Text(
          'You will confirm securely with your M-Pesa PIN.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary),
        ),
      ],
    );
  }
}

class _LoadingStep extends StatelessWidget {
  const _LoadingStep({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: KodaraSpacing.space5),
          Text(message, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _WaitingStep extends StatelessWidget {
  const _WaitingStep({required this.phone});
  final String phone;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space5),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 56,
            height: 56,
            child: CircularProgressIndicator(strokeWidth: 4),
          ),
          const SizedBox(height: KodaraSpacing.space5),
          const Text(
            'Check your phone',
            style: TextStyle(fontSize: KodaraTypography.lg, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: KodaraSpacing.space2),
          Text(
            'Enter your M-Pesa PIN on $phone to complete the payment. This page will update automatically.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: KodaraColors.textSecondary),
          ),
          const SizedBox(height: KodaraSpacing.space5),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close — I will check my balance later'),
          ),
        ],
      ),
    );
  }
}

class _SuccessStep extends StatelessWidget {
  const _SuccessStep({required this.amount, required this.reference});
  final double amount;
  final String? reference;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: const BoxDecoration(color: KodaraColors.successTint, shape: BoxShape.circle),
          child: const Icon(Icons.check_rounded, color: KodaraColors.success, size: 32),
        ),
        const SizedBox(height: KodaraSpacing.space4),
        const Text(
          'Payment confirmed',
          style: TextStyle(fontSize: KodaraTypography.xl, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: KodaraSpacing.space2),
        Text(
          formatKes(amount),
          style: const TextStyle(fontSize: KodaraTypography.xxl, fontWeight: FontWeight.w700, color: KodaraColors.success),
        ),
        const SizedBox(height: KodaraSpacing.space1),
        Text(
          'M-Pesa · ${reference ?? 'Confirmed'}',
          style: const TextStyle(color: KodaraColors.textSecondary, fontSize: KodaraTypography.sm),
        ),
        const SizedBox(height: KodaraSpacing.space6),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Back home'),
          ),
        ),
      ],
    );
  }
}

class _FailureStep extends StatelessWidget {
  const _FailureStep({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: const BoxDecoration(color: KodaraColors.errorTint, shape: BoxShape.circle),
          child: const Icon(Icons.priority_high_rounded, color: KodaraColors.error, size: 32),
        ),
        const SizedBox(height: KodaraSpacing.space4),
        const Text(
          'Payment not completed',
          style: TextStyle(fontSize: KodaraTypography.lg, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: KodaraSpacing.space2),
        Text(message, textAlign: TextAlign.center, style: const TextStyle(color: KodaraColors.textSecondary)),
        const SizedBox(height: KodaraSpacing.space5),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Close'),
              ),
            ),
            const SizedBox(width: KodaraSpacing.space3),
            Expanded(
              child: FilledButton(
                onPressed: onRetry,
                child: const Text('Try again'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
