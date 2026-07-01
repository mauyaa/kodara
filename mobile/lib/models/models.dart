// Lean domain models mirroring the shapes returned by Supabase table/view
// queries (see lib/types.ts and docs/API_SPEC.md on the web app). Fields are
// nullable wherever the underlying column can be null or the view might omit
// it, so a partially-populated row never throws during parsing.

T? _asOrNull<T>(Object? value) => value is T ? value : null;

double _toDouble(Object? value, [double fallback = 0]) {
  if (value == null) return fallback;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

/// Tolerant int parsing: PostgREST normally serializes Postgres integer
/// columns without a decimal point, but this guards against a stray
/// `5.0`-style numeric value being returned for an int field.
int? _toIntOrNull(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value) ?? double.tryParse(value)?.round();
  return null;
}

DateTime? _toDate(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  if (value is String && value.isNotEmpty) return DateTime.tryParse(value);
  return null;
}

/// A tenant row from the `tenant_directory` view, joined/denormalized with
/// profile, unit, and property fields.
class TenantSummary {
  final String id;
  final String userId;
  final String unitId;
  final String fullName;
  final String phone;
  final String unitName;
  final String propertyName;
  final double outstandingBalance;
  final DateTime? lastPaymentDate;
  final String status;

  const TenantSummary({
    required this.id,
    required this.userId,
    required this.unitId,
    required this.fullName,
    required this.phone,
    required this.unitName,
    required this.propertyName,
    required this.outstandingBalance,
    required this.lastPaymentDate,
    required this.status,
  });

  factory TenantSummary.fromJson(Map<String, dynamic> json) => TenantSummary(
        id: json['id']?.toString() ?? '',
        userId: json['user_id']?.toString() ?? '',
        unitId: json['unit_id']?.toString() ?? '',
        fullName: _asOrNull<String>(json['full_name']) ?? 'Tenant',
        phone: _asOrNull<String>(json['phone']) ?? '',
        unitName: _asOrNull<String>(json['unit_name']) ?? '—',
        propertyName: _asOrNull<String>(json['property_name']) ?? '—',
        outstandingBalance: _toDouble(json['outstanding_balance']),
        lastPaymentDate: _toDate(json['last_payment_date']),
        status: _asOrNull<String>(json['status']) ?? 'active',
      );
}

class PropertySummary {
  final String id;
  final String name;
  final String address;
  final String propertyType;
  final List<UnitSummary> units;

  const PropertySummary({
    required this.id,
    required this.name,
    required this.address,
    required this.propertyType,
    required this.units,
  });

  int get occupiedCount => units.where((u) => u.status == 'occupied').length;

  factory PropertySummary.fromJson(Map<String, dynamic> json) {
    final rawUnits = json['units'];
    final units = rawUnits is List
        ? rawUnits
            .whereType<Map>()
            .map((u) => UnitSummary.fromJson(Map<String, dynamic>.from(u)))
            .toList()
        : <UnitSummary>[];
    return PropertySummary(
      id: json['id']?.toString() ?? '',
      name: _asOrNull<String>(json['name']) ?? 'Property',
      address: _asOrNull<String>(json['address']) ?? '',
      propertyType: _asOrNull<String>(json['property_type']) ?? 'apartment',
      units: units,
    );
  }
}

class UnitSummary {
  final String id;
  final String propertyId;
  final String unitName;
  final int? floor;
  final double monthlyRent;
  final String status;

  const UnitSummary({
    required this.id,
    required this.propertyId,
    required this.unitName,
    required this.floor,
    required this.monthlyRent,
    required this.status,
  });

  factory UnitSummary.fromJson(Map<String, dynamic> json) => UnitSummary(
        id: json['id']?.toString() ?? '',
        propertyId: json['property_id']?.toString() ?? '',
        unitName: _asOrNull<String>(json['unit_name']) ?? '—',
        floor: _toIntOrNull(json['floor']),
        monthlyRent: _toDouble(json['monthly_rent']),
        status: _asOrNull<String>(json['status']) ?? 'vacant',
      );
}

class MaintenanceItem {
  final String id;
  final String unitId;
  final String tenantId;
  final String title;
  final String description;
  final String category;
  final String priority;
  final String status;
  final String? tenantName;
  final String? unitName;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const MaintenanceItem({
    required this.id,
    required this.unitId,
    required this.tenantId,
    required this.title,
    required this.description,
    required this.category,
    required this.priority,
    required this.status,
    required this.tenantName,
    required this.unitName,
    required this.createdAt,
    required this.updatedAt,
  });

