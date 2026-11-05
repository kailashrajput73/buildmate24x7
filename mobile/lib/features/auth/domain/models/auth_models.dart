enum UserRole {
  dealer('Dealer'),
  builder('Builder'),
  contractor('Contractor'),
  individualCustomer('Individual Customer');

  const UserRole(this.label);

  final String label;
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    this.fullName,
    this.mobileNumber,
    this.businessName,
    this.role,
    this.isGuest = false,
    this.referralCode,
  });

  final String id;
  final String email;
  final String? fullName;
  final String? mobileNumber;
  final String? businessName;
  final UserRole? role;
  final bool isGuest;

  /// Referral code the user entered while signing up, if any.
  final String? referralCode;

  factory AuthUser.guest() => const AuthUser(
        id: 'guest',
        email: '',
        fullName: 'Guest',
        isGuest: true,
      );
}

class AuthResult {
  const AuthResult._({required this.success, this.user, this.message});

  final bool success;
  final AuthUser? user;
  final String? message;

  factory AuthResult.ok(AuthUser user) => AuthResult._(success: true, user: user);

  factory AuthResult.fail(String message) =>
      AuthResult._(success: false, message: message);
}

class RegisterRequest {
  const RegisterRequest({
    required this.fullName,
    required this.email,
    required this.mobileNumber,
    required this.password,
    required this.role,
    this.businessName,
  });

  final String fullName;
  final String email;
  final String mobileNumber;
  final String password;
  final UserRole role;
  final String? businessName;
}
