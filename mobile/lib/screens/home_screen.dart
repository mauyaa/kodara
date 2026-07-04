import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../providers/providers.dart';
import '../services/api_exception.dart';
import '../theme/kodara_theme.dart';
import '../widgets/async_state_view.dart';
import '../widgets/formatters.dart';
import '../widgets/maintenance_request_sheet.dart';
import '../widgets/payment_sheet.dart';
import '../widgets/status_badge.dart';

/// Tenant home: current balance and due date, one-tap M-Pesa payment,
/// recent payments, and maintenance — all live via Realtime.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tenancyAsync = ref.watch(activeTenancyProvider);

    return Scaffold(
      backgroundColor: KodaraColors.background,
      appBar: AppBar(
        title: const Text('Kodara'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => ref.read(kodaraServiceProvider).signOut(),
          ),
        ],
      ),
      body: tenancyAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => AsyncStateView(
          loading: false,
          error: error,
          onRetry: () => ref.invalidate(activeTenancyProvider),
        ),
        data: (tenancy) => tenancy == null
            ? _InvitationGate(
                onAccepted: () => ref.invalidate(activeTenancyProvider))
            : _TenantHome(tenancy: tenancy),
      ),
    );
  }
}

/// Shown when the signed-in tenant has no active tenancy: lists pending
/// invitations addressed to their phone and lets them accept one.
class _InvitationGate extends ConsumerStatefulWidget {
  const _InvitationGate({required this.onAccepted});

  final VoidCallback onAccepted;

  @override
  ConsumerState<_InvitationGate> createState() => _InvitationGateState();
}

class _InvitationGateState extends ConsumerState<_InvitationGate> {
  bool _busy = false;
  String? _error;

