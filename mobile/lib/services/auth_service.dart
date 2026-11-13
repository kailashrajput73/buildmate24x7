import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../core/config.dart';
import '../core/network/api_client.dart';
import '../features/auth/domain/models/auth_models.dart';
import '../features/auth/services/auth_service.dart' as auth_contract;

/// Phone OTP sign-in through the BuildMate API, which sends codes with MSG91.
class PhoneAuthService implements auth_contract.AuthService {
  PhoneAuthService._();

  static final PhoneAuthService instance = PhoneAuthService._();
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  static const String pendingUserId = 'pending';

  final http.Client _client = http.Client();
  String? _accessToken;
  String? _refreshToken;
  String? _pendingPhone;
  String? _pendingCode;
  AuthUser? _currentUser;

  static Future<void> initialize() async {
    final service = instance;
    service._accessToken = await _storage.read(key: 'access');
    service._refreshToken = await _storage.read(key: 'refresh');
    ApiClient.authTokenProvider = ({bool forceRefresh = false}) =>
        service._getAccessToken(forceRefresh: forceRefresh);
  }

  Future<String?> _getAccessToken({bool forceRefresh = false}) async {
    if (!forceRefresh) return _accessToken;
    final refreshToken = _refreshToken;
    if (refreshToken == null) return null;

    try {
      final result = await _post('refresh', {'refreshToken': refreshToken});
      await _saveTokens(result);
      return _accessToken;
    } catch (error) {
      debugPrint('Session token refresh failed: $error');
      await _clearTokens();
      return null;
    }
  }

  @override
  Future<AuthResult> sendOtp({required String mobileNumber}) async {
    final phone = _normalizePhone(mobileNumber);
    if (phone == null)
      return AuthResult.fail('Enter a valid 10-digit mobile number.');
    _pendingPhone = null;
    _pendingCode = null;
    try {
      await _post('otp/request', {'phone': phone});
      return AuthResult.ok(
        AuthUser(id: pendingUserId, email: '', mobileNumber: phone),
      );
    } catch (error) {
      return AuthResult.fail(_message(error));
    }
  }

  @override
  Future<AuthResult> verifyOtp({
    required String mobileNumber,
    required String otp,
  }) async {
    final phone = _normalizePhone(mobileNumber);
    if (phone == null)
      return AuthResult.fail('Enter a valid 10-digit mobile number.');
    if (!RegExp(r'^\d{6}$').hasMatch(otp.trim())) {
      return AuthResult.fail('Enter the 6-digit verification code.');
    }

    try {
      final result = await _post('otp/verify', {
        'phone': phone,
        'code': otp.trim(),
      });
      _pendingPhone = null;
      _pendingCode = null;
      _currentUser = await _saveAuthResult(result);
      return AuthResult.ok(_currentUser!);
    } on _AuthApiException catch (error) {
      if (error.status == 409 &&
          error.code?.contains('signup_required') == true) {
        _pendingPhone = phone;
        _pendingCode = otp.trim();
        return AuthResult.ok(
          AuthUser(id: pendingUserId, email: '', mobileNumber: phone),
        );
      }
      return AuthResult.fail(error.message);
    } catch (error) {
      return AuthResult.fail(_message(error));
    }
  }

  Future<AuthResult> completeSignup({
    required String mobileNumber,
    required String fullName,
    required String email,
    required String audience,
    String? partnerType,
    String? referralCode,
  }) async {
    final phone = _pendingPhone;
    final code = _pendingCode;
    if (phone == null ||
        code == null ||
        phone != _normalizePhone(mobileNumber)) {
      return AuthResult.fail('Please verify your mobile number again.');
    }
    try {
      final result = await _post('otp/verify', {
        'phone': phone,
        'code': code,
        'audience': audience,
        'name': fullName.trim(),
        if (email.trim().isNotEmpty) 'email': email.trim(),
        if (partnerType != null) 'partnerType': partnerType,
        if (referralCode != null && referralCode.trim().isNotEmpty)
          'referralCode': referralCode.trim().toUpperCase(),
      });
      _currentUser = await _saveAuthResult(result);
      _pendingPhone = null;
      _pendingCode = null;
      return AuthResult.ok(_currentUser!);
    } catch (error) {
      return AuthResult.fail(_message(error));
    }
  }

  Future<void> signOut() async {
    final refreshToken = _refreshToken;
    try {
      if (refreshToken != null)
        await _post('logout', {'refreshToken': refreshToken});
    } catch (error) {
      debugPrint('Server logout failed: $error');
    } finally {
      await _clearTokens();
      _currentUser = null;
      _pendingPhone = null;
      _pendingCode = null;
    }
  }

