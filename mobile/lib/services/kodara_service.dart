import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/models.dart';
import 'api_exception.dart';

/// All tenant-side data access. Every read and write goes straight to
/// Supabase under the signed-in tenant's session; Row Level Security in the
/// database is what scopes results — this class never implements access
/// control of its own (kodara.md: access control is enforced server-side,
/// never inferred client-side).
class KodaraService {
  KodaraService(this._client);

  final SupabaseClient _client;

  String? get currentUserId => _client.auth.currentUser?.id;

  Future<T> _guard<T>(Future<T> Function() body) async {
    try {
      return await body();
    } on AuthException catch (e) {
      throw ApiException(e.message);
    } on PostgrestException catch (e) {
      throw ApiException(e.message.isNotEmpty ? e.message : 'Request failed');
    } on FunctionException catch (e) {
      final detail = e.details;
      final message = detail is Map && detail['error'] is String
          ? _friendlyFunctionError(detail['error'] as String)
          : 'Payment service is unavailable. Please try again.';
      throw ApiException(message);
    } on StorageException catch (e) {
      throw ApiException(
          e.message.isNotEmpty ? e.message : 'Upload failed. Please retry.');
    } on SocketException {
      throw ApiException.network();
    } on TimeoutException {
      throw ApiException.network('The request timed out. Please retry.');
    } on ApiException {
      rethrow;
    } catch (_) {
      throw const ApiException('Something went wrong. Please try again.');
    }
  }

  static String _friendlyFunctionError(String code) => switch (code) {
        'invalid_phone' =>
          'Enter a valid Safaricom number (2547XXXXXXXX or 2541XXXXXXXX).',
        'invalid_amount' => 'Enter a whole amount of at least KSh 1.',
        'tenancy_not_found' =>
          'We could not find your active lease. Pull to refresh and retry.',
        'stk_push_rejected' =>
          'M-Pesa rejected the request. Wait a moment and try again.',
        'payment_attempt_unavailable' ||
        'payment_service_unavailable' =>
          'Payment service is busy. Please try again shortly.',
        _ => 'Payment could not be started. Please try again.',
      };

  // ---- Lease ------------------------------------------------------------

  /// Every unit the tenant currently rents. Most tenants have exactly one,
  /// but nothing in the data model prevents a tenant from renting more than
  /// one unit -- from the same landlord or different ones.
  Future<List<Tenancy>> fetchActiveTenancies() => _guard(() async {
        final userId = currentUserId;
        if (userId == null) return const <Tenancy>[];
        final rows = await _client
            .from('tenancies')
            .select('*, unit:units(name, property:properties(name, address))')
            .eq('tenant_id', userId)
            .eq('status', 'active')
            .order('created_at', ascending: false);
        return rows.map(Tenancy.fromJson).toList();
      });

  Future<TenancyBalance?> fetchBalance(String tenancyId) => _guard(() async {
        final row = await _client
            .from('tenancy_balances')
            .select()
            .eq('tenancy_id', tenancyId)
            .maybeSingle();
        if (row == null) return null;
        return TenancyBalance.fromJson(row);
      });

  // ---- Invitations --------------------------------------------------------

  /// Pending invitations addressed to this tenant's verified phone number.
  /// RLS restricts visibility to invitations matching the caller's phone.
  Future<List<TenantInvitation>> fetchPendingInvitations() => _guard(() async {
        final rows = await _client
            .from('tenant_invitations')
            .select()
            .eq('status', 'pending')
            .order('created_at', ascending: false);
        return rows.map(TenantInvitation.fromJson).toList();
      });

  /// Atomically accepts an invitation, creating the active tenancy.
  Future<Tenancy> acceptInvitation(String invitationId) => _guard(() async {
        final row = await _client.rpc(
          'accept_tenant_invitation',
          params: {'target_invitation_id': invitationId},
        );
        return Tenancy.fromJson(Map<String, dynamic>.from(row as Map));
      });

  // ---- Payments -----------------------------------------------------------

  Future<List<Payment>> fetchPayments(String tenancyId) => _guard(() async {
        final rows = await _client
            .from('payments')
            .select()
            .eq('tenancy_id', tenancyId)
            .order('created_at', ascending: false)
            .limit(50);
        return rows.map(Payment.fromJson).toList();
      });

