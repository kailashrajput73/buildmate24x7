import 'package:flutter/foundation.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

/// Real-time GPS location controller using geolocator and geocoding.
class LocationController extends ChangeNotifier {
  static final Geocoding _geocoding = Geocoding();

  LocationController() {
    // Defer so the first frame can render before the permission dialog.
    Future<void>.microtask(fetchCurrentLocation);
  }

  LatLng _currentCenter = const LatLng(28.5710, 77.3260); // Default until GPS
  String _addressLine1 = 'Detecting current location…';
  String _addressLine2 = 'Please wait';
  bool _isLoading = false;
  bool _hasFix = false;
  String? _error;

  LatLng get currentCenter => _currentCenter;
  String get addressLine1 => _addressLine1;
  String get addressLine2 => _addressLine2;
  bool get isLoading => _isLoading;
  bool get hasFix => _hasFix;
  String? get error => _error;

  String get fullAddress {
    if (_isLoading && !_hasFix) return 'Detecting current location…';
    if (_error != null && !_hasFix) return _error!;
    return '$_addressLine1, $_addressLine2';
  }

  /// Returns `true` when a GPS fix (or last-known position) was applied.
  Future<bool> fetchCurrentLocation() async {
    if (_isLoading) return _hasFix;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        await Geolocator.openLocationSettings();
        final stillOff = !(await Geolocator.isLocationServiceEnabled());
        if (stillOff) {
          _error = 'Turn on location services to continue';
          return false;
        }
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        _error = 'Location permission denied — tap to retry';
        return false;
      }

      if (permission == LocationPermission.deniedForever) {
        _error = 'Location permission blocked — enable it in Settings';
        await Geolocator.openAppSettings();
        return false;
      }

      Position? position;
      try {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 20),
          ),
        );
      } catch (e) {
        debugPrint('getCurrentPosition failed, trying last known: $e');
        position = await Geolocator.getLastKnownPosition();
      }

      if (position == null) {
        _error = 'Unable to get current location — try again';
        return false;
      }

      await applyCoordinates(
        LatLng(position.latitude, position.longitude),
        markAsFix: true,
      );
      return true;
    } catch (e) {
      debugPrint('Error fetching location: $e');
      _error = 'Unable to get current location — try again';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Updates the pin from map drag / reverse geocode at [point].
  Future<void> applyCoordinates(
    LatLng point, {
    bool markAsFix = true,
  }) async {
    _currentCenter = point;
    if (markAsFix) _hasFix = true;
    _error = null;

    try {
      final placemarks = await _geocoding.placemarkFromCoordinates(
        point.latitude,
        point.longitude,
      );
      if (placemarks.isNotEmpty) {
        final place = placemarks.first;
        final street = [
          place.street,
          place.name,
        ].whereType<String>().where((s) => s.trim().isNotEmpty).toSet();
        final streetLine = street.isEmpty ? '' : street.first;
        final locality = place.subLocality?.trim().isNotEmpty == true
            ? place.subLocality!
            : (place.locality ?? '');
        final city = place.locality ?? place.subAdministrativeArea ?? '';
        final state = place.administrativeArea ?? '';
        final postcode = place.postalCode ?? '';

        final line1Parts = <String>[
          if (streetLine.isNotEmpty) streetLine,
          if (locality.isNotEmpty && locality != streetLine) locality,
        ];
        _addressLine1 =
            line1Parts.isNotEmpty ? line1Parts.join(', ') : 'Pinned location';

        final line2Parts = <String>[
          if (city.isNotEmpty && city != locality) city,
          if (state.isNotEmpty) state,
          if (postcode.isNotEmpty) postcode,
        ];
        _addressLine2 = line2Parts.isNotEmpty
            ? line2Parts.join(', ')
            : 'GPS current location';
      } else {
        _addressLine1 =
            'Lat ${point.latitude.toStringAsFixed(5)}, Lng ${point.longitude.toStringAsFixed(5)}';
        _addressLine2 = 'GPS current location';
      }
    } catch (_) {
      _addressLine1 =
          'Lat ${point.latitude.toStringAsFixed(5)}, Lng ${point.longitude.toStringAsFixed(5)}';
      _addressLine2 = 'GPS current location';
    }
    notifyListeners();
  }

  void updateLocation(LatLng point, String line1, String line2) {
    _currentCenter = point;
    _addressLine1 = line1;
    _addressLine2 = line2;
    _hasFix = true;
    _error = null;
    notifyListeners();
  }

  /// Forward-geocode a typed address / landmark and move the pin.
  /// Returns `true` when at least one match was applied.
  Future<bool> searchAddress(String query) async {
    final q = query.trim();
    if (q.isEmpty) return false;

    try {
      final locations = await _geocoding.locationFromAddress(q);
      if (locations.isEmpty) {
        _error = 'No places found for “$q”';
        notifyListeners();
        return false;
      }

      final match = locations.first;
      await applyCoordinates(
        LatLng(match.latitude, match.longitude),
        markAsFix: true,
      );
      return true;
    } catch (e) {
      debugPrint('searchAddress failed: $e');
      _error = 'Unable to find that place — try a nearby landmark';
      notifyListeners();
      return false;
    }
  }
}
