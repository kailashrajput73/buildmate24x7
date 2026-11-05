import 'package:flutter/foundation.dart';

import '../../features/catalog/domain/models/catalog_models.dart';

class WishlistController extends ChangeNotifier {
  final List<ProductVariant> _items = [];

  List<ProductVariant> get items => List.unmodifiable(_items);

  int get count => _items.length;

  bool contains(String variantId) => _items.any((p) => p.id == variantId);

  bool containsProduct(String productId) =>
      _items.any((p) => p.productId == productId);

  void toggle(ProductVariant variant) {
    final index = _items.indexWhere((p) => p.id == variant.id);
    if (index >= 0) {
      _items.removeAt(index);
    } else {
      _items.insert(0, variant);
    }
    notifyListeners();
  }

  void remove(String variantId) {
    _items.removeWhere((p) => p.id == variantId);
    notifyListeners();
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }
}