  Future<AuthUser?> currentAuthUser() async => _currentUser;

  @override
  Future<AuthResult> continueAsGuest() async => AuthResult.ok(AuthUser.guest());

  @override
  Future<AuthResult> signInWithEmail({
    required String email,
    required String password,
  }) async => AuthResult.fail('Email sign-in is not enabled.');

  @override
  Future<AuthResult> signInWithGoogle() async =>
      AuthResult.fail('Google sign-in is not enabled.');

  @override
  Future<AuthResult> register(RegisterRequest request) => completeSignup(
    mobileNumber: request.mobileNumber,
    fullName: request.fullName,
    email: request.email,
    audience: request.role == UserRole.individualCustomer
        ? 'Customer'
        : 'Partner',
    partnerType: _partnerType(request.role),
  );

  @override
  Future<AuthResult> sendPasswordResetCode({
    required String identifier,
    required bool isEmail,
  }) async => AuthResult.fail('Password reset is not available.');

  @override
  Future<AuthResult> resetPassword({
    required String identifier,
    required String newPassword,
  }) async => AuthResult.fail('Password reset is not available.');

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final uri = Uri.parse('${AppConfig.apiUrl}/api/auth/$path');
    final response = await _client
        .post(
          uri,
          headers: const {
            'Content-Type': 'application/json',
            'X-Client': 'app',
          },
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 20));

    Map<String, dynamic> payload = {};
    if (response.body.trim().isNotEmpty) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) payload = decoded;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _AuthApiException(
        response.statusCode,
        _problemMessage(payload, response.statusCode),
        payload['type']?.toString(),
      );
    }
    return payload;
  }

  Future<AuthUser> _saveAuthResult(Map<String, dynamic> result) async {
    await _saveTokens(result);
    final user = result['user'];
    if (user is! Map<String, dynamic>) {
      throw const FormatException(
        'The server returned an invalid sign-in response.',
      );
    }
    return AuthUser(
      id: user['id']?.toString() ?? '',
      email: user['email']?.toString() ?? '',
      fullName: user['name']?.toString(),
      mobileNumber: user['phone']?.toString(),
      role: _userRole(user['userType']?.toString()),
    );
  }

  Future<void> _saveTokens(Map<String, dynamic> result) async {
    final access = result['accessToken']?.toString();
    final refresh = result['refreshToken']?.toString();
    if (access == null ||
        access.isEmpty ||
        refresh == null ||
        refresh.isEmpty) {
      throw const FormatException(
        'The server returned invalid session tokens.',
      );
    }
    _accessToken = access;
    _refreshToken = refresh;
    await _storage.write(key: 'access', value: access);
    await _storage.write(key: 'refresh', value: refresh);
  }

  Future<void> _clearTokens() async {
    _accessToken = null;
    _refreshToken = null;
    await _storage.delete(key: 'access');
    await _storage.delete(key: 'refresh');
  }

  String? _normalizePhone(String value) {
    var digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 12 && digits.startsWith('91'))
      digits = digits.substring(2);
    return RegExp(r'^[6-9]\d{9}$').hasMatch(digits) ? digits : null;
  }

  String _message(Object error) {
    if (error is _AuthApiException) return error.message;
    if (error is TimeoutException)
      return 'The server is taking too long to answer. Try again.';
    if (error is FormatException) return error.message.toString();
    debugPrint('Phone authentication request failed: $error');
    return 'Could not reach the BuildMate server. Check your connection and try again.';
  }

  String _problemMessage(Map<String, dynamic> payload, int status) {
    final title = payload['title']?.toString().trim();
    final detail = payload['detail']?.toString().trim();
    if (title != null && title.isNotEmpty) {
      return detail == null || detail.isEmpty || detail == title
          ? title
          : '$title: $detail';
    }
    return detail?.isNotEmpty == true
        ? detail!
        : 'Request failed (HTTP $status).';
  }

  UserRole? _userRole(String? type) => switch (type?.toLowerCase()) {
    'customer' => UserRole.individualCustomer,
    'partner' => UserRole.contractor,
    _ => null,
  };

  String? _partnerType(UserRole role) => switch (role) {
    UserRole.contractor => 'Contractor',
    UserRole.builder => 'Builder',
    UserRole.dealer => 'Other',
    UserRole.individualCustomer => null,
  };
}

class _AuthApiException implements Exception {
  const _AuthApiException(this.status, this.message, this.code);
  final int status;
  final String message;
  final String? code;
}
