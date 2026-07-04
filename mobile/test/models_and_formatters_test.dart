import 'package:flutter_test/flutter_test.dart';
import 'package:kodara/models/models.dart';
import 'package:kodara/widgets/formatters.dart';

void main() {
  group('Kodara domain models', () {
    test('parses nested tenancy and numeric database values', () {
      final tenancy = Tenancy.fromJson({
        'id': 'tenancy-1',
        'unit_id': 'unit-1',
        'tenant_id': 'tenant-1',
        'rent_amount': '25000.50',
        'billing_day': 5,
        'payment_reference': 'KDR-001',
        'start_date': '2026-07-01',
        'end_date': null,
        'status': 'active',
        'unit': {
          'name': 'A1',
          'property': {
            'name': 'Kodara Heights',
            'address': 'Nairobi',
          },
        },
      });

      expect(tenancy.rentAmount, 25000.5);
      expect(tenancy.unitName, 'A1');
      expect(tenancy.propertyName, 'Kodara Heights');
      expect(tenancy.startDate, DateTime(2026, 7, 1));
    });

    test('treats uncertain payment attempts as terminal', () {
      final attempt = PaymentAttempt.fromJson({
        'id': 'attempt-1',
        'status': 'uncertain',
        'requested_amount': 1000,
        'result_code': null,
        'result_description': 'Daraja outcome requires reconciliation',
      });

      expect(attempt.isTerminal, isTrue);
    });

    test('normalizes absent maintenance photo paths', () {
      final request = MaintenanceRequest.fromJson({
        'id': 'request-1',
        'tenancy_id': 'tenancy-1',
        'title': 'Leaking tap',
        'description': 'The kitchen tap is leaking continuously.',
        'priority': 'normal',
        'status': 'pending',
        'created_at': '2026-07-03T12:00:00Z',
      });

      expect(request.photoPaths, isEmpty);
    });
  });

  group('formatters', () {
    test('formats Kenyan shillings without fractional digits', () {
      expect(formatKes(25000), 'KES 25,000');
    });

    test('formats dates predictably', () {
      expect(formatDate(DateTime(2026, 7, 3)), '3 Jul 2026');
    });
  });
}
