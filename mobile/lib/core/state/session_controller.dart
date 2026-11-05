import 'package:flutter/foundation.dart';

import '../../features/auth/domain/models/auth_models.dart';
import '../../features/catalog/domain/models/catalog_models.dart';
import '../../services/auth_service.dart';
import '../services/session_storage.dart';

/// Holds the currently logged-in user with local persistence.
class SessionController extends ChangeNotifier {
  AppUserProfile _user = AppUserProfile.empty;
  bool _isLoggedIn = false;
  bool _restored = false;
  Future<void>? _restoreOperation;

  AppUserProfile get user => _user;
  bool get isLoggedIn => _isLoggedIn;
  bool get isRestored => _restored;

  /// Load saved session from device storage (call once on app start).
  Future<void> restore() {
    return _restoreOperation ??= _restore();
  }

  Future<void> _restore() async {
    try {
      final saved = await SessionStorage.load();
      if (saved != null && saved.id.isNotEmpty) {
        _user = saved;
        _isLoggedIn = true;
      } else {
        _user = AppUserProfile.empty;
        _isLoggedIn = false;
      }
    } catch (e, st) {
      _user = AppUserProfile.empty;
      _isLoggedIn = false;
      debugPrint('Session restore failed; continuing signed out: $e');
      debugPrint('$st');
    } finally {
      _restored = true;
      notifyListeners();
    }
  }

  Future<void> setUser(AppUserProfile user) async {
    _user = user;
    if (_isLoggedIn && user.id.isNotEmpty) {
      await SessionStorage.save(_user);
    }
    notifyListeners();
  }

  Future<void> setFromAuth(AuthUser authUser) async {
    final name = (authUser.fullName != null && authUser.fullName!.trim().isNotEmpty)
        ? authUser.fullName!.trim()
        : (authUser.isGuest
            ? 'Guest'
            : (authUser.email.isNotEmpty
                ? authUser.email.split('@').first
                : 'User'));
    _user = AppUserProfile(
      id: authUser.id,
      name: name,
      email: authUser.email.isEmpty ? null : authUser.email,
      phone: authUser.mobileNumber,
      businessName: authUser.businessName,
      isGuest: authUser.isGuest,
    );
    _isLoggedIn = true;
    await SessionStorage.save(_user);
    notifyListeners();
  }

  Future<void> logout() async {
    await PhoneAuthService.instance.signOut();
    await SessionStorage.clear();
    _user = AppUserProfile.empty;
    _isLoggedIn = false;
    notifyListeners();
  }
}
