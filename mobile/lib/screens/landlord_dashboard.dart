import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config.dart';
import '../models/models.dart';
import '../providers/core_providers.dart';
import '../providers/landlord_providers.dart';
import '../theme/kodara_theme.dart';
import '../widgets/async_state_view.dart';
import '../widgets/formatters.dart';
import '../widgets/refreshable_async_list.dart';
import '../widgets/status_badge.dart';

class LandlordDashboard extends ConsumerStatefulWidget {
  const LandlordDashboard({super.key});

  @override
  ConsumerState<LandlordDashboard> createState() => _LandlordDashboardState();
}

class _LandlordDashboardState extends ConsumerState<LandlordDashboard> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    if (!isSupabaseConfigured) {
      return Scaffold(
        appBar: AppBar(title: const Text('Kodara · Portfolio')),
        body: const SingleChildScrollView(child: NotConfiguredNotice()),
      );
    }

    final pages = const [
      _PortfolioTab(),
      _TenantsTab(),
      _MaintenanceTab(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kodara · Portfolio'),
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
          NavigationDestination(icon: Icon(Icons.dashboard_rounded), label: 'Portfolio'),
          NavigationDestination(icon: Icon(Icons.people_rounded), label: 'Tenants'),
          NavigationDestination(icon: Icon(Icons.build_rounded), label: 'Maintenance'),
        ],
      ),
    );
  }
}

class _PortfolioTab extends ConsumerWidget {
  const _PortfolioTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final portfolioAsync = ref.watch(portfolioProvider);

