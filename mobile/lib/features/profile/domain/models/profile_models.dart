import 'dart:typed_data';

/// Approval state of a KYC section (PAN / GST / Bank).
///
/// Once the backend team approves a section it can no longer be edited by
/// the customer. Any edit to a section sends it back to [pending].
enum VerificationStatus {
  approved,
  pending;

  String get label => switch (this) {
        VerificationStatus.approved => 'Approved',
        VerificationStatus.pending => 'Pending for Approval',
      };

  bool get isLocked => this == VerificationStatus.approved;
}

/// A supporting document attached to a KYC section.
class ProfileDocument {
  const ProfileDocument({
    required this.fileName,
    required this.uploadedOn,
    this.bytes,
  });

  final String fileName;
  final DateTime uploadedOn;

  /// File content, only for documents picked in this session. Seeded
  /// documents have none (no backend to fetch them from yet).
  final Uint8List? bytes;

  bool get canPreview => bytes != null;

  bool get isPdf => fileName.toLowerCase().endsWith('.pdf');
}

class PersonalInfo {
  const PersonalInfo({
    required this.fullName,
    required this.mobileNumber,
    required this.email,
    required this.address,
  });

  final String fullName;

  /// Login identity — never editable from the profile screen.
  final String mobileNumber;
  final String email;
  final String address;

  PersonalInfo copyWith({String? fullName, String? email, String? address}) {
    return PersonalInfo(
      fullName: fullName ?? this.fullName,
      mobileNumber: mobileNumber,
      email: email ?? this.email,
      address: address ?? this.address,
    );
  }
}

class PanDetails {
  const PanDetails({
    required this.panNumber,
    required this.nameOnDocument,
    this.document,
    this.status,
  });

  final String panNumber;
  final String nameOnDocument;
  final ProfileDocument? document;
  final VerificationStatus? status;
}

class GstDetails {
  const GstDetails({
    required this.gstNumber,
    required this.nameOnDocument,
    this.document,
    this.status,
  });

  final String gstNumber;
  final String nameOnDocument;
  final ProfileDocument? document;
  final VerificationStatus? status;
}

class BankDetails {
  const BankDetails({
    required this.accountNumber,
    required this.ifscCode,
    required this.nameOnAccount,
    this.document,
    this.status,
  });

  /// Stored masked (e.g. XXXXXXXX1234); only the last 4 digits are shown.
  final String accountNumber;
  final String ifscCode;
  final String nameOnAccount;
  final ProfileDocument? document;
  final VerificationStatus? status;
}

class ProfileDetails {
  const ProfileDetails({
    required this.personal,
    required this.pan,
    required this.gst,
    required this.bank,
  });

  final PersonalInfo personal;
  final PanDetails pan;
  final GstDetails gst;
  final BankDetails bank;

  bool get hasPendingApproval => [pan.status, gst.status, bank.status]
      .contains(VerificationStatus.pending);

  ProfileDetails copyWith({
    PersonalInfo? personal,
    PanDetails? pan,
    GstDetails? gst,
    BankDetails? bank,
  }) {
    return ProfileDetails(
      personal: personal ?? this.personal,
      pan: pan ?? this.pan,
      gst: gst ?? this.gst,
      bank: bank ?? this.bank,
    );
  }
}

/// Masks an account number to `XXXXXXXX` + last 4 digits.
String maskAccountNumber(String raw) {
  final digits = raw.replaceAll(RegExp(r'\s'), '');
  if (digits.length <= 4) return digits;
  return '${'X' * (digits.length - 4)}${digits.substring(digits.length - 4)}';
}

/// Validators shared by the profile edit forms.
abstract final class ProfileValidators {
  static final _email = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  static final _pan = RegExp(r'^[A-Z]{5}[0-9]{4}[A-Z]$');
  static final _gst = RegExp(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
  static final _ifsc = RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$');
  static final _account = RegExp(r'^[0-9]{9,18}$');

  static String? required(String? v, String label) =>
      (v == null || v.trim().isEmpty) ? '$label is required' : null;

  static String? email(String? v) {
    final r = required(v, 'Email address');
    if (r != null) return r;
    return _email.hasMatch(v!.trim()) ? null : 'Enter a valid email address';
  }

  static String? pan(String? v) {
    final r = required(v, 'PAN number');
    if (r != null) return r;
    return _pan.hasMatch(v!.trim().toUpperCase())
        ? null
        : 'Enter a valid PAN (e.g. ABCDE1234F)';
  }

  static String? gst(String? v) {
    final r = required(v, 'GST number');
    if (r != null) return r;
    return _gst.hasMatch(v!.trim().toUpperCase())
        ? null
        : 'Enter a valid 15-character GSTIN';
  }

  static String? ifsc(String? v) {
    final r = required(v, 'IFSC code');
    if (r != null) return r;
    return _ifsc.hasMatch(v!.trim().toUpperCase())
        ? null
        : 'Enter a valid IFSC (e.g. HDFC0001234)';
  }

  static String? accountNumber(String? v) {
    final r = required(v, 'Account number');
    if (r != null) return r;
    return _account.hasMatch(v!.trim()) ? null : 'Enter 9–18 digits';
  }
}
