import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/glass.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';
import 'category_browse.dart';

/// Categories tab: every category as a picture tile (design kit), plus brands.
class CategoriesScreen extends ConsumerWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final cats = ref.watch(categoriesProvider);
    final brands = ref.watch(brandsProvider).valueOrNull ?? [];
    final groups = ref.watch(productGroupsProvider).valueOrNull ?? [];
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: const Text('Categories'),
        actions: [
          IconButton(tooltip: 'Search', icon: const Icon(Icons.search_rounded), onPressed: () => context.push('/products', extra: const CatalogQuery())),
          IconButton(tooltip: 'Cart', icon: const Icon(Icons.shopping_cart_outlined), onPressed: () => context.push('/cart')),
        ],
      ),
      body: cats.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(categoriesProvider)),
        data: (list) => ListView(padding: const EdgeInsets.all(AppSpacing.space4), children: [
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: AppSpacing.space3,
            mainAxisSpacing: AppSpacing.space3,
            childAspectRatio: 0.78,
            children: [
              for (final c in list.where((c) => c.productCount > 0))
                Material(
                  color: AppColors.surface,
                  borderRadius: AppRadius.lgAll,
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => context.push('/category/${c.id}', extra: c.name),
                    child: Container(
                      decoration: BoxDecoration(borderRadius: AppRadius.lgAll, border: Border.all(color: AppColors.divider)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        Expanded(child: CategoryArt(name: c.name, imageUrl: c.imageUrl)),
                        Padding(
                          padding: const EdgeInsets.all(AppSpacing.space2),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(c.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700)),
                            Text('${c.productCount} products', style: theme.textTheme.labelSmall?.copyWith(color: AppColors.outline)),
                          ]),
                        ),
                      ]),
                    ),
                  ),
                ),
            ],
          ),
          if (groups.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(0, AppSpacing.space6, 0, AppSpacing.space3),
              child: Text('Product groups', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            ),
            Wrap(spacing: AppSpacing.space2, runSpacing: AppSpacing.space2, children: [
              for (final g in groups)
                ActionChip(label: Text(g.name), onPressed: () => context.push('/products?title=${Uri.encodeComponent(g.name)}', extra: CatalogQuery(groupId: g.id))),
            ]),
          ],
          if (brands.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(0, AppSpacing.space6, 0, AppSpacing.space3),
              child: Text('Brands', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            ),
            Wrap(spacing: AppSpacing.space2, runSpacing: AppSpacing.space2, children: [
              for (final b in brands)
                ActionChip(label: Text(b.name), onPressed: () => context.push('/products?title=${Uri.encodeComponent(b.name)}', extra: CatalogQuery(brandId: b.id))),
            ]),
          ],
        ]),
      ),
    );
  }
}

/// Search + filtered product grid with infinite scroll.
class ProductListScreen extends ConsumerStatefulWidget {
  const ProductListScreen({super.key, required this.query, this.title});
  final CatalogQuery query;
  final String? title;
  @override
  ConsumerState<ProductListScreen> createState() => _ProductListState();
}

class _ProductListState extends ConsumerState<ProductListScreen> {
  late CatalogQuery _q = widget.query;
  final _search = TextEditingController();
  final _scroll = ScrollController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _search.text = _q.q;
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 600) ref.read(productListProvider(_q).notifier).more();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => setState(() => _q = _q.copyWith(q: v.trim())));
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(trProvider);
    final res = ref.watch(productListProvider(_q));
    final searching = widget.title == null;
    return Scaffold(
      appBar: AppBar(
        title: searching
            ? TextField(
                controller: _search,
                autofocus: _q.q.isEmpty && _q.categoryId == null,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(hintText: t('home.search'), border: InputBorder.none, enabledBorder: InputBorder.none, focusedBorder: InputBorder.none, filled: false),
                onChanged: _onSearch,
              )
            : Text(widget.title!),
      ),
      body: Column(children: [
        SizedBox(
          height: 48,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), children: [
            for (final (v, l) in const [('', 'Popular'), ('price_asc', 'Price ↑'), ('price_desc', 'Price ↓'), ('newest', 'Newest')])
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(label: Text(l), selected: _q.sort == v, onSelected: (_) => setState(() => _q = _q.copyWith(sort: v))),
              ),
            FilterChip(label: const Text('In stock'), selected: _q.inStock, onSelected: (s) => setState(() => _q = _q.copyWith(inStock: s))),
          ]),
        ),
        const Divider(),
        Expanded(
          child: res.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(productListProvider(_q))),
            data: (page) => page.items.isEmpty
                ? EmptyView(icon: Icons.search_off, title: 'No products found', body: 'Try a brand name, a shorter word, or the local name (e.g. nal, taar, pankha).')
                : RefreshIndicator(
                    onRefresh: () => ref.read(productListProvider(_q).notifier).load(),
                    child: GridView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.all(12),
                      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 220, mainAxisExtent: 272, crossAxisSpacing: 10, mainAxisSpacing: 10),
                      itemCount: page.items.length + (page.hasMore ? 1 : 0),
                      itemBuilder: (_, i) => i >= page.items.length
                          ? const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
                          : ProductTile(page.items[i]),
                    ),
                  ),
          ),
        ),
      ]),
    );
  }
}