  factory MaintenanceItem.fromJson(Map<String, dynamic> json) {
    // The /api/maintenance GET route nests tenant->profile and unit objects;
    // direct Supabase table reads return flat columns. Handle both.
    final tenantJoin = json['tenant'];
    final unitJoin = json['unit'];
    String? tenantName;
    if (tenantJoin is Map) {
      final profile = tenantJoin['profile'];
      if (profile is Map) tenantName = _asOrNull<String>(profile['full_name']);
    }
    String? unitName;
    if (unitJoin is Map) {
      unitName = _asOrNull<String>(unitJoin['unit_name']);
    }
    return MaintenanceItem(
      id: json['id']?.toString() ?? '',
      unitId: json['unit_id']?.toString() ?? '',
      tenantId: json['tenant_id']?.toString() ?? '',
      title: _asOrNull<String>(json['title']) ??
          _asOrNull<String>(json['category']) ??
          'Maintenance request',
      description: _asOrNull<String>(json['description']) ?? '',
      category: _asOrNull<String>(json['category']) ?? 'general',
      priority: _asOrNull<String>(json['priority']) ?? 'medium',
      status: _asOrNull<String>(json['status']) ?? 'submitted',
      tenantName: tenantName ?? _asOrNull<String>(json['tenant_name']),
      unitName: unitName ?? _asOrNull<String>(json['unit_name']),
      createdAt: _toDate(json['created_at']),
      updatedAt: _toDate(json['updated_at']),
    );
  }
}

class PaymentRecord {
  final String id;
  final String? invoiceId;
  final String tenantId;
  final double amount;
  final String status; // initiated | processing | completed | failed | ...
  final String? reference;
  final String? mpesaReceipt;
  final DateTime? createdAt;
  final String? tenantName;

  const PaymentRecord({
    required this.id,
    required this.invoiceId,
    required this.tenantId,
    required this.amount,
    required this.status,
    required this.reference,
    required this.mpesaReceipt,
    required this.createdAt,
    required this.tenantName,
  });

  factory PaymentRecord.fromJson(Map<String, dynamic> json) {
    String? tenantName;
    final tenantJoin = json['tenant'];
    if (tenantJoin is Map) {
      final profile = tenantJoin['profile'];
      if (profile is Map) tenantName = _asOrNull<String>(profile['full_name']);
    }
    return PaymentRecord(
      id: json['id']?.toString() ?? '',
      invoiceId: json['invoice_id']?.toString(),
      tenantId: json['tenant_id']?.toString() ?? '',
      amount: _toDouble(json['amount']),
      status: _asOrNull<String>(json['status']) ?? 'initiated',
      reference: _asOrNull<String>(json['reference']),
      mpesaReceipt: _asOrNull<String>(json['mpesa_receipt']),
      createdAt: _toDate(json['created_at']),
      tenantName: tenantName ?? _asOrNull<String>(json['tenant_name']),
    );
  }
}

class InvoiceRecord {
  final String id;
  final double totalAmount;
  final String status;
  final DateTime? dueDate;

  const InvoiceRecord({
    required this.id,
    required this.totalAmount,
    required this.status,
    required this.dueDate,
  });

  factory InvoiceRecord.fromJson(Map<String, dynamic> json) => InvoiceRecord(
        id: json['id']?.toString() ?? '',
        totalAmount: _toDouble(json['total_amount']),
        status: _asOrNull<String>(json['status']) ?? 'sent',
        dueDate: _toDate(json['due_date']),
      );
}

class MessageItem {
  final String id;
  final String senderId;
  final String receiverId;
  final String senderName;
  final String? subject;
  final String content;
  final bool read;
  final DateTime? createdAt;

  const MessageItem({
    required this.id,
    required this.senderId,
    required this.receiverId,
    required this.senderName,
    required this.subject,
    required this.content,
    required this.read,
    required this.createdAt,
  });

  factory MessageItem.fromJson(Map<String, dynamic> json) => MessageItem(
        id: json['id']?.toString() ?? '',
        senderId: json['sender_id']?.toString() ?? '',
        receiverId: json['receiver_id']?.toString() ?? '',
        senderName: _asOrNull<String>(json['sender_name']) ?? 'Kodara',
        subject: _asOrNull<String>(json['subject']),
        content: _asOrNull<String>(json['content']) ?? '',
        read: json['read'] == true,
        createdAt: _toDate(json['created_at']),
      );
}

class NotificationItem {
  final String id;
  final String type;
  final String title;
  final String message;
  final bool read;
  final DateTime? createdAt;

  const NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.read,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) =>
      NotificationItem(
        id: json['id']?.toString() ?? '',
        type: _asOrNull<String>(json['type']) ?? 'system_alert',
        title: _asOrNull<String>(json['title']) ?? 'Notification',
        message: _asOrNull<String>(json['message']) ?? '',
        read: json['read'] == true,
        createdAt: _toDate(json['created_at']),
      );
}
