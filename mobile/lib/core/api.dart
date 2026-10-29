import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'config.dart';
import 'i18n.dart';

/// Error with a message that is safe to show to the user (from the API's ProblemDetails title).
class ApiException implements Exception {
  final int status;
  final String message;
  final String? code;
  /// True when the request never got an answer from the server (wrong address, server down, no network, TLS).
  final bool unreachable;
  ApiException(this.status, this.message, [this.code, this.unreachable = false]);
  @override
  String toString() => message;
}

/// Tokens live in the platform keystore / keychain.
class TokenStore {
  static const _s = FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));
  String? access;
  String? refresh;

  Future<void> load() async {
    access = await _s.read(key: 'access');
    refresh = await _s.read(key: 'refresh');
  }

  Future<void> save(String a, String r) async {
    access = a;
    refresh = r;
    await _s.write(key: 'access', value: a);
    await _s.write(key: 'refresh', value: r);
  }

  Future<void> clear() async {
    access = null;
    refresh = null;
    await _s.deleteAll();
  }

  bool get hasSession => refresh != null;
}

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

/// Called when the session can't be refreshed (forces the app back to login).
final sessionExpiredProvider = StateProvider<int>((ref) => 0);

final dioProvider = Provider<Dio>((ref) {
  final tokens = ref.watch(tokenStoreProvider);
  final dio = Dio(BaseOptions(
    baseUrl: AppConfig.apiUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'X-Client': 'app'},
  ));
  Completer<bool>? refreshing;

  Future<bool> doRefresh() async {
    if (refreshing != null) return refreshing!.future;
    final c = refreshing = Completer<bool>();
    try {
      if (tokens.refresh == null) {
        c.complete(false);
      } else {
        final res = await Dio(BaseOptions(baseUrl: AppConfig.apiUrl)).post('/api/auth/refresh', data: {'refreshToken': tokens.refresh});
        await tokens.save(res.data['accessToken'] as String, res.data['refreshToken'] as String);
        c.complete(true);
      }
    } catch (_) {
      await tokens.clear();
      ref.read(sessionExpiredProvider.notifier).state++;
      c.complete(false);
    } finally {
      refreshing = null;
    }
    return c.future;
  }

  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) {
      if (tokens.access != null) options.headers['Authorization'] = 'Bearer ${tokens.access}';
      options.headers['Accept-Language'] = ref.read(langProvider);
      handler.next(options);
    },
    onError: (e, handler) async {
      final retried = e.requestOptions.extra['retried'] == true;
      if (e.response?.statusCode == 401 && !retried && tokens.refresh != null && !e.requestOptions.path.contains('/auth/')) {
        if (await doRefresh()) {
          final opts = e.requestOptions..extra['retried'] = true;
          opts.headers['Authorization'] = 'Bearer ${tokens.access}';
          try {
            return handler.resolve(await dio.fetch(opts));
          } on DioException catch (e2) {
            return handler.next(e2);
          }
        }
      }
      handler.next(e);
    },
  ));
  return dio;
});

/// Thin typed wrapper that converts Dio errors into [ApiException].
class Api {
  final Dio _dio;
  Api(this._dio);

  Future<T> _wrap<T>(Future<Response> Function() call) async {
    try {
      final r = await call();
      return r.data as T;
    } on DioException catch (e) {
      final data = e.response?.data;
      final status = e.response?.statusCode ?? 0;
      if (data is Map && data['title'] is String) throw ApiException(status, data['title'] as String, data['type'] as String?);
      // No HTTP answer at all. Say which, and name the server, so a wrong API address is obvious.
      final host = Uri.tryParse(AppConfig.apiUrl)?.authority ?? AppConfig.apiUrl;
      switch (e.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          throw ApiException(0, 'The BuildMate server ($host) is taking too long to answer. Check your connection and try again.', 'timeout', true);
        case DioExceptionType.badCertificate:
          throw ApiException(0, 'Secure connection to the BuildMate server ($host) failed: its HTTPS certificate is not valid.', 'tls', true);
        case DioExceptionType.connectionError:
        case DioExceptionType.unknown:
          if (e.response == null) {
            throw ApiException(0, AppConfig.isDeviceUnreachableUrl
                ? 'This app was built for the emulator (server $host), which a phone can\'t reach. Rebuild it with your server\'s address (API_URL).'
                : "Can't reach the BuildMate server ($host). Check your internet; if it works, the server may be down.", 'unreachable', true);
          }
        default:
          break;
      }
      throw ApiException(status, 'Something went wrong. Please try again.');
    }
  }

  Future<T> get<T>(String path, [Map<String, dynamic>? q]) => _wrap(() => _dio.get(path, queryParameters: q?..removeWhere((k, v) => v == null || v == '')));
  Future<T> post<T>(String path, [Object? body]) => _wrap(() => _dio.post(path, data: body));
  Future<T> put<T>(String path, [Object? body]) => _wrap(() => _dio.put(path, data: body));
  Future<T> delete<T>(String path) => _wrap(() => _dio.delete(path));
  Future<T> upload<T>(String path, FormData form) => _wrap(() => _dio.post(path, data: form));
}

final apiProvider = Provider<Api>((ref) => Api(ref.watch(dioProvider)));
