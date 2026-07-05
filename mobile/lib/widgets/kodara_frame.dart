import 'package:flutter/material.dart';

import '../theme/kodara_theme.dart';

/// Centers content in a phone-width column (max [KodaraSpacing.frameTenant])
/// so the app composes correctly on tablets, desktop, and the web preview —
/// on phones the constraint never bites. Every screen body, the app bar
/// title, and the bottom navigation share this frame so all chrome lines up
/// on one axis.
class KodaraFrame extends StatelessWidget {
  const KodaraFrame({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints:
            const BoxConstraints(maxWidth: KodaraSpacing.frameTenant),
        child: child,
      ),
    );
  }
}
