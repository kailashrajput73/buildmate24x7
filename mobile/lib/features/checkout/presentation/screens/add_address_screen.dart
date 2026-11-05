import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../../../../core/location/device_location.dart';
import '../../../../core/state/cart_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/app_icons.dart';
import '../../../auth/presentation/widgets/auth_validators.dart';
import '../../domain/models/address_models.dart';

/// Checkout step 2 of 4 — add a new delivery address.
///
/// Pops with the saved [DeliveryAddress], or `null` if the user backs out.
class AddAddressScreen extends StatefulWidget {
  const AddAddressScreen({super.key, this.showMapPreview = true});

  /// Tests turn this off so no map tiles are fetched.
  final bool showMapPreview;

  @override
  State<AddAddressScreen> createState() => _AddAddressScreenState();
}

enum _PincodeStatus { idle, loading, found, notFound }

class _AddAddressScreenState extends State<AddAddressScreen> {
  static const double _maxContentWidth = 720;
  static const _location = DeviceLocation();
  static const _defaultCenter = LatLng(12.9716, 77.5946);

  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _mobile = TextEditingController();
  final _pincode = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _house = TextEditingController();
  final _area = TextEditingController();
  final _customLabel = TextEditingController();
  final _houseFocus = FocusNode();
  final _mapController = MapController();

  var _type = AddressType.home;
  var _isDefault = false;
  var _pinStatus = _PincodeStatus.idle;
  var _locating = false;
  var _saving = false;
  var _autovalidate = AutovalidateMode.disabled;
  LatLng _pin = _defaultCenter;

  @override
  void dispose() {
    for (final c in [
      _name,
      _mobile,
      _pincode,
      _city,
      _state,
      _house,
      _area,
      _customLabel,
    ]) {
      c.dispose();
    }
    _houseFocus.dispose();
    _mapController.dispose();
    super.dispose();
  }

  Future<void> _onPincodeChanged(String value) async {
    if (value.length < 6) {
      if (_pinStatus != _PincodeStatus.idle) {
        setState(() => _pinStatus = _PincodeStatus.idle);
      }
      return;
    }
    setState(() => _pinStatus = _PincodeStatus.loading);
    final result = await PincodeDirectory.lookup(value);
    // Ignore stale lookups if the user kept typing.
    if (!mounted || _pincode.text != value) return;
    setState(() {
      if (result == null) {
        _pinStatus = _PincodeStatus.notFound;
      } else {
        _pinStatus = _PincodeStatus.found;
        _city.text = result.$1;
        _state.text = result.$2;
      }
    });
  }

  Future<void> _useCurrentLocation() async {
    if (_locating) return;
    FocusScope.of(context).unfocus();
    setState(() => _locating = true);

    try {
      final place = await _location.currentPlace();
      if (!mounted) return;

      setState(() {
        _locating = false;
        _pin = place.point;
        if (place.area.isNotEmpty) _area.text = place.area;
        if (place.city.isNotEmpty) _city.text = place.city;
        if (place.state.isNotEmpty) _state.text = place.state;
        if (place.pincode.isNotEmpty) {
          _pincode.text = place.pincode;
          _pinStatus = _PincodeStatus.found;
        }
        if (place.house.isNotEmpty && _house.text.trim().isEmpty) {
          _house.text = place.house;
        }
      });
      if (widget.showMapPreview) {
        try {
          _mapController.move(place.point, 16);
        } catch (_) {}
      }

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Location found. Add your house/flat number.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      if (_house.text.trim().isEmpty) _houseFocus.requestFocus();
    } on LocationException catch (error) {
      _showLocationError(error);
    } on TimeoutException {
      _showLocationError(
        const LocationException('Could not get a GPS fix. Try again outdoors.'),
      );
    } catch (_) {
      _showLocationError(
        const LocationException('Could not read your current location.'),
      );
    }
  }

  void _showLocationError(LocationException error) {
    if (!mounted) return;
    setState(() => _locating = false);
    ScaffoldMessenger.of(context)
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

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) {
      setState(() => _autovalidate = AutovalidateMode.onUserInteraction);
      return;
    }
    setState(() => _saving = true);
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;

