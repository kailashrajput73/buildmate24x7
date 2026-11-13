import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';

/// The server's answer for one delivery PIN code (`GET /api/delivery/check`).
@immutable
class DeliveryCheck {
  const DeliveryCheck({
    required this.pincode,
    required this.status,
    required this.serviceable,
    required this.message,
    this.city,
    this.district,
    this.state,
  });

  factory DeliveryCheck.fromJson(Map<String, dynamic> json) => DeliveryCheck(
        pincode: json['pincode']?.toString() ?? '',
        status: json['status']?.toString() ?? 'INVALID',
        serviceable: json['serviceable'] == true,
        message: json['message']?.toString() ?? '',
        city: json['city'] as String?,
        district: json['district'] as String?,
        state: json['state'] as String?,
      );

  final String pincode;

  /// SERVICEABLE, NOT_SERVICEABLE or INVALID.
  final String status;
  final bool serviceable;
  final String message;
  final String? city;
  final String? district;
  final String? state;

  bool get isValid => status != 'INVALID';

  /// "Mundra, Kachchh, Gujarat".
  String get place => [city, district, state].whereType<String>().where((s) => s.isNotEmpty).join(', ');

  /// "370421, Mundra" — for the Home "Deliver to" bar.
  String get label => [pincode, city ?? district].whereType<String>().where((s) => s.isNotEmpty).join(', ');

  Map<String, dynamic> toJson() => {
        'pincode': pincode,
        'status': status,
        'serviceable': serviceable,
        'message': message,
        'city': city,
        'district': district,
        'state': state,
      };
}

/// Delivery serviceability in the app.
///
/// The customer selects a delivery PIN code ("Deliver to …"); the server decides whether it is serviceable
/// (dashboard → Delivery areas). Only that selected PIN code decides whether Add to Cart and checkout are allowed —
/// never the phone's GPS position or the customer's current city. The choice is remembered on the phone and
/// re-checked with the server every time the app starts, so PIN codes the store adds or switches off apply without
/// an app update.
class DeliveryController extends ChangeNotifier {
  DeliveryController({ApiClient? apiClient}) : _api = apiClient ?? ApiClient() {
    Future<void>.microtask(_restore);
  }

  static const _prefsKey = 'delivery_pin_v1';
  static final RegExp _pinPattern = RegExp(r'^[1-9]\d{5}$');

  final ApiClient _api;
  final Map<String, DeliveryCheck> _cache = {};
  DeliveryCheck? _selected;
  bool _checking = false;

  DeliveryCheck? get selected => _selected;
  bool get checking => _checking;

  /// Purchasing allowed: a selected PIN code the server says is serviceable.
  bool get canPurchase => _selected?.serviceable == true;

  /// A PIN code is selected and the server said it is not serviceable (Add to Cart is disabled).
  bool get blocked => _selected != null && !_selected!.serviceable;

  static bool isValidPin(String pin) => _pinPattern.hasMatch(pin.trim());

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pin = prefs.getString(_prefsKey);
      if (pin == null || !isValidPin(pin)) return;
      await choose(pin);
    } catch (_) {
      // Offline at start-up: the customer can pick the PIN code again.
    }
  }

  /// Asks the server about [pincode] (cached for this app session). Throws [ApiException] when offline.
  Future<DeliveryCheck> check(String pincode, {bool fresh = false}) async {
    final pin = pincode.trim();
    if (!fresh && _cache[pin] != null) return _cache[pin]!;
    final json = await _api.getJson(
      '/delivery/check',
      queryParameters: {'pincode': pin},
      authenticate: false,
    );
    final result = DeliveryCheck.fromJson(Map<String, dynamic>.from(json as Map));
    if (result.isValid) _cache[pin] = result;
    return result;
  }

  /// Checks [pincode] with the server and, when valid, makes it the selected delivery PIN code.
  Future<DeliveryCheck> choose(String pincode) async {
    _checking = true;
    notifyListeners();
    try {
      final result = await check(pincode, fresh: true);
      if (result.isValid) {
        _selected = result;
        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_prefsKey, result.pincode);
        } catch (_) {}
      }
      return result;
    } finally {
      _checking = false;
      notifyListeners();
    }
  }
}