  Future<void> _accept(TenantInvitation invitation) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(kodaraServiceProvider).acceptInvitation(invitation.id);
      widget.onAccepted();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final invitationsAsync = ref.watch(pendingInvitationsProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(pendingInvitationsProvider);
        await ref.read(pendingInvitationsProvider.future);
      },
      child: invitationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => AsyncStateView(
          loading: false,
          error: error,
          onRetry: () => ref.invalidate(pendingInvitationsProvider),
        ),
        data: (invitations) {
          if (invitations.isEmpty) {
            return ListView(
              children: const [
                EmptyState(
                  icon: Icons.mail_outline_rounded,
                  title: 'No invitation yet',
                  message:
                      'Ask your landlord to invite the phone number you signed up '
                      'with, then pull down to refresh.',
                ),
              ],
            );
          }
          return ListView(
            padding: const EdgeInsets.all(KodaraSpacing.space5),
            children: [
              Text('Your lease invitation',
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: KodaraSpacing.space4),
              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(KodaraSpacing.space3),
                  decoration: BoxDecoration(
                    color: KodaraColors.errorTint,
                    borderRadius: BorderRadius.circular(KodaraRadius.md),
                  ),
                  child: Text(_error!,
                      style: const TextStyle(color: KodaraColors.error)),
                ),
                const SizedBox(height: KodaraSpacing.space4),
              ],
              for (final invitation in invitations)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(KodaraSpacing.space4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${formatKes(invitation.rentAmount)} / month',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: KodaraSpacing.space1),
                        Text(
                          'Rent due day ${invitation.billingDay} of each month · '
                          'starts ${formatDate(invitation.startDate)}',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: KodaraColors.textSecondary),
                        ),
                        const SizedBox(height: KodaraSpacing.space4),
                        FilledButton(
                          onPressed: _busy ? null : () => _accept(invitation),
                          child: _busy
                              ? const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2))
                              : const Text('Accept lease'),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _TenantHome extends ConsumerWidget {
  const _TenantHome({required this.tenancy});

  final Tenancy tenancy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balanceAsync = ref.watch(balanceProvider(tenancy.id));
    final paymentsAsync = ref.watch(paymentsStreamProvider(tenancy.id));
    final maintenanceAsync = ref.watch(maintenanceStreamProvider(tenancy.id));
    final balance = balanceAsync.valueOrNull;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(balanceProvider(tenancy.id));
        ref.invalidate(activeTenancyProvider);
      },
      child: ListView(
        padding: const EdgeInsets.all(KodaraSpacing.space5),
        children: [
          // --- Balance card -------------------------------------------------
          Container(
            padding: const EdgeInsets.all(KodaraSpacing.space5),
            decoration: BoxDecoration(
              color: KodaraColors.ink,
              borderRadius: BorderRadius.circular(KodaraRadius.xl),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${tenancy.propertyName ?? 'Your home'} · Unit ${tenancy.unitName ?? ''}',
                  style: const TextStyle(color: KodaraColors.onInkSecondary),
                ),
                const SizedBox(height: KodaraSpacing.space3),
                Text(
                  balance == null ? '—' : formatKes(balance.balance),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: KodaraTypography.hero,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: KodaraSpacing.space1),
                Text(
                  balance != null && balance.balance <= 0
                      ? 'You are up to date. Next rent due ${formatDate(tenancy.nextDueDate)}.'
                      : 'Balance due · next due date ${formatDate(tenancy.nextDueDate)}',
                  style: const TextStyle(color: KodaraColors.onInkMuted),
                ),
                const SizedBox(height: KodaraSpacing.space5),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: KodaraColors.accent,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: () => PaymentSheet.show(
                      context,
                      tenancy: tenancy,
                      suggestedAmount: balance != null && balance.balance > 0
                          ? balance.balance
                          : tenancy.rentAmount,
                    ),
                    child: const Text('Pay with M-Pesa'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: KodaraSpacing.space6),

          // --- Recent payments ----------------------------------------------
          Text('Payments',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: KodaraSpacing.space3),
          paymentsAsync.when(
            loading: () => const LoadingSkeleton(),
            error: (error, _) => AsyncStateView(
              loading: false,
              error: error,
              onRetry: () => ref.invalidate(paymentsStreamProvider(tenancy.id)),
            ),
            data: (payments) => payments.isEmpty
                ? const EmptyState(
                    icon: Icons.receipt_long_rounded,
                    title: 'No payments yet',
                    message: 'Your confirmed M-Pesa payments will appear here.',
                  )
                : Column(
                    children: [
                      for (final payment in payments.take(5))
                        Card(
                          child: ListTile(
                            title: Text(formatKes(payment.amount),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                            subtitle: Text(
                              '${payment.providerTransactionId ?? '—'} · ${formatDate(payment.paidAt ?? payment.createdAt)}',
                            ),
                            trailing: StatusBadge(payment.status),
                          ),
                        ),
                    ],
                  ),
          ),
          const SizedBox(height: KodaraSpacing.space6),

          // --- Maintenance ---------------------------------------------------
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Maintenance',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
              TextButton.icon(
                onPressed: () => MaintenanceRequestSheet.show(context,
                    tenancyId: tenancy.id),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Report issue'),
              ),
            ],
          ),
          const SizedBox(height: KodaraSpacing.space2),
          maintenanceAsync.when(
            loading: () => const LoadingSkeleton(),
            error: (error, _) => AsyncStateView(
              loading: false,
              error: error,
              onRetry: () =>
                  ref.invalidate(maintenanceStreamProvider(tenancy.id)),
            ),
            data: (requests) => requests.isEmpty
                ? const EmptyState(
                    icon: Icons.build_rounded,
                    title: 'No open issues',
                    message:
                        'Report a problem in your unit and track its progress here.',
                  )
                : Column(
                    children: [
                      for (final request in requests)
                        Card(
                          child: ListTile(
                            title: Text(request.title,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                            subtitle: Text(
                              '${formatDate(request.createdAt)} · priority ${request.priority}'
                              '${request.photoPaths.isNotEmpty ? ' · ${request.photoPaths.length} photo(s)' : ''}',
                            ),
                            trailing: StatusBadge(request.status),
                          ),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
