import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config.dart';
import '../models/models.dart';
import '../providers/core_providers.dart';
import '../providers/tenant_providers.dart';
import '../theme/kodara_theme.dart';
import '../widgets/async_state_view.dart';
import '../widgets/formatters.dart';
import '../widgets/maintenance_request_sheet.dart';
import '../widgets/payment_sheet.dart';
import '../widgets/refreshable_async_list.dart';
import '../widgets/status_badge.dart';

class TenantPortal extends ConsumerStatefulWidget {
  const TenantPortal({super.key});

  @override
  ConsumerState<TenantPortal> createState() => _TenantPortalState();
}

class _TenantPortalState extends ConsumerState<TenantPortal> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    if (!isSupabaseConfigured) {
      return Scaffold(
        appBar: AppBar(title: const Text('Kodara')),
        body: const SingleChildScrollView(child: NotConfiguredNotice()),
      );
    }

    final pages = [
      const _TenantHomeTab(),
      const _TenantRepairsTab(),
      const _TenantMessagesTab(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kodara'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () async {
              final client = ref.read(supabaseClientProvider);
              await client?.auth.signOut();
              if (context.mounted) context.go('/');
            },
          ),
        ],
      ),
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (value) => setState(() => _tab = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_rounded), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.build_rounded), label: 'Repairs'),
          NavigationDestination(icon: Icon(Icons.message_rounded), label: 'Messages'),
        ],
      ),
    );
  }
}

class _TenantHomeTab extends ConsumerWidget {
  const _TenantHomeTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeAsync = ref.watch(tenantHomeProvider);

    return RefreshableAsyncList<TenantHomeData?>(
      value: homeAsync,
      onRefresh: () => ref.read(tenantHomeProvider.notifier).refresh(),
      builder: (context, data) {
        if (data == null) {
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: const [
              EmptyState(
                icon: Icons.home_outlined,
                title: 'No tenant profile found',
                message: 'We could not find a tenancy linked to your account yet.',
              ),
            ],
          );
        }
        final tenant = data.tenant;
        final invoice = data.outstandingInvoice;
        final balance = invoice?.totalAmount ?? tenant.outstandingBalance;
        final hasBalance = balance > 0;

        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(KodaraSpacing.space4),
          children: [
            Text(
              'Your home',
              style: const TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary, letterSpacing: 1),
            ),
            const SizedBox(height: KodaraSpacing.space1),
            Text(tenant.propertyName, style: Theme.of(context).textTheme.headlineSmall),
            Text('Unit ${tenant.unitName}', style: const TextStyle(color: KodaraColors.accentDark)),
            const SizedBox(height: KodaraSpacing.space5),
            // The tenant balance card is the ONE featured surface + ONE
            // hero number on this screen (principle 1: Isolation, principle
            // 5: Golden Ratio). Ink surface + accent-tinted shadow set it
            // apart from every other card on the page.
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(KodaraSpacing.space5),
              decoration: BoxDecoration(
                color: KodaraColors.ink,
                borderRadius: BorderRadius.circular(KodaraRadius.lg),
                boxShadow: KodaraShadows.accent,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'CURRENT BALANCE',
                    style: TextStyle(color: KodaraColors.onInkMuted, fontSize: KodaraTypography.xs, letterSpacing: 1.2),
                  ),
                  const SizedBox(height: KodaraSpacing.space2),
                  Text(formatKes(balance), style: KodaraTypography.heroStyle),
                  const SizedBox(height: KodaraSpacing.space2),
                  Text(
                    invoice?.dueDate != null ? 'Due ${formatDate(invoice!.dueDate)}' : 'No invoice due',
                    style: TextStyle(color: KodaraColors.onInkSecondary, fontSize: KodaraTypography.sm),
                  ),
                  const SizedBox(height: KodaraSpacing.space4),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: KodaraColors.ink,
                      ),
                      onPressed: !hasBalance || invoice == null
                          ? null
                          : () => showPaymentSheet(context, tenant: tenant, invoice: invoice),
                      icon: const Icon(Icons.phone_iphone_rounded, size: 18),
                      label: Text(
                        !hasBalance
                            ? 'Rent paid in full'
                            : invoice == null
                                ? 'No invoice to pay yet'
                                : 'Pay with M-Pesa',
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: KodaraSpacing.space4),
            Row(
              children: [
                Expanded(
                  child: _MetricCard(
                    label: 'Open repairs',
                    value: data.recentMaintenance
                        .where((m) => m.status != 'completed')
                        .length
                        .toString(),
                    helper: 'Live updates',
                  ),
                ),
                const SizedBox(width: KodaraSpacing.space3),
                Expanded(
                  child: _MetricCard(
                    label: 'Last payment',
                    value: tenant.lastPaymentDate != null ? formatDate(tenant.lastPaymentDate) : '—',
                    helper: 'M-Pesa',
                  ),
                ),
              ],
            ),
            const SizedBox(height: KodaraSpacing.space6),
            Text('Recent activity', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: KodaraSpacing.space3),
            if (data.recentMaintenance.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space3),
                child: Text('No maintenance activity yet.', style: TextStyle(color: KodaraColors.textSecondary)),
              )
            else
              ...data.recentMaintenance.map((item) => _ActivityTile(item: item)),
          ],
        );
      },
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.value, required this.helper});
  final String label;
  final String value;
  final String helper;

  @override
  Widget build(BuildContext context) {
    // Neutral tones — the balance card above is the one accent-carrying
    // surface on this screen (principle 2: The Accent), so these supporting
    // metric cards stay desaturated.
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KodaraSpacing.space3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary)),
            const SizedBox(height: KodaraSpacing.space2),
            Text(value, style: const TextStyle(fontSize: KodaraTypography.lg, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(helper, style: const TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.item});
  final MaintenanceItem item;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KodaraSpacing.space3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CircleAvatar(
              backgroundColor: KodaraColors.accentTintStrong,
              child: Icon(Icons.build_rounded, color: KodaraColors.accentDark, size: 18),
            ),
            const SizedBox(width: KodaraSpacing.space3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: KodaraTypography.sm),
                        ),
                      ),
                      StatusBadge(item.status),
                    ],
                  ),
                  const SizedBox(height: KodaraSpacing.space1),
                  Text(
                    item.description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TenantRepairsTab extends ConsumerWidget {
  const _TenantRepairsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final maintenanceAsync = ref.watch(tenantMaintenanceProvider);

    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.fromLTRB(
          KodaraSpacing.space4,
          KodaraSpacing.space4,
          KodaraSpacing.space4,
          0,
        ),
        child: RefreshableAsyncList<List<MaintenanceItem>>(
          value: maintenanceAsync,
          onRefresh: () => ref.read(tenantMaintenanceProvider.notifier).refresh(),
          builder: (context, items) {
            if (items.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  EmptyState(
                    icon: Icons.build_outlined,
                    title: 'No repair requests yet',
                    message: 'Report an issue and your property manager will be notified.',
                  ),
                ],
              );
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: KodaraSpacing.space3),
              itemBuilder: (context, index) {
                final item = items[index];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(KodaraSpacing.space3),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                            ),
                            StatusBadge(item.status),
                          ],
                        ),
                        const SizedBox(height: KodaraSpacing.space2),
                        Text(item.description, style: const TextStyle(color: KodaraColors.textPrimary)),
                        const SizedBox(height: KodaraSpacing.space3),
                        Row(
                          children: [
                            const Icon(Icons.check_circle_outline_rounded, size: 14, color: KodaraColors.textSecondary),
                            const SizedBox(width: KodaraSpacing.space2),
                            Text(
                              'Updated ${formatDate(item.updatedAt ?? item.createdAt)}',
                              style: const TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showMaintenanceRequestSheet(context),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New request'),
      ),
    );
  }
}

