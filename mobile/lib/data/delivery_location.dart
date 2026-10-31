import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'models.dart';
import 'providers.dart';

class DeliveryLocation {
  const DeliveryLocation({this.address, this.place, this.gps = false});
  final Address? address;
  final Json? place;
  final bool gps;
  String get label =>
      address?.oneLine ??
      [
        place?['area'],
        place?['city'],
        place?['pincode'],
      ].whereType<String>().where((s) => s.isNotEmpty).join(', ');
}

// Reset on account changes: one shopper must never inherit another's delivery address.
final deliveryLocationProvider = StateProvider<DeliveryLocation>((ref) {
  ref.watch(authProvider.select((a) => a.user?.id));
  return const DeliveryLocation();
});