  /// Starts an M-Pesa STK push via the Edge Function. [idempotencyKey] must
  /// be generated once per user intent and reused on retries of the same
  /// intent so a flaky network can never double-charge (kodara.md DoD #8).
  Future<PaymentAttempt> initiateStkPush({
    required String tenancyId,
    required String phone,
    required int amount,
    required String idempotencyKey,
  }) =>
      _guard(() async {
        final response = await _client.functions.invoke(
          'mpesa-stk-push',
          body: {
            'tenancyId': tenancyId,
            'phone': phone,
            'amount': amount,
            'idempotencyKey': idempotencyKey,
          },
        );
        final data = Map<String, dynamic>.from(response.data as Map);
        return PaymentAttempt(
          id: data['attemptId'] as String,
          status: (data['status'] as String?) ?? 'pending',
          requestedAmount: amount.toDouble(),
          resultCode: (data['resultCode'] as num?)?.toInt(),
          resultDescription: data['resultDescription'] as String?,
        );
      });

  Future<PaymentAttempt?> fetchAttempt(String attemptId) => _guard(() async {
        final row = await _client
            .from('payment_attempts')
            .select()
            .eq('id', attemptId)
            .maybeSingle();
        if (row == null) return null;
        return PaymentAttempt.fromJson(row);
      });

  /// Live updates for one payment attempt so the pay sheet can move from
  /// "confirm on your phone" to success/failure the moment the webhook lands.
  ///
  /// Seeds with a plain REST fetch before chaining the realtime stream: the
  /// Realtime channel handshake against the local Supabase stack can take
  /// 10+ seconds to subscribe, and `.stream()` withholds its first emission
  /// until that handshake completes, which otherwise leaves the UI stuck on
  /// a loading state far longer than the fetch itself ever takes.
  Stream<PaymentAttempt?> watchAttempt(String attemptId) async* {
    yield await fetchAttempt(attemptId);
    yield* _client
        .from('payment_attempts')
        .stream(primaryKey: ['id'])
        .eq('id', attemptId)
        .map((rows) => rows.isEmpty
            ? null
            : PaymentAttempt.fromJson(Map<String, dynamic>.from(rows.first)));
  }

