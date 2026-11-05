import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../features/catalog/domain/models/catalog_models.dart';

/// Persists the logged-in user profile across app restarts.
abstract final class SessionStorage {
  static const _profileKey = 'session_user_profile';

  static Future<void> save(AppUserProfile user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_profileKey, jsonEncode(_toJson(user)));
  }

  static Future<AppUserProfile?> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_profileKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return _fromJson(map);
    } catch (_) {
      await clear();
      return null;
    }
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_profileKey);
  }

  static Map<String, dynamic> _toJson(AppUserProfile user) => {
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'phone': user.phone,
        'businessName': user.businessName,
        'isGuest': user.isGuest,
      };

  static AppUserProfile _fromJson(Map<String, dynamic> json) {
    return AppUserProfile(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'User',
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      businessName: json['businessName'] as String?,
      isGuest: json['isGuest'] as bool? ?? false,
    );
  }
}
