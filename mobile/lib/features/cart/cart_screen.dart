import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  Future<void> _run(BuildContext context, Future<void> Function() f) async {
    try {
      await f();
    } catch (e) {
      if (context.mounted) toast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(trProvider);
    final cart = ref.watch(cartProvider);
    final ctl = ref.read(cartProvider.notifier);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(t('cart.title'))),
      body: cart.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ctl.reload()),
        data: (c) => c.items.isEmpty
            ? EmptyView(icon: Icons.shopping_cart_outlined, title: t('cart.empty'), body: 'Scan a product QR at the counter or search the catalogue.',
                action: FilledButton(onPressed: () => context.go('/shop'), child: const Text('Browse products')))
            : RefreshIndicator(
                onRefresh: () => ctl.reload(),
                child: ListView(padding: const EdgeInsets.only(bottom: 16), children: [
                  for (final i in c.items)
                    Dismissible(
                      key: ValueKey('${i.productId}:${i.purchaseUnit}'),
                      direction: DismissDirection.endToStart,
                      background: Container(color: BM.brick, alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 20), child: const Icon(Icons.delete_outline, color: Colors.white)),
                      onDismissed: (_) => _run(context, () => ctl.remove(i.productId, purchaseUnit: i.purchaseUnit)),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          GestureDetector(
                            onTap: () => context.push('/product/${i.productId}'),
                            child: ClipRRect(borderRadius: BorderRadius.circular(8), child: SizedBox(width: 64, height: 64, child: NetImage(i.imageUrl))),
                          ),
                          const SizedBox(width: 12),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(i.purchaseUnit == 'Box' ? '${i.name} (box of ${qty(i.packSize ?? 0)})' : i.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text('${money(i.unitPrice)} / ${i.unit}${i.discountPercent > 0 ? ' · ${qty(i.discountPercent)}% off' : ''}', style: const TextStyle(color: BM.inkSoft, fontSize: 13)),
                            if (i.issue != null) Text(i.issue!, style: const TextStyle(color: BM.brick, fontWeight: FontWeight.w600, fontSize: 13)),
                            const SizedBox(height: 6),
                            Row(children: [
                              QtyStepper(compact: true, value: i.quantity, max: i.availableQty > 0 ? i.availableQty : null, onChanged: (v) => _run(context, () => ctl.setQty(i.productId, v, purchaseUnit: i.purchaseUnit))),
                              const Spacer(),
                              Text(money(i.lineTotal), style: const TextStyle(fontWeight: FontWeight.w800)),
                            ]),
                          ])),
                        ]),
                      ),
                    ),
                  const Divider(),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(children: [
                      _row('List total', money(c.subTotal)),
                      if (c.discountTotal > 0) _row('Discount', '−${money(c.discountTotal)}', color: BM.leaf),
                      _row(t('cart.total'), money(c.total), bold: true),
                      if (c.rewardPoints > 0) _row(t('cart.points'), '+${qty(c.rewardPoints)}', color: BM.leaf),
                      const SizedBox(height: 6),
                      const Text('Points are credited when the order is handed over.', style: TextStyle(color: BM.inkFaint, fontSize: 12)),
                    ]),
                  ),
                  if (c.issues.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: 16),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: const Color(0xFFFDEEEC), borderRadius: BorderRadius.circular(10)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [for (final x in c.issues) Text(x, style: const TextStyle(color: BM.brick))]),
                    ),
                ]),
              ),
      ),
      bottomNavigationBar: (cart.valueOrNull?.items.isNotEmpty ?? false)
          ? Material(
              color: AppColors.surface,
              elevation: AppElevation.level3,
              shadowColor: AppColors.shadow,
              child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: FilledButton(
                  // Checkout also offers "Ask for a quote", which works even when the cart can't be paid for yet.
                  onPressed: () => context.push('/checkout'),
                  child: Text('${t('cart.checkout')} · ${money(cart.value!.total)}'),
                ),
              ),
            ),
            )
          : null,
    );
  }

  Widget _row(String k, String v, {bool bold = false, Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Expanded(child: Text(k, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w400, fontSize: bold ? 17 : 14))),
          Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w600, fontSize: bold ? 17 : 14, color: color)),
        ]),
      );
}
