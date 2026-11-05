import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';

/// HTTP client for the public ASP.NET Core mobile APIs.
class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// Supplies a login token when the user is signed in (none is set at the moment).
  static Future<String?> Function({bool forceRefresh})? authTokenProvider;

  /// When [authenticate] is false, no `Authorization` header is sent.
  Future<dynamic> getJson(
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
      return _decodeResponse(response);
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

    final response = await _client.get(uri, headers: {
      'X-Client': 'app',
      ...headers,
    }).timeout(timeout);

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

  dynamic _decodeResponse(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        _errorMessage(response),
        statusCode: response.statusCode,
        body: response.body,
      );
    }

    if (response.body.trim().isEmpty) return null;

    final dynamic decoded;
    try {
      decoded = jsonDecode(response.body);
    } on FormatException catch (e) {
      throw ApiException(
        'Invalid JSON response: ${e.message}',
        statusCode: response.statusCode,
        body: response.body,
      );
    }

    // Keep support for any older service still returning the legacy envelope,
    // while passing through the ASP.NET arrays, pages, and objects unchanged.
    if (decoded is Map<String, dynamic> && decoded.containsKey('success')) {
      if (decoded['success'] != true) {
        throw ApiException(
          (decoded['error'] ?? decoded['message'] ?? 'API request failed')
              .toString(),
          statusCode: response.statusCode,
          body: response.body,
        );
      }
      return decoded.containsKey('data') ? decoded['data'] : decoded;
    }

    return decoded;
  }

  String _errorMessage(http.Response response) {
    final body = response.body.trim();
    if (body.isNotEmpty) {
      try {
        final decoded = jsonDecode(body);
        if (decoded is Map) {
          final title = decoded['title']?.toString().trim();
          final detail = decoded['detail']?.toString().trim();
          final error = decoded['error']?.toString().trim();
          final message = decoded['message']?.toString().trim();
          if (title != null && title.isNotEmpty) {
            return detail == null || detail.isEmpty || detail == title
                ? title
                : '$title: $detail';
          }
          for (final value in [detail, error, message]) {
            if (value != null && value.isNotEmpty) return value;
          }
        }
      } on FormatException {
        // Preserve a plain-text server error below.
      }
      return body;
    }
    final reason = response.reasonPhrase;
    return reason == null || reason.isEmpty
        ? 'HTTP ${response.statusCode}'
        : 'HTTP ${response.statusCode} $reason';
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
