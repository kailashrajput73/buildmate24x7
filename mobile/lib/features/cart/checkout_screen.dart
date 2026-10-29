import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/payment.dart';
import '../../core/glass.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});
  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutState();
}

class _CheckoutState extends ConsumerState<CheckoutScreen> {
  String _fulfilment = 'StorePickup';
  int? _addressId;
  DateTime? _when;
  final _note = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(cartProvider.notifier).reload(fulfilment: _fulfilment));
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _pickWhen() async {
    final now = DateTime.now();
    final d = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 30)), initialDate: _when ?? now);
    if (d == null || !mounted) return;
    final tm = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_when ?? now.add(const Duration(hours: 2))));
    if (tm == null) return;
    setState(() => _when = DateTime(d.year, d.month, d.day, tm.hour, tm.minute));
  }

  Future<void> _pay() async {
    setState(() => _busy = true);
    try {
      final r = CheckoutResult.fromJson(await ref.read(apiProvider).post<Json>('/api/orders/checkout', {
        'fulfilmentType': _fulfilment,
        'addressId': _fulfilment == 'HomeDelivery' ? _addressId : null,
        'preferredAt': _when?.toUtc().toIso8601String(),
        'notes': _note.text.trim().isEmpty ? null : _note.text.trim(),
      }));
      final res = await CashfreePayment.pay(r);
      if (!mounted) return;
      if (res.outcome == PayOutcome.failed && res.message != null) toast(context, res.message!, error: true);
      context.pushReplacement('/orders/${r.orderId}/paid');
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Bulk / site orders: send the cart to the store for its best price instead of paying now.
  Future<void> _askForQuote() async {
    setState(() => _busy = true);
    try {
      final j = await ref.read(apiProvider).post<Json>('/api/quotations', {
        'fulfilmentType': _fulfilment,
        'addressId': _fulfilment == 'HomeDelivery' ? _addressId : null,
        'preferredAt': _when?.toUtc().toIso8601String(),
        'notes': _note.text.trim().isEmpty ? null : _note.text.trim(),
      });
      ref.read(cartProvider.notifier).reload();
      ref.invalidate(quotationsProvider);
      if (!mounted) return;
      toast(context, 'Sent to the store. You will get a notification when the price is ready.');
      context.pushReplacement('/quotations/${j['id']}');
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(trProvider);
    final cart = ref.watch(cartProvider);
    final addresses = ref.watch(addressesProvider);
    final list = addresses.valueOrNull ?? [];
    if (_addressId == null && list.isNotEmpty) _addressId = (list.where((a) => a.isDefault).firstOrNull ?? list.first).id;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(backgroundColor: AppColors.surface, title: Text(t('checkout.title'))),
      body: cart.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e),
        data: (c) => ListView(padding: const EdgeInsets.all(16), children: [
          if (c.storePickupEnabled)
            _Choice(selected: _fulfilment == 'StorePickup', icon: Icons.storefront, title: t('checkout.pickup'), subtitle: 'Free · we notify you when it is packed',
                onTap: () { setState(() => _fulfilment = 'StorePickup'); ref.read(cartProvider.notifier).reload(fulfilment: 'StorePickup'); }),
          if (c.homeDeliveryEnabled)
            _Choice(selected: _fulfilment == 'HomeDelivery', icon: Icons.local_shipping_outlined, title: t('checkout.delivery'),
                subtitle: c.freeDeliveryAbove > 0 ? 'Free above ${money(c.freeDeliveryAbove)}' : 'Delivery charges apply',
                onTap: () { setState(() => _fulfilment = 'HomeDelivery'); ref.read(cartProvider.notifier).reload(fulfilment: 'HomeDelivery'); }),
          if (_fulfilment == 'HomeDelivery') ...[
            const SizedBox(height: 8),
            Text('Deliver to', style: Theme.of(context).textTheme.titleSmall),
            for (final a in list)
              RadioListTile<int>(
                value: a.id, groupValue: _addressId, onChanged: (v) => setState(() => _addressId = v),
                title: Text(a.name, style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text(a.oneLine), contentPadding: EdgeInsets.zero,
              ),
            TextButton.icon(
              icon: const Icon(Icons.add_location_alt_outlined),
              label: const Text('Add site / delivery address'),
              onPressed: () async {
                final saved = await showAddressSheet(context, ref);
                if (saved != null) setState(() => _addressId = saved.id);
              },
            ),
          ],
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.schedule),
            title: Text(t('checkout.when')),
            subtitle: Text(_when == null ? 'As soon as possible' : '${_when!.day}/${_when!.month} at ${TimeOfDay.fromDateTime(_when!).format(context)}'),
            trailing: const Icon(Icons.edit_calendar_outlined),
            onTap: _pickWhen,
          ),
          TextField(controller: _note, decoration: InputDecoration(labelText: t('checkout.note'), hintText: 'e.g. Keep the pipes cut to 3 m')),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: glassDecoration(radius: 22),
            child: Column(children: [
              _kv('${c.count} items', money(c.total)),
              _kv('Delivery', c.deliveryFee > 0 ? money(c.deliveryFee) : 'Free'),
              if (c.roundOff.abs() >= 0.005) _kv('Round off', '${c.roundOff > 0 ? '+' : '−'}${money(c.roundOff.abs())}'),
              const Divider(height: 16),
              _kv('To pay', money(c.payable), bold: true),
              if (c.rewardPoints > 0) _kv('Points you will earn', '+${qty(c.rewardPoints)}', color: BM.leaf),
            ]),
          ),
          if (c.issues.isNotEmpty) ...[
            const SizedBox(height: 12),
            for (final x in c.issues) Text(x, style: const TextStyle(color: BM.brick)),
          ],
        ]),
      ),
      bottomNavigationBar: cart.valueOrNull == null
          ? null
          : Material(
              color: AppColors.surface,
              elevation: AppElevation.level3,
              shadowColor: AppColors.shadow,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.space4, AppSpacing.space3, AppSpacing.space4, AppSpacing.space3),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    FilledButton.icon(
                      icon: const Icon(Icons.lock_outline_rounded, size: 18),
                      onPressed: _busy || !cart.value!.canCheckout || (_fulfilment == 'HomeDelivery' && _addressId == null) ? null : _pay,
                      label: Text(_busy ? 'Please wait…' : '${t('checkout.pay')} ${money(cart.value!.payable)}'),
                    ),
                    TextButton.icon(
                      icon: const Icon(Icons.request_quote_outlined, size: 18),
                      onPressed: _busy || cart.value!.items.isEmpty || (_fulfilment == 'HomeDelivery' && _addressId == null) ? null : _askForQuote,
                      label: const Text('Buying in bulk? Ask for a quote instead'),
                    ),
                  ]),
                ),
              ),
            ),
    );
  }

  Widget _kv(String k, String v, {bool bold = false, Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Text(k, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w400))),
          Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w600, color: color, fontSize: bold ? 18 : 14)),
        ]),
      );
}

