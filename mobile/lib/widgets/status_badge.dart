import 'package:flutter/material.dart';

import '../theme/kodara_theme.dart';

const _success = {
  'completed',
  'occupied',
  'active',
  'paid',
  'succeeded',
  'matched_auto',
  'matched_manual',
};
const _warning = {
  'initiated',
  'vacant',
  'submitted',
  'overdue',
  'unmatched',
  'pending',
  'in_progress',
};
// Red means failure, never "needs attention" (DESIGN.md status semantics).
const _danger = {
  'failed',
  'cancelled',
  'rejected',
  'expired',
  'reversed',
};

/// Semantic foreground for a status value. Success/warning/error are
/// reserved for their real meaning, never decorative.
Color statusColorOf(BuildContext context, String value) {
  final kodara = context.kodara;
  if (_success.contains(value)) return kodara.success;
  if (_danger.contains(value)) return kodara.error;
  if (_warning.contains(value)) return kodara.warning;
  return kodara.accentDark;
}

String statusLabelOf(String value) {
  return value
      .replaceAll('_', ' ')
      .split(' ')
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}

/// Color-coded status pill, for surfaces that need weight (sheets, alerts).
class StatusBadge extends StatelessWidget {
  const StatusBadge(this.value, {super.key});

  final String value;

  @override
  Widget build(BuildContext context) {
    final kodara = context.kodara;
    final Color background;
    if (_success.contains(value)) {
      background = kodara.successTint;
    } else if (_danger.contains(value)) {
      background = kodara.errorTint;
    } else if (_warning.contains(value)) {
      background = kodara.warningTint;
    } else {
      background = kodara.accentTintStrong;
    }
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: KodaraSpacing.space3, vertical: KodaraSpacing.space1),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(KodaraRadius.full),
      ),
      child: Text(
        statusLabelOf(value),
        style: TextStyle(
            color: statusColorOf(context, value),
            fontWeight: FontWeight.w600,
            fontSize: KodaraTypography.xs),
      ),
    );
  }
}

/// The quiet variant for list rows: a 7px dot plus muted label. Editorial
/// lists use this instead of pills so status never shouts over content.
class StatusDot extends StatelessWidget {
  const StatusDot(this.value, {super.key});

  final String value;

  @override
  Widget build(BuildContext context) {
    final color = statusColorOf(context, value);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: KodaraSpacing.space2),
        Text(
          statusLabelOf(value),
          style: TextStyle(
            color: context.kodara.textSecondary,
            fontSize: KodaraTypography.sm,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
