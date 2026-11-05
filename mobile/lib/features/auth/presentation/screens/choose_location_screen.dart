import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../../../../core/location/device_location.dart';
import '../../../../core/state/location_controller.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../widgets/login_flow_widgets.dart';

/// Step between signup and profession selection — lets the user drop a pin
/// on the map or use their current location.
class ChooseLocationScreen extends StatefulWidget {
  const ChooseLocationScreen({
    super.key,
    required this.args,
    this.isLocationUpdate = false,
  });

  final SignupFlowArgs args;

  /// True when opened from Home to change the saved address, rather than
  /// as part of the signup flow — confirming should return to Home instead
  /// of continuing on to profession selection.
  final bool isLocationUpdate;

  @override
  State<ChooseLocationScreen> createState() => _ChooseLocationScreenState();
}

class _ChooseLocationScreenState extends State<ChooseLocationScreen>
    with SingleTickerProviderStateMixin {
  static const _location = DeviceLocation();
  static const _defaultCenter = LatLng(28.5710, 77.3260);

  bool _locating = false;
  bool _located = false;
  bool _mapReady = false;
  LatLng? _pendingMapCenter;
  ResolvedPlace? _place;
  int _resolveToken = 0;
  late final AnimationController _pinController;
  late final MapController _mapController;

  @override
  void initState() {
    super.initState();
    _pinController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _mapController = MapController();
  }

  @override
  void dispose() {
    _pinController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  void _onMapReady() {
    _mapReady = true;
    final pending = _pendingMapCenter;
    if (pending != null) {
      _pendingMapCenter = null;
      _moveMap(pending);
    }
    if (_located) return;
    unawaited(_bootstrapLocation());
  }

  Future<void> _bootstrapLocation() async {
    final shared = context.read<LocationController>();
    if (shared.hasFix) {
      _applySharedLocation(shared);
      return;
    }

    if (shared.isLoading) {
      for (var attempt = 0; attempt < 40; attempt++) {
        if (!mounted) return;
        if (!shared.isLoading) break;
        await Future<void>.delayed(const Duration(milliseconds: 100));
      }
      if (!mounted) return;
      if (shared.hasFix) {
        _applySharedLocation(shared);
        return;
      }
    }

    await _useCurrentLocation();
  }

  void _applySharedLocation(LocationController shared) {
    final point = shared.currentCenter;
    _moveMap(point);
    setState(() {
      _located = true;
      _locating = false;
      _place = ResolvedPlace(
        point: point,
        line1: shared.addressLine1,
        line2: shared.addressLine2,
      );
    });
  }

  Future<void> _useCurrentLocation() async {
    if (_locating) return;
    setState(() {
      _locating = true;
      _located = false;
    });
    _pinController.repeat(reverse: true);

    try {
      final point = await _location.currentPoint();
      if (!mounted) return;
      _moveMap(point);
      await _showPlace(point);
    } on LocationException catch (error) {
      _stopLocating();
      _showLocationError(error);
    } on TimeoutException {
      _stopLocating();
      _showLocationError(
        const LocationException('Could not get a GPS fix. Try again outdoors.'),
      );
    } catch (_) {
      _stopLocating();
      _showLocationError(
        const LocationException('Could not read your current location.'),
      );
    }
  }

  Future<void> _onPinMoved(LatLng point) async {
    await _showPlace(point);
  }

  Future<void> _showPlace(LatLng point) async {
    final token = ++_resolveToken;
    final place = await _location.describe(point);
    if (!mounted || token != _resolveToken) return;
    _pinController
      ..stop()
      ..value = 0;
    setState(() {
      _place = place;
      _locating = false;
      _located = true;
    });
    if (!mounted) return;
    context.read<LocationController>().updateLocation(
      place.point,
      place.line1,
      place.line2,
    );
  }

  void _stopLocating() {
    if (!mounted) return;
    _pinController
      ..stop()
      ..value = 0;
    setState(() => _locating = false);
  }

  void _moveMap(LatLng point) {
    if (!_mapReady) {
      _pendingMapCenter = point;
      return;
    }
    try {
      _mapController.move(point, 16);
    } catch (_) {
      _pendingMapCenter = point;
    }
  }

  void _showLocationError(LocationException error) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(error.message),
          behavior: SnackBarBehavior.floating,
          action: error.openAppSettings
              ? SnackBarAction(
                  label: 'Settings',
                  onPressed: DeviceLocation.openPermissionSettings,
                )
              : error.openLocationSettings
              ? SnackBarAction(
                  label: 'Settings',
                  onPressed: DeviceLocation.openSystemLocationSettings,
                )
              : null,
        ),
      );
  }

  void _continue() {
    if (widget.isLocationUpdate) {
      Navigator.of(context).pop(_place?.singleLine);
      return;
    }
    Navigator.of(
      context,
    ).pushNamed(AppRoutes.chooseProfession, arguments: widget.args);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          // Top half: real map surface.
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _defaultCenter,
                    initialZoom: 15,
                    onMapReady: _onMapReady,
                    interactionOptions: const InteractionOptions(
                      flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                    ),
                    onMapEvent: (event) {
                      if (event is! MapEventMoveEnd) return;
                      if (event.source != MapEventSource.dragEnd &&
                          event.source != MapEventSource.multiFingerEnd &&
                          event.source !=
                              MapEventSource.flingAnimationController) {
                        return;
                      }
                      _onPinMoved(event.camera.center);
                    },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.buildmate.customerapp',
                    ),
                  ],
                ),

                // Back button, same style used across the auth flow.
                SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.space5,
                      AppSpacing.space2,
                      AppSpacing.space5,
                      0,
                    ),
                    child: Row(
                      children: [
                        _RoundIconButton(
                          icon: Icons.arrow_back_rounded,
                          onTap: () => Navigator.of(context).maybePop(),
                        ),
                        const Spacer(),
                      ],
                    ),
                  ),
                ),

                // Centered pin, fixed over the map (map pans beneath it).
                Center(
                  child: AnimatedBuilder(
                    animation: _pinController,
                    builder: (context, child) {
                      final bounce = _locating
                          ? math.sin(_pinController.value * math.pi) * -14
                          : 0.0;
                      return Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Transform.translate(
                            offset: Offset(0, bounce),
                            child: child,
                          ),
                          const SizedBox(height: 2),
                          Container(
                            width: 10,
                            height: 4,
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                        ],
                      );
                    },
                    child: const _MapPin(),
                  ),
                ),

                // Locate-me FAB.
                Positioned(
                  right: AppSpacing.space5,
                  bottom: AppSpacing.space5,
                  child: _LocateMeButton(
                    loading: _locating,
                    onTap: _useCurrentLocation,
                  ),
                ),
              ],
            ),
          ),

          // Bottom half: search + location name + confirm button.
          Container(
            width: double.infinity,
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.52,
            ),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.space5,
              AppSpacing.space5,
              AppSpacing.space5,
              0,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              boxShadow: [
                BoxShadow(
                  color: Color(0x14000000),
                  blurRadius: 24,
                  offset: Offset(0, -6),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Pin your location',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space2),
                    Text(
                      'Drag the map or search to place the pin '
                      'exactly where you\'d like deliveries and '
                      'site visits.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space4),
                    _SearchField(),
                    const SizedBox(height: AppSpacing.space4),
                    _AddressCard(
                      located: _located,
                      locating: _locating,
                      place: _place,
                      onUseLocation: _useCurrentLocation,
                      onContinue: _continue,
                    ),
                    const SizedBox(height: AppSpacing.space4),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Icon(icon, size: 14, color: AppColors.onSurface),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
      height: 52,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.search_rounded, color: LoginFlowColors.accent),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Text(
              'Search area, street or landmark',
              style: TextStyle(color: AppColors.onSurfaceVariant, fontSize: 15),
            ),
          ),
        ],
      ),
    );
  }
}

