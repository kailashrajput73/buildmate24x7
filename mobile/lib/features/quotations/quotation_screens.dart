import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/payment.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

const _labels = {
  'Requested': 'Waiting for the store',
  'Quoted': 'Price ready',
  'Accepted': 'Accepted',
  'Declined': 'Declined',
  'Expired': 'Price expired',
  'Cancelled': 'Closed by the store',
};

(Color, Color) _tone(String s) => switch (s) {
      'Quoted' => (AppColors.primaryContainer, AppColors.primary),
      'Requested' => (AppColors.secondaryContainer, AppColors.secondary),
      'Accepted' => (AppColors.successContainer, AppColors.success),
      _ => (AppColors.surfaceContainer, AppColors.onSurfaceVariant),
    };

class QuoteStatusChip extends StatelessWidget {
  const QuoteStatusChip(this.status, {super.key});
  final String status;
  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _tone(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space2, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: AppRadius.pillAll),
      child: Text(_labels[status] ?? status, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: fg, fontWeight: FontWeight.w700)),
    );
  }
}

/// Quotation tab: the customer's requests, newest first.
class QuotationsScreen extends ConsumerWidget {
  const QuotationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final loggedIn = ref.watch(authProvider).status == AuthStatus.loggedIn;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(backgroundColor: AppColors.surface, title: const Text('Quotations')),
      body: !loggedIn
          ? EmptyView(
              icon: Icons.request_quote_outlined,
              title: 'Get the best price for bulk orders',
              body: 'Log in, fill your cart and choose “Ask for a quote” at checkout.',
              action: FilledButton(onPressed: () => context.push('/login?next=/quotations'), child: const Text('Log in')),
            )
          : ref.watch(quotationsProvider).when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(quotationsProvider)),
                data: (list) => list.isEmpty
                    ? EmptyView(
                        icon: Icons.request_quote_outlined,
                        title: 'No quotations yet',
                        body: 'Buying for a site or in bulk? Fill your cart, go to checkout and choose “Ask for a quote”. The store sends its best price; you accept and pay in the app.',
                        action: OutlinedButton(onPressed: () => context.go('/shop'), child: const Text('Browse products')),
                      )
                    : RefreshIndicator(
                        onRefresh: () => ref.refresh(quotationsProvider.future),
                        child: ListView.separated(
                          padding: const EdgeInsets.all(AppSpacing.space4),
                          itemCount: list.length,
                          separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.space3),
                          itemBuilder: (_, i) {
                            final q = list[i];
                            return Material(
                              color: AppColors.surface,
                              borderRadius: AppRadius.mdAll,
                              child: InkWell(
                                borderRadius: AppRadius.mdAll,
                                onTap: () => context.push('/quotations/${q.id}'),
                                child: Container(
                                  padding: const EdgeInsets.all(AppSpacing.space4),
                                  decoration: BoxDecoration(borderRadius: AppRadius.mdAll, border: Border.all(color: AppColors.divider)),
                                  child: Row(children: [
                                    Expanded(
                                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Row(children: [
                                          Text(q.quoteNo, style: theme.textTheme.titleSmall),
                                          const SizedBox(width: AppSpacing.space2),
                                          QuoteStatusChip(q.status),
                                        ]),
                                        const SizedBox(height: AppSpacing.space1),
                                        Text('${dateTime(q.createdAt)} · ${q.itemCount} ${q.itemCount == 1 ? 'item' : 'items'} · ${q.fulfilmentType == 'StorePickup' ? 'Pickup' : 'Delivery'}',
                                            style: theme.textTheme.bodySmall?.copyWith(color: AppColors.outline)),
                                      ]),
                                    ),
                                    Text(q.status == 'Requested' ? '—' : money(q.grandTotal), style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                                  ]),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
              ),
    );
  }
}

/// One quotation: lines at the quoted price; accept (→ order → Cashfree) or decline.
class QuotationScreen extends ConsumerStatefulWidget {
  const QuotationScreen({super.key, required this.id});
  final int id;
  @override
  ConsumerState<QuotationScreen> createState() => _QuotationState();
}

class _QuotationState extends ConsumerState<QuotationScreen> {
  bool _busy = false;

