import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../providers/providers.dart';
import '../services/api_exception.dart';
import '../theme/kodara_theme.dart';
import '../widgets/async_state_view.dart';
import '../widgets/formatters.dart';
import '../widgets/kodara_logo.dart';
import '../widgets/maintenance_request_sheet.dart';
import '../widgets/payment_sheet.dart';
import '../widgets/status_badge.dart';

/// Phone-first tenant workspace with focused tabs for the tasks tenants repeat:
/// checking rent, paying, following repairs, and managing their lease details.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _selectedIndex = 0;

  static const _titles = ['Home', 'Payments', 'Repairs', 'Account'];

  void _selectTab(int index) {
    if (index == _selectedIndex) return;
    HapticFeedback.selectionClick();
    setState(() => _selectedIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final tenancyAsync = ref.watch(activeTenancyProvider);
    final tenancy = tenancyAsync.valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: _selectedIndex == 0
            ? const KodaraLockup()
            : Text(_titles[_selectedIndex]),
      ),
      body: tenancyAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => AsyncStateView(
          loading: false,
          error: error,
          onRetry: () => ref.invalidate(activeTenancyProvider),
        ),
        data: (value) => value == null
            ? _InvitationGate(
                onAccepted: () => ref.invalidate(activeTenancyProvider),
              )
            : IndexedStack(
                index: _selectedIndex,
                children: [
                  _OverviewTab(
                    tenancy: value,
                    onOpenPayments: () => _selectTab(1),
                    onOpenRepairs: () => _selectTab(2),
                  ),
                  _PaymentsTab(tenancy: value),
                  _RepairsTab(tenancy: value),
                  _AccountTab(tenancy: value),
                ],
              ),
      ),
      bottomNavigationBar: tenancy == null
          ? null
          : NavigationBar(
              selectedIndex: _selectedIndex,
              onDestinationSelected: _selectTab,
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home_rounded),
                  label: 'Home',
                ),
                NavigationDestination(
                  icon: Icon(Icons.receipt_long_outlined),
                  selectedIcon: Icon(Icons.receipt_long_rounded),
                  label: 'Payments',
                ),
                NavigationDestination(
                  icon: Icon(Icons.build_outlined),
                  selectedIcon: Icon(Icons.build_rounded),
                  label: 'Repairs',
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline_rounded),
                  selectedIcon: Icon(Icons.person_rounded),
                  label: 'Account',
                ),
              ],
            ),
    );
  }
}

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
    HapticFeedback.lightImpact();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(kodaraServiceProvider).acceptInvitation(invitation.id);
      HapticFeedback.mediumImpact();
      widget.onAccepted();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
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
                  icon: Icons.mark_email_unread_outlined,
                  title: 'Your invitation will appear here',
                  message:
                      'Ask your landlord to invite the phone number on your account, then pull down to refresh.',
                ),
              ],
            );
          }

          return ListView(
            padding: const EdgeInsets.all(KodaraSpacing.space5),
            children: [
              Text(
                'You have a new home',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: KodaraSpacing.space2),
              Text(
                'Review the lease summary and accept when you are ready.',
                style: TextStyle(color: context.kodara.textSecondary),
              ),
              const SizedBox(height: KodaraSpacing.space5),
              if (_error != null) ...[
                _InlineMessage(message: _error!, isError: true),
                const SizedBox(height: KodaraSpacing.space4),
              ],
              for (final invitation in invitations)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(KodaraSpacing.space5),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          formatKes(invitation.rentAmount),
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                        Text(
                          'per month',
                          style: TextStyle(
                            color: context.kodara.textSecondary,
                          ),
                        ),
                        const SizedBox(height: KodaraSpacing.space5),
                        _LeaseRow(
                          label: 'Rent due',
                          value: 'Day ${invitation.billingDay} every month',
                        ),
                        _LeaseRow(
                          label: 'Lease starts',
                          value: formatDate(invitation.startDate),
                        ),
                        _LeaseRow(
                          label: 'Invitation expires',
                          value: formatDate(invitation.expiresAt),
                        ),
                        const SizedBox(height: KodaraSpacing.space5),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _busy ? null : () => _accept(invitation),
                            child: _busy
                                ? const _ButtonLoader()
                                : const Text('Accept lease'),
                          ),
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

class _OverviewTab extends ConsumerWidget {
  const _OverviewTab({
    required this.tenancy,
    required this.onOpenPayments,
    required this.onOpenRepairs,
  });

  final Tenancy tenancy;
  final VoidCallback onOpenPayments;
  final VoidCallback onOpenRepairs;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balanceAsync = ref.watch(balanceProvider(tenancy.id));
    final paymentsAsync = ref.watch(paymentsStreamProvider(tenancy.id));
    final maintenanceAsync = ref.watch(maintenanceStreamProvider(tenancy.id));
    final balance = balanceAsync.valueOrNull;
    final payments = paymentsAsync.valueOrNull ?? const <Payment>[];
    final requests =
        maintenanceAsync.valueOrNull ?? const <MaintenanceRequest>[];

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(balanceProvider(tenancy.id));
        ref.invalidate(activeTenancyProvider);
        await ref.read(balanceProvider(tenancy.id).future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          KodaraSpacing.space5,
          KodaraSpacing.space3,
          KodaraSpacing.space5,
          KodaraSpacing.space6,
        ),
        children: [
          Text(
            tenancy.propertyName ?? 'Your home',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: KodaraSpacing.space1),
          Text(
            [
              if ((tenancy.unitName ?? '').isNotEmpty)
                'Unit ${tenancy.unitName}',
              if ((tenancy.propertyAddress ?? '').isNotEmpty)
                tenancy.propertyAddress!,
            ].join(' · '),
            style: TextStyle(color: context.kodara.textSecondary),
          ),
          const SizedBox(height: KodaraSpacing.space5),
          _BalanceCard(tenancy: tenancy, balance: balance),
          const SizedBox(height: KodaraSpacing.space5),
          Row(
            children: [
              Expanded(
                child: _MetricCard(
                  label: 'MONTHLY RENT',
                  value: formatKes(tenancy.rentAmount),
                  icon: Icons.calendar_month_rounded,
                ),
              ),
              const SizedBox(width: KodaraSpacing.space3),
              Expanded(
                child: _MetricCard(
                  label: 'NEXT DUE',
                  value: formatDate(tenancy.nextDueDate),
                  icon: Icons.event_available_rounded,
                ),
              ),
            ],
          ),
          const SizedBox(height: KodaraSpacing.space6),
          _SectionHeader(
            title: 'Latest payment',
            actionLabel: 'See all',
            onAction: onOpenPayments,
          ),
          const SizedBox(height: KodaraSpacing.space3),
          if (paymentsAsync.isLoading)
            const LoadingSkeleton()
          else if (payments.isEmpty)
            const _CompactEmptyState(
              icon: Icons.receipt_long_outlined,
              message: 'Confirmed M-Pesa payments will appear here.',
            )
          else
            _PaymentCard(payment: payments.first),
          const SizedBox(height: KodaraSpacing.space6),
          _SectionHeader(
            title: 'Repairs',
            actionLabel: 'View all',
            onAction: onOpenRepairs,
          ),
          const SizedBox(height: KodaraSpacing.space3),
          if (maintenanceAsync.isLoading)
            const LoadingSkeleton()
          else if (requests.isEmpty)
            const _CompactEmptyState(
              icon: Icons.home_repair_service_outlined,
              message: 'No repair requests. Your home is all clear.',
            )
          else
            _MaintenanceCard(request: requests.first),
        ],
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.tenancy, required this.balance});

  final Tenancy tenancy;
  final TenancyBalance? balance;

  @override
  Widget build(BuildContext context) {
    final amount = balance?.balance;
    final isPaid = amount != null && amount <= 0;

    return Container(
      padding: const EdgeInsets.all(KodaraSpacing.space5),
      decoration: BoxDecoration(
        color: context.kodara.ink,
        borderRadius: BorderRadius.circular(KodaraRadius.xl),
        boxShadow: KodaraShadows.accent,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isPaid ? 'ACCOUNT STATUS' : 'BALANCE DUE',
            style: KodaraTypography.eyebrow.copyWith(
              color: context.kodara.onInkSecondary,
            ),
          ),
          const SizedBox(height: KodaraSpacing.space3),
          AnimatedSwitcher(
            duration: KodaraMotion.base,
            switchInCurve: KodaraMotion.easeSpring,
            child: Text(
              amount == null
                  ? '—'
                  : isPaid
                      ? 'All paid up'
                      : formatKes(amount),
              key: ValueKey<String>(amount?.toString() ?? 'pending'),
              style: KodaraTypography.heroStyle,
            ),
          ),
          const SizedBox(height: KodaraSpacing.space2),
          Text(
            isPaid
                ? 'You are up to date. Next rent is due ${formatDate(tenancy.nextDueDate)}.'
                : 'Next rent date · ${formatDate(tenancy.nextDueDate)}',
            style: TextStyle(color: context.kodara.onInkMuted),
          ),
          const SizedBox(height: KodaraSpacing.space5),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: context.kodara.accent,
                foregroundColor: Colors.white,
              ),
              onPressed: () {
                HapticFeedback.lightImpact();
                PaymentSheet.show(
                  context,
                  tenancy: tenancy,
                  suggestedAmount: amount != null && amount > 0
                      ? amount
                      : tenancy.rentAmount,
                );
              },
              icon: const Icon(Icons.phone_android_rounded, size: 19),
              label: const Text('Pay with M-Pesa'),
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentsTab extends ConsumerWidget {
  const _PaymentsTab({required this.tenancy});

  final Tenancy tenancy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balance = ref.watch(balanceProvider(tenancy.id)).valueOrNull;
    final paymentsAsync = ref.watch(paymentsStreamProvider(tenancy.id));

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(balanceProvider(tenancy.id));
        await ref.read(balanceProvider(tenancy.id).future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          KodaraSpacing.space5,
          KodaraSpacing.space3,
          KodaraSpacing.space5,
          KodaraSpacing.space6,
        ),
        children: [
          _PaymentActionCard(tenancy: tenancy, balance: balance),
          const SizedBox(height: KodaraSpacing.space6),
          Text('Payment history',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: KodaraSpacing.space2),
          Text(
            'Receipts update automatically after M-Pesa confirms payment.',
            style: TextStyle(color: context.kodara.textSecondary),
          ),
          const SizedBox(height: KodaraSpacing.space4),
          paymentsAsync.when(
            loading: () => const LoadingSkeleton(),
            error: (error, _) => AsyncStateView(
              loading: false,
              error: error,
              onRetry: () => ref.invalidate(paymentsStreamProvider(tenancy.id)),
            ),
            data: (payments) => payments.isEmpty
                ? const EmptyState(
                    icon: Icons.receipt_long_outlined,
                    title: 'No payments yet',
                    message:
                        'Your confirmed M-Pesa receipts will be stored here.',
                  )
                : Column(
                    children: [
                      for (final payment in payments) ...[
                        _PaymentCard(payment: payment),
                        const SizedBox(height: KodaraSpacing.space3),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _PaymentActionCard extends StatelessWidget {
  const _PaymentActionCard({required this.tenancy, required this.balance});

  final Tenancy tenancy;
  final TenancyBalance? balance;

  @override
  Widget build(BuildContext context) {
    final due = balance?.balance ?? tenancy.rentAmount;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KodaraSpacing.space5),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Ready to pay?',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: KodaraSpacing.space2),
            Text(
              due > 0
                  ? '${formatKes(due)} is currently due.'
                  : 'Your account is paid up. You can still pay rent early.',
              style: TextStyle(color: context.kodara.textSecondary),
            ),
            const SizedBox(height: KodaraSpacing.space4),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => PaymentSheet.show(
                  context,
                  tenancy: tenancy,
                  suggestedAmount: due > 0 ? due : tenancy.rentAmount,
                ),
                icon: const Icon(Icons.phone_android_rounded, size: 19),
                label: const Text('Send M-Pesa prompt'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RepairsTab extends ConsumerWidget {
  const _RepairsTab({required this.tenancy});

  final Tenancy tenancy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requestsAsync = ref.watch(maintenanceStreamProvider(tenancy.id));

    Future<void> reportIssue() async {
      HapticFeedback.lightImpact();
      await MaintenanceRequestSheet.show(context, tenancyId: tenancy.id);
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(maintenanceStreamProvider(tenancy.id));
        await ref.read(maintenanceStreamProvider(tenancy.id).future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          KodaraSpacing.space5,
          KodaraSpacing.space3,
          KodaraSpacing.space5,
          KodaraSpacing.space6,
        ),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(KodaraSpacing.space5),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: context.kodara.accentTint,
                      borderRadius: BorderRadius.circular(KodaraRadius.md),
                    ),
                    child: Icon(
                      Icons.home_repair_service_rounded,
                      color: context.kodara.accent,
                    ),
                  ),
                  const SizedBox(width: KodaraSpacing.space4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Something needs attention?',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: KodaraSpacing.space1),
                        Text(
                          'Send details and photos to your landlord.',
                          style: TextStyle(
                            color: context.kodara.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: KodaraSpacing.space4),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: reportIssue,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Report a repair'),
            ),
          ),
          const SizedBox(height: KodaraSpacing.space6),
          Text('Your requests', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: KodaraSpacing.space4),
          requestsAsync.when(
            loading: () => const LoadingSkeleton(),
            error: (error, _) => AsyncStateView(
              loading: false,
              error: error,
              onRetry: () =>
                  ref.invalidate(maintenanceStreamProvider(tenancy.id)),
            ),
            data: (requests) => requests.isEmpty
                ? const EmptyState(
                    icon: Icons.check_circle_outline_rounded,
                    title: 'No open issues',
                    message:
                        'When you report a repair, its progress will appear here.',
                  )
                : Column(
                    children: [
                      for (final request in requests) ...[
                        _MaintenanceCard(request: request),
                        const SizedBox(height: KodaraSpacing.space3),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _AccountTab extends ConsumerWidget {
  const _AccountTab({required this.tenancy});

  final Tenancy tenancy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final fullName = user?.userMetadata?['full_name']?.toString();
    final phone = user?.phone;

    Future<void> copyReference() async {
      await Clipboard.setData(ClipboardData(text: tenancy.paymentReference));
      HapticFeedback.selectionClick();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payment reference copied')),
        );
      }
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        KodaraSpacing.space5,
        KodaraSpacing.space3,
        KodaraSpacing.space5,
        KodaraSpacing.space6,
      ),
      children: [
        Row(
          children: [
            Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: context.kodara.accentTint,
                borderRadius: BorderRadius.circular(KodaraRadius.lg),
              ),
              child: Text(
                _initials(fullName),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: context.kodara.accent,
                    ),
              ),
            ),
            const SizedBox(width: KodaraSpacing.space4),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    fullName?.isNotEmpty == true ? fullName! : 'Kodara tenant',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  if (phone?.isNotEmpty == true) ...[
                    const SizedBox(height: KodaraSpacing.space1),
                    Text(
                      phone!,
                      style: TextStyle(color: context.kodara.textSecondary),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: KodaraSpacing.space6),
        Text('Your lease', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: KodaraSpacing.space3),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(KodaraSpacing.space5),
            child: Column(
              children: [
                _LeaseRow(
                  label: 'Property',
                  value: tenancy.propertyName ?? '—',
                ),
                _LeaseRow(
                  label: 'Unit',
                  value: tenancy.unitName ?? '—',
                ),
                _LeaseRow(
                  label: 'Monthly rent',
                  value: formatKes(tenancy.rentAmount),
                ),
                _LeaseRow(
                  label: 'Rent due',
                  value: 'Day ${tenancy.billingDay}',
                ),
                _LeaseRow(
                  label: 'Lease started',
                  value: formatDate(tenancy.startDate),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: KodaraSpacing.space4),
        Card(
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: KodaraSpacing.space4,
              vertical: KodaraSpacing.space2,
            ),
            title: const Text('Payment reference'),
            subtitle: Text(tenancy.paymentReference),
            trailing: IconButton(
              tooltip: 'Copy payment reference',
              onPressed: copyReference,
              icon: const Icon(Icons.copy_rounded),
            ),
          ),
        ),
        const SizedBox(height: KodaraSpacing.space6),
        OutlinedButton.icon(
          onPressed: () => ref.read(kodaraServiceProvider).signOut(),
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Sign out'),
        ),
      ],
    );
  }

  String _initials(String? name) {
    final words = (name ?? '').trim().split(RegExp(r'\s+'));
    final initials = words
        .where((word) => word.isNotEmpty)
        .take(2)
        .map((word) => word[0].toUpperCase())
        .join();
    return initials.isEmpty ? 'KT' : initials;
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KodaraSpacing.space4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: context.kodara.accent),
            const SizedBox(height: KodaraSpacing.space3),
            Text(
              label,
              style: KodaraTypography.eyebrow.copyWith(
                color: context.kodara.textSecondary,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: KodaraSpacing.space1),
            Text(
              value,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.actionLabel,
    required this.onAction,
  });

  final String title;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
        TextButton(onPressed: onAction, child: Text(actionLabel)),
      ],
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({required this.payment});

  final Payment payment;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KodaraSpacing.space4),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: context.kodara.successTint,
                borderRadius: BorderRadius.circular(KodaraRadius.md),
              ),
              child: Icon(
                Icons.south_west_rounded,
                color: context.kodara.success,
              ),
            ),
            const SizedBox(width: KodaraSpacing.space3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    formatKes(payment.amount),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: KodaraSpacing.space1),
                  Text(
                    '${payment.providerTransactionId ?? 'M-Pesa'} · ${formatDate(payment.paidAt ?? payment.createdAt)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const SizedBox(width: KodaraSpacing.space2),
            StatusBadge(payment.status),
          ],
        ),
      ),
    );
  }
}

class _MaintenanceCard extends StatelessWidget {
  const _MaintenanceCard({required this.request});

  final MaintenanceRequest request;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KodaraSpacing.space4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    request.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const SizedBox(width: KodaraSpacing.space3),
                StatusBadge(request.status),
              ],
            ),
            const SizedBox(height: KodaraSpacing.space2),
            Text(
              '${formatDate(request.createdAt)} · ${_titleCase(request.priority)} priority'
              '${request.photoPaths.isNotEmpty ? ' · ${request.photoPaths.length} photo${request.photoPaths.length == 1 ? '' : 's'}' : ''}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _LeaseRow extends StatelessWidget {
  const _LeaseRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: context.kodara.textSecondary),
            ),
          ),
          const SizedBox(width: KodaraSpacing.space4),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: Theme.of(context).textTheme.labelLarge,
            ),
          ),
        ],
      ),
    );
  }
}

