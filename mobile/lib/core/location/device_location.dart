import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

/// A GPS fix turned into the address lines the location screens show.
class ResolvedPlace {
  const ResolvedPlace({
    required this.point,
    required this.line1,
    required this.line2,
    this.house = '',
    this.area = '',
    this.city = '',
    this.state = '',
    this.pincode = '',
  });

  final LatLng point;
  final String line1;
  final String line2;
  final String house;
  final String area;
  final String city;
  final String state;
  final String pincode;

  String get singleLine {
    final parts = [line1, line2].where((part) => part.trim().isNotEmpty);
    return parts.join(', ');
  }
}

class LocationException implements Exception {
  const LocationException(
    this.message, {
    this.openAppSettings = false,
    this.openLocationSettings = false,
  });

  final String message;
  final bool openAppSettings;
  final bool openLocationSettings;
}

/// Reads the device GPS position and turns it into a street address.
class DeviceLocation {
  const DeviceLocation();

  Future<ResolvedPlace> currentPlace() async {
    final point = await currentPoint();
    return describe(point);
  }

  Future<LatLng> currentPoint() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      throw const LocationException(
        'Turn on location services and try again.',
        openLocationSettings: true,
      );
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw const LocationException(
        'Location permission is needed to find you.',
      );
    }
    if (permission == LocationPermission.deniedForever) {
      throw const LocationException(
        'Location permission is blocked. Enable it in Settings.',
        openAppSettings: true,
      );
    }

    final position = await _readPosition();
    return LatLng(position.latitude, position.longitude);
  }

  Future<ResolvedPlace> describe(LatLng point) async {
    try {
      final marks = await placemarkFromCoordinates(
        point.latitude,
        point.longitude,
      );
      if (marks.isEmpty) return _fromCoordinates(point);
      return _fromPlacemark(point, marks.first);
    } catch (_) {
      return _fromCoordinates(point);
    }
  }

  static Future<void> openPermissionSettings() => Geolocator.openAppSettings();

  static Future<void> openSystemLocationSettings() =>
      Geolocator.openLocationSettings();

  Future<Position> _readPosition() async {
    final settings = defaultTargetPlatform == TargetPlatform.android
        ? AndroidSettings(
            accuracy: LocationAccuracy.best,
            timeLimit: const Duration(seconds: 20),
          )
        : const LocationSettings(
            accuracy: LocationAccuracy.best,
            timeLimit: Duration(seconds: 20),
          );

    Position? position;
    try {
      position = await Geolocator.getCurrentPosition(locationSettings: settings);
    } catch (_) {
      position = null;
    }

    if (position == null && defaultTargetPlatform == TargetPlatform.android) {
      try {
        position = await Geolocator.getCurrentPosition(
          locationSettings: AndroidSettings(
            accuracy: LocationAccuracy.best,
            forceLocationManager: true,
            timeLimit: const Duration(seconds: 20),
          ),
        );
      } catch (_) {
        position = null;
      }
    }

    position ??= await Geolocator.getLastKnownPosition();
    if (position != null) return position;

    throw const LocationException(
      'Could not get a GPS fix. Try again outdoors or move the pin manually.',
    );
  }

  ResolvedPlace _fromPlacemark(LatLng point, Placemark mark) {
    final house = _text(mark.subThoroughfare);
    final street = _text(mark.thoroughfare);
    final named = _text(mark.name);
    final area = _firstNonEmpty([
      _text(mark.subLocality),
      street,
      _text(mark.street),
    ]);
    final city = _firstNonEmpty([
      _text(mark.locality),
      _text(mark.subAdministrativeArea),
    ]);
    final state = _text(mark.administrativeArea);
    final pincode = _text(mark.postalCode).replaceAll(RegExp(r'\s+'), '');

    final line1Parts = <String>[];
    void addPart(String value) {
      if (value.isEmpty) return;
      if (line1Parts.any((part) => part.toLowerCase() == value.toLowerCase())) {
        return;
      }
      if (value.toLowerCase() == city.toLowerCase()) return;
      line1Parts.add(value);
    }

    if (house.isNotEmpty && street.isNotEmpty) {
      addPart('$house, $street');
    } else {
      addPart(street);
      if (named.isNotEmpty && named != street) addPart(named);
    }
    addPart(area);
    if (line1Parts.isEmpty) addPart(named);

    final line2 = [
      city,
      state,
      pincode,
    ].where((part) => part.isNotEmpty).join(', ');

    return ResolvedPlace(
      point: point,
      line1: line1Parts.isEmpty ? 'Pinned location' : line1Parts.join(', '),
      line2: line2.isEmpty ? _coordinateLine(point) : line2,
      house: house,
      area: area,
      city: city,
      state: state,
      pincode: pincode,
    );
  }

  ResolvedPlace _fromCoordinates(LatLng point) {
    return ResolvedPlace(
      point: point,
      line1: 'Pinned location',
      line2: _coordinateLine(point),
    );
  }

  String _coordinateLine(LatLng point) {
    return '${point.latitude.toStringAsFixed(5)}, '
        '${point.longitude.toStringAsFixed(5)}';
  }

  String _text(String? value) => value?.trim() ?? '';

  String _firstNonEmpty(List<String> values) {
    for (final value in values) {
      if (value.isNotEmpty) return value;
    }
    return '';
  }
}
