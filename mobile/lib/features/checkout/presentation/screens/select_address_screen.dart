import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/cart_controller.dart';
import '../../../../core/state/delivery_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../catalog/domain/models/catalog_models.dart';
import '../../domain/models/address_models.dart';
import '../widgets/checkout_widgets.dart';

/// Checkout step 2 of 4 — pick a shipping address and a delivery option.
///
/// "+ Add New" opens [AddAddressScreen]; the saved address is added to the
/// list and selected.
class SelectAddressScreen extends StatefulWidget {
  const SelectAddressScreen({super.key, this.initialAddresses});

  /// Addresses supplied by the account API, when available.
  final List<DeliveryAddress>? initialAddresses;

  @override
  State<SelectAddressScreen> createState() => _SelectAddressScreenState();
}

class _SelectAddressScreenState extends State<SelectAddressScreen> {
  late final List<DeliveryAddress> _addresses = [
    ...widget.initialAddresses ?? const <DeliveryAddress>[],
  ];
  late int _selected = _addresses.indexWhere((a) => a.isDefault);
  var _delivery = DeliveryOption.standard;

  /// Server answer per address PIN code (each address is checked on its own).
  final Map<String, DeliveryCheck> _status = {};

  @override
  void initState() {
    super.initState();
    if (_selected < 0 && _addresses.isNotEmpty) _selected = 0;
    // Prefer the address in the selected delivery PIN code.
    final pin = context.read<DeliveryController>().selected?.pincode;
    final match = pin == null
        ? -1
        : _addresses.indexWhere((a) => a.pincode == pin);
    if (match >= 0) _selected = match;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      for (final a in _addresses) {
        _checkAddress(a);
      }
    });
  }

  Future<DeliveryCheck?> _checkAddress(DeliveryAddress a) async {
    try {
      final r = await context.read<DeliveryController>().check(a.pincode);
      if (mounted) setState(() => _status[a.pincode] = r);
      return r;
    } catch (_) {
      return null; // Offline: checked again when continuing.
    }
  }

  void _choose(int i) {
    setState(() => _selected = i);
    // The delivery address becomes the selected delivery PIN code, so Add to Cart and checkout agree.
    final delivery = context.read<DeliveryController>();
    if (delivery.selected?.pincode != _addresses[i].pincode) {
      () async {
        try {
          await delivery.choose(_addresses[i].pincode);
        } catch (_) {
          // Offline: the address is checked again when continuing.
        }
      }();
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
  }

  Future<void> _addNew() async {
    final address = await Navigator.of(context).pushNamed(AppRoutes.addAddress);
    if (!mounted || address is! DeliveryAddress) return;
    setState(() {
      if (address.isDefault) {
        for (var i = 0; i < _addresses.length; i++) {
          if (_addresses[i].isDefault) {
            _addresses[i] = _addresses[i].withDefault(false);
          }
        }
        _addresses.insert(0, address);
        _selected = 0;
      } else {
        _addresses.add(address);
        _selected = _addresses.length - 1;
      }
    });
    _checkAddress(address);
    _showSnack('${address.label} address saved');
  }

  Future<void> _proceed() async {
    if (_selected < 0) {
      _showSnack('Add a shipping address to continue');
      return;
    }
    // Delivery only to a serviceable PIN code — checked with the server, never assumed.
    final address = _addresses[_selected];
    final status = await _checkAddress(address) ?? _status[address.pincode];
    if (!mounted) return;
    if (status == null) {
      _showSnack(
        'Could not check delivery to ${address.pincode}. Check your internet connection and try again.',
      );
      return;
    }
    if (!status.serviceable) {
      _showSnack(
        "Sorry, we don't deliver to ${address.pincode} yet. Choose an address in a serviceable PIN code.",
      );
      return;
    }
    Navigator.of(context).pushNamed(
      AppRoutes.payment,
      arguments: PaymentArgs(
        address: _addresses[_selected],
        delivery: _delivery,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          CheckoutStepHeader(currentStep: 1, cartCount: cart.totalQuantity),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.space4,
                AppSpacing.space5,
                AppSpacing.space4,
                AppSpacing.space6,
              ),
              children: [
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: kCheckoutMaxContentWidth,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        CheckoutSectionTitle(
                          icon: Icons.location_on_rounded,
                          title: 'Shipping Address',
                          action: TextButton.icon(
                            onPressed: _addNew,
                            style: TextButton.styleFrom(
                              foregroundColor: AppColors.primary,
                              visualDensity: VisualDensity.compact,
                            ),
                            icon: const Icon(Icons.add_rounded, size: 18),
                            label: const Text('Add New'),
                          ),
                        ),
                        if (_addresses.isEmpty)
                          _EmptyAddresses(onAdd: _addNew)
                        else
                          for (var i = 0; i < _addresses.length; i++) ...[
                            _AddressCard(
                              address: _addresses[i],
                              selected: i == _selected,
                              status: _status[_addresses[i].pincode],
                              onTap: () => _choose(i),
                            ),
                            const SizedBox(height: AppSpacing.space3),
                          ],
                        const SizedBox(height: AppSpacing.space3),
                        const CheckoutSectionTitle(
                          icon: Icons.local_shipping_rounded,
                          title: 'Delivery Options',
                        ),
                        for (final option in DeliveryOption.values) ...[
                          _DeliveryCard(
                            option: option,
                            selected: option == _delivery,
                            onTap: () => setState(() => _delivery = option),
                          ),
                          const SizedBox(height: AppSpacing.space3),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: CheckoutTotalBar(
        total: cart.grandTotal + _delivery.fee,
        label: 'Proceed to Payment',
        icon: Icons.arrow_forward_rounded,
        onShowSummary: () => showCheckoutPriceBreakdown(
          context,
          cart: cart,
          delivery: _delivery,
        ),
        onPressed: _proceed,
      ),
    );
  }
}

// ── Cards ───────────────────────────────────────────────────────────────

class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.address,
    required this.selected,
    required this.onTap,
    this.status,
  });

  final DeliveryAddress address;
  final bool selected;
  final VoidCallback onTap;

  /// Serviceable / Not serviceable, from the server (null while checking).
  final DeliveryCheck? status;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(
      color: AppColors.onSurfaceVariant,
      height: 1.4,
    );

    return CheckoutSelectableCard(
      selected: selected,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Flexible(
                child: Text(
                  address.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (address.isDefault) ...[
                const SizedBox(width: AppSpacing.space2),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space2,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.successContainer,
                    borderRadius: AppRadius.pillAll,
                  ),
                  child: Text(
                    'Default',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: AppColors.success,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.space1),
          Text(
            address.fullName,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          Text('${address.house}, ${address.area}', style: muted),
          Text(
            '${address.city} - ${address.pincode}, ${address.state}',
            style: muted,
          ),
          const SizedBox(height: AppSpacing.space1),
          Row(
            children: [
              const Icon(
                Icons.call_rounded,
                size: 14,
                color: AppColors.onSurfaceVariant,
              ),
              const SizedBox(width: AppSpacing.space1),
              Text(address.formattedMobile, style: muted),
            ],
          ),
          if (status != null) ...[
            const SizedBox(height: AppSpacing.space1),
            Row(
              children: [
                Icon(
                  status!.serviceable
                      ? Icons.check_circle_rounded
                      : Icons.cancel_rounded,
                  size: 14,
                  color: status!.serviceable
                      ? AppColors.success
                      : AppColors.error,
                ),
                const SizedBox(width: AppSpacing.space1),
                Text(
                  status!.serviceable ? 'Serviceable' : 'Not serviceable',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: status!.serviceable
                        ? AppColors.success
                        : AppColors.error,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final DeliveryOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isFree = option.fee == 0;

    return CheckoutSelectableCard(
      selected: selected,
      onTap: onTap,
      crossAxisAlignment: CrossAxisAlignment.center,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  option.label,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  option.eta,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          if (isFree)
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.space2,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: AppColors.successContainer,
                borderRadius: AppRadius.pillAll,
              ),
              child: Text(
                'FREE',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: AppColors.success,
                  fontWeight: FontWeight.w800,
                ),
              ),
            )
          else
            Text(
              formatInr(option.fee),
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
        ],
      ),
    );
  }
}

class _EmptyAddresses extends StatelessWidget {
  const _EmptyAddresses({required this.onAdd});

  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.space3),
      child: OutlinedButton.icon(
        onPressed: onAdd,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.all(AppSpacing.space5),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
        ),
        icon: const Icon(Icons.add_location_alt_outlined),
        label: const Text('Add a shipping address'),
      ),
    );
  }
}
