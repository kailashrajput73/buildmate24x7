import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';

import 'api.dart';

/// What proves the user owns the number, exchanged with the API for a BuildMate session.
sealed class PhoneProof {
  const PhoneProof(this.phone);
  final String phone;
}

/// Firebase verified the SMS code; the API checks this ID token with Google.
class FirebaseProof extends PhoneProof {
  const FirebaseProof(super.phone, this.idToken);
  final String idToken;
}

/// Fallback when Firebase isn't set up (local mock API): the API checks the code itself.
class OtpProof extends PhoneProof {
  const OtpProof(super.phone, this.code);
  final String code;
}

/// Phone sign-in. Uses Firebase phone auth (the store's Firebase project, `buildmate24x7`) unless the app was built
/// with `--dart-define=AUTH_MODE=otp`, which uses the API's own OTP (for the mock API and local testing).
class PhoneAuth {
  PhoneAuth(this._api);
  final Api _api;

  static const _mode = String.fromEnvironment('AUTH_MODE', defaultValue: 'firebase');
  static bool get usesFirebase => _mode != 'otp';

  String? _verificationId;
  int? _resendToken;
  /// Set when Android verified the SMS by itself (no code to type).
  FirebaseProof? autoVerified;

  static String e164(String tenDigits) => '+91${tenDigits.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^91(?=\d{10}$)'), '')}';

  /// Sends the SMS code. Throws [ApiException] with a message that can be shown.
  Future<void> send(String phone) async {
    autoVerified = null;
    if (!usesFirebase) {
      await _api.post('/api/auth/otp/request', {'phone': phone});
      return;
    }
    final done = Completer<void>();
    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: e164(phone),
        timeout: const Duration(seconds: 60),
        forceResendingToken: _resendToken,
        verificationCompleted: (credential) async {
          try {
            final r = await FirebaseAuth.instance.signInWithCredential(credential);
            final token = await r.user?.getIdToken();
            if (token != null) autoVerified = FirebaseProof(phone, token);
          } catch (_) {}
          if (!done.isCompleted) done.complete();
        },
        verificationFailed: (e) {
          if (!done.isCompleted) done.completeError(ApiException(0, _message(e)));
        },
        codeSent: (id, resend) {
          _verificationId = id;
          _resendToken = resend;
          if (!done.isCompleted) done.complete();
        },
        codeAutoRetrievalTimeout: (id) => _verificationId ??= id,
      );
    } on FirebaseAuthException catch (e) {
      throw ApiException(0, _message(e));
    }
    return done.future.timeout(const Duration(seconds: 70), onTimeout: () => throw ApiException(0, 'Sending the code timed out. Please try again.'));
  }

  /// Checks the typed code and returns the proof for the API.
  Future<PhoneProof> verify(String phone, String code) async {
    if (!usesFirebase) return OtpProof(phone, code);
    if (autoVerified != null) return autoVerified!;
    final id = _verificationId;
    if (id == null) throw ApiException(0, 'Request a new code first.');
    try {
      final r = await FirebaseAuth.instance.signInWithCredential(PhoneAuthProvider.credential(verificationId: id, smsCode: code.trim()));
      final token = await r.user?.getIdToken();
      if (token == null) throw ApiException(0, "We couldn't verify your number. Please try again.");
      return FirebaseProof(phone, token);
    } on FirebaseAuthException catch (e) {
      throw ApiException(0, _message(e));
    }
  }

  /// Fresh token for a second call (e.g. after choosing a profession); Firebase tokens last an hour.
  Future<PhoneProof> refresh(PhoneProof p) async {
    if (p is! FirebaseProof) return p;
    final token = await FirebaseAuth.instance.currentUser?.getIdToken(true);
    return token == null ? p : FirebaseProof(p.phone, token);
  }

  Future<void> signOut() async {
    if (usesFirebase) {
      try {
        await FirebaseAuth.instance.signOut();
      } catch (_) {}
    }
  }

  static String _message(FirebaseAuthException e) => switch (e.code) {
        'invalid-verification-code' => 'That code is not right. Check the SMS and try again.',
        'session-expired' || 'code-expired' => 'The code expired. Tap Resend OTP.',
        'too-many-requests' => 'Too many attempts. Please wait a few minutes and try again.',
        'invalid-phone-number' => 'Enter a valid 10-digit mobile number.',
        'network-request-failed' => 'No internet connection. Check your network and try again.',
        _ => e.message ?? 'Could not verify your number. Please try again.',
      };
}
