import 'package:flutter/material.dart';

import '../theme/kodara_theme.dart';

/// Color-coded status pill mirroring app/components/ui/Badge.tsx variants
/// (success/warning/neutral) used throughout PortfolioWorkspace and
/// TenantPortal on web, so status semantics stay consistent across clients.
/// Colors come exclusively from KodaraColors — success/warning are reserved
/// for their real semantic meaning per DESIGN_SYSTEM.md, never decorative.
class StatusBadge extends StatelessWidget {
  const StatusBadge(this.value, {super.key});

  final String value;

  static const _success = {
    'completed',
    'occupied',
    'active',
    'paid',
    'succeeded',
    'matched_auto',
    'matched_manual',
  };
  static const _warning = {
    'initiated',
    'vacant',
    'submitted',
    'overdue',
    'unmatched',
    'pending',
    'in_progress',
  };
  // Red means failure, never "needs attention" (DESIGN.md status semantics).
  static const _danger = {
    'failed',
    'cancelled',
    'rejected',
    'expired',
    'reversed',
  };

  @override
  Widget build(BuildContext context) {
    final kodara = context.kodara;
    final Color background;
    final Color foreground;
    if (_success.contains(value)) {
      background = kodara.successTint;
      foreground = kodara.success;
    } else if (_danger.contains(value)) {
      background = kodara.errorTint;
      foreground = kodara.error;
    } else if (_warning.contains(value)) {
      background = kodara.warningTint;
      foreground = kodara.warning;
    } else {
      background = kodara.accentTintStrong;
      foreground = kodara.accentDark;
    }
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: KodaraSpacing.space3, vertical: KodaraSpacing.space1),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(KodaraRadius.full),
      ),
      child: Text(
        _titleCase(value),
        style: TextStyle(
            color: foreground,
            fontWeight: FontWeight.w600,
            fontSize: KodaraTypography.xs),
      ),
    );
  }

  String _titleCase(String value) {
    return value
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }
}
