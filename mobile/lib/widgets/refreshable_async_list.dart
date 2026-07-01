import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'async_state_view.dart';

/// Wires an [AsyncValue] up to RefreshIndicator + consistent loading/error
/// states in one place, so every list screen gets pull-to-refresh and a
/// retry affordance without re-implementing the same boilerplate.
class RefreshableAsyncList<T> extends StatelessWidget {
  const RefreshableAsyncList({
    super.key,
    required this.value,
    required this.onRefresh,
    required this.builder,
  });

  final AsyncValue<T> value;
  final Future<void> Function() onRefresh;
  final Widget Function(BuildContext context, T data) builder;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: value.when(
        data: (data) {
          final content = builder(context, data);
          return content;
        },
        loading: () => value.hasValue
            ? builder(context, value.value as T)
            : ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 80),
                  Center(child: CircularProgressIndicator()),
                ],
              ),
        error: (err, _) => ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: 360,
              child: AsyncStateView(
                loading: false,
                error: err,
                onRetry: onRefresh,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
