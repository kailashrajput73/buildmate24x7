import 'dart:math';

import '../../../../core/state/cart_controller.dart';
import 'address_models.dart';
import 'payment_models.dart';

/// One line of a placed order, copied out of the cart.
class OrderLine {
  const OrderLine({
    required this.name,
    required this.quantity,
    required this.total,
  });

  final String name;
  final int quantity;
  final double total;

  Map<String, dynamic> toJson() => {
        'name': name,
        'quantity': quantity,
        'total': total,
      };

  factory OrderLine.fromJson(Map<String, dynamic> json) {
    return OrderLine(
      name: json['name']?.toString() ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Snapshot of an order taken when "Place Order" succeeds, so the
/// confirmation screen still has the details after the cart is cleared.
class PlacedOrder {
  const PlacedOrder({
    required this.orderId,
    required this.lines,
    required this.total,
    required this.address,
    required this.delivery,
    required this.method,
    required this.placedAt,
  });

  /// Builds the order from the current cart. [random] is injectable for tests.
  factory PlacedOrder.fromCart(
    CartController cart, {
    required DeliveryAddress address,
    required DeliveryOption delivery,
    required PaymentMethod method,
    Random? random,
    DateTime? placedAt,
  }) {
    final number = 100000 + (random ?? Random()).nextInt(900000);
    return PlacedOrder(
      orderId: '#SC-$number',
      lines: [
        for (final item in cart.items)
          OrderLine(
            name: item.variant.productName,
            quantity: item.quantity,
            total: item.totalPrice,
          ),
      ],
      total: cart.grandTotal + delivery.fee,
      address: address,
      delivery: delivery,
      method: method,
      placedAt: placedAt ?? DateTime.now(),
    );
  }

  final String orderId;
  final List<OrderLine> lines;
  final double total;
  final DeliveryAddress address;
  final DeliveryOption delivery;
  final PaymentMethod method;
  final DateTime placedAt;

  /// Distinct products, matching the cart's "N items" wording.
  int get itemCount => lines.length;

  /// Cash on delivery is collected later; every other method is prepaid.
  bool get isPaid => method != PaymentMethod.cod;

  String get paymentStatus => switch (method) {
    PaymentMethod.upi => 'Paid via UPI',
    PaymentMethod.card => 'Paid via Card',
    PaymentMethod.netBanking => 'Paid via Net Banking',
    PaymentMethod.cod => 'Pay on Delivery',
  };

  String get customerFirstName {
    final name = address.fullName.trim();
    return name.isEmpty ? 'there' : name.split(RegExp(r'\s+')).first;
  }

  Map<String, dynamic> toJson() => {
        'orderId': orderId,
        'lines': lines.map((line) => line.toJson()).toList(),
        'total': total,
        'address': _addressToJson(address),
        'delivery': delivery.name,
        'method': method.name,
        'placedAt': placedAt.toIso8601String(),
      };

  factory PlacedOrder.fromJson(Map<String, dynamic> json) {
    final deliveryName = json['delivery']?.toString() ?? '';
    final methodName = json['method']?.toString() ?? '';
    return PlacedOrder(
      orderId: json['orderId']?.toString() ?? '',
      lines: (json['lines'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(OrderLine.fromJson)
          .toList(),
      total: (json['total'] as num?)?.toDouble() ?? 0,
      address: _addressFromJson(
        json['address'] as Map<String, dynamic>? ?? const {},
      ),
      delivery: DeliveryOption.values.firstWhere(
        (o) => o.name == deliveryName,
        orElse: () => DeliveryOption.standard,
      ),
      method: PaymentMethod.values.firstWhere(
        (m) => m.name == methodName,
        orElse: () => PaymentMethod.cod,
      ),
      placedAt: DateTime.tryParse(json['placedAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  static Map<String, dynamic> _addressToJson(DeliveryAddress address) => {
        'fullName': address.fullName,
        'mobile': address.mobile,
        'pincode': address.pincode,
        'city': address.city,
        'state': address.state,
        'house': address.house,
        'area': address.area,
        'type': address.type.name,
        'customLabel': address.customLabel,
        'isDefault': address.isDefault,
      };

  static DeliveryAddress _addressFromJson(Map<String, dynamic> json) {
    final typeName = json['type']?.toString() ?? AddressType.home.name;
    final type = AddressType.values.firstWhere(
      (t) => t.name == typeName,
      orElse: () => AddressType.home,
    );
    return DeliveryAddress(
      fullName: json['fullName']?.toString() ?? '',
      mobile: json['mobile']?.toString() ?? '',
      pincode: json['pincode']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      state: json['state']?.toString() ?? '',
      house: json['house']?.toString() ?? '',
      area: json['area']?.toString() ?? '',
      type: type,
      customLabel: json['customLabel']?.toString(),
      isDefault: json['isDefault'] == true,
    );
  }
}
