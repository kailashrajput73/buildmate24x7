import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../core/glass.dart';
import '../core/api.dart';
import '../core/config.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../data/models.dart';
import '../data/providers.dart';

/// Network image that also handles SVG (used by placeholder artwork).
class NetImage extends StatelessWidget {
  const NetImage(this.url, {super.key, this.fit = BoxFit.cover});
  final String? url;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final u = AppConfig.imageUrl(url);
    if (u.isEmpty) return const ColoredBox(color: BM.paper);
    if (u.toLowerCase().endsWith('.svg')) {
      return SvgPicture.network(u, fit: fit, placeholderBuilder: (_) => const ColoredBox(color: BM.paper));
    }
    return CachedNetworkImage(
      imageUrl: u,
      fit: fit,
      placeholder: (_, __) => const ColoredBox(color: BM.paper),
      errorWidget: (_, __, ___) => const ColoredBox(color: BM.paper, child: Icon(Icons.image_not_supported_outlined, color: BM.inkFaint)),
    );
  }
}

class ErrorView extends ConsumerWidget {
  const ErrorView(this.error, {super.key, this.onRetry});
  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(trProvider);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.cloud_off_outlined, size: 40, color: BM.inkFaint),
          const SizedBox(height: 12),
          Text(error is ApiException ? error.toString() : t('common.error'), textAlign: TextAlign.center),
          // Shows which server the app is calling, so a wrong address is easy to spot.
          if (error is ApiException && (error as ApiException).unreachable)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('Server: ${AppConfig.apiUrl}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: BM.inkFaint)),
            ),
          if (onRetry != null) ...[const SizedBox(height: 12), OutlinedButton(onPressed: onRetry, child: Text(t('common.retry')))],
        ]),
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.icon, required this.title, this.body, this.action});
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 48, color: BM.inkFaint),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleMedium, textAlign: TextAlign.center),
            if (body != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(body!, textAlign: TextAlign.center, style: const TextStyle(color: BM.inkSoft))),
            if (action != null) Padding(padding: const EdgeInsets.only(top: 16), child: action!),
          ]),
        ),
      );
}

void toast(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg), backgroundColor: error ? BM.brick : null));
}

class QtyStepper extends StatelessWidget {
  const QtyStepper({super.key, required this.value, required this.onChanged, this.max, this.compact = false});
  final double value;
  final ValueChanged<double> onChanged;
  final double? max;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final h = compact ? 34.0 : 46.0;
    Widget btn(IconData i, VoidCallback? f, String label) => SizedBox(
          width: h, height: h,
          child: IconButton(onPressed: f, icon: Icon(i, size: 18), padding: EdgeInsets.zero, tooltip: label),
        );
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.7),
        border: Border.all(color: Colors.white.withValues(alpha: 0.95)),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        btn(Icons.remove, value > 1 ? () => onChanged(value - 1) : null, 'Decrease'),
        SizedBox(width: compact ? 36 : 44, child: Text(qty(value), textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700))),
        btn(Icons.add, max == null || value < max! ? () => onChanged(value + 1) : null, 'Increase'),
      ]),
    );
  }
}

