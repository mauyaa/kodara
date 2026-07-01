import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import 'core_providers.dart';

/// Aggregated portfolio snapshot for the landlord/manager dashboard home
/// tab: properties+units, tenant directory, and recent payments. Bundled
/// into one provider so the dashboard has a single loading/error/retry
/// surface, matching the "Today's Overview" card on web
/// (PortfolioWorkspace.tsx Dashboard()).
class PortfolioSnapshot {
  final List<PropertySummary> properties;
  final List<TenantSummary> tenants;
  final List<PaymentRecord> recentPayments;
  final List<MaintenanceItem> openMaintenance;

  const PortfolioSnapshot({
    required this.properties,
    required this.tenants,
    required this.recentPayments,
    required this.openMaintenance,
  });

  int get totalUnits => properties.fold(0, (sum, p) => sum + p.units.length);
  int get occupiedUnits =>
      properties.fold(0, (sum, p) => sum + p.occupiedCount);
  double get outstandingTotal =>
      tenants.fold(0.0, (sum, t) => sum + t.outstandingBalance);
}

final portfolioProvider =
    AsyncNotifierProvider<PortfolioNotifier, PortfolioSnapshot?>(
  PortfolioNotifier.new,
);

class PortfolioNotifier extends AsyncNotifier<PortfolioSnapshot?> {
  @override
  Future<PortfolioSnapshot?> build() => _load();

  Future<PortfolioSnapshot?> _load() async {
    final service = ref.read(kodaraServiceProvider);
    if (service == null) return null;
    final results = await Future.wait([
      service.fetchProperties(),
      service.fetchTenantDirectory(),
      service.fetchRecentPayments(limit: 8),
      service.fetchAllMaintenance(),
    ]);
    final maintenance = (results[3] as List<MaintenanceItem>)
        .where((m) => m.status != 'completed' && m.status != 'cancelled')
        .toList();
    return PortfolioSnapshot(
      properties: results[0] as List<PropertySummary>,
      tenants: results[1] as List<TenantSummary>,
      recentPayments: results[2] as List<PaymentRecord>,
      openMaintenance: maintenance,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading<PortfolioSnapshot?>().copyWithPrevious(state);
    state = await AsyncValue.guard(_load);
  }
}

final landlordMaintenanceProvider = AsyncNotifierProvider<
    LandlordMaintenanceNotifier, List<MaintenanceItem>>(
  LandlordMaintenanceNotifier.new,
);

class LandlordMaintenanceNotifier
    extends AsyncNotifier<List<MaintenanceItem>> {
  @override
  Future<List<MaintenanceItem>> build() => _load();

  Future<List<MaintenanceItem>> _load() async {
    final service = ref.read(kodaraServiceProvider);
    if (service == null) return const [];
    return service.fetchAllMaintenance();
  }

  Future<void> refresh() async {
    state = const AsyncLoading<List<MaintenanceItem>>().copyWithPrevious(state);
    state = await AsyncValue.guard(_load);
  }

  Future<void> updateStatus(String id, String status) async {
    final service = ref.read(kodaraServiceProvider);
    if (service == null) return;
    await service.updateMaintenanceStatus(id, status);
    await refresh();
    // Keep the dashboard's open-maintenance count in sync too.
    ref.invalidate(portfolioProvider);
  }
}