    return RefreshableAsyncList<PortfolioSnapshot?>(
      value: portfolioAsync,
      onRefresh: () => ref.read(portfolioProvider.notifier).refresh(),
      builder: (context, snapshot) {
        if (snapshot == null) {
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: const [
              EmptyState(
                icon: Icons.apartment_outlined,
                title: 'No portfolio data',
                message: 'Properties you manage will appear here once connected.',
              ),
            ],
          );
        }
        final occupancy = snapshot.totalUnits == 0
            ? 0
            : ((snapshot.occupiedUnits / snapshot.totalUnits) * 100).round();

        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(KodaraSpacing.space4),
          children: [
            Text('Good morning', style: TextStyle(color: KodaraColors.textSecondary, fontSize: KodaraTypography.sm)),
            const SizedBox(height: KodaraSpacing.space1),
            Text("Today's overview", style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: KodaraSpacing.space5),
            // Headline stat card — the ONE hero number on this screen
            // (outstanding total is the most actionable figure for a
            // landlord). Real breathing room + accent shadow signal that
            // this is the featured surface, per principle 1 (Isolation).
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
                    'OUTSTANDING BALANCE',
                    style: TextStyle(color: KodaraColors.onInkMuted, fontSize: KodaraTypography.xs, letterSpacing: 1.2),
                  ),
                  const SizedBox(height: KodaraSpacing.space2),
                  Text(formatKes(snapshot.outstandingTotal), style: KodaraTypography.heroStyle),
                  const SizedBox(height: KodaraSpacing.space1),
                  Text(
                    'Across ${snapshot.totalUnits} unit${snapshot.totalUnits == 1 ? '' : 's'}',
                    style: TextStyle(color: KodaraColors.onInkSecondary, fontSize: KodaraTypography.sm),
                  ),
                ],
              ),
            ),
            const SizedBox(height: KodaraSpacing.space4),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: KodaraSpacing.space3,
              crossAxisSpacing: KodaraSpacing.space3,
              childAspectRatio: 1.1,
              children: [
                _StatCard(
                  label: 'Occupancy',
                  value: '$occupancy%',
                  icon: Icons.apartment_rounded,
                ),
                _StatCard(
                  label: 'Units',
                  value: '${snapshot.occupiedUnits}/${snapshot.totalUnits}',
                  icon: Icons.door_front_door_rounded,
                ),
                _StatCard(
                  label: 'Open maintenance',
                  value: snapshot.openMaintenance.length.toString(),
                  icon: Icons.build_rounded,
                ),
              ],
            ),
            const SizedBox(height: KodaraSpacing.space6),
            Text('Properties', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: KodaraSpacing.space3),
            if (snapshot.properties.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space3),
                child: Text('No properties yet.', style: TextStyle(color: KodaraColors.textSecondary)),
              )
            else
              ...snapshot.properties.map((property) => _PropertyCard(property: property)),
            const SizedBox(height: KodaraSpacing.space6),
            Text('Recent payments', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: KodaraSpacing.space3),
            if (snapshot.recentPayments.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space3),
                child: Text('No payments recorded yet.', style: TextStyle(color: KodaraColors.textSecondary)),
              )
            else
              ...snapshot.recentPayments.map((payment) => Card(
                    margin: const EdgeInsets.only(bottom: KodaraSpacing.space2),
                    child: ListTile(
                      title: Text(payment.tenantName ?? 'Tenant'),
                      subtitle: Text(formatDate(payment.createdAt)),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(formatKes(payment.amount), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: KodaraTypography.base)),
                          const SizedBox(height: KodaraSpacing.space1),
                          StatusBadge(payment.status),
                        ],
                      ),
                    ),
                  )),
          ],
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value, required this.icon});
  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    // Neutral icon tone — the hero balance card above already carries the
    // accent color, so these supporting stats stay desaturated per
    // principle 2 (The Accent): only one element gets to be green.
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KodaraSpacing.space3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary),
                    maxLines: 2,
                  ),
                ),
                Icon(icon, size: 16, color: KodaraColors.textSecondary),
              ],
            ),
            const Spacer(),
            Text(value, style: const TextStyle(fontSize: KodaraTypography.lg, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

class _PropertyCard extends StatelessWidget {
  const _PropertyCard({required this.property});
  final PropertySummary property;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ExpansionTile(
        title: Text(property.name, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text('${property.occupiedCount}/${property.units.length} occupied · ${property.address}'),
        children: property.units.isEmpty
            ? [
                Padding(
                  padding: const EdgeInsets.all(KodaraSpacing.space4),
                  child: Text('No units added yet.', style: TextStyle(color: KodaraColors.textSecondary)),
                ),
              ]
            : property.units
                .map((unit) => ListTile(
                      dense: true,
                      title: Text(unit.unitName),
                      subtitle: Text(formatKes(unit.monthlyRent)),
                      trailing: StatusBadge(unit.status),
                    ))
                .toList(),
      ),
    );
  }
}

class _TenantsTab extends ConsumerStatefulWidget {
  const _TenantsTab();

  @override
  ConsumerState<_TenantsTab> createState() => _TenantsTabState();
}

class _TenantsTabState extends ConsumerState<_TenantsTab> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final portfolioAsync = ref.watch(portfolioProvider);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        KodaraSpacing.space4,
        KodaraSpacing.space4,
        KodaraSpacing.space4,
        0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search_rounded),
              hintText: 'Search tenants, phone, or property',
            ),
            onChanged: (value) => setState(() => _query = value.toLowerCase()),
          ),
          const SizedBox(height: KodaraSpacing.space3),
          Expanded(
            child: RefreshableAsyncList<PortfolioSnapshot?>(
              value: portfolioAsync,
              onRefresh: () => ref.read(portfolioProvider.notifier).refresh(),
              builder: (context, snapshot) {
                final tenants = (snapshot?.tenants ?? const <TenantSummary>[])
                    .where((t) =>
                        _query.isEmpty ||
                        '${t.fullName} ${t.phone} ${t.propertyName}'.toLowerCase().contains(_query))
                    .toList();
                if (tenants.isEmpty) {
                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      EmptyState(
                        icon: Icons.people_outline_rounded,
                        title: 'No tenants found',
                        message: 'Tenants you manage will appear here.',
                      ),
                    ],
                  );
                }
                return ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  itemCount: tenants.length,
                  separatorBuilder: (_, __) => const SizedBox(height: KodaraSpacing.space2),
                  itemBuilder: (context, index) {
                    final tenant = tenants[index];
                    final hasBalance = tenant.outstandingBalance > 0;
                    return Card(
                      child: ListTile(
                        title: Text(tenant.fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('${tenant.propertyName} · Unit ${tenant.unitName}\n${tenant.phone}'),
                        isThreeLine: true,
                        trailing: Text(
                          hasBalance ? formatKes(tenant.outstandingBalance) : 'Paid',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: hasBalance ? KodaraColors.warning : KodaraColors.success,
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _MaintenanceTab extends ConsumerWidget {
  const _MaintenanceTab();

  static const _groups = [
    {'label': 'New', 'statuses': ['submitted', 'in_review']},
    {'label': 'In progress', 'statuses': ['approved', 'assigned', 'in_progress']},
    {'label': 'Completed', 'statuses': ['completed']},
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final maintenanceAsync = ref.watch(landlordMaintenanceProvider);

    return Padding(
      padding: const EdgeInsets.all(KodaraSpacing.space4),
      child: RefreshableAsyncList<List<MaintenanceItem>>(
        value: maintenanceAsync,
        onRefresh: () => ref.read(landlordMaintenanceProvider.notifier).refresh(),
        builder: (context, items) {
          if (items.isEmpty) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const [
                EmptyState(
                  icon: Icons.build_outlined,
                  title: 'No maintenance requests',
                  message: 'Tenant repair requests will show up here for triage.',
                ),
              ],
            );
          }
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              for (final group in _groups) ...[
                _MaintenanceGroupHeader(
                  label: group['label'] as String,
                  count: items
                      .where((i) => (group['statuses'] as List<String>).contains(i.status))
                      .length,
                ),
                ...items
                    .where((i) => (group['statuses'] as List<String>).contains(i.status))
                    .map((item) => _MaintenanceTicket(item: item)),
                const SizedBox(height: KodaraSpacing.space4),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _MaintenanceGroupHeader extends StatelessWidget {
  const _MaintenanceGroupHeader({required this.label, required this.count});
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KodaraSpacing.space2),
      child: Row(
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: KodaraTypography.md)),
          const SizedBox(width: KodaraSpacing.space2),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: KodaraSpacing.space2, vertical: 2),
            decoration: BoxDecoration(
              color: KodaraColors.border,
              borderRadius: BorderRadius.circular(KodaraRadius.full),
            ),
            child: Text(
              count.toString(),
              style: const TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

class _MaintenanceTicket extends ConsumerWidget {
  const _MaintenanceTicket({required this.item});
  final MaintenanceItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      margin: const EdgeInsets.only(bottom: KodaraSpacing.space3),
      child: Padding(
        padding: const EdgeInsets.all(KodaraSpacing.space3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                StatusBadge(item.priority),
                const Spacer(),
                Text(
                  formatDate(item.createdAt),
                  style: const TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: KodaraSpacing.space2),
            Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: KodaraTypography.md)),
            const SizedBox(height: KodaraSpacing.space1),
            Text(
              item.description,
              style: const TextStyle(color: KodaraColors.textPrimary, fontSize: KodaraTypography.sm),
            ),
            const SizedBox(height: KodaraSpacing.space3),
            Text(
              '${item.tenantName ?? 'Tenant'} · ${item.unitName ?? 'Unit'}',
              style: const TextStyle(fontSize: KodaraTypography.xs, color: KodaraColors.textSecondary),
            ),
            if (item.status != 'completed') ...[
              const SizedBox(height: KodaraSpacing.space3),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => ref
                          .read(landlordMaintenanceProvider.notifier)
                          .updateStatus(item.id, 'in_progress'),
                      child: const Text('In progress'),
                    ),
                  ),
                  const SizedBox(width: KodaraSpacing.space2),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => ref
                          .read(landlordMaintenanceProvider.notifier)
                          .updateStatus(item.id, 'completed'),
                      child: const Text('Complete'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
