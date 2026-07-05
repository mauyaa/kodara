import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kodara/main.dart';

void main() {
  testWidgets('unconfigured builds fail safely', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: KodaraApp()));

    expect(find.text('Not connected'), findsOneWidget);
    expect(find.textContaining('SUPABASE_URL'), findsOneWidget);
  });
}
