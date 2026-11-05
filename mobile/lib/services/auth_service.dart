import '../features/auth/domain/models/auth_models.dart';
import '../features/auth/services/auth_service.dart' as auth_contract;

/// Phone OTP sign-in for Buildmate 24x7.
///
/// Firebase has been removed from the app, and no other SMS/OTP service is
/// connected yet, so phone sign-in reports that it is unavailable instead of
/// pretending to work. "Skip login" (guest) is unaffected. Connect a real OTP
/// service (for example MSG91 through the backend) in [sendOtp] and
/// [verifyOtp] to turn phone login back on.
class PhoneAuthService implements auth_contract.AuthService {
  PhoneAuthService._();

  static final PhoneAuthService instance = PhoneAuthService._();

  static const String unavailableMessage =
      "Phone login isn't available yet. Tap Skip login to continue.";

  @override
  Future<AuthResult> sendOtp({required String mobileNumber}) async {
    return AuthResult.fail(unavailableMessage);
  }

  @override
  Future<AuthResult> verifyOtp({
    required String mobileNumber,
    required String otp,
  }) async {
    return AuthResult.fail(unavailableMessage);
  }

  /// Nothing to sign out of: there is no phone sign-in session.
  Future<void> signOut() async {}

  /// There is no phone sign-in session to restore.
  Future<AuthUser?> currentAuthUser() async => null;

  @override
  Future<AuthResult> continueAsGuest() async {
    return AuthResult.ok(AuthUser.guest());
  }

  @override
  Future<AuthResult> signInWithEmail({
    required String email,
    required String password,
  }) async {
    return AuthResult.fail('Email sign-in is not enabled.');
  }

  @override
  Future<AuthResult> signInWithGoogle() async {
    return AuthResult.fail('Google sign-in is not enabled.');
  }

  @override
  Future<AuthResult> register(RegisterRequest request) async {
    return AuthResult.fail('Use phone OTP to sign in.');
  }

  @override
  Future<AuthResult> sendPasswordResetCode({
    required String identifier,
    required bool isEmail,
  }) async {
    return AuthResult.fail('Password reset is not available.');
  }

  @override
  Future<AuthResult> resetPassword({
    required String identifier,
    required String newPassword,
  }) async {
    return AuthResult.fail('Password reset is not available.');
  }
}
