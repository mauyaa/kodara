/// Domain models mirroring the Supabase schema in
/// supabase/migrations/20260701000000_core_schema.sql. Field names match the
/// generated web types (generated/database.types.ts); keep the two in sync by
/// regenerating after any migration change.
library;

double _asDouble(dynamic v) =>
    v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;

DateTime? _asDate(dynamic v) =>
    v == null ? null : DateTime.tryParse(v.toString());

/// An active or past lease binding the signed-in tenant to a unit.
class Tenancy {
  const Tenancy({
    required this.id,
    required this.unitId,
    required this.tenantId,
    required this.rentAmount,
    required this.billingDay,
    required this.paymentReference,
    required this.startDate,
    required this.status,
    this.endDate,
    this.unitName,
    this.propertyName,
    this.propertyAddress,
  });

  final String id;
  final String unitId;
  final String tenantId;
  final double rentAmount;
  final int billingDay;
  final String paymentReference;
  final DateTime startDate;
  final DateTime? endDate;
  final String status;
  final String? unitName;
  final String? propertyName;
  final String? propertyAddress;

  factory Tenancy.fromJson(Map<String, dynamic> json) {
    final unit = json['unit'] as Map<String, dynamic>?;
    final property = unit?['property'] as Map<String, dynamic>?;
    return Tenancy(
      id: json['id'] as String,
      unitId: json['unit_id'] as String,
      tenantId: json['tenant_id'] as String,
      rentAmount: _asDouble(json['rent_amount']),
      billingDay: (json['billing_day'] as num).toInt(),
      paymentReference: json['payment_reference'] as String,
      startDate: _asDate(json['start_date'])!,
      endDate: _asDate(json['end_date']),
      status: json['status'] as String,
      unitName: unit?['name'] as String?,
      propertyName: property?['name'] as String?,
      propertyAddress: property?['address'] as String?,
    );
  }

  /// The next date rent is due: the billing day of the current month, or of
  /// next month if it has already passed.
  DateTime get nextDueDate {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final thisMonth = DateTime(now.year, now.month, billingDay);
    if (!thisMonth.isBefore(today)) return thisMonth;
    return DateTime(now.year, now.month + 1, billingDay);
  }
}

/// Row from the tenancy_balances view (security invoker; RLS applies).
class TenancyBalance {
  const TenancyBalance({
    required this.tenancyId,
    required this.totalDue,
    required this.totalPaid,
    required this.balance,
  });

  final String tenancyId;
  final double totalDue;
  final double totalPaid;
  final double balance;

  factory TenancyBalance.fromJson(Map<String, dynamic> json) => TenancyBalance(
        tenancyId: json['tenancy_id'] as String,
        totalDue: _asDouble(json['total_due']),
        totalPaid: _asDouble(json['total_paid']),
        balance: _asDouble(json['balance']),
      );
}

/// A confirmed M-Pesa payment attached to the tenant's tenancy.
class Payment {
  const Payment({
    required this.id,
    required this.amount,
    required this.status,
    required this.reconciliationStatus,
    required this.createdAt,
    this.providerTransactionId,
    this.paidAt,
  });

  final String id;
  final double amount;
  final String status;
  final String reconciliationStatus;
  final DateTime createdAt;
  final String? providerTransactionId;
  final DateTime? paidAt;

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
        id: json['id'] as String,
        amount: _asDouble(json['amount']),
        status: json['status'] as String,
        reconciliationStatus: json['reconciliation_status'] as String,
        createdAt: _asDate(json['created_at'])!,
        providerTransactionId: json['provider_transaction_id'] as String?,
        paidAt: _asDate(json['paid_at']),
      );
}

/// An STK push attempt. The tenant app watches this row after initiating a
/// payment: pending -> succeeded (webhook confirmed) or failed (cancelled,
/// timed out, or rejected).
class PaymentAttempt {
  const PaymentAttempt({
    required this.id,
    required this.status,
    required this.requestedAmount,
    this.resultCode,
    this.resultDescription,
  });

  final String id;
  final String status;
  final double requestedAmount;
  final int? resultCode;
  final String? resultDescription;

  factory PaymentAttempt.fromJson(Map<String, dynamic> json) => PaymentAttempt(
        id: json['id'] as String,
        status: json['status'] as String,
        requestedAmount: _asDouble(json['requested_amount']),
        resultCode: (json['result_code'] as num?)?.toInt(),
        resultDescription: json['result_description'] as String?,
      );

  bool get isTerminal =>
      status == 'succeeded' || status == 'failed' || status == 'uncertain';
}

class MaintenanceRequest {
  const MaintenanceRequest({
    required this.id,
    required this.tenancyId,
    required this.title,
    required this.description,
    required this.priority,
    required this.status,
    required this.photoPaths,
    required this.createdAt,
  });

  final String id;
  final String tenancyId;
  final String title;
  final String description;

  /// One of: low, normal, high, emergency (schema check constraint).
  final String priority;

  /// One of: pending, in_progress, completed (transitions enforced by DB).
  final String status;
  final List<String> photoPaths;
  final DateTime createdAt;

  factory MaintenanceRequest.fromJson(Map<String, dynamic> json) =>
      MaintenanceRequest(
        id: json['id'] as String,
        tenancyId: json['tenancy_id'] as String,
        title: json['title'] as String,
        description: json['description'] as String,
        priority: json['priority'] as String,
        status: json['status'] as String,
        photoPaths: ((json['photo_paths'] as List?) ?? const [])
            .map((e) => e.toString())
            .toList(),
        createdAt: _asDate(json['created_at'])!,
      );
}

/// A pending invitation addressed to the signed-in tenant's phone number.
class TenantInvitation {
  const TenantInvitation({
    required this.id,
    required this.rentAmount,
    required this.billingDay,
    required this.startDate,
    required this.expiresAt,
  });

  final String id;
  final double rentAmount;
  final int billingDay;
  final DateTime startDate;
  final DateTime expiresAt;

  factory TenantInvitation.fromJson(Map<String, dynamic> json) =>
      TenantInvitation(
        id: json['id'] as String,
        rentAmount: _asDouble(json['rent_amount']),
        billingDay: (json['billing_day'] as num).toInt(),
        startDate: _asDate(json['start_date'])!,
        expiresAt: _asDate(json['expires_at'])!,
      );
}