  /// Live updates to the tenancy's confirmed payments (drives the balance
  /// refresh without polling). See [watchAttempt] for why this seeds with a
  /// REST fetch first.
  Stream<List<Payment>> watchPayments(String tenancyId) async* {
    yield await fetchPayments(tenancyId);
    yield* _client
        .from('payments')
        .stream(primaryKey: ['id'])
        .eq('tenancy_id', tenancyId)
        .map((rows) => rows
            .map((r) => Payment.fromJson(Map<String, dynamic>.from(r)))
            .toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt)));
  }

  // ---- Maintenance ---------------------------------------------------------

  Future<List<MaintenanceRequest>> fetchMaintenance(String tenancyId) =>
      _guard(() async {
        final rows = await _client
            .from('maintenance_requests')
            .select()
            .eq('tenancy_id', tenancyId)
            .order('created_at', ascending: false);
        return rows.map(MaintenanceRequest.fromJson).toList();
      });

  /// Live maintenance status updates (kodara.md DoD #6: tenant sees each
  /// status change in real time). See [watchAttempt] for why this seeds
  /// with a REST fetch first.
  Stream<List<MaintenanceRequest>> watchMaintenance(String tenancyId) async* {
    yield await fetchMaintenance(tenancyId);
    yield* _client
        .from('maintenance_requests')
        .stream(primaryKey: ['id'])
        .eq('tenancy_id', tenancyId)
        .map((rows) => rows
            .map((r) => MaintenanceRequest.fromJson(Map<String, dynamic>.from(r)))
            .toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt)));
  }

  /// Uploads photos first, then creates the request referencing their paths.
  /// If the insert fails the uploaded objects are orphaned in the tenant's
  /// own folder only; they are re-usable on retry and harmless otherwise.
  Future<MaintenanceRequest> createMaintenanceRequest({
    required String tenancyId,
    required String title,
    required String description,
    required String priority,
    List<PhotoUpload> photos = const [],
  }) =>
      _guard(() async {
        final userId = currentUserId;
        if (userId == null) {
          throw const ApiException('You need to be signed in.');
        }

        final photoPaths = <String>[];
        for (final photo in photos) {
          final path =
              '$tenancyId/new/${DateTime.now().millisecondsSinceEpoch}-${photo.fileName}';
          await _client.storage.from('maintenance-photos').uploadBinary(
                path,
                photo.bytes,
                fileOptions: FileOptions(contentType: photo.contentType),
              );
          photoPaths.add(path);
        }

        final row = await _client
            .from('maintenance_requests')
            .insert({
              'tenancy_id': tenancyId,
              'created_by': userId,
              'title': title,
              'description': description,
              'priority': priority,
              'photo_paths': photoPaths,
            })
            .select()
            .single();
        return MaintenanceRequest.fromJson(row);
      });

  /// Short-lived signed URL for a maintenance photo in the private bucket.
  Future<String> signedPhotoUrl(String path) => _guard(() =>
      _client.storage.from('maintenance-photos').createSignedUrl(path, 3600));

  // ---- Messaging -------------------------------------------------------------

  Future<String?> _findThreadId(String tenancyId) => _guard(() async {
        final row = await _client
            .from('message_threads')
            .select('id')
            .eq('tenancy_id', tenancyId)
            .maybeSingle();
        return row?['id'] as String?;
      });

  Future<List<ChatMessage>> fetchMessages(String tenancyId) => _guard(() async {
        final threadId = await _findThreadId(tenancyId);
        if (threadId == null) return const <ChatMessage>[];
        final rows = await _client
            .from('messages')
            .select()
            .eq('thread_id', threadId)
            .order('created_at', ascending: true);
        return rows.map(ChatMessage.fromJson).toList();
      });

  /// Live conversation updates. See [watchAttempt] for why this seeds with a
  /// REST fetch first. If no thread exists yet (neither party has sent a
  /// message), this only yields the empty seed; call [sendMessage] to create
  /// one and reload.
  Stream<List<ChatMessage>> watchMessages(String tenancyId) async* {
    final seeded = await fetchMessages(tenancyId);
    yield seeded;
    final threadId = await _findThreadId(tenancyId);
    if (threadId == null) return;
    yield* _client
        .from('messages')
        .stream(primaryKey: ['id'])
        .eq('thread_id', threadId)
        .map((rows) => rows
            .map((r) => ChatMessage.fromJson(Map<String, dynamic>.from(r)))
            .toList()
          ..sort((a, b) => a.createdAt.compareTo(b.createdAt)));
  }

  Future<ChatMessage> sendMessage({
    required String tenancyId,
    required String body,
  }) =>
      _guard(() async {
        final row = await _client.rpc('send_message', params: {
          'target_tenancy_id': tenancyId,
          'message_body': body,
        });
        return ChatMessage.fromJson(Map<String, dynamic>.from(row as Map));
      });

  Future<void> markThreadRead(String tenancyId) => _guard(() async {
        final threadId = await _findThreadId(tenancyId);
        final userId = currentUserId;
        if (threadId == null || userId == null) return;
        await _client
            .from('messages')
            .update({'read_at': DateTime.now().toUtc().toIso8601String()})
            .eq('thread_id', threadId)
            .neq('sender_id', userId)
            .isFilter('read_at', null);
      });

  // ---- Auth -----------------------------------------------------------------

  Future<void> signIn({required String phone, required String password}) =>
      _guard(() async {
        await _client.auth.signInWithPassword(
          phone: '+$phone',
          password: password,
        );
      });

  /// Uses phone as the primary Auth identity. The database only exposes an
  /// invitation after Supabase has confirmed this number by SMS OTP.
  Future<void> signUp({
    required String password,
    required String fullName,
    required String phone,
  }) =>
      _guard(() async {
        await _client.auth.signUp(
          phone: '+$phone',
          password: password,
          data: {'full_name': fullName},
        );
      });

  Future<void> verifyPhone({
    required String phone,
    required String token,
  }) =>
      _guard(() async {
        await _client.auth.verifyOTP(
          type: OtpType.sms,
          phone: '+$phone',
          token: token,
        );
      });

  Future<void> signOut() => _guard(() => _client.auth.signOut());
}

/// A photo picked by the tenant, ready for upload.
class PhotoUpload {
  const PhotoUpload({
    required this.fileName,
    required this.bytes,
    required this.contentType,
  });

  final String fileName;
  final Uint8List bytes;
  final String contentType;
}
