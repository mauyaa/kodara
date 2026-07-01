import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../services/api_exception.dart';
import 'core_providers.dart';

/// Aggregated tenant-home data: the tenant's own profile/balance plus their
/// open invoice (needed to drive STK push) and a handful of maintenance
/// items for the home tab. Kept as one provider so the home screen has a
/// single loading/error surface; repairs and messages have their own
/// providers since they're paginated/listed independently.
class TenantHomeData {
  final TenantSummary tenant;
  final InvoiceRecord? outstandingInvoice;
  final List<MaintenanceItem> recentMaintenance;

  const TenantHomeData({
    required this.tenant,
    required this.outstandingInvoice,
    required this.recentMaintenance,
  });
}

final tenantHomeProvider =
    AsyncNotifierProvider<TenantHomeNotifier, TenantHomeData?>(
  TenantHomeNotifier.new,
);

class TenantHomeNotifier extends AsyncNotifier<TenantHomeData?> {
  @override
  Future<TenantHomeData?> build() => _load();

  Future<TenantHomeData?> _load() async {
    final service = ref.read(kodaraServiceProvider);
    if (service == null) return null;
    final tenant = await service.fetchTenantForCurrentUser();
    if (tenant == null) return null;
    final results = await Future.wait([
      service.fetchOutstandingInvoice(tenant.id),
      service.fetchMaintenanceForTenant(tenant.id),
    ]);
    final invoice = results[0] as InvoiceRecord?;
    final maintenance = results[1] as List<MaintenanceItem>;
    return TenantHomeData(
      tenant: tenant,
      outstandingInvoice: invoice,
      recentMaintenance: maintenance.take(2).toList(),
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading<TenantHomeData?>().copyWithPrevious(state);
    state = await AsyncValue.guard(_load);
  }
}

final tenantMaintenanceProvider = AsyncNotifierProvider<
    TenantMaintenanceNotifier, List<MaintenanceItem>>(
  TenantMaintenanceNotifier.new,
);

class TenantMaintenanceNotifier extends AsyncNotifier<List<MaintenanceItem>> {
  @override
  Future<List<MaintenanceItem>> build() => _load();

  Future<List<MaintenanceItem>> _load() async {
    final service = ref.read(kodaraServiceProvider);
    final tenant = await service?.fetchTenantForCurrentUser();
    if (service == null || tenant == null) return const [];
    return service.fetchMaintenanceForTenant(tenant.id);
  }

  Future<void> refresh() async {
    state = const AsyncLoading<List<MaintenanceItem>>().copyWithPrevious(state);
    state = await AsyncValue.guard(_load);
  }

  Future<void> submit({
    required String category,
    required String title,
    required String description,
    String priority = 'medium',
  }) async {
    final service = ref.read(kodaraServiceProvider);
    if (service == null) {
      throw const ApiException('This build is not connected to Kodara yet.');
    }
    final tenant = await service.fetchTenantForCurrentUser();
    if (tenant == null) {
      throw const ApiException('We could not find your tenant profile.');
    }
    await service.createMaintenanceRequest(
      unitId: tenant.unitId,
      tenantId: tenant.id,
      category: category,
      title: title,
      description: description,
      priority: priority,
    );
    await refresh();
  }
}

final tenantMessagesProvider =
    AsyncNotifierProvider<TenantMessagesNotifier, List<MessageItem>>(
  TenantMessagesNotifier.new,
);

class TenantMessagesNotifier extends AsyncNotifier<List<MessageItem>> {
  @override
  Future<List<MessageItem>> build() => _load();

  Future<List<MessageItem>> _load() async {
    final service = ref.read(kodaraServiceProvider);
    final userId = ref.read(currentUserIdProvider);
    if (service == null || userId == null) return const [];
    return service.fetchMessagesForUser(userId);
  }

  Future<void> refresh() async {
    state = const AsyncLoading<List<MessageItem>>().copyWithPrevious(state);
    state = await AsyncValue.guard(_load);
  }

  Future<void> sendToPropertyManager(String content) async {
    final service = ref.read(kodaraServiceProvider);
    if (service == null) {
      throw const ApiException('This build is not connected to Kodara yet.');
    }
    await service.sendMessage(
      receiverId: 'property-manager',
      receiverName: 'Property manager',
      subject: 'Tenant message',
      content: content,
    );
    await refresh();
  }
}
