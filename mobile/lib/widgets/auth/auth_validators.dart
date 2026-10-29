abstract final class AuthValidators {
  static final RegExp _email = RegExp(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
  );

  static final RegExp _mobile = RegExp(r'^[6-9]\d{9}$');

  static String? email(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'Email address is required';
    if (!_email.hasMatch(v)) return 'Enter a valid email address';
    return null;
  }

  static String? password(String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    if (value.length < 6) return 'Password must be at least 6 characters';
    return null;
  }

  static String? confirmPassword(String? value, String password) {
    if (value == null || value.isEmpty) return 'Confirm your password';
    if (value != password) return 'Passwords do not match';
    return null;
  }

  static String? fullName(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'Full name is required';
    if (v.length < 2) return 'Enter a valid full name';
    return null;
  }

  static String? mobile(String? value) {
    final v = (value ?? '').replaceAll(RegExp(r'\s+'), '');
    final digits = v.replaceAll(RegExp(r'^\+91'), '').replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return 'Mobile number is required';
    if (!_mobile.hasMatch(digits)) return 'Enter a valid 10-digit mobile number';
    return null;
  }

  static String? requiredField(String? value, String label) {
    if (value == null || value.trim().isEmpty) return '$label is required';
    return null;
  }

  static String formatMobileDisplay(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    final local = digits.length > 10 ? digits.substring(digits.length - 10) : digits;
    if (local.length == 10) {
      return '+91 ${local.substring(0, 5)} ${local.substring(5)}';
    }
    return raw;
  }
}
