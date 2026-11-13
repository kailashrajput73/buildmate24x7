import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

enum AddressType {
  home('Home', Icons.home_rounded),
  office('Office', Icons.business_rounded),
  other('Other', Icons.location_on_rounded);

  const AddressType(this.label, this.icon);

  final String label;
  final IconData icon;
}

/// A saved delivery address, returned by [AddAddressScreen] on save.
class DeliveryAddress {
  const DeliveryAddress({
    required this.fullName,
    required this.mobile,
    required this.pincode,
    required this.city,
    required this.state,
    required this.house,
    required this.area,
    required this.type,
    required this.isDefault,
    this.customLabel,
    this.location,
  });

  final String fullName;

  /// 10-digit local number, without the +91 prefix.
  final String mobile;
  final String pincode;
  final String city;
  final String state;
  final String house;
  final String area;
  final AddressType type;

  /// Only set when [type] is [AddressType.other].
  final String? customLabel;
  final bool isDefault;
  final LatLng? location;

  String get label =>
      type == AddressType.other && (customLabel?.isNotEmpty ?? false)
      ? customLabel!
      : type.label;

  String get singleLine => '$house, $area, $city - $pincode, $state';
}

extension DeliveryAddressCopy on DeliveryAddress {
  DeliveryAddress withDefault(bool value) => DeliveryAddress(
    fullName: fullName,
    mobile: mobile,
    pincode: pincode,
    city: city,
    state: state,
    house: house,
    area: area,
    type: type,
    customLabel: customLabel,
    isDefault: value,
    location: location,
  );

  /// e.g. "+91 98765 43210".
  String get formattedMobile => mobile.length == 10
      ? '+91 ${mobile.substring(0, 5)} ${mobile.substring(5)}'
      : '+91 $mobile';
}

enum DeliveryOption {
  standard('Standard Delivery', '3 - 5 business days', 0),
  express('Express Delivery', '1 - 2 business days', 99);

  const DeliveryOption(this.label, this.eta, this.fee);

  final String label;
  final String eta;
  final double fee;
}
