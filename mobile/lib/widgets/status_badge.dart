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

  static const _success = {'completed', 'occupied', 'active', 'paid'};
  static const _warning = {
    'initiated',
    'vacant',
    'submitted',
    'overdue',
    'failed',
    'cancelled',
    'rejected',
  };

  @override
  Widget build(BuildContext context) {
    final Color background;
    final Color foreground;
    if (_success.contains(value)) {
      background = KodaraColors.successTint;
      foreground = KodaraColors.success;
    } else if (_warning.contains(value)) {
      background = KodaraColors.warningTint;
      foreground = KodaraColors.warning;
    } else {
      background = KodaraColors.accentTintStrong;
      foreground = KodaraColors.accentDark;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: KodaraSpacing.space3, vertical: KodaraSpacing.space1),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(KodaraRadius.full),
      ),
      child: Text(
        _titleCase(value),
        style: TextStyle(color: foreground, fontWeight: FontWeight.w600, fontSize: KodaraTypography.xs),
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
