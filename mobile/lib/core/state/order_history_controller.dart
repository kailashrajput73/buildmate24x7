import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/checkout/domain/models/order_models.dart';

/// Persists placed orders per signed-in user for the profile order history.
class OrderHistoryController extends ChangeNotifier {
  static const _storageKeyPrefix = 'order_history_v1_';

  List<PlacedOrder> _orders = const [];
  String? _loadedUserId;

  List<PlacedOrder> get orders => _orders;

  Future<void> loadForUser(String userId) async {
    if (userId.isEmpty) {
      _orders = const [];
      _loadedUserId = null;
      notifyListeners();
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('$_storageKeyPrefix$userId');
    if (raw == null || raw.isEmpty) {
      _orders = const [];
      _loadedUserId = userId;
      notifyListeners();
      return;
    }

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) {
        _orders = const [];
      } else {
        _orders = decoded
            .whereType<Map<String, dynamic>>()
            .map(PlacedOrder.fromJson)
            .where((o) => o.orderId.isNotEmpty)
            .toList();
      }
    } catch (e) {
      if (kDebugMode) {
        print('Order history load failed: $e');
      }
      _orders = const [];
    }

    _loadedUserId = userId;
    notifyListeners();
  }

  Future<void> recordOrder(PlacedOrder order, {required String userId}) async {
    if (userId.isEmpty || order.orderId.isEmpty) return;

    if (_loadedUserId != userId) {
      await loadForUser(userId);
    }

    _orders = [order, ..._orders.where((o) => o.orderId != order.orderId)];
    _loadedUserId = userId;
    notifyListeners();

    final prefs = await SharedPreferences.getInstance();
    final payload = jsonEncode(_orders.map((o) => o.toJson()).toList());
    await prefs.setString('$_storageKeyPrefix$userId', payload);
  }

  void clear() {
    _orders = const [];
    _loadedUserId = null;
    notifyListeners();
  }
}
