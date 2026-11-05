import 'package:flutter/foundation.dart';

import '../../features/catalog/domain/models/catalog_models.dart';

class RecentlyViewedController extends ChangeNotifier {
  RecentlyViewedController({this.maxItems = 10});

  final int maxItems;
  final List<ProductVariant> _items = [];
  bool _seeded = false;

  List<ProductVariant> get items => List.unmodifiable(_items);

  /// Seed demo history once if empty (initial dashboard content).
  void seedIfEmpty(List<ProductVariant> seed) {
    if (_seeded || _items.isNotEmpty || seed.isEmpty) return;
    _items.addAll(seed.take(maxItems));
    _seeded = true;
    notifyListeners();
  }

  void add(ProductVariant variant) {
    _items.removeWhere((p) => p.id == variant.id);
    _items.insert(0, variant);
    if (_items.length > maxItems) {
      _items.removeRange(maxItems, _items.length);
    }
    _seeded = true;
    notifyListeners();
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }
}
