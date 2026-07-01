import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config.dart';
import 'api_exception.dart';

class StkPushResult {
  final bool success;
  final String? checkoutRequestId;
  final String message;

  const StkPushResult({
    required this.success,
    required this.checkoutRequestId,
    required this.message,
  });
}

/// Calls the Next.js `/api/mpesa/stk-push` route, which holds the Daraja
/// (Safaricom M-Pesa) credentials server-side and is not something the
/// mobile client should talk to directly. The mobile app authenticates the
/// call with the same Supabase access token used by the web app's
/// `getRequestClient` (see lib/supabase.ts), so RLS-equivalent checks apply.
class PaymentsApi {
  PaymentsApi(this._client);

  final SupabaseClient _client;

  Future<StkPushResult> initiateStkPush({
    required String phone,
    required int amount,
    required String invoiceId,
  }) async {
    final session = _client.auth.currentSession;
    final token = session?.accessToken;
    if (token == null) {
      throw const ApiException('Your session has expired. Please sign in again.');
    }

    final uri = Uri.parse('$apiBaseUrl/api/mpesa/stk-push');
    http.Response response;
    try {
      response = await http
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'phone': phone,
              'amount': amount,
              'invoiceId': invoiceId,
            }),
          )
          .timeout(const Duration(seconds: 30));
    } on SocketException {
      throw ApiException.network();
    } on TimeoutException {
      throw ApiException.network(
        'M-Pesa is taking too long to respond. Please try again.',
      );
    } on HttpException {
      throw ApiException.network();
    }

    Map<String, dynamic> body;
    try {
      body = response.body.isEmpty
          ? <String, dynamic>{}
          : Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    } catch (_) {
      body = <String, dynamic>{};
    }

    if (response.statusCode == 202 || response.statusCode == 200) {
      return StkPushResult(
        success: body['success'] == true,
        checkoutRequestId: body['checkoutRequestId']?.toString(),
        message: body['message']?.toString() ?? 'Check your phone to complete payment',
      );
    }

    final errorMessage = body['error']?.toString();
    switch (response.statusCode) {
      case 401:
        throw ApiException(errorMessage ?? 'Please sign in again to continue.');
      case 404:
        throw ApiException(errorMessage ?? 'No matching invoice was found.');
      case 409:
        throw ApiException(errorMessage ?? 'This invoice has already been paid.');
      case 429:
        throw const ApiException(
          'Too many payment attempts. Please wait a minute and try again.',
        );
      case 502:
      case 503:
        throw ApiException(
          errorMessage ?? 'M-Pesa is unavailable right now. Please try again shortly.',
        );
      default:
        throw ApiException(errorMessage ?? 'Could not start the M-Pesa payment.');
    }
  }
}