class ProductScreen extends ConsumerStatefulWidget {
  const ProductScreen({super.key, required this.id});
  final int id;
  @override
  ConsumerState<ProductScreen> createState() => _ProductState();
}

class _ProductState extends ConsumerState<ProductScreen> {
  double _qty = 1;
  bool _busy = false;
  int _img = 0;

  /// Puts this quantity in the cart and goes straight to checkout.
  /// "Selected product size · 20 mm" for the bottom bar.
  String _selectedLabel(ProductDetail d) {
    final size = d.variantAxes.isNotEmpty
        ? d.variantAxes.map((a) => a.choices.where((c) => c.selected).map((c) => c.value).join()).where((v) => v.isNotEmpty).join(' · ')
        : d.variants.where((v) => v.id == d.card.id).map((v) => v.label).join();
    return size.isEmpty ? 'Selected product' : 'Selected product size · $size';
  }

  /// Brand and Class rows: the same item ("CPVC pipe") from other brands / classes in this category. Tapping one
  /// opens that family at the same size when it has it, otherwise its first in-stock size.
  List<Widget> _familyRows(BuildContext context, WidgetRef ref, ProductCard p) {
    final items = ref.watch(categoryItemsProvider(p.categoryId)).valueOrNull;
    if (items == null) return const [];
    final groups = buildGroups(items);
    final current = groups.where((g) => g.items.any((i) => i.id == p.id)).firstOrNull;
    if (current == null || current.itemKey.isEmpty) return const [];
    final me = current.items.firstWhere((i) => i.id == p.id);
    final mm = sizeMm(me);
    final siblings = groups.where((g) => g.type == current.type && g.itemKey == current.itemKey).toList();

    int target(ProductGroup g) {
      if (mm != null) {
        final same = g.items.where((i) => sizeMm(i) == mm).toList()..sort((a, b) => (b.inStock ? 1 : 0) - (a.inStock ? 1 : 0));
        if (same.isNotEmpty) return same.first.id;
      }
      return g.openId;
    }

    bool hasSize(ProductGroup g) => mm == null || g.items.any((i) => sizeMm(i) == mm);

    final rows = <Widget>[];
    final brands = <String, ProductGroup>{};
    for (final g in siblings) {
      final prev = brands[g.brand];
      // Per brand, prefer the family with the current class, then one that has the current size.
      if (prev == null || (g.cls == current.cls && prev.cls != current.cls) || (hasSize(g) && !hasSize(prev) && prev.cls != current.cls)) {
        brands[g.brand] = g;
      }
    }
    if (brands.length > 1) {
      final names = brands.keys.toList()..sort();
      rows.add(_OptionRow(label: 'Brand', options: [
        for (final b in names)
          _Option(b,
              selected: b == current.brand,
              exact: hasSize(brands[b]!),
              inStock: brands[b]!.inStock,
              onTap: () => context.pushReplacement('/product/${target(brands[b]!)}')),
      ]));
    }
    final classes = siblings.where((g) => g.brand == current.brand && g.cls != null).toList();
    if (classes.length > 1) {
      classes.sort((a, b) => a.cls!.compareTo(b.cls!));
      rows.add(_OptionRow(label: 'Class', options: [
        for (final g in classes)
          _Option(g.cls!,
              selected: g == current,
              exact: hasSize(g),
              inStock: g.inStock,
              onTap: () => context.pushReplacement('/product/${target(g)}')),
      ]));
    }
    return rows;
  }

