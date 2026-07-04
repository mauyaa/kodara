import 'package:intl/intl.dart';

/// KES currency + date formatting shared across screens, mirroring
/// lib/utils.ts formatKES/formatDate on the web app. Uses the 'en_US'
/// number-grouping convention (comma thousands separator) with the KES
/// symbol override, rather than an explicit 'en_KE' locale, since that
/// locale's separator data is not guaranteed to be bundled with intl.
final NumberFormat kesFormat = NumberFormat.currency(
  locale: 'en_US',
  symbol: 'KES ',
  decimalDigits: 0,
);

String formatKes(num? value) => kesFormat.format(value ?? 0);

final DateFormat _dateFormat = DateFormat('d MMM yyyy');

String formatDate(DateTime? value) {
  if (value == null) return '—';
  return _dateFormat.format(value);
}

final DateFormat _timeFormat = DateFormat('HH:mm');

String formatTime(DateTime? value) {
  if (value == null) return '—';
  return _timeFormat.format(value);
}
