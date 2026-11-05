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

/// Mock pincode directory used for City/State auto-fill until the
/// address API exists.
abstract final class PincodeDirectory {
  static const Map<String, (String city, String state)> _entries = {
    '560001': ('Bangalore', 'Karnataka'),
    '560076': ('Bangalore', 'Karnataka'),
    '110001': ('New Delhi', 'Delhi'),
    '201301': ('Noida', 'Uttar Pradesh'),
    '122001': ('Gurugram', 'Haryana'),
    '400001': ('Mumbai', 'Maharashtra'),
    '411001': ('Pune', 'Maharashtra'),
    '500001': ('Hyderabad', 'Telangana'),
    '600001': ('Chennai', 'Tamil Nadu'),
    '700001': ('Kolkata', 'West Bengal'),
    '302001': ('Jaipur', 'Rajasthan'),
    '380001': ('Ahmedabad', 'Gujarat'),
  };

  static Future<(String city, String state)?> lookup(String pincode) async {
    await Future<void>.delayed(const Duration(milliseconds: 450));
    return _entries[pincode];
  }
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

/// Mock saved addresses until the address API exists.
abstract final class MockAddresses {
  static const List<DeliveryAddress> saved = [
    DeliveryAddress(
      fullName: 'Nandini Sharma',
      mobile: '9876543210',
      pincode: '560076',
      city: 'Bangalore',
      state: 'Karnataka',
      house: '123, Green Park',
      area: 'Near City Mall',
      type: AddressType.home,
      isDefault: true,
    ),
    DeliveryAddress(
      fullName: 'Nandini Sharma',
      mobile: '9876543210',
      pincode: '560001',
      city: 'Bangalore',
      state: 'Karnataka',
      house: 'Plot No. 45',
      area: 'Tech Park Road',
      type: AddressType.office,
      isDefault: false,
    ),
  ];
}
