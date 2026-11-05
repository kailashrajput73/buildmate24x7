import '../../../core/constants/app_constants.dart';
import '../domain/models/auth_models.dart';
import 'auth_service.dart';

class MockAuthService implements AuthService {
  AuthUser? _currentUser;

  AuthUser? get currentUser => _currentUser;

  Future<void> _delay() => Future<void>.delayed(AppConstants.mockNetworkDelay);

  @override
  Future<AuthResult> signInWithEmail({
    required String email,
    required String password,
  }) async {
    await _delay();
    if (email.trim().isEmpty || password.isEmpty) {
      return AuthResult.fail('Email and password are required.');
    }
    _currentUser = AuthUser(
      id: 'user-email',
      email: email.trim(),
      // Demo default identity when using the sample email; otherwise derive from email.
      fullName: email.trim().toLowerCase() == 'rajesh@shivani.com'
          ? 'Rajesh Kumar'
          : _displayNameFromEmail(email.trim()),
    );
    return AuthResult.ok(_currentUser!);
  }

  String _displayNameFromEmail(String email) {
    final local =
        email.split('@').first.replaceAll('.', ' ').replaceAll('_', ' ');
    if (local.isEmpty) return 'Customer';
    return local
        .split(' ')
        .where((p) => p.isNotEmpty)
        .map((p) => '${p[0].toUpperCase()}${p.substring(1)}')
        .join(' ');
  }

  @override
  Future<AuthResult> signInWithGoogle() async {
    await _delay();
    _currentUser = const AuthUser(
      id: 'user-google',
      email: 'user@gmail.com',
      fullName: 'Google User',
    );
    return AuthResult.ok(_currentUser!);
  }

  @override
  Future<AuthResult> continueAsGuest() async {
    await _delay();
    _currentUser = AuthUser.guest();
    return AuthResult.ok(_currentUser!);
  }

  @override
  Future<AuthResult> register(RegisterRequest request) async {
    await _delay();
    _currentUser = AuthUser(
      id: 'user-register',
      email: request.email,
      fullName: request.fullName,
      mobileNumber: request.mobileNumber,
      businessName: request.businessName,
      role: request.role,
    );
    return AuthResult.ok(_currentUser!);
  }

  @override
  Future<AuthResult> sendOtp({required String mobileNumber}) async {
    await _delay();
    if (mobileNumber.trim().isEmpty) {
      return AuthResult.fail('Mobile number is required.');
    }
    return AuthResult.ok(
      AuthUser(id: 'pending', email: '', mobileNumber: mobileNumber),
    );
  }

  @override
  Future<AuthResult> verifyOtp({
    required String mobileNumber,
    required String otp,
  }) async {
    await _delay();
    if (otp != AppConstants.mockOtp) {
      return AuthResult.fail('Invalid OTP. Please enter 123456.');
    }
    // Preserve registration details if the user just registered.
    final existing = _currentUser;
    _currentUser = AuthUser(
      id: existing?.id == 'user-register' ? existing!.id : 'user-otp',
      email: existing?.email ?? '',
      fullName: existing?.fullName ?? 'Verified User',
      mobileNumber: mobileNumber,
      businessName: existing?.businessName,
      role: existing?.role,
    );
    return AuthResult.ok(_currentUser!);
  }

  @override
  Future<AuthResult> sendPasswordResetCode({
    required String identifier,
    required bool isEmail,
  }) async {
    await _delay();
    if (identifier.trim().isEmpty) {
      return AuthResult.fail(
        isEmail ? 'Email address is required.' : 'Mobile number is required.',
      );
    }
    return AuthResult.ok(
      AuthUser(
        id: 'reset-pending',
        email: isEmail ? identifier : '',
        mobileNumber: isEmail ? null : identifier,
      ),
    );
  }

  @override
  Future<AuthResult> resetPassword({
    required String identifier,
    required String newPassword,
  }) async {
    await _delay();
    if (newPassword.length < 6) {
      return AuthResult.fail('Password must be at least 6 characters.');
    }
    return AuthResult.ok(
      AuthUser(id: 'reset-done', email: identifier, fullName: 'Updated'),
    );
  }
}
