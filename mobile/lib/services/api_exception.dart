/// Thrown by service-layer calls so screens can show a friendly, retryable
/// error message instead of crashing on a network failure or API error.
/// Kenyan mobile networks drop in and out, so every network call in this app
/// should funnel failures through this type rather than letting raw
/// exceptions (SocketException, TimeoutException, PostgrestException, etc.)
/// reach the widget tree.
class ApiException implements Exception {
  final String message;
  final bool isNetworkError;

  const ApiException(this.message, {this.isNetworkError = false});

  factory ApiException.network([String? detail]) => ApiException(
        detail ?? 'No connection. Check your internet and try again.',
        isNetworkError: true,
      );

  @override
  String toString() => message;
}
