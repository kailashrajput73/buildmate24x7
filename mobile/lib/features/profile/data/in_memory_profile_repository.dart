import '../../catalog/domain/models/catalog_models.dart';
import '../domain/models/profile_models.dart';

/// Profile store keyed by user id. Stores and retrieves live user profile details.
class InMemoryProfileRepository {
  final Map<String, ProfileDetails> _store = {};

  Future<ProfileDetails> fetch(AppUserProfile user) async {
    return _store.putIfAbsent(user.id, () => _createInitialProfile(user));
  }

  Future<ProfileDetails> save(String userId, ProfileDetails details) async {
    _store[userId] = details;
    return details;
  }

  static ProfileDetails _createInitialProfile(AppUserProfile user) {
    return ProfileDetails(
      personal: PersonalInfo(
        fullName: user.name,
        mobileNumber: user.phone ?? '',
        email: user.email ?? '',
        address: '',
      ),
      pan: const PanDetails(
        panNumber: '',
        nameOnDocument: '',
        document: null,
        status: null,
      ),
      gst: const GstDetails(
        gstNumber: '',
        nameOnDocument: '',
        document: null,
        status: null,
      ),
      bank: const BankDetails(
        accountNumber: '',
        ifscCode: '',
        nameOnAccount: '',
        document: null,
        status: null,
      ),
    );
  }
}
