import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../providers/providers.dart';
import '../services/api_exception.dart';
import '../theme/kodara_theme.dart';
import '../widgets/async_state_view.dart';
import '../widgets/formatters.dart';
import '../widgets/kodara_frame.dart';
import '../widgets/kodara_logo.dart';
import '../widgets/maintenance_request_sheet.dart';
import '../widgets/payment_sheet.dart';
import '../widgets/status_badge.dart';

/// Bottom padding that keeps scrolling content clear of the floating dock.
const double _dockClearance = 120;

/// Phone-first tenant workspace. Editorial composition: one featured ink
/// surface per screen, de-boxed lists separated by hairlines, uppercase
/// eyebrow section labels, and a floating pill dock for navigation.
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
      extendBody: true,
      appBar: AppBar(
        titleSpacing: 0,
        title: KodaraFrame(
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: KodaraSpacing.space5),
            child: Align(
              alignment: Alignment.centerLeft,
              child: _selectedIndex == 0
                  ? const KodaraLockup()
                  : Text(_titles[_selectedIndex]),
            ),
          ),
        ),
      ),
      body: KodaraFrame(
        child: tenancyAsync.when(
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
      ),
      bottomNavigationBar: tenancy == null
          ? null
          : _FloatingDock(
              selectedIndex: _selectedIndex,
              onSelect: _selectTab,
            ),
    );
  }
}

/// Floating pill navigation — the one piece of chrome that makes the app
/// unmistakably Kodara instead of stock Material.
class _FloatingDock extends StatelessWidget {
  const _FloatingDock({required this.selectedIndex, required this.onSelect});

  final int selectedIndex;
  final ValueChanged<int> onSelect;

  static const _items = [
    (Icons.home_outlined, Icons.home_rounded, 'Home'),
    (Icons.receipt_long_outlined, Icons.receipt_long_rounded, 'Payments'),
    (Icons.build_outlined, Icons.build_rounded, 'Repairs'),
    (Icons.person_outline_rounded, Icons.person_rounded, 'Account'),
  ];

