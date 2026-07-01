import 'dart:async';
import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/models.dart';
import 'api_exception.dart';

/// Wraps all direct Supabase table/view access used by the mobile app.
/// Mirrors the read patterns in the Next.js API routes (lib/supabase.ts +
/// app/api/**) but goes straight to PostgREST under the user's session, which
/// is simpler and lower-latency on mobile than round-tripping through the
/// Next.js BFF for plain reads. Row Level Security on the Supabase project is
/// what actually scopes results to the signed-in user/org — this class does
/// not duplicate that logic.
class KodaraService {
  KodaraService(this._client);

  final SupabaseClient _client;

  Future<T> _guard<T>(Future<T> Function() body) async {
    try {
      return await body();
    } on AuthException catch (e) {
      throw ApiException(e.message);
    } on PostgrestException catch (e) {
      throw ApiException(e.message.isNotEmpty ? e.message : 'Request failed');
    } on SocketException {
      throw ApiException.network();
    } on TimeoutException {
      throw ApiException.network('The request timed out. Please retry.');
    } catch (e) {
      throw ApiException('Something went wrong. Please try again.');
    }
  }

  String? get currentUserId => _client.auth.currentUser?.id;

  // ---- Tenant-side reads ----------------------------------------------

  Future<TenantSummary?> fetchTenantForCurrentUser() => _guard(() async {
        final userId = currentUserId;
        if (userId == null) return null;
        final row = await _client
            .from('tenant_directory')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        if (row == null) return null;
        return TenantSummary.fromJson(row);
      });

  Future<List<MaintenanceItem>> fetchMaintenanceForTenant(
    String tenantId,
  ) =>
      _guard(() async {
        final rows = await _client
            .from('maintenance_requests')
            .select('*, unit:unit_id(unit_name)')
            .eq('tenant_id', tenantId)
            .order('created_at', ascending: false);
        return (rows as List)
            .whereType<Map>()
            .map((r) => MaintenanceItem.fromJson(Map<String, dynamic>.from(r)))
            .toList();
      });

  Future<List<PaymentRecord>> fetchPaymentsForTenant(String tenantId) =>
      _guard(() async {
        final rows = await _client
            .from('payments')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', ascending: false)
            .limit(20);
        return (rows as List)
            .whereType<Map>()
            .map((r) => PaymentRecord.fromJson(Map<String, dynamic>.from(r)))
            .toList();
      });

  /// Finds the most recent unpaid/partially-paid invoice for a tenant, used
  /// to drive the M-Pesa STK push (the backend requires an invoiceId).
  Future<InvoiceRecord?> fetchOutstandingInvoice(String tenantId) =>
      _guard(() async {
        final row = await _client
            .from('invoices')
            .select('id, total_amount, status, due_date')
            .eq('tenant_id', tenantId)
            .inFilter('status', ['sent', 'overdue', 'partially_paid'])
            .order('due_date', ascending: true)
            .limit(1)
            .maybeSingle();
        if (row == null) return null;
        return InvoiceRecord.fromJson(row);
      });

  Future<List<MessageItem>> fetchMessagesForUser(String userId) =>
      _guard(() async {
        final rows = await _client
            .from('messages')
            .select('*')
            .or('sender_id.eq.$userId,receiver_id.eq.$userId')
            .order('created_at', ascending: false)
            .limit(50);
        return (rows as List)
            .whereType<Map>()
            .map((r) => MessageItem.fromJson(Map<String, dynamic>.from(r)))
            .toList();
      });

  Future<List<NotificationItem>> fetchNotifications(String userId) =>
      _guard(() async {
        final rows = await _client
            .from('notifications')
            .select('*')
            .eq('recipient_id', userId)
            .order('created_at', ascending: false)
            .limit(50);
        return (rows as List)
            .whereType<Map>()
            .map(
                (r) => NotificationItem.fromJson(Map<String, dynamic>.from(r)))
            .toList();
      });