    Navigator.of(context).pop(
      DeliveryAddress(
        fullName: _name.text.trim(),
        mobile: _mobile.text.trim(),
        pincode: _pincode.text.trim(),
        city: _city.text.trim(),
        state: _state.text.trim(),
        house: _house.text.trim(),
        area: _area.text.trim(),
        type: _type,
        customLabel: _type == AddressType.other
            ? _customLabel.text.trim()
            : null,
        isDefault: _isDefault,
        location: widget.showMapPreview ? _pin : null,
      ),
    );
  }

  String? _pincodeValidator(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'Pincode is required';
    if (!RegExp(r'^[1-9]\d{5}$').hasMatch(v)) {
      return 'Enter a valid 6-digit pincode';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final cartCount = context.select<CartController, int>(
      (cart) => cart.totalQuantity,
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _AddressHeader(cartCount: cartCount),
          Expanded(
            child: Form(
              key: _formKey,
              autovalidateMode: _autovalidate,
              child: ListView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.space4,
                  AppSpacing.space4,
                  AppSpacing.space4,
                  AppSpacing.space6,
                ),
                children: [
                  _constrained(
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _CurrentLocationButton(
                          loading: _locating,
                          onTap: _useCurrentLocation,
                        ),
                        const _OrDivider(),
                        _SectionCard(
                          icon: Icons.person_outline_rounded,
                          title: 'Contact Details',
                          children: [
                            _Field(
                              controller: _name,
                              label: 'Full Name',
                              textCapitalization: TextCapitalization.words,
                              autofillHints: const [AutofillHints.name],
                              validator: AuthValidators.fullName,
                            ),
                            _Field(
                              controller: _mobile,
                              label: 'Mobile Number',
                              prefixText: '+91  ',
                              keyboardType: TextInputType.phone,
                              autofillHints: const [
                                AutofillHints.telephoneNumberNational,
                              ],
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(10),
                              ],
                              validator: AuthValidators.mobile,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.space4),
                        _SectionCard(
                          icon: Icons.location_on_outlined,
                          title: 'Address',
                          children: [
                            _Field(
                              controller: _pincode,
                              label: 'Pincode',
                              keyboardType: TextInputType.number,
                              autofillHints: const [AutofillHints.postalCode],
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(6),
                              ],
                              onChanged: _onPincodeChanged,
                              validator: _pincodeValidator,
                              suffixIcon: _PincodeSuffix(status: _pinStatus),
                              helperText: switch (_pinStatus) {
                                _PincodeStatus.found =>
                                  'Delivery available · City & State filled',
                                _PincodeStatus.notFound =>
                                  "Couldn't find this pincode — enter City & State",
                                _ => 'City & State fill in automatically',
                              },
                              helperColor: switch (_pinStatus) {
                                _PincodeStatus.found => AppColors.success,
                                _PincodeStatus.notFound => AppColors.warning,
                                _ => null,
                              },
                            ),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: _Field(
                                    controller: _city,
                                    label: 'City',
                                    textCapitalization:
                                        TextCapitalization.words,
                                    autofillHints: const [
                                      AutofillHints.addressCity,
                                    ],
                                    validator: (v) =>
                                        AuthValidators.requiredField(v, 'City'),
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.space3),
                                Expanded(
                                  child: _Field(
                                    controller: _state,
                                    label: 'State',
                                    textCapitalization:
                                        TextCapitalization.words,
                                    autofillHints: const [
                                      AutofillHints.addressState,
                                    ],
                                    validator: (v) =>
                                        AuthValidators.requiredField(
                                          v,
                                          'State',
                                        ),
                                  ),
                                ),
                              ],
                            ),
                            _Field(
                              controller: _house,
                              focusNode: _houseFocus,
                              label: 'House / Flat / Building No.',
                              textCapitalization: TextCapitalization.words,
                              validator: (v) => AuthValidators.requiredField(
                                v,
                                'House / Flat / Building No.',
                              ),
                            ),
                            _Field(
                              controller: _area,
                              label: 'Area / Street / Landmark',
                              textCapitalization: TextCapitalization.sentences,
                              textInputAction: TextInputAction.done,
                              autofillHints: const [
                                AutofillHints.streetAddressLine2,
                              ],
                              validator: (v) => AuthValidators.requiredField(
                                v,
                                'Area / Street',
                              ),
                            ),
                          ],
                        ),
                        if (widget.showMapPreview) ...[
                          const SizedBox(height: AppSpacing.space4),
                          _SectionCard(
                            icon: Icons.map_outlined,
                            title: 'Pin Location',
                            trailing: 'Optional',
                            children: [
                              _MapPreview(
                                controller: _mapController,
                                initialCenter: _pin,
                                onMoved: (center) => _pin = center,
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: AppSpacing.space4),
                        _SectionCard(
                          icon: Icons.bookmark_border_rounded,
                          title: 'Save Address As',
                          children: [
                            _AddressTypeChips(
                              selected: _type,
                              onSelected: (t) => setState(() => _type = t),
                            ),
                            AnimatedSize(
                              duration: const Duration(milliseconds: 200),
                              curve: Curves.easeOutCubic,
                              alignment: Alignment.topCenter,
                              child: _type == AddressType.other
                                  ? _Field(
                                      controller: _customLabel,
                                      label: 'Label (e.g. Site 2, Warehouse)',
                                      textCapitalization:
                                          TextCapitalization.words,
                                      textInputAction: TextInputAction.done,
                                    )
                                  : const SizedBox(width: double.infinity),
                            ),
                            _DefaultToggle(
                              value: _isDefault,
                              onChanged: (v) => setState(() => _isDefault = v),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _SaveBar(
        maxWidth: _maxContentWidth,
        saving: _saving,
        onSave: _save,
      ),
    );
  }

  Widget _constrained(Widget child) => Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: _maxContentWidth),
      child: child,
    ),
  );
}

// ── Header + stepper ────────────────────────────────────────────────────

class _AddressHeader extends StatelessWidget {
  const _AddressHeader({required this.cartCount});

  final int cartCount;

  static const _steps = ['Cart', 'Address', 'Payment', 'Confirm'];
  static const _currentStep = 1;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: AppColors.surface,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            SizedBox(
              height: AppSpacing.space14,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.space1,
                ),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      tooltip: 'Back',
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                    Expanded(
                      child: Text(
                        'Add New Address',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      onPressed: null,
                      tooltip: 'Cart',
                      icon: Badge(
                        isLabelVisible: cartCount > 0,
                        backgroundColor: AppColors.secondary,
                        label: Text(
                          cartCount > 99 ? '99+' : '$cartCount',
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppColors.onSecondary,
                          ),
                        ),
                        child: Icon(
                          appIcon('shopping_cart'),
                          color: AppColors.onSurface,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.space4,
                0,
                AppSpacing.space4,
                AppSpacing.space3,
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      for (var i = 0; i < _steps.length; i++)
                        Expanded(
                          child: Text(
                            '${i + 1}. ${_steps[i]}',
                            textAlign: switch (i) {
                              0 => TextAlign.left,
                              3 => TextAlign.right,
                              _ => TextAlign.center,
                            },
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: i <= _currentStep
                                  ? AppColors.primary
                                  : AppColors.outline,
                              fontWeight: i == _currentStep
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.space2),
                  TweenAnimationBuilder<double>(
                    tween: Tween(
                      begin: _currentStep / _steps.length,
                      end: (_currentStep + 1) / _steps.length,
                    ),
                    duration: const Duration(milliseconds: 600),
                    curve: Curves.easeOutCubic,
                    builder: (context, value, _) => LinearProgressIndicator(
                      value: value,
                      minHeight: 6,
                      borderRadius: AppRadius.pillAll,
                      color: AppColors.primary,
                      backgroundColor: AppColors.surfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.divider),
          ],
        ),
      ),
    );
  }
}

// ── Current location ────────────────────────────────────────────────────

class _CurrentLocationButton extends StatelessWidget {
  const _CurrentLocationButton({required this.loading, required this.onTap});

  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: AppColors.primaryContainer.withValues(alpha: 0.45),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: const BorderSide(color: AppColors.primary, width: 1.2),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: loading ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.space3),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: loading
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: AppColors.onPrimary,
                        ),
                      )
                    : const Icon(
                        Icons.my_location_rounded,
                        color: AppColors.onPrimary,
                        size: 22,
                      ),
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      loading
                          ? 'Detecting location…'
                          : 'Use my current location',
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Auto-fill your address using GPS',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.primary),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.space4),
      child: Row(
        children: [
          const Expanded(child: Divider(color: AppColors.divider)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space3),
            child: Text(
              'OR ENTER MANUALLY',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: AppColors.outline,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.8,
              ),
            ),
          ),
          const Expanded(child: Divider(color: AppColors.divider)),
        ],
      ),
    );
  }
}

