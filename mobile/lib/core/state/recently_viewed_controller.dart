import 'package:flutter/foundation.dart';

import '../../features/catalog/domain/models/catalog_models.dart';

class RecentlyViewedController extends ChangeNotifier {
  RecentlyViewedController({this.maxItems = 10});

  final int maxItems;
  final List<ProductVariant> _items = [];

  List<ProductVariant> get items => List.unmodifiable(_items);

  void add(ProductVariant variant) {
    _items.removeWhere((p) => p.id == variant.id);
    _items.insert(0, variant);
    if (_items.length > maxItems) {
      _items.removeRange(maxItems, _items.length);
    }
    notifyListeners();
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }
}