  Future<void> _accept() async {
    setState(() => _busy = true);
    try {
      final r = CheckoutResult.fromJson(await ref.read(apiProvider).post<Json>('/api/quotations/${widget.id}/accept', const <String, dynamic>{}));
      final res = await CashfreePayment.pay(r);
      ref.invalidate(quotationsProvider);
      if (!mounted) return;
      if (res.outcome == PayOutcome.failed && res.message != null) toast(context, res.message!, error: true);
      context.pushReplacement('/orders/${r.orderId}/paid');
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _decline() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Decline this quotation?'),
        content: const Text('You can always ask for a new one.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Keep it')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Decline')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).post<Json>('/api/quotations/${widget.id}/decline');
      ref.invalidate(quotationProvider(widget.id));
      ref.invalidate(quotationsProvider);
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final res = ref.watch(quotationProvider(widget.id));
    final q = res.valueOrNull;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(backgroundColor: AppColors.surface, title: Text(q?.summary.quoteNo ?? 'Quotation')),
      body: res.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(quotationProvider(widget.id))),
        data: (q) {
          final s = q.summary;
          final quoted = s.status != 'Requested';
          final pickup = s.fulfilmentType == 'StorePickup';
          return RefreshIndicator(
            onRefresh: () => ref.refresh(quotationProvider(widget.id).future),
            child: ListView(padding: const EdgeInsets.all(AppSpacing.space4), children: [
              Row(children: [
                QuoteStatusChip(s.status),
                const Spacer(),
                Text(dateTime(s.createdAt), style: theme.textTheme.bodySmall?.copyWith(color: AppColors.outline)),
              ]),
              const SizedBox(height: AppSpacing.space2),
              Text(
                switch (s.status) {
                  'Quoted' => s.validUntil == null ? 'Price ready' : 'Price valid till ${dateTime(s.validUntil)}',
                  'Requested' => 'The store is preparing your price. You will get a notification.',
                  'Expired' => 'This price has expired — ask for a fresh quote.',
                  'Cancelled' => q.cancelReason ?? 'Closed by the store',
                  'Accepted' => 'Accepted · order ${q.orderNo ?? ''}',
                  _ => 'You declined this quotation',
                },
                style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.onSurfaceVariant),
              ),
              const SizedBox(height: AppSpacing.space2),
              Text(pickup ? 'Store pickup' : 'Delivery to ${q.addressText ?? 'your address'}', style: theme.textTheme.bodySmall),
              if (q.storeMessage != null) _note('From the store', q.storeMessage!, AppColors.primaryContainer),
              if (q.customerNotes != null) _note('Your note', q.customerNotes!, AppColors.surfaceContainer),
              const SizedBox(height: AppSpacing.space4),
              Container(
                decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.mdAll, border: Border.all(color: AppColors.divider)),
                child: Column(children: [
                  for (var i = 0; i < q.items.length; i++) ...[
                    if (i > 0) const Divider(height: 1),
                    _Line(q.items[i], quoted: quoted),
                  ],
                ]),
              ),
              const SizedBox(height: AppSpacing.space4),
              Container(
                padding: const EdgeInsets.all(AppSpacing.space4),
                decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.mdAll, border: Border.all(color: AppColors.divider)),
                child: Column(children: [
                  _kv('Items (MRP)', money(s.subTotal)),
                  if (q.discountTotal > 0.004) _kv(quoted ? 'Discount incl. quote' : 'Your discount', '− ${money(q.discountTotal)}', color: AppColors.success),
                  if (!pickup) _kv('Delivery', q.shippingFee == 0 ? 'FREE' : money(q.shippingFee)),
                  if (q.roundOff.abs() >= 0.005) _kv('Round off', '${q.roundOff > 0 ? '+' : '−'} ${money(q.roundOff.abs())}'),
                  const Divider(height: AppSpacing.space6),
                  _kv(quoted ? 'You pay' : 'Current total', money(s.grandTotal), bold: true),
                  if (q.rewardPoints > 0) _kv('Points when handed over', '+${qty(q.rewardPoints)}', color: AppColors.success),
                ]),
              ),
              const SizedBox(height: 100),
            ]),
          );
        },
      ),
      bottomNavigationBar: q == null || !['Requested', 'Quoted', 'Accepted'].contains(q.summary.status)
          ? null
          : Material(
              color: AppColors.surface,
              elevation: AppElevation.level3,
              shadowColor: AppColors.shadow,
              child: SafeArea(
                minimum: const EdgeInsets.fromLTRB(AppSpacing.space4, AppSpacing.space3, AppSpacing.space4, AppSpacing.space3),
                child: q.summary.status == 'Accepted'
                    ? FilledButton(onPressed: () => context.push('/orders/${q.summary.orderId}'), child: const Text('View order'))
                    : Row(children: [
                        Expanded(child: OutlinedButton(onPressed: _busy ? null : _decline, child: const Text('Decline'))),
                        if (q.summary.status == 'Quoted') ...[
                          const SizedBox(width: AppSpacing.space3),
                          Expanded(
                            flex: 2,
                            child: FilledButton.icon(
                              icon: const Icon(Icons.lock_outline_rounded, size: 18),
                              onPressed: _busy ? null : _accept,
                              label: Text(_busy ? 'Please wait…' : 'Accept & pay ${money(q.summary.grandTotal)}'),
                            ),
                          ),
                        ],
                      ]),
              ),
            ),
    );
  }

  Widget _note(String title, String text, Color bg) => Container(
        margin: const EdgeInsets.only(top: AppSpacing.space3),
        padding: const EdgeInsets.all(AppSpacing.space3),
        decoration: BoxDecoration(color: bg, borderRadius: AppRadius.smAll),
        child: Text.rich(TextSpan(children: [
          TextSpan(text: '$title: ', style: const TextStyle(fontWeight: FontWeight.w700)),
          TextSpan(text: text),
        ])),
      );

  Widget _kv(String k, String v, {bool bold = false, Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Expanded(child: Text(k, style: TextStyle(fontWeight: bold ? FontWeight.w700 : FontWeight.w400, color: AppColors.onSurfaceVariant))),
          Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w600, color: color, fontSize: bold ? 20 : 14)),
        ]),
      );
}

