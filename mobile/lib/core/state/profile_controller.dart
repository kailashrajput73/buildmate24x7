import 'package:flutter/foundation.dart';

import '../../features/catalog/domain/models/catalog_models.dart';
import '../../features/profile/data/in_memory_profile_repository.dart';
import '../../features/profile/domain/models/profile_models.dart';

/// UI-facing profile + KYC state for the signed-in user.
///
/// Approved sections are locked. Saving PAN / GST / Bank changes sends that
/// section back to [VerificationStatus.pending] for backend review.
class ProfileController extends ChangeNotifier {
  ProfileController({InMemoryProfileRepository? repository})
      : _repository = repository ?? InMemoryProfileRepository();

  final InMemoryProfileRepository _repository;

  ProfileDetails? _details;
  String? _userId;

  ProfileDetails? get details => _details;

  Future<void> loadForUser(AppUserProfile user) async {
    if (user.id.isEmpty) {
      clear();
      return;
    }
    if (_userId == user.id && _details != null) return;
    _userId = user.id;
    _details = await _repository.fetch(user);
    notifyListeners();
  }

  void clear() {
    _details = null;
    _userId = null;
    notifyListeners();
  }

  Future<void> savePersonal(PersonalInfo personal) =>
      _update((d) => d.copyWith(personal: personal));

  Future<void> savePan({
    required String panNumber,
    required String nameOnDocument,
    ProfileDocument? document,
  }) {
    return _update((d) {
      _assertEditable(d.pan.status);
      return d.copyWith(
        pan: PanDetails(
          panNumber: panNumber.trim().toUpperCase(),
          nameOnDocument: nameOnDocument.trim(),
          document: document ?? d.pan.document,
          status: VerificationStatus.pending,
        ),
      );
    });
  }

  Future<void> saveGst({
    required String gstNumber,
    required String nameOnDocument,
    ProfileDocument? document,
  }) {
    return _update((d) {
      _assertEditable(d.gst.status);
      return d.copyWith(
        gst: GstDetails(
          gstNumber: gstNumber.trim().toUpperCase(),
          nameOnDocument: nameOnDocument.trim(),
          document: document ?? d.gst.document,
          status: VerificationStatus.pending,
        ),
      );
    });
  }

  Future<void> saveBank({
    required String accountNumber,
    required String ifscCode,
    required String nameOnAccount,
    ProfileDocument? document,
  }) {
    return _update((d) {
      _assertEditable(d.bank.status);
      return d.copyWith(
        bank: BankDetails(
          accountNumber: maskAccountNumber(accountNumber),
          ifscCode: ifscCode.trim().toUpperCase(),
          nameOnAccount: nameOnAccount.trim(),
          document: document ?? d.bank.document,
          status: VerificationStatus.pending,
        ),
      );
    });
  }

  Future<void> _update(ProfileDetails Function(ProfileDetails) change) async {
    final current = _details;
    final userId = _userId;
    if (current == null || userId == null) return;
    _details = await _repository.save(userId, change(current));
    notifyListeners();
  }

  static void _assertEditable(VerificationStatus? status) {
    if (status?.isLocked == true) {
      throw StateError('Approved details cannot be changed.');
    }
  }
}