class _Choice extends StatelessWidget {
  const _Choice({required this.selected, required this.icon, required this.title, required this.subtitle, required this.onTap});
  final bool selected;
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: selected ? BM.pipeLight : Colors.white,
              border: Border.all(color: selected ? BM.pipe : BM.line, width: selected ? 2 : 1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(children: [
              Icon(icon, color: BM.pipe),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(subtitle, style: const TextStyle(color: BM.inkSoft, fontSize: 13)),
              ])),
              if (selected) const Icon(Icons.check_circle, color: BM.pipe),
            ]),
          ),
        ),
      );
}

/// Bottom sheet to add a delivery / site address. Returns the saved address.
Future<Address?> showAddressSheet(BuildContext context, WidgetRef ref, {Address? existing}) {
  return showModalBottomSheet<Address>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => Padding(padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom), child: _AddressForm(existing: existing)),
  );
}

class _AddressForm extends ConsumerStatefulWidget {
  const _AddressForm({this.existing});
  final Address? existing;
  @override
  ConsumerState<_AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends ConsumerState<_AddressForm> {
  final _f = GlobalKey<FormState>();
  late final c = {
    'name': TextEditingController(text: widget.existing?.name ?? ref.read(authProvider).user?.name),
    'phone': TextEditingController(text: widget.existing?.phone ?? ref.read(authProvider).user?.phone),
    'line1': TextEditingController(text: widget.existing?.line1),
    'line2': TextEditingController(text: widget.existing?.line2),
    'landmark': TextEditingController(text: widget.existing?.landmark),
    'city': TextEditingController(text: widget.existing?.city),
    'state': TextEditingController(text: widget.existing?.state ?? 'Gujarat'),
    'pincode': TextEditingController(text: widget.existing?.pincode),
  };
  bool _busy = false;

  @override
  void dispose() {
    for (final x in c.values) {
      x.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_f.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final body = {for (final e in c.entries) e.key: e.value.text.trim(), 'isDefault': widget.existing?.isDefault ?? true};
      final api = ref.read(apiProvider);
      final j = widget.existing == null ? await api.post<Json>('/api/account/addresses', body) : await api.put<Json>('/api/account/addresses/${widget.existing!.id}', body);
      ref.invalidate(addressesProvider);
      if (mounted) Navigator.of(context).pop(Address.fromJson(j));
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    String? req(String? v) => v == null || v.trim().isEmpty ? 'Required' : null;
    Widget field(String k, String label, {String? Function(String?)? v, TextInputType? type, int? max}) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: TextFormField(controller: c[k], validator: v, keyboardType: type, maxLength: max,
              inputFormatters: type == TextInputType.number || type == TextInputType.phone ? [FilteringTextInputFormatter.digitsOnly] : null,
              decoration: InputDecoration(labelText: label, counterText: '')),
        );
    return SafeArea(
      child: Form(
        key: _f,
        child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), children: [
          Text(widget.existing == null ? 'New address' : 'Edit address', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          field('name', 'Contact name', v: req),
          field('phone', 'Mobile', v: (x) => x == null || x.length != 10 ? '10 digits' : null, type: TextInputType.phone, max: 10),
          field('line1', 'House / site, street', v: req),
          field('line2', 'Area / locality'),
          field('landmark', 'Landmark'),
          Row(children: [
            Expanded(child: field('city', 'City', v: req)),
            const SizedBox(width: 10),
            Expanded(child: field('pincode', 'Pincode', v: (x) => x == null || x.length != 6 ? '6 digits' : null, type: TextInputType.number, max: 6)),
          ]),
          field('state', 'State', v: req),
          FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? '…' : 'Save address')),
        ]),
      ),
    );
  }
}