class _MapPin extends StatelessWidget {
  const _MapPin();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 52,
      height: 52,
      alignment: Alignment.topCenter,
      child: Stack(
        alignment: Alignment.topCenter,
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: LoginFlowColors.accent.withValues(alpha: 0.16),
            ),
          ),
          Positioned(
            top: 4,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: LoginFlowColors.accentGradient,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                border: Border.all(color: Colors.white, width: 3),
                boxShadow: [
                  BoxShadow(
                    color: LoginFlowColors.accent.withValues(alpha: 0.4),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                Icons.home_rounded,
                size: 18,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LocateMeButton extends StatelessWidget {
  const _LocateMeButton({required this.loading, required this.onTap});

  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(28),
      child: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.12),
              blurRadius: 14,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: loading
            ? const Padding(
                padding: EdgeInsets.all(14),
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  color: LoginFlowColors.accent,
                ),
              )
            : const Icon(
                Icons.my_location_rounded,
                color: LoginFlowColors.accent,
              ),
      ),
    );
  }
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.located,
    required this.locating,
    required this.place,
    required this.onUseLocation,
    required this.onContinue,
  });

  final bool located;
  final bool locating;
  final ResolvedPlace? place;
  final VoidCallback onUseLocation;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: located
              ? Row(
                  key: const ValueKey('located'),
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: LoginFlowColors.accentMuted,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.location_on_rounded,
                        color: LoginFlowColors.accent,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.space3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Current location',
                                style: theme.textTheme.labelMedium?.copyWith(
                                  color: LoginFlowColors.accent,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(width: 6),
                              const Icon(
                                Icons.check_circle_rounded,
                                size: 14,
                                color: LoginFlowColors.accent,
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            place?.line1 ?? '',
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            place?.line2 ?? '',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: AppColors.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                )
              : InkWell(
                  key: const ValueKey('cta'),
                  onTap: onUseLocation,
                  borderRadius: BorderRadius.circular(14),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.space2,
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: LoginFlowColors.accentMuted,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Center(
                            child: locating
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: LoginFlowColors.accent,
                                    ),
                                  )
                                : const Icon(
                                    Icons.my_location_rounded,
                                    color: LoginFlowColors.accent,
                                    size: 18,
                                  ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.space3),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                locating
                                    ? 'Finding your location…'
                                    : 'Use my current location',
                                style: theme.textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                'Or drag the pin to fine-tune it manually',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: AppColors.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
        ),
        const SizedBox(height: AppSpacing.space4),
        LoginFlowContinueButton(
          label: 'Confirm & continue',
          enabled: located,
          onPressed: onContinue,
        ),
      ],
    );
  }
}
