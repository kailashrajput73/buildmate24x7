import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'api_client.dart';
import 'api_config.dart';

/// HTTP client for **public** BuildMate browse APIs (`/api/catalog`, categories, …).
///
/// Never attaches [ApiClient.authTokenProvider]. The production dashboard treats
/// any `Authorization: Bearer` as an admin session token, so customer
/// tokens cause `401 Invalid or expired admin token`.
class PublicApiClient {
  PublicApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, String>? queryParameters,
    Duration timeout = const Duration(seconds: 15),
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}${ApiConfig.apiPrefix}$path')
        .replace(queryParameters: queryParameters);
    try {
      if (kDebugMode) {
        print('API GET (public): $uri');
      }
      final response =
          await _client.get(uri).timeout(timeout);
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