class _Line extends StatelessWidget {
  const _Line(this.l, {required this.quoted});
  final QuotationLine l;
  final bool quoted;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final extra = quoted && l.specialDiscountPercent > 0;
    return InkWell(
      onTap: () => context.push('/product/${l.productId}'),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.space3),
        child: Row(children: [
          ClipRRect(borderRadius: AppRadius.smAll, child: SizedBox(width: 52, height: 52, child: ColoredBox(color: AppColors.surfaceContainer, child: NetImage(l.imageUrl, fit: BoxFit.contain)))),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(l.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.titleSmall),
              Text.rich(TextSpan(style: theme.textTheme.bodySmall, children: [
                TextSpan(text: '${qty(l.quantity)} ${l.unit} × ${money(l.unitPrice)}'),
                if (extra) TextSpan(text: ' · extra ${qty(l.specialDiscountPercent)}% off', style: const TextStyle(color: AppColors.success, fontWeight: FontWeight.w600)),
              ])),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(money(l.lineTotal), style: theme.textTheme.titleSmall),
            if (extra)
              Text(money(l.regularTotal), style: theme.textTheme.bodySmall?.copyWith(color: AppColors.outline, decoration: TextDecoration.lineThrough)),
          ]),
        ]),
      ),
    );
  }
}

/// Wishlist tab: products saved with the heart (kept on this phone), at today's prices.
class WishlistScreen extends ConsumerWidget {
  const WishlistScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final res = ref.watch(wishlistProductsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(backgroundColor: AppColors.surface, title: const Text('Wishlist')),
      body: res.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e is ApiException ? e : 'Could not load your wishlist', onRetry: () => ref.invalidate(wishlistProductsProvider)),
        data: (list) => list.isEmpty
            ? EmptyView(
                icon: Icons.favorite_border_rounded,
                title: 'Nothing saved yet',
                body: 'Tap the heart on a product to keep it here for later.',
                action: OutlinedButton(onPressed: () => context.go('/shop'), child: const Text('Browse products')),
              )
            : GridView.builder(
                padding: const EdgeInsets.all(AppSpacing.space3),
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 220, mainAxisExtent: 272, crossAxisSpacing: 10, mainAxisSpacing: 10),
                itemCount: list.length,
                itemBuilder: (_, i) => ProductTile(list[i]),
              ),
      ),
    );
  }
}
