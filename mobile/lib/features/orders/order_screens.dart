import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/payment.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(trProvider);
    final orders = ref.watch(ordersProvider);
    return Scaffold(
      appBar: AppBar(title: Text(t('orders.title'))),
      body: orders.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(ordersProvider)),
        data: (list) => list.isEmpty
            ? EmptyView(icon: Icons.receipt_long_outlined, title: t('orders.empty'))
            : RefreshIndicator(
                onRefresh: () async => ref.invalidate(ordersProvider),
                child: ListView.separated(
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const Divider(),
                  itemBuilder: (_, i) {
                    final o = list[i];
                    return ListTile(
                      onTap: () => context.push('/orders/${o.id}'),
                      title: Row(children: [Expanded(child: Text(o.orderNo, style: const TextStyle(fontWeight: FontWeight.w700))), StatusChip(o.status)]),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(children: [
                          Expanded(child: Text('${dateTime(o.createdAt)} · ${o.itemCount} items · ${o.fulfilmentType == 'HomeDelivery' ? 'Delivery' : 'Pickup'}')),
                          Text(money(o.grandTotal), style: const TextStyle(fontWeight: FontWeight.w800, color: BM.ink)),
                        ]),
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}

class OrderScreen extends ConsumerWidget {
  const OrderScreen({super.key, required this.id});
  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final res = ref.watch(orderProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(res.valueOrNull?.summary.orderNo ?? 'Order')),
      body: res.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(orderProvider(id))),
        data: (o) {
          final s = o.summary;
          final steps = ['Confirmed', 'Packing', s.fulfilmentType == 'HomeDelivery' ? 'On the way' : 'Ready', s.fulfilmentType == 'HomeDelivery' ? 'Delivered' : 'Collected'];
          final idx = switch (s.status) { 'Paid' => 0, 'Processing' => 1, 'ReadyForPickup' || 'OutForDelivery' => 2, 'Completed' => 3, _ => -1 };
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(orderProvider(id)),
            child: ListView(padding: const EdgeInsets.all(16), children: [
              Row(children: [Expanded(child: Text('Placed ${dateTime(s.createdAt)}', style: const TextStyle(color: BM.inkSoft))), StatusChip(s.status)]),
              if (idx >= 0) ...[
                const SizedBox(height: 16),
                Row(children: [
                  for (var i = 0; i < 4; i++)
                    Expanded(child: Column(children: [
                      Container(height: 5, margin: const EdgeInsets.symmetric(horizontal: 2), decoration: BoxDecoration(color: i <= idx ? BM.leaf : BM.line, borderRadius: BorderRadius.circular(3))),
                      const SizedBox(height: 4),
                      Text(steps[i], style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: i <= idx ? BM.ink : BM.inkFaint)),
                    ])),
                ]),
              ],
              if (s.scheduledAt != null && idx >= 0 && idx < 3)
                Container(
                  margin: const EdgeInsets.only(top: 14),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: BM.pipeLight, borderRadius: BorderRadius.circular(10)),
                  child: Text('${s.fulfilmentType == 'HomeDelivery' ? 'Delivery' : 'Pickup'} scheduled: ${dateTime(s.scheduledAt)}', style: const TextStyle(color: BM.pipe, fontWeight: FontWeight.w700)),
                ),
              if (s.status == 'PendingPayment' || s.status == 'PaymentFailed') _PayAgain(order: o),
              if (o.cancelReason != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text('Cancelled: ${o.cancelReason}')),
              const SizedBox(height: 16),
              for (final i in o.items)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(children: [
                    ClipRRect(borderRadius: BorderRadius.circular(8), child: SizedBox(width: 52, height: 52, child: NetImage(i.imageUrl))),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(i.productName, style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text('${i.purchaseUnit == 'Box' ? '${qty(i.purchaseQuantity ?? 0)} box(es) of ${qty(i.packSize ?? 0)} · ${money(i.lineTotal)}' : '${qty(i.quantity)} × ${money(i.unitPrice)}'}${i.specialDiscountPercent > 0 ? ' (extra ${qty(i.specialDiscountPercent)}% off)' : ''}', style: const TextStyle(color: BM.inkSoft, fontSize: 13)),
                    ])),
                    Text(money(i.lineTotal), style: const TextStyle(fontWeight: FontWeight.w700)),
                  ]),
                ),
              const Divider(height: 24),
              _kv('Items', money(o.subTotal - o.discountTotal)),
              if (o.shippingFee > 0) _kv('Delivery', money(o.shippingFee)),
              _kv('Total', money(s.grandTotal), bold: true),
              _kv('Paid', money(o.amountPaid)),
              if (o.balanceDue > 0.01 && s.status != 'PendingPayment') _kv('To pay at counter', money(o.balanceDue), color: const Color(0xFF8A6400)),
              if (s.rewardPointsEarned > 0) _kv(o.rewardsCredited ? 'Points credited' : 'Points on handover', '+${qty(s.rewardPointsEarned)}', color: BM.leaf),
              if (s.invoiceNo != null) _kv('Invoice', s.invoiceNo!),
              const SizedBox(height: 20),
              Text('Updates', style: Theme.of(context).textTheme.titleSmall),
              for (final e in o.events.reversed)
                ListTile(
                  dense: true, contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.circle, size: 10, color: BM.pipe),
                  title: Text(e.action, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text([e.details, dateTime(e.at)].whereType<String>().join('\n')),
                ),
            ]),
          );
        },
      ),
    );
  }

  Widget _kv(String k, String v, {bool bold = false, Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Text(k, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w400))),
          Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w600, color: color)),
        ]),
      );
}

