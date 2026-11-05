import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';

/// Minimal HTTP client for the FastAPI envelope `{ success, data, error }`.
class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// Supplies a login token when the user is signed in (none is set at the moment).
  static Future<String?> Function({bool forceRefresh})? authTokenProvider;

  /// When [authenticate] is false, no `Authorization` header is sent.
  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, String>? queryParameters,
    Duration timeout = const Duration(seconds: 15),
    bool authenticate = true,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}${ApiConfig.apiPrefix}$path')
        .replace(queryParameters: queryParameters);
    try {
      if (kDebugMode) {
        print('API GET: $uri');
      }
      final response = await _sendWithAuthRetry(
        uri: uri,
        timeout: timeout,
        authenticate: authenticate,
      );
      if (kDebugMode) {
        print('API RESPONSE (${response.statusCode}): ${response.body}');
      }
      return _decodeEnvelope(response);
    } catch (e) {
      if (kDebugMode) {
        print('API ERROR for $uri: $e');
      }
      rethrow;
    }
  }

  Future<Map<String, String>> _authHeaders({bool forceRefresh = false}) async {
    final provider = authTokenProvider;
    if (provider == null) return const {};
    final token = await provider(forceRefresh: forceRefresh);
    if (token == null || token.isEmpty) return const {};
    return {'Authorization': 'Bearer $token'};
  }

  Future<http.Response> _sendWithAuthRetry({
    required Uri uri,
    required Duration timeout,
    bool authenticate = true,
    bool forceRefreshToken = false,
    bool triedWithoutAuth = false,
  }) async {
    final headers = authenticate
        ? await _authHeaders(forceRefresh: forceRefreshToken)
        : const <String, String>{};

    final response = await _client.get(uri, headers: headers).timeout(timeout);

    if (!authenticate) {
      return response;
    }

    if (response.statusCode == 401 &&
        !forceRefreshToken &&
        authTokenProvider != null) {
      return _sendWithAuthRetry(
        uri: uri,
        timeout: timeout,
        authenticate: true,
        forceRefreshToken: true,
        triedWithoutAuth: triedWithoutAuth,
      );
    }

    // Signed-in users send a login token; public catalog routes treat
    // Bearer tokens as admin JWTs and return 401 for customer tokens.
    if (response.statusCode == 401 &&
        !triedWithoutAuth &&
        _looksLikeAdminTokenRejection(response)) {
      return _sendWithAuthRetry(
        uri: uri,
        timeout: timeout,
        authenticate: false,
        triedWithoutAuth: true,
      );
    }

    return response;
  }

  bool _looksLikeAdminTokenRejection(http.Response response) {
    final body = response.body.toLowerCase();
    return body.contains('admin token') ||
        (body.contains('invalid or expired') && body.contains('token'));
  }

  Map<String, dynamic> _decodeEnvelope(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        'HTTP ${response.statusCode}',
        statusCode: response.statusCode,
        body: response.body,
      );
    }

    final dynamic decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw ApiException('Invalid JSON envelope');
    }

    final success = decoded['success'] == true;
    if (!success) {
      throw ApiException(
        decoded['error']?.toString() ?? 'API request failed',
        statusCode: response.statusCode,
      );
    }

    return decoded;
  }

  void dispose() => _client.close();
}

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.body});

  final String message;
  final int? statusCode;
  final String? body;

  @override
  String toString() => 'ApiException($message)';
}