  Future<void> _buyNow() async {
    if (ref.read(authProvider).status != AuthStatus.loggedIn) {
      context.push('/login?next=${Uri.encodeComponent('/product/${widget.id}')}');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(cartProvider.notifier).add(widget.id, _qty);
      if (mounted) context.push('/checkout');
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(trProvider);
    final res = ref.watch(productProvider(widget.id));
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        actions: [
          Consumer(builder: (context, ref, _) {
            final saved = ref.watch(wishlistProvider).contains(widget.id);
            return IconButton(
              tooltip: saved ? 'Remove from wishlist' : 'Save to wishlist',
              onPressed: () => ref.read(wishlistProvider.notifier).toggle(widget.id),
              icon: Icon(saved ? Icons.favorite_rounded : Icons.favorite_border_rounded, color: saved ? AppColors.error : null),
            );
          }),
          IconButton(tooltip: 'Cart', onPressed: () => context.push('/cart'), icon: const Icon(Icons.shopping_cart_outlined)),
        ],
      ),
      body: res.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(productProvider(widget.id))),
        data: (d) {
          final p = d.card;
          return ListView(padding: const EdgeInsets.only(bottom: 100), children: [
            AspectRatio(
              aspectRatio: 1.2,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(28),
                  child: PageView(
                    onPageChanged: (i) => setState(() => _img = i),
                    children: [for (final u in d.imageUrls.isEmpty ? [''] : d.imageUrls) ColoredBox(color: Colors.white, child: NetImage(u, fit: BoxFit.contain))],
                  ),
                ),
              ),
            ),
            if (d.imageUrls.length > 1)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  for (var i = 0; i < d.imageUrls.length; i++)
                    Container(margin: const EdgeInsets.symmetric(horizontal: 3), width: 6, height: 6,
                        decoration: BoxDecoration(shape: BoxShape.circle, color: i == _img ? BM.pipe : BM.line)),
                ]),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p.brandName, style: const TextStyle(color: BM.pipe, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(p.name, style: Theme.of(context).textTheme.titleLarge),
                if (d.otherNames.isNotEmpty)
                  Padding(padding: const EdgeInsets.only(top: 4), child: Text('Also: ${d.otherNames.take(4).join(', ')}', style: const TextStyle(color: BM.inkFaint, fontSize: 13))),
                const SizedBox(height: 14),
                Text(t('product.yourPrice'), style: const TextStyle(color: BM.inkSoft, fontSize: 12)),
                Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                  Text(money(p.price), style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
                  const SizedBox(width: 6),
                  Text('/ ${p.unit}', style: const TextStyle(color: BM.inkSoft)),
                ]),
                Wrap(spacing: 8, children: [
                  if (p.listPrice > p.price) Text('List ${money(p.listPrice)}', style: const TextStyle(color: BM.inkFaint, decoration: TextDecoration.lineThrough)),
                  if (p.discountPercent > 0) Text('${qty(p.discountPercent)}% partner discount', style: const TextStyle(color: BM.leaf, fontWeight: FontWeight.w700)),
                ]),
                Text('Incl. ${qty(d.gstRate)}% GST · ${p.code}', style: const TextStyle(color: BM.inkFaint, fontSize: 12)),
                // Brand / Class / Size as tappable blocks (design kit), not dropdowns or chips.
                ..._familyRows(context, ref, p),
                if (d.variantAxes.isNotEmpty) ...[
                  for (final axis in d.variantAxes)
                    _OptionRow(
                      label: axis.name,
                      options: [
                        for (final c in axis.choices)
                          _Option(c.value, selected: c.selected, inStock: c.inStock, exact: c.exact,
                              onTap: () => context.pushReplacement('/product/${c.productId}')),
                      ],
                    ),
                ] else if (d.variants.length > 1)
                  _OptionRow(
                    label: t('product.size'),
                    options: [
                      for (final v in d.variants)
                        _Option(v.label, selected: v.id == p.id, inStock: v.inStock,
                            onTap: () => context.pushReplacement('/product/${v.id}')),
                    ],
                  ),
                if ((p.rewardPoints ?? 0) > 0) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: BM.leafLight, borderRadius: BorderRadius.circular(10)),
                    child: Row(children: [
                      const Icon(Icons.stars_rounded, color: BM.leaf),
                      const SizedBox(width: 8),
                      Text('Earn ${qty(p.rewardPoints! * _qty)} points', style: const TextStyle(color: BM.leaf, fontWeight: FontWeight.w700)),
                      Text('  (${qty(p.rewardPoints)} ${t('product.points')})', style: const TextStyle(color: BM.inkSoft, fontSize: 12)),
                    ]),
                  ),
                ],
                if (d.specs.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(t('product.specs'), style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Container(
                    clipBehavior: Clip.antiAlias,
                    decoration: glassDecoration(radius: 20, shadow: false),
                    child: Column(children: [
                      for (var i = 0; i < d.specs.length; i++)
                        Container(
                          color: i.isEven ? Colors.white.withValues(alpha: 0.5) : Colors.transparent,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            SizedBox(width: 120, child: Text(d.specs[i].name, style: const TextStyle(color: BM.inkSoft))),
                            Expanded(child: Text(d.specs[i].value, style: const TextStyle(fontWeight: FontWeight.w600))),
                          ]),
                        ),
                    ]),
                  ),
                ],
                if (d.description != null && d.description!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(d.description!, style: const TextStyle(color: BM.inkSoft, height: 1.4)),
                ],
                if (d.related.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Text('Similar products', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                ],
              ]),
            ),
            if (d.related.isNotEmpty)
              SizedBox(
                height: 268,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  scrollDirection: Axis.horizontal,
                  itemCount: d.related.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (_, i) => SizedBox(width: 156, child: ProductTile(d.related[i])),
                ),
              ),
          ]);
        },
      ),
      bottomNavigationBar: res.valueOrNull == null
          ? null
          : Material(
              color: AppColors.surface,
              elevation: AppElevation.level3,
              shadowColor: AppColors.shadow,
              child: SafeArea(
                minimum: const EdgeInsets.fromLTRB(AppSpacing.space4, AppSpacing.space3, AppSpacing.space4, AppSpacing.space3),
                child: res.value!.maxOrderQty <= 0
                    ? Text(t('product.outOfStock'), textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700, color: BM.inkSoft))
                    : Column(mainAxisSize: MainAxisSize.min, children: [
                        Row(children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                              Text(_selectedLabel(res.value!), maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 12, color: AppColors.onSurfaceVariant)),
                              Text(money(res.value!.card.price * _qty), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                            ]),
                          ),
                          QtyStepper(value: _qty, max: res.value!.maxOrderQty, onChanged: (v) => setState(() => _qty = v)),
                        ]),
                        const SizedBox(height: 8),
                        Row(children: [
                          Expanded(
                            child: FilledButton.icon(
                              style: FilledButton.styleFrom(backgroundColor: AppColors.accentGreenContainer, foregroundColor: AppColors.onAccentGreenContainer),
                              icon: const Icon(Icons.add_shopping_cart),
                              onPressed: _busy ? null : () async {
                                setState(() => _busy = true);
                                await addToCart(context, ref, widget.id, _qty, res.value!.card.name);
                                if (mounted) setState(() => _busy = false);
                              },
                              label: const Text('Add to Cart'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: FilledButton.icon(
                              icon: const Icon(Icons.flash_on_rounded),
                              onPressed: _busy ? null : _buyNow,
                              label: const Text('Buy Now'),
                            ),
                          ),
                        ]),
                      ]),
              ),
            ),
    );
  }
}


