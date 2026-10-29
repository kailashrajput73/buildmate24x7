import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/glass.dart';
import 'core/i18n.dart';
import 'core/theme.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final lang = prefs.getString('lang') ?? 'en';

  // Push notifications are optional: they start working once google-services.json /
  // GoogleService-Info.plist are added (see README). Without them the app runs normally.
  var pushReady = false;
  try {
    await Firebase.initializeApp();
    pushReady = true;
  } catch (_) {}

  runApp(ProviderScope(
    overrides: [
      langProvider.overrideWith((ref) => LangNotifier(lang)),
      pushReadyProvider.overrideWithValue(pushReady),
    ],
    child: const BuildMateApp(),
  ));
}

final pushReadyProvider = Provider<bool>((ref) => false);

/// Asks for notification permission and returns the FCM token (or null when push isn't configured).
Future<String?> getPushToken() async {
  try {
    final m = FirebaseMessaging.instance;
    await m.requestPermission();
    return await m.getToken();
  } catch (_) {
    return null;
  }
}

class BuildMateApp extends ConsumerWidget {
  const BuildMateApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(langProvider);
    return MaterialApp.router(
      title: 'BuildMate 24x7',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: ref.watch(routerProvider),
      // One shared Liquid Glass backdrop behind every screen (scaffolds are transparent).
      builder: (context, child) => GlassBackdrop(child: child ?? const SizedBox.shrink()),
      locale: Locale(lang),
      supportedLocales: const [Locale('en'), Locale('hi')],
      localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
    );
  }
}
