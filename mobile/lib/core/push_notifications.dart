import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Push registration is available only after the host app initializes Firebase.
final pushReadyProvider = Provider<bool>((ref) => Firebase.apps.isNotEmpty);

/// Returns this installation's FCM token when Firebase is configured.
///
/// Push is optional in builds without Firebase configuration. Keep failures
/// non-fatal so they do not interrupt sign-in or navigation.
Future<String?> getPushToken() async {
  if (Firebase.apps.isEmpty) return null;
  try {
    return await FirebaseMessaging.instance.getToken();
  } catch (_) {
    return null;
  }
}