/// Product tile used in grids and rails. Shows the partner price and reward points.
class ProductTile extends ConsumerWidget {
  const ProductTile(this.p, {super.key});
  final ProductCard p;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(trProvider);
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: () => context.push('/product/${p.id}'),
      child: Container(
        decoration: glassDecoration(radius: 22),
        padding: const EdgeInsets.all(7),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AspectRatio(
            aspectRatio: 1,
            child: Stack(children: [
              // Product photos stay on solid white so the goods aren't tinted by the glass.
              Positioned.fill(child: ClipRRect(borderRadius: BorderRadius.circular(16), child: ColoredBox(color: Colors.white, child: NetImage(p.imageUrl)))),
              if (p.discountPercent > 0 && !p.isFamily)
                Positioned(left: 6, top: 6, child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: BM.tape, borderRadius: BorderRadius.circular(4)),
                  child: Text('${qty(p.discountPercent)}% off', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                )),
            ]),
          ),
          const SizedBox(height: 6),
          Text(p.brandName, style: const TextStyle(fontSize: 11, color: BM.inkFaint, fontWeight: FontWeight.w600)),
          Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, height: 1.25)),
          const Spacer(),
          if (p.isFamily) ...[
            Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
              const Text('from ', style: TextStyle(fontSize: 11, color: BM.inkFaint)),
              Text(money(p.fromPrice ?? p.price), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ]),
            Text(p.variantSummary ?? '${p.variantCount} sizes', maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: BM.pipe, fontWeight: FontWeight.w700)),
          ] else
            Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
              Text(money(p.price), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(width: 4),
              if (p.listPrice > p.price)
                Flexible(child: Text(money(p.listPrice), overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: BM.inkFaint, decoration: TextDecoration.lineThrough))),
            ]),
          if ((p.rewardPoints ?? 0) > 0)
            Text('+${qty(p.rewardPoints)} pts / ${p.unit}', style: const TextStyle(fontSize: 11, color: BM.leaf, fontWeight: FontWeight.w700)),
          if (!p.inStock) Text(t('product.outOfStock'), style: const TextStyle(fontSize: 12, color: BM.brick, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}

/// Adds to cart with error handling; shows a snackbar with a shortcut to the cart.
Future<bool> addToCart(BuildContext context, WidgetRef ref, int productId, double q, String name) async {
  if (ref.read(authProvider).status != AuthStatus.loggedIn) {
    toast(context, 'Log in to add products to your cart');
    context.push('/login?next=${Uri.encodeComponent('/product/$productId')}');
    return false;
  }
  try {
    await ref.read(cartProvider.notifier).add(productId, q);
    if (context.mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text('Added $name'), action: SnackBarAction(label: 'Cart', onPressed: () => context.push('/cart'))));
    }
    return true;
  } catch (e) {
    if (context.mounted) toast(context, e.toString(), error: true);
    return false;
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final String status;

  static const labels = {
    'PendingPayment': 'Awaiting payment', 'PaymentFailed': 'Payment failed', 'Paid': 'Confirmed', 'Processing': 'Being packed',
    'ReadyForPickup': 'Ready for pickup', 'OutForDelivery': 'Out for delivery', 'Completed': 'Completed', 'Cancelled': 'Cancelled',
  };

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (status) {
      'Completed' || 'ReadyForPickup' => (BM.leafLight, BM.leaf),
      'PendingPayment' => (BM.tapeLight, const Color(0xFF8A6400)),
      'PaymentFailed' => (const Color(0xFFFDEEEC), BM.brick),
      'Cancelled' => (BM.paper, BM.inkSoft),
      _ => (BM.pipeLight, BM.pipe),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(labels[status] ?? status, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}

/// Category picture: the admin's upload when there is one, otherwise the design kit's artwork for that kind of goods.
class CategoryArt extends StatelessWidget {
  const CategoryArt({super.key, required this.name, this.imageUrl, this.fit = BoxFit.cover});
  final String name;
  final String? imageUrl;
  final BoxFit fit;

  static const _art = <(String, String)>[
    (r'pipe|fitting|tubing', 'plumbing_pipes_fittings'),
    (r'sanitary|wash|closet|basin', 'sanitary_wares'),
    (r'electric|wire|cable|light|switch|fan', 'electricals_lights'),
    (r'hardware|tool', 'hardware_tools'),
    (r'valve|plumbing', 'valves_controls'),
    (r'cp |tap|faucet|shower', 'cp_fittings'),
    (r'drain', 'drainage_accessories'),
    (r'cement|plaster|building', 'cement_plaster'),
    (r'tile|grout', 'tiling_grouts'),
    (r'paint|putty', 'paints_putty'),
    (r'lock|handle', 'locks_handles'),
    (r'adhesive|fevicol', 'fevicol_adhesives'),
  ];

  static String assetFor(String name) {
    for (final (re, file) in _art) {
      if (RegExp(re, caseSensitive: false).hasMatch(name)) return 'assets/images/categories/$file.png';
    }
    return 'assets/images/categories/consumables.png';
  }

  @override
  Widget build(BuildContext context) {
    final u = imageUrl;
    if (u != null && u.isNotEmpty && !u.startsWith('/files/mock/')) return NetImage(u, fit: fit);
    return Image.asset(assetFor(name), fit: fit, errorBuilder: (_, __, ___) => const ColoredBox(color: BM.paper));
  }
}
