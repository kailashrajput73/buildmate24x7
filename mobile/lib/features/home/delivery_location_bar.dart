import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/delivery_location.dart';
import '../cart/checkout_screen.dart' show showAddressSheet;

class DeliveryLocationBar extends ConsumerStatefulWidget {
  const DeliveryLocationBar({super.key});
  @override
  ConsumerState<DeliveryLocationBar> createState() =>
      _DeliveryLocationBarState();
}

class _DeliveryLocationBarState extends ConsumerState<DeliveryLocationBar>
    with WidgetsBindingObserver {
  StreamSubscription<Position>? _positions;
  GoRouter? _router;
  bool _busy = false, _foreground = true;
  String? _message;
  int _generation = 0;
  bool get _visible =>
      _foreground &&
      _router?.routeInformationProvider.value.uri.path == '/home';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final router = GoRouter.of(context);
    if (_router == router) return;
    _router?.routeInformationProvider.removeListener(_visibility);
    _router = router;
    router.routeInformationProvider.addListener(_visibility);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    _visibility();
  }

  void _visibility() {
    if (!_visible) {
      _generation++;
      _positions?.cancel();
      _positions = null;
    } else if (ref.read(deliveryLocationProvider).gps &&
        _positions == null &&
        !_busy) {
      _locate();
    }
  }

  @override
  void dispose() {
    _generation++;
    _positions?.cancel();
    _router?.routeInformationProvider.removeListener(_visibility);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _resolve(Position p, int generation) async {
    final place = await ref.read(apiProvider).get<Json>('/api/geo/reverse', {
      'lat': p.latitude,
      'lng': p.longitude,
    });
    if (!mounted || generation != _generation || !_visible) return;
    ref.read(deliveryLocationProvider.notifier).state = DeliveryLocation(
      place: place,
      gps: true,
    );
    setState(() => _message = null);
  }

  Future<void> _locate() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    final generation = ++_generation;
    await _positions?.cancel();
    _positions = null;
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        if (mounted)
          setState(() => _message = 'GPS is off. Turn on location below.');
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied)
        permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (mounted)
          setState(
            () =>
                _message =
                    permission == LocationPermission.deniedForever
                        ? 'Location blocked. Open app settings below.'
                        : 'Location permission denied. Choose a saved address or try again.',
          );
        return;
      }
      const settings = LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 75,
        timeLimit: Duration(seconds: 20),
      );
      final p = await Geolocator.getCurrentPosition(locationSettings: settings);
      await _resolve(p, generation);
      if (!mounted || generation != _generation || !_visible) return;
      _positions = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 75,
        ),
      ).listen(
        (p) async {
          try {
            await _resolve(p, generation);
          } catch (_) {
            if (mounted)
              setState(
                () =>
                    _message =
                        'Cannot resolve location. Check your connection and retry.',
              );
          }
        },
        onError: (_) {
          if (mounted)
            setState(
              () => _message = 'Location unavailable. Check GPS and retry.',
            );
        },
      );
    } on TimeoutException {
      if (mounted)
        setState(
          () => _message = 'Location timed out. Move outdoors and retry.',
        );
    } catch (_) {
      if (mounted)
        setState(
          () =>
              _message =
                  'Cannot get your location. Check GPS and internet, then retry.',
        );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _choose(Address a) {
    _generation++;
    _positions?.cancel();
    _positions = null;
    ref.read(deliveryLocationProvider.notifier).state = DeliveryLocation(
      address: a,
    );
    setState(() => _message = null);
  }

  Future<void> _open() async {
    final loggedIn = ref.read(authProvider).status == AuthStatus.loggedIn;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder:
          (sheet) => Consumer(
            builder: (context, ref, _) {
              final addresses =
                  loggedIn
                      ? ref.watch(addressesProvider)
                      : const AsyncData<List<Address>>([]);
              return SafeArea(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    ListTile(
                      leading: const Icon(Icons.my_location),
                      title: const Text('Use current location'),
                      onTap: () {
                        Navigator.pop(sheet);
                        _locate();
                      },
                    ),
                    ListTile(
                      title: const Text('Turn on location'),
                      onTap: () => Geolocator.openLocationSettings(),
                    ),
                    ListTile(
                      title: const Text('Open app permission settings'),
                      onTap: () => Geolocator.openAppSettings(),
                    ),
                    ...addresses.when(
                      data:
                          (list) =>
                              list
                                  .map(
                                    (a) => ListTile(
                                      title: Text(a.name),
                                      subtitle: Text(a.oneLine),
                                      onTap: () {
                                        _choose(a);
                                        Navigator.pop(sheet);
                                      },
                                    ),
                                  )
                                  .toList(),
                      loading: () => [const LinearProgressIndicator()],
                      error:
                          (e, _) => [
                            ListTile(
                              title: const Text(
                                'Could not load saved addresses',
                              ),
                              onTap: () => ref.invalidate(addressesProvider),
                            ),
                          ],
                    ),
                    ListTile(
                      leading: const Icon(Icons.add_location_alt_outlined),
                      title: const Text('Add new address'),
                      onTap: () async {
                        Navigator.pop(sheet);
                        if (!loggedIn) {
                          this.context.push('/login?next=/addresses');
                          return;
                        }
                        final a = await showAddressSheet(
                          this.context,
                          this.ref,
                        );
                        if (mounted && a != null) _choose(a);
                      },
                    ),
                  ],
                ),
              );
            },
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final location = ref.watch(deliveryLocationProvider);
    final store = ref.watch(storeInfoProvider).valueOrNull;
    final pin =
        location.address?.pincode ?? location.place?['pincode'] as String?;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.location_on),
          title: const Text('Deliver to'),
          subtitle: Text(
            _message ??
                (location.label.isEmpty
                    ? 'Choose location or delivery address'
                    : location.label),
            maxLines: 2,
          ),
          trailing:
              _busy
                  ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(),
                  )
                  : const Icon(Icons.expand_more),
          onTap: _open,
        ),
        if (store != null && pin != null)
          Text(
            store.deliversTo(pin)
                ? 'Delivery available to $pin'
                : 'Delivery is not available to $pin. Store pickup is available.',
            style: const TextStyle(fontSize: 12),
          ),
        if (location.gps)
          const Text(
            'At checkout, confirm a full delivery address for this location.',
            style: TextStyle(fontSize: 12),
          ),
      ],
    );
  }
}