class _CompactEmptyState extends StatelessWidget {
  const _CompactEmptyState({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KodaraSpacing.space4),
      decoration: BoxDecoration(
        color: context.kodara.surface,
        border: Border.all(color: context.kodara.border),
        borderRadius: BorderRadius.circular(KodaraRadius.lg),
      ),
      child: Row(
        children: [
          Icon(icon, color: context.kodara.textSecondary),
          const SizedBox(width: KodaraSpacing.space3),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: context.kodara.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

class _InlineMessage extends StatelessWidget {
  const _InlineMessage({required this.message, required this.isError});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KodaraSpacing.space3),
      decoration: BoxDecoration(
        color: isError ? context.kodara.errorTint : context.kodara.accentTint,
        borderRadius: BorderRadius.circular(KodaraRadius.md),
      ),
      child: Text(
        message,
        style: TextStyle(
          color: isError ? context.kodara.error : context.kodara.accent,
        ),
      ),
    );
  }
}

class _ButtonLoader extends StatelessWidget {
  const _ButtonLoader();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 18,
      height: 18,
      child: CircularProgressIndicator(strokeWidth: 2),
    );
  }
}

String _titleCase(String value) {
  if (value.isEmpty) return value;
  final normalized = value.replaceAll('_', ' ');
  return '${normalized[0].toUpperCase()}${normalized.substring(1)}';
}