// ── Form building blocks ────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.icon,
    required this.title,
    required this.children,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String? trailing;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            left: AppSpacing.space1,
            bottom: AppSpacing.space2,
          ),
          child: Row(
            children: [
              Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: AppSpacing.space2),
              Expanded(
                child: Text(
                  title.toUpperCase(),
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: AppColors.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
              if (trailing != null)
                Text(
                  trailing!,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: AppColors.outline,
                  ),
                ),
            ],
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: AppColors.divider),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.space4,
              AppSpacing.space4,
              AppSpacing.space4,
              AppSpacing.space1,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: children,
            ),
          ),
        ),
      ],
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    this.focusNode,
    this.keyboardType,
    this.textInputAction = TextInputAction.next,
    this.textCapitalization = TextCapitalization.none,
    this.inputFormatters,
    this.autofillHints,
    this.validator,
    this.onChanged,
    this.prefixText,
    this.suffixIcon,
    this.helperText,
    this.helperColor,
  });

  final TextEditingController controller;
  final String label;
  final FocusNode? focusNode;
  final TextInputType? keyboardType;
  final TextInputAction textInputAction;
  final TextCapitalization textCapitalization;
  final List<TextInputFormatter>? inputFormatters;
  final Iterable<String>? autofillHints;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged;
  final String? prefixText;
  final Widget? suffixIcon;
  final String? helperText;
  final Color? helperColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.space3),
      child: TextFormField(
        controller: controller,
        focusNode: focusNode,
        keyboardType: keyboardType,
        textInputAction: textInputAction,
        textCapitalization: textCapitalization,
        inputFormatters: inputFormatters,
        autofillHints: autofillHints,
        validator: validator,
        onChanged: onChanged,
        style: theme.textTheme.bodyLarge?.copyWith(color: AppColors.onSurface),
        decoration: InputDecoration(
          labelText: label,
          prefixText: prefixText,
          prefixStyle: theme.textTheme.bodyLarge?.copyWith(
            color: AppColors.onSurface,
            fontWeight: FontWeight.w600,
          ),
          suffixIcon: suffixIcon,
          helperText: helperText,
          helperStyle: helperColor == null
              ? null
              : theme.textTheme.bodySmall?.copyWith(
                  color: helperColor,
                  fontWeight: FontWeight.w600,
                ),
          helperMaxLines: 2,
          errorMaxLines: 2,
        ),
      ),
    );
  }
}

