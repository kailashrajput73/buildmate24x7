import 'package:flutter/foundation.dart';

import '../../features/catalog/domain/models/catalog_models.dart';

/// Promo codes accepted at checkout.
enum CartCoupon {
  /// 10% off the item subtotal.
  build10('BUILD10', '10% off applied'),

  /// Waives the shipping charge.
  freeShip('FREESHIP', 'Free shipping applied');

  const CartCoupon(this.code, this.successMessage);

  final String code;
  final String successMessage;

  static CartCoupon? fromCode(String code) {
    final normalized = code.trim().toUpperCase();
    for (final coupon in values) {
      if (coupon.code == normalized) return coupon;
    }
    return null;
  }
}

class CartController extends ChangeNotifier {
  static const int maxQuantity = 99;
  static const double gstRate = 0.18;
  static const double shippingFee = 250;
  static const double freeShippingThreshold = 10000;
  static const double _build10Rate = 0.10;

  final List<CartItem> _items = [];
  CartCoupon? _coupon;

  List<CartItem> get items => List.unmodifiable(_items);

  int get totalQuantity => _items.fold(0, (sum, i) => sum + i.quantity);

  double get subtotal => _items.fold(0, (sum, i) => sum + i.totalPrice);

  double get estimatedTotal => subtotal;

  bool get isEmpty => _items.isEmpty;

  // ── Checkout pricing ──────────────────────────────────────────────────

  CartCoupon? get coupon => _coupon;

  double get discount => _coupon == CartCoupon.build10
      ? (subtotal * _build10Rate).roundToDouble()
      : 0;

  double get shipping {
    if (isEmpty) return 0;
    if (_coupon == CartCoupon.freeShip) return 0;
    return subtotal >= freeShippingThreshold ? 0 : shippingFee;
  }

  /// GST is charged on the discounted item value, not on shipping.
  double get gst => ((subtotal - discount) * gstRate).roundToDouble();

  double get grandTotal => subtotal - discount + shipping + gst;

  /// Applies [code] and returns the coupon, or null if the code is unknown.
  CartCoupon? applyCoupon(String code) {
    final coupon = CartCoupon.fromCode(code);
    if (coupon == null) return null;
    _coupon = coupon;
    notifyListeners();
    return coupon;
  }

  void removeCoupon() {
    if (_coupon == null) return;
    _coupon = null;
    notifyListeners();
  }

  // ── Items ─────────────────────────────────────────────────────────────

  CartItem? itemForVariant(String variantId) {
    for (final item in _items) {
      if (item.variant.id == variantId) return item;
    }
    return null;
  }

  int quantityOf(String variantId) => itemForVariant(variantId)?.quantity ?? 0;

  void addVariant(ProductVariant variant, {int quantity = 1}) {
    if (quantity <= 0) return;
    final minQty = variant.minimumOrderQuantity;
    final addQty = quantity < minQty ? minQty : quantity;
    final index = _items.indexWhere((i) => i.variant.id == variant.id);
    if (index >= 0) {
      final current = _items[index];
      final next = current.quantity + addQty;
      _items[index] = current.copyWith(
        quantity: next > maxQuantity ? maxQuantity : next,
      );
    } else {
      _items.add(
        CartItem(
          variant: variant,
          quantity: addQty > maxQuantity ? maxQuantity : addQty,
        ),
      );
    }
    notifyListeners();
  }

  void setQuantity(String variantId, int quantity) {
    final index = _items.indexWhere((i) => i.variant.id == variantId);
    if (index < 0) return;
    if (quantity <= 0) {
      _items.removeAt(index);
      _resetCouponIfEmpty();
    } else {
      _items[index] = _items[index].copyWith(
        quantity: quantity > maxQuantity ? maxQuantity : quantity,
      );
    }
    notifyListeners();
  }

  void increase(String variantId) {
    setQuantity(variantId, quantityOf(variantId) + 1);
  }

  void decrease(String variantId) {
    setQuantity(variantId, quantityOf(variantId) - 1);
  }

  void remove(String variantId) {
    _items.removeWhere((i) => i.variant.id == variantId);
    _resetCouponIfEmpty();
    notifyListeners();
  }

  /// Puts a removed [item] back at [index] (used by "Undo").
  void restore(CartItem item, int index) {
    if (itemForVariant(item.variantId) != null) return;
    _items.insert(index.clamp(0, _items.length), item);
    notifyListeners();
  }

  void clear() {
    _items.clear();
    _coupon = null;
    notifyListeners();
  }

  void _resetCouponIfEmpty() {
    if (_items.isEmpty) _coupon = null;
  }
}