class _PayAgain extends ConsumerStatefulWidget {
  const _PayAgain({required this.order});
  final OrderDetail order;
  @override
  ConsumerState<_PayAgain> createState() => _PayAgainState();
}

class _PayAgainState extends ConsumerState<_PayAgain> {
  bool _busy = false;

  Future<void> _pay() async {
    setState(() => _busy = true);
    try {
      final r = CheckoutResult.fromJson(await ref.read(apiProvider).post<Json>('/api/orders/${widget.order.summary.id}/pay', {}));
      final res = await CashfreePayment.pay(r);
      if (!mounted) return;
      if (res.outcome == PayOutcome.failed && res.message != null) toast(context, res.message!, error: true);
      context.push('/orders/${r.orderId}/paid');
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    try {
      await ref.read(apiProvider).post<Json>('/api/orders/${widget.order.summary.id}/cancel');
      ref.invalidate(orderProvider(widget.order.summary.id));
      ref.invalidate(ordersProvider);
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: BM.tapeLight, borderRadius: BorderRadius.circular(10)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('This order is not paid yet.', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          FilledButton(onPressed: _busy ? null : _pay, child: Text('Pay ${money(widget.order.summary.grandTotal)}')),
          TextButton(onPressed: _busy ? null : _cancel, child: const Text('Cancel order')),
        ]),
      );
}

/// After returning from Cashfree: the API verifies the payment with Cashfree, then we show the result.
class PaymentResultScreen extends ConsumerStatefulWidget {
  const PaymentResultScreen({super.key, required this.orderId});
  final int orderId;
  @override
  ConsumerState<PaymentResultScreen> createState() => _PaymentResultState();
}

class _PaymentResultState extends ConsumerState<PaymentResultScreen> {
  Json? _r;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _check(0);
  }

  Future<void> _check(int attempt) async {
    try {
      final r = await ref.read(apiProvider).post<Json>('/api/orders/${widget.orderId}/confirm-payment');
      if (!mounted) return;
      setState(() => _r = r);
      if (r['status'] == 'PendingPayment' && attempt < 4) {
        Timer(const Duration(seconds: 3), () => _check(attempt + 1));
      } else {
        ref.read(cartProvider.notifier).reload();
        ref.invalidate(ordersProvider);
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = _r?['status'] as String?;
    final paid = status != null && !['PendingPayment', 'PaymentFailed', 'Cancelled'].contains(status);
    return Scaffold(
      appBar: AppBar(automaticallyImplyLeading: false),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _error != null
              ? ErrorView(_error!, onRetry: () { setState(() => _error = null); _check(0); })
              : Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(_r == null || status == 'PendingPayment' ? Icons.hourglass_top : paid ? Icons.check_circle : Icons.cancel,
                      size: 72, color: _r == null || status == 'PendingPayment' ? BM.tape : paid ? BM.leaf : BM.brick),
                  const SizedBox(height: 16),
                  Text(_r == null ? 'Checking payment…' : paid ? 'Order placed' : status == 'PendingPayment' ? 'Payment not received yet' : 'Payment failed',
                      style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 8),
                  if (_r != null) Text(paid ? 'Order ${_r!['orderNo']} is confirmed. We will notify you when it is ready.' : _r!['message'] as String? ?? '', textAlign: TextAlign.center),
                  const SizedBox(height: 24),
                  if (_r != null) ...[
                    FilledButton(onPressed: () => context.pushReplacement('/orders/${widget.orderId}'), child: const Text('View order')),
                    TextButton(onPressed: () => context.go('/home'), child: const Text('Back to home')),
                  ],
                ]),
        ),
      ),
    );
  }
}
