import 'api.dart';

/// OTP proof exchanged with the API for a BuildMate session.
sealed class PhoneProof {
  const PhoneProof(this.phone);
  final String phone;
}

class OtpProof extends PhoneProof {
  const OtpProof(super.phone, this.code);
  final String code;
}

/// Phone sign-in through the BuildMate API, which delivers OTPs using MSG91.
class PhoneAuth {
  PhoneAuth(this._api);
  final Api _api;

  static String e164(String tenDigits) =>
      '+91${tenDigits.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^91(?=\d{10}$)'), '')}';

  Future<void> send(String phone) async {
    await _api.post('/api/auth/otp/request', {'phone': phone});
  }

  Future<PhoneProof> verify(String phone, String code) async =>
      OtpProof(phone, code.trim());

  Future<PhoneProof> refresh(PhoneProof proof) async => proof;

  Future<void> signOut() async {}
}