class _Option {
  const _Option(this.value, {required this.selected, required this.inStock, this.exact = true, required this.onTap});
  final String value;
  final bool selected, inStock, exact;
  final VoidCallback onTap;
}

/// A labelled grid of selectable blocks: four per row, value in bold, "Out of stock" underneath when it is.
/// Green = selected. Faded border = not made with the other options picked; tapping it changes them.
class _OptionRow extends StatelessWidget {
  const _OptionRow({required this.label, required this.options});
  final String label;
  final List<_Option> options;

  @override
  Widget build(BuildContext context) {
    final picked = options.where((o) => o.selected).map((o) => o.value).join();
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text.rich(TextSpan(children: [
          TextSpan(text: label, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.onSurface)),
          if (picked.isNotEmpty) TextSpan(text: '  $picked', style: const TextStyle(color: AppColors.onSurfaceVariant)),
        ])),
        const SizedBox(height: 8),
        LayoutBuilder(builder: (context, box) {
          const gap = 8.0;
          final cols = box.maxWidth >= 520 ? 5 : 4;
          final w = (box.maxWidth - gap * (cols - 1)) / cols;
          return Wrap(spacing: gap, runSpacing: gap, children: [
            for (final o in options) SizedBox(width: w, child: _Block(o)),
          ]);
        }),
      ]),
    );
  }
}

class _Block extends StatelessWidget {
  const _Block(this.o);
  final _Option o;

  @override
  Widget build(BuildContext context) {
    final border = o.selected
        ? AppColors.accentGreen
        : o.exact
            ? AppColors.outlineVariant
            : AppColors.outlineVariant.withValues(alpha: 0.5);
    return Semantics(
      button: true,
      selected: o.selected,
      label: '${o.value}${o.inStock ? '' : ', out of stock'}',
      child: Material(
        color: o.selected ? AppColors.accentGreenContainer.withValues(alpha: 0.45) : AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: border, width: o.selected ? 2 : 1),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: o.selected ? null : o.onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 52),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(o.value,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: o.selected
                          ? AppColors.onAccentGreenContainer
                          : o.exact
                              ? AppColors.onSurface
                              : AppColors.onSurfaceVariant,
                    )),
                if (!o.inStock)
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Text('Out of stock', style: TextStyle(fontSize: 10, color: AppColors.error)),
                  ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