class _PincodeSuffix extends StatelessWidget {
  const _PincodeSuffix({required this.status});

  final _PincodeStatus status;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      child: switch (status) {
        _PincodeStatus.loading => const Padding(
          key: ValueKey('loading'),
          padding: EdgeInsets.all(14),
          child: SizedBox.square(
            dimension: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
        _PincodeStatus.found => const Icon(
          Icons.check_circle_rounded,
          key: ValueKey('found'),
          color: AppColors.success,
        ),
        _PincodeStatus.notFound => const Icon(
          Icons.info_outline_rounded,
          key: ValueKey('notFound'),
          color: AppColors.warning,
        ),
        _PincodeStatus.idle => const SizedBox.shrink(key: ValueKey('idle')),
      },
    );
  }
}

// ── Map preview ─────────────────────────────────────────────────────────

class _MapPreview extends StatelessWidget {
  const _MapPreview({
    required this.controller,
    required this.initialCenter,
    required this.onMoved,
  });

  final MapController controller;
  final LatLng initialCenter;
  final ValueChanged<LatLng> onMoved;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.space3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: AppRadius.mdAll,
            child: SizedBox(
              height: 170,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  FlutterMap(
                    mapController: controller,
                    options: MapOptions(
                      initialCenter: initialCenter,
                      initialZoom: 15,
                      interactionOptions: const InteractionOptions(
                        flags:
                            InteractiveFlag.drag |
                            InteractiveFlag.pinchZoom |
                            InteractiveFlag.doubleTapZoom,
                      ),
                      onPositionChanged: (camera, hasGesture) {
                        if (hasGesture) onMoved(camera.center);
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
                  // Pin stays centred; the map pans beneath it.
                  const IgnorePointer(
                    child: Center(
                      child: Padding(
                        padding: EdgeInsets.only(bottom: 36),
                        child: Icon(
                          Icons.location_on_rounded,
                          size: 40,
                          color: AppColors.primary,
                          shadows: [
                            Shadow(color: AppColors.shadow, blurRadius: 8),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.space2),
          Row(
            children: [
              const Icon(
                Icons.pan_tool_alt_outlined,
                size: 16,
                color: AppColors.outline,
              ),
              const SizedBox(width: AppSpacing.space2),
              Expanded(
                child: Text(
                  'Drag the map to place the pin on your exact location',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Address type + default ──────────────────────────────────────────────

class _AddressTypeChips extends StatelessWidget {
  const _AddressTypeChips({required this.selected, required this.onSelected});

  final AddressType selected;
  final ValueChanged<AddressType> onSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.space3),
      child: Row(
        children: [
          for (final type in AddressType.values) ...[
            if (type != AddressType.values.first)
              const SizedBox(width: AppSpacing.space2),
            Expanded(
              child: Builder(
                builder: (context) {
                  final isSelected = type == selected;
                  return Semantics(
                    selected: isSelected,
                    button: true,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primaryContainer
                            : AppColors.surface,
                        borderRadius: AppRadius.pillAll,
                        border: Border.all(
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.outlineVariant,
                          width: isSelected ? 1.5 : 1,
                        ),
                      ),
                      child: Material(
                        type: MaterialType.transparency,
                        child: InkWell(
                          borderRadius: AppRadius.pillAll,
                          onTap: () => onSelected(type),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              vertical: AppSpacing.space3,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  type.icon,
                                  size: 18,
                                  color: isSelected
                                      ? AppColors.primary
                                      : AppColors.onSurfaceVariant,
                                ),
                                const SizedBox(width: AppSpacing.space1),
                                Flexible(
                                  child: Text(
                                    type.label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: theme.textTheme.labelLarge?.copyWith(
                                      color: isSelected
                                          ? AppColors.primary
                                          : AppColors.onSurfaceVariant,
                                      fontWeight: isSelected
                                          ? FontWeight.w700
                                          : FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DefaultToggle extends StatelessWidget {
  const _DefaultToggle({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        const Divider(height: 1, color: AppColors.divider),
        MergeSemantics(
          child: InkWell(
            onTap: () => onChanged(!value),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.space2),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Make this my default address',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          'Used first at every checkout',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Switch(value: value, onChanged: onChanged),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Bottom bar ──────────────────────────────────────────────────────────

class _SaveBar extends StatelessWidget {
  const _SaveBar({
    required this.maxWidth,
    required this.saving,
    required this.onSave,
  });

  final double maxWidth;
  final bool saving;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxWidth),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.space4,
                AppSpacing.space3,
                AppSpacing.space4,
                AppSpacing.space3,
              ),
              child: SizedBox(
                width: double.infinity,
                height: AppSpacing.buttonHeight,
                child: FilledButton(
                  onPressed: saving ? null : onSave,
                  style: FilledButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.mdAll,
                    ),
                  ),
                  child: saving
                      ? const SizedBox.square(
                          dimension: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            color: AppColors.onPrimary,
                          ),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Flexible(
                              child: Text(
                                'Save & Deliver Here',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            SizedBox(width: AppSpacing.space2),
                            Icon(Icons.arrow_forward_rounded, size: 20),
                          ],
                        ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