class _TenantMessagesTab extends ConsumerWidget {
  const _TenantMessagesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messagesAsync = ref.watch(tenantMessagesProvider);

    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.fromLTRB(
          KodaraSpacing.space4,
          KodaraSpacing.space4,
          KodaraSpacing.space4,
          0,
        ),
        child: Column(
          children: [
            Expanded(
              child: RefreshableAsyncList<List<MessageItem>>(
                value: messagesAsync,
                onRefresh: () => ref.read(tenantMessagesProvider.notifier).refresh(),
                builder: (context, items) {
                  if (items.isEmpty) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        EmptyState(
                          icon: Icons.message_outlined,
                          title: 'No messages yet',
                          message: 'Conversations with your property manager will appear here.',
                        ),
                      ],
                    );
                  }
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: KodaraSpacing.space3),
                    itemBuilder: (context, index) {
                      final message = items[index];
                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: KodaraColors.ink,
                            child: Text(
                              message.senderName.isNotEmpty ? message.senderName[0] : '?',
                              style: const TextStyle(color: Colors.white),
                            ),
                          ),
                          title: Text(message.senderName, style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(message.content, maxLines: 2, overflow: TextOverflow.ellipsis),
                          trailing: !message.read
                              ? const CircleAvatar(radius: 4, backgroundColor: KodaraColors.accentDark)
                              : null,
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space3),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _composeMessage(context, ref),
                  icon: const Icon(Icons.send_rounded, size: 16),
                  label: const Text('Message property manager'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _composeMessage(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('New message'),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 5,
          decoration: const InputDecoration(hintText: 'Write a message…'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text.trim()),
            child: const Text('Send'),
          ),
        ],
      ),
    );
    if (result == null || result.isEmpty || !context.mounted) return;
    try {
      await ref.read(tenantMessagesProvider.notifier).sendToPropertyManager(result);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Message sent')));
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not send your message. Please try again.')),
        );
      }
    }
  }
}