  @override
  Widget build(BuildContext context) {
    final kodara = context.kodara;
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(
        KodaraSpacing.space5,
        0,
        KodaraSpacing.space5,
        KodaraSpacing.space4,
      ),
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Container(
            height: 64,
            decoration: BoxDecoration(
              color: kodara.surface,
              borderRadius: BorderRadius.circular(KodaraRadius.full),
              border: Border.all(color: kodara.border),
              boxShadow: KodaraShadows.modal,
            ),
            child: Row(
              children: [
                for (var i = 0; i < _items.length; i++)
                  Expanded(
                    child: _DockItem(
                      icon: _items[i].$1,
                      selectedIcon: _items[i].$2,
                      label: _items[i].$3,
                      selected: i == selectedIndex,
                      onTap: () => onSelect(i),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DockItem extends StatelessWidget {
  const _DockItem({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final kodara = context.kodara;
    final color = selected ? kodara.accent : kodara.textSecondary;
    return InkWell(
      onTap: onTap,
      customBorder: const StadiumBorder(),
      child: AnimatedContainer(
        duration: KodaraMotion.base,
        curve: KodaraMotion.easeStandard,
        margin: const EdgeInsets.all(KodaraSpacing.space2),
        decoration: BoxDecoration(
          color: selected ? kodara.accentTint : Colors.transparent,
          borderRadius: BorderRadius.circular(KodaraRadius.full),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(selected ? selectedIcon : icon, size: 22, color: color),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
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
                style: Theme.of(context).textTheme.displayMedium,
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
                        _DetailRow(
                          label: 'Rent due',
                          value: 'Day ${invitation.billingDay} every month',
                        ),
                        const _HairLine(),
                        _DetailRow(
                          label: 'Lease starts',
                          value: formatDate(invitation.startDate),
                        ),
                        const _HairLine(),
                        _DetailRow(
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

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balanceAsync = ref.watch(balanceProvider(tenancy.id));
    final paymentsAsync = ref.watch(paymentsStreamProvider(tenancy.id));
    final maintenanceAsync = ref.watch(maintenanceStreamProvider(tenancy.id));
    final balance = balanceAsync.valueOrNull;
    final payments = paymentsAsync.valueOrNull ?? const <Payment>[];
    final requests =
        maintenanceAsync.valueOrNull ?? const <MaintenanceRequest>[];
    final user = ref.watch(currentUserProvider);
    final firstName = (user?.userMetadata?['full_name']?.toString() ?? '')
        .trim()
        .split(RegExp(r'\s+'))
        .first;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(balanceProvider(tenancy.id));
        ref.invalidate(activeTenancyProvider);
        await ref.read(balanceProvider(tenancy.id).future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          KodaraSpacing.space5,
          KodaraSpacing.space4,
          KodaraSpacing.space5,
          _dockClearance,
        ),
        children: [
          Text(
            [
              tenancy.propertyName ?? 'Your home',
              if ((tenancy.unitName ?? '').isNotEmpty)
                'Unit ${tenancy.unitName}',
            ].join(' · ').toUpperCase(),
            style: KodaraTypography.eyebrow.copyWith(
              color: context.kodara.textSecondary,
            ),
          ),
          const SizedBox(height: KodaraSpacing.space2),
          Text(
            firstName.isEmpty ? _greeting() : '${_greeting()}, $firstName',
            style: Theme.of(context).textTheme.displayMedium,
          ),
          const SizedBox(height: KodaraSpacing.space5),
          _BalanceCard(tenancy: tenancy, balance: balance),
          const SizedBox(height: KodaraSpacing.space5),
          _StatRow(
            leftLabel: 'MONTHLY RENT',
            leftValue: formatKes(tenancy.rentAmount),
            rightLabel: 'NEXT DUE',
            rightValue: formatDate(tenancy.nextDueDate),
          ),
          const SizedBox(height: KodaraSpacing.space6),
          _SectionHeader(
            title: 'LATEST PAYMENT',
            actionLabel: 'See all',
            onAction: onOpenPayments,
          ),
          if (paymentsAsync.isLoading)
            const LoadingSkeleton()
          else if (payments.isEmpty)
            const _QuietNote(
                message: 'Confirmed M-Pesa payments will appear here.')
          else
            _PaymentRow(payment: payments.first),
          const SizedBox(height: KodaraSpacing.space5),
          _SectionHeader(
            title: 'REPAIRS',
            actionLabel: 'View all',
            onAction: onOpenRepairs,
          ),
          if (maintenanceAsync.isLoading)
            const LoadingSkeleton()
          else if (requests.isEmpty)
            const _QuietNote(
                message: 'No repair requests. Your home is all clear.')
          else
            _RepairRow(request: requests.first),
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
      padding: const EdgeInsets.all(KodaraSpacing.space6),
      decoration: BoxDecoration(
        color: context.kodara.ink,
        borderRadius: BorderRadius.circular(28),
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
    final due = balance?.balance ?? tenancy.rentAmount;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(balanceProvider(tenancy.id));
        await ref.read(balanceProvider(tenancy.id).future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          KodaraSpacing.space5,
          KodaraSpacing.space4,
          KodaraSpacing.space5,
          _dockClearance,
        ),
        children: [
          Text(
            due > 0
                ? '${formatKes(due)} is currently due.'
                : 'Your account is paid up. You can still pay rent early.',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: KodaraSpacing.space4),
          FilledButton.icon(
            onPressed: () {
              HapticFeedback.lightImpact();
              PaymentSheet.show(
                context,
                tenancy: tenancy,
                suggestedAmount: due > 0 ? due : tenancy.rentAmount,
              );
            },
            icon: const Icon(Icons.phone_android_rounded, size: 19),
            label: const Text('Send M-Pesa prompt'),
          ),
          const SizedBox(height: KodaraSpacing.space6),
          const _Eyebrow('PAYMENT HISTORY'),
          const SizedBox(height: KodaraSpacing.space2),
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
                      for (var i = 0; i < payments.length; i++) ...[
                        if (i > 0) const _HairLine(),
                        _PaymentRow(payment: payments[i]),
                      ],
                    ],
                  ),
          ),
        ],
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
          KodaraSpacing.space4,
          KodaraSpacing.space5,
          _dockClearance,
        ),
        children: [
          Text(
            'Something needs attention?',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: KodaraSpacing.space2),
          Text(
            'Send details and photos straight to your landlord and track the fix here.',
            style: TextStyle(color: context.kodara.textSecondary),
          ),
          const SizedBox(height: KodaraSpacing.space4),
          FilledButton.icon(
            onPressed: reportIssue,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Report a repair'),
          ),
          const SizedBox(height: KodaraSpacing.space6),
          const _Eyebrow('YOUR REQUESTS'),
          const SizedBox(height: KodaraSpacing.space2),
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
                      for (var i = 0; i < requests.length; i++) ...[
                        if (i > 0) const _HairLine(),
                        _RepairRow(request: requests[i]),
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
        KodaraSpacing.space4,
        KodaraSpacing.space5,
        _dockClearance,
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
                shape: BoxShape.circle,
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
        const _Eyebrow('YOUR LEASE'),
        const SizedBox(height: KodaraSpacing.space2),
        _DetailRow(label: 'Property', value: tenancy.propertyName ?? '—'),
        const _HairLine(),
        _DetailRow(label: 'Unit', value: tenancy.unitName ?? '—'),
        const _HairLine(),
        _DetailRow(
          label: 'Address',
          value: tenancy.propertyAddress ?? '—',
        ),
        const _HairLine(),
        _DetailRow(label: 'Monthly rent', value: formatKes(tenancy.rentAmount)),
        const _HairLine(),
        _DetailRow(label: 'Rent due', value: 'Day ${tenancy.billingDay}'),
        const _HairLine(),
        _DetailRow(
            label: 'Lease started', value: formatDate(tenancy.startDate)),
        const _HairLine(),
        InkWell(
          onTap: copyReference,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space3),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Payment reference',
                        style: TextStyle(color: context.kodara.textSecondary),
                      ),
                      const SizedBox(height: KodaraSpacing.space1),
                      Text(
                        tenancy.paymentReference,
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                    ],
                  ),
                ),
                Icon(Icons.copy_rounded,
                    size: 18, color: context.kodara.textSecondary),
              ],
            ),
          ),
        ),
        const SizedBox(height: KodaraSpacing.space8),
        Center(
          child: TextButton.icon(
            style: TextButton.styleFrom(
              foregroundColor: context.kodara.error,
            ),
            onPressed: () => ref.read(kodaraServiceProvider).signOut(),
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: const Text('Sign out'),
          ),
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

/// Two stats separated by a vertical hairline — no boxes, just typography.
class _StatRow extends StatelessWidget {
  const _StatRow({
    required this.leftLabel,
    required this.leftValue,
    required this.rightLabel,
    required this.rightValue,
  });

  final String leftLabel;
  final String leftValue;
  final String rightLabel;
  final String rightValue;

  @override
  Widget build(BuildContext context) {
    Widget stat(String label, String value) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Eyebrow(label),
            const SizedBox(height: KodaraSpacing.space2),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
          ],
        );

    return Row(
      children: [
        Expanded(child: stat(leftLabel, leftValue)),
        Container(
          width: 1,
          height: 44,
          color: context.kodara.border,
          margin: const EdgeInsets.symmetric(horizontal: KodaraSpacing.space5),
        ),
        Expanded(child: stat(rightLabel, rightValue)),
      ],
    );
  }
}

class _Eyebrow extends StatelessWidget {
  const _Eyebrow(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: KodaraTypography.eyebrow.copyWith(
        color: context.kodara.textSecondary,
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
        Expanded(child: _Eyebrow(title)),
        TextButton(
          style: TextButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: const Size(0, 32),
            textStyle: const TextStyle(
              fontFamily: kodaraFontFamily,
              fontSize: KodaraTypography.sm,
              fontWeight: FontWeight.w600,
            ),
          ),
          onPressed: onAction,
          child: Text(actionLabel),
        ),
      ],
    );
  }
}

/// De-boxed payment row: amount leads, receipt and date support, a quiet
/// status dot closes the line.
class _PaymentRow extends StatelessWidget {
  const _PaymentRow({required this.payment});

  final Payment payment;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space3),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  formatKes(payment.amount),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
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
          const SizedBox(width: KodaraSpacing.space3),
          StatusDot(payment.status),
        ],
      ),
    );
  }
}

class _RepairRow extends StatelessWidget {
  const _RepairRow({required this.request});

  final MaintenanceRequest request;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space3),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  request.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: KodaraSpacing.space1),
                Text(
                  '${formatDate(request.createdAt)} · ${statusLabelOf(request.priority)} priority'
                  '${request.photoPaths.isNotEmpty ? ' · ${request.photoPaths.length} photo${request.photoPaths.length == 1 ? '' : 's'}' : ''}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: KodaraSpacing.space3),
          StatusDot(request.status),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space3),
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

class _HairLine extends StatelessWidget {
  const _HairLine();

  @override
  Widget build(BuildContext context) {
    return Divider(height: 1, thickness: 1, color: context.kodara.border);
  }
}

class _QuietNote extends StatelessWidget {
  const _QuietNote({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space3),
      child: Text(
        message,
        style: TextStyle(color: context.kodara.textSecondary),
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
