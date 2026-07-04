import 'package:flutter/material.dart';

import '../services/api_exception.dart';
import '../theme/kodara_theme.dart';

/// Consistent loading / empty / error treatment for AsyncValue-driven
/// screens, per the cross-cutting requirement that the app never crash on a
/// failed network call and always offers a retry affordance.
class AsyncStateView extends StatelessWidget {
  const AsyncStateView({
    super.key,
    required this.loading,
    required this.error,
    required this.onRetry,
    this.errorTitle = 'Something went wrong',
  });

  final bool loading;
  final Object? error;
  final VoidCallback onRetry;
  final String errorTitle;

  bool get isNetworkError {
    final err = error;
    return err is ApiException && err.isNetworkError;
  }

  String get message {
    final err = error;
    if (err is ApiException) return err.message;
    return 'Please try again in a moment.';
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(child: CircularProgressIndicator());
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(KodaraSpacing.space5),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isNetworkError
                  ? Icons.wifi_off_rounded
                  : Icons.error_outline_rounded,
              size: 40,
              color: KodaraColors.error,
            ),
            const SizedBox(height: KodaraSpacing.space3),
            Text(
              isNetworkError ? "You're offline" : errorTitle,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: KodaraSpacing.space2),
            Text(
              message,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: KodaraColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: KodaraSpacing.space4),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Simple shimmer-free skeleton block used while a section is first loading.
class LoadingSkeleton extends StatelessWidget {
  const LoadingSkeleton({super.key, this.height = 96});
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      margin: const EdgeInsets.only(bottom: KodaraSpacing.space3),
      decoration: BoxDecoration(
        color: KodaraColors.border,
        borderRadius: BorderRadius.circular(KodaraRadius.lg),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          vertical: KodaraSpacing.space8, horizontal: KodaraSpacing.space5),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 36, color: KodaraColors.textSecondary),
          const SizedBox(height: KodaraSpacing.space3),
          Text(title,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center),
          const SizedBox(height: KodaraSpacing.space2),
          Text(
            message,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: KodaraColors.textSecondary),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[
            const SizedBox(height: KodaraSpacing.space4),
            action!
          ],
        ],
      ),
    );
  }
}

/// Shown when the build has no Supabase configuration, so screens degrade
/// gracefully instead of throwing — mirrors the auth_screen.dart pattern.
class NotConfiguredNotice extends StatelessWidget {
  const NotConfiguredNotice({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(KodaraSpacing.space5),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(KodaraSpacing.space4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: const [
              Text('Not connected',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              SizedBox(height: KodaraSpacing.space2),
              Text(
                'This build has no Supabase configuration. Provide SUPABASE_URL and SUPABASE_ANON_KEY with --dart-define to load live data.',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
