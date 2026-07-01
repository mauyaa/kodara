import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../services/api_exception.dart';
import '../services/kodara_service.dart';
import 'core_providers.dart';

enum PaymentFlowStatus { idle, sendingPrompt, waitingForConfirmation, success, failure }

class PaymentFlowState {
  final PaymentFlowStatus status;
  final double? amount;
  final String? reference;
  final String? errorMessage;

  const PaymentFlowState({
    this.status = PaymentFlowStatus.idle,
    this.amount,
    this.reference,
    this.errorMessage,
  });

  PaymentFlowState copyWith({
    PaymentFlowStatus? status,
    double? amount,
    String? reference,
    String? errorMessage,
  }) =>
      PaymentFlowState(
        status: status ?? this.status,
        amount: amount ?? this.amount,
        reference: reference ?? this.reference,
        errorMessage: errorMessage,
      );
}

/// Drives the M-Pesa STK push lifecycle: trigger the prompt, then watch the
/// `payments` row via Supabase Realtime until the async webhook
/// (app/api/mpesa/callback/route.ts) flips it to completed/failed. This is
/// the single highest-value interaction in the app, so it gets its own
/// state machine rather than being folded into general tenant data loading.
class PaymentFlowNotifier extends StateNotifier<PaymentFlowState> {
  PaymentFlowNotifier(this._ref) : super(const PaymentFlowState());

  final Ref _ref;
  StreamSubscription<PaymentRecord?>? _subscription;
  Timer? _timeoutTimer;

  Future<void> startPayment({
    required TenantSummary tenant,
    required InvoiceRecord invoice,
  }) async {
    final api = _ref.read(paymentsApiProvider);
    final service = _ref.read(kodaraServiceProvider);
    if (api == null || service == null) {
      state = const PaymentFlowState(
        status: PaymentFlowStatus.failure,
        errorMessage: 'This build is not connected to Kodara yet.',
      );
      return;
    }

    state = PaymentFlowState(
      status: PaymentFlowStatus.sendingPrompt,
      amount: invoice.totalAmount,
    );

    try {
      final result = await api.initiateStkPush(
        phone: tenant.phone,
        amount: invoice.totalAmount.round(),
        invoiceId: invoice.id,
      );
      state = state.copyWith(
        status: PaymentFlowStatus.waitingForConfirmation,
        reference: result.checkoutRequestId,
      );
      await _watchForConfirmation(service as KodaraService, tenant, invoice);
    } on ApiException catch (e) {
      state = state.copyWith(
        status: PaymentFlowStatus.failure,
        errorMessage: e.message,
      );
    } catch (_) {
      state = state.copyWith(
        status: PaymentFlowStatus.failure,
        errorMessage: 'Could not start the M-Pesa payment. Please try again.',
      );
    }
  }

  Future<void> _watchForConfirmation(
    KodaraService service,
    TenantSummary tenant,
    InvoiceRecord invoice,
  ) async {
    await _subscription?.cancel();
    _timeoutTimer?.cancel();

    // Find the just-created payment row by polling once, then subscribe to
    // its row for the realtime callback update. We poll briefly first
    // because the insert happens server-side milliseconds after the STK
    // response, so there is a tiny race on first read.
    String? paymentId;
    for (var attempt = 0; attempt < 5 && paymentId == null; attempt++) {
      await Future.delayed(Duration(milliseconds: 400 * (attempt + 1)));
      final List<PaymentRecord> payments =
          await service.fetchPaymentsForTenant(tenant.id);
      final match = payments.firstWhere(
            (p) => p.invoiceId == invoice.id && p.status != 'completed',
            orElse: () => payments.isNotEmpty
                ? payments.first
                : const PaymentRecord(
                    id: '',
                    invoiceId: null,
                    tenantId: '',
                    amount: 0,
                    status: 'initiated',
                    reference: null,
                    mpesaReceipt: null,
                    createdAt: null,
                    tenantName: null,
                  ),
          );
      if (match.id.isNotEmpty) paymentId = match.id;
    }

    if (paymentId == null) {
      // Could not locate the payment row yet; tenant can still complete the
      // prompt on their phone, but we can't track it live. Leave them in
      // the waiting state with guidance rather than a false failure.
      return;
    }

    _subscription = service.watchPayment(paymentId).listen(
      (PaymentRecord? payment) {
        if (payment == null) return;
        if (payment.status == 'completed') {
          state = state.copyWith(
            status: PaymentFlowStatus.success,
            reference: payment.mpesaReceipt ?? payment.reference,
          );
          _subscription?.cancel();
          _timeoutTimer?.cancel();
        } else if (payment.status == 'failed' || payment.status == 'cancelled') {
          state = state.copyWith(
            status: PaymentFlowStatus.failure,
            errorMessage: 'The M-Pesa payment was not completed.',
          );
          _subscription?.cancel();
          _timeoutTimer?.cancel();
        }
      },
      onError: (_) {
        // Realtime stream dropped (e.g. connectivity loss). Stay in the
        // waiting state — the tenant can pull-to-refresh the balance later
        // to see whether it landed.
      },
    );

    // Give up watching after 2 minutes so the UI doesn't spin forever; the
    // tenant can still check their balance afterwards via pull-to-refresh.
    _timeoutTimer = Timer(const Duration(minutes: 2), () {
      if (state.status == PaymentFlowStatus.waitingForConfirmation) {
        state = state.copyWith(
          status: PaymentFlowStatus.failure,
          errorMessage:
              "We haven't received confirmation yet. If you completed the prompt, pull to refresh — your balance will update once M-Pesa confirms.",
        );
      }
    });
  }

  void reset() {
    _subscription?.cancel();
    _timeoutTimer?.cancel();
    state = const PaymentFlowState();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _timeoutTimer?.cancel();
    super.dispose();
  }
}

final paymentFlowProvider =
    StateNotifierProvider.autoDispose<PaymentFlowNotifier, PaymentFlowState>(
  (ref) => PaymentFlowNotifier(ref),
);