  Future<void> sendMessage({
    required String receiverId,
    required String receiverName,
    String? subject,
    required String content,
  }) =>
      _guard(() async {
        final userId = currentUserId;
        if (userId == null) {
          throw const ApiException('You need to be signed in to send messages');
        }
        await _client.from('messages').insert({
          'sender_id': userId,
          'receiver_id': receiverId,
          'subject': subject,
          'content': content,
          'attachments': <String>[],
          'read': false,
        });
      });

  Future<MaintenanceItem> createMaintenanceRequest({
    required String unitId,
    required String tenantId,
    required String category,
    required String title,
    required String description,
    String priority = 'medium',
  }) =>
      _guard(() async {
        final row = await _client
            .from('maintenance_requests')
            .insert({
              'unit_id': unitId,
              'tenant_id': tenantId,
              'category': category,
              'title': title,
              'description': description,
              'priority': priority,
              'status': 'submitted',
            })
            .select()
            .single();
        return MaintenanceItem.fromJson(row);
      });

  // ---- Landlord-side reads ---------------------------------------------

  Future<List<PropertySummary>> fetchProperties({String? organizationId}) =>
      _guard(() async {
        var query = _client.from('properties').select('*, units(*)');
        if (organizationId != null) {
          query = query.eq('organization_id', organizationId);
        }
        final rows = await query.order('created_at', ascending: false);
        return (rows as List)
            .whereType<Map>()
            .map((r) => PropertySummary.fromJson(Map<String, dynamic>.from(r)))
            .toList();
      });

  Future<List<TenantSummary>> fetchTenantDirectory({
    String? organizationId,
  }) =>
      _guard(() async {
        var query = _client.from('tenant_directory').select('*');
        if (organizationId != null) {
          query = query.eq('organization_id', organizationId);
        }
        final rows = await query.order('move_in_date', ascending: false);
        return (rows as List)
            .whereType<Map>()
            .map((r) => TenantSummary.fromJson(Map<String, dynamic>.from(r)))
            .toList();
      });

  Future<List<MaintenanceItem>> fetchAllMaintenance({
    String? organizationId,
    String? status,
  }) =>
      _guard(() async {
        var query = _client.from('maintenance_requests').select(
            '*, tenant:tenant_id(profile:user_id(full_name, phone)), unit:unit_id(unit_name)');
        if (organizationId != null) {
          query = query.eq('organization_id', organizationId);
        }
        if (status != null) query = query.eq('status', status);
        final rows = await query.order('created_at', ascending: false);
        return (rows as List)
            .whereType<Map>()
            .map((r) => MaintenanceItem.fromJson(Map<String, dynamic>.from(r)))
            .toList();
      });

  Future<List<PaymentRecord>> fetchRecentPayments({
    int limit = 10,
  }) =>
      _guard(() async {
        final rows = await _client
            .from('payments')
            .select('*, tenant:tenant_id(profile:user_id(full_name, phone))')
            .order('created_at', ascending: false)
            .limit(limit);
        return (rows as List)
            .whereType<Map>()
            .map((r) => PaymentRecord.fromJson(Map<String, dynamic>.from(r)))
            .toList();
      });

  Future<void> updateMaintenanceStatus(String id, String status) =>
      _guard(() async {
        await _client
            .from('maintenance_requests')
            .update({
              'status': status,
              'updated_at': DateTime.now().toUtc().toIso8601String(),
            })
            .eq('id', id);
      });

  /// Streams live updates to a single payment row so the tenant app can
  /// reflect the M-Pesa callback (initiated -> completed/failed) without
  /// polling. Falls back to manual refresh if realtime is unavailable.
  Stream<PaymentRecord?> watchPayment(String paymentId) {
    return _client
        .from('payments')
        .stream(primaryKey: ['id'])
        .eq('id', paymentId)
        .map((rows) {
          if (rows.isEmpty) return null;
          return PaymentRecord.fromJson(Map<String, dynamic>.from(rows.first));
        });
  }
}
