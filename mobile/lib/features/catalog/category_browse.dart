import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

/// One row of GET /api/catalog/categories/{id}/items (one product = one size).
class CatalogItem {
  CatalogItem.fromJson(Json j)
      : id = (j['id'] as num).toInt(),
        name = j['name'] as String,
        brandName = j['brandName'] as String,
        brandId = (j['brandId'] as num).toInt(),
        subCategoryName = j['subCategoryName'] as String?,
        unit = j['unit'] as String,
        imageUrl = j['imageUrl'] as String?,
        mrp = (j['mrp'] as num).toDouble(),
        price = (j['price'] as num).toDouble(),
        discountPercent = (j['discountPercent'] as num).toDouble(),
        inStock = j['inStock'] as bool? ?? false,
        family = j['family'] as String?,
        variantLabel = j['variantLabel'] as String?,
        specs = (j['specs'] as Map? ?? const {}).map((k, v) => MapEntry(k as String, '$v'));
  final int id, brandId;
  final String name, brandName, unit;
  final String? subCategoryName, imageUrl, family, variantLabel;
  final double mrp, price, discountPercent;
  final bool inStock;
  final Map<String, String> specs;

  String? spec(String n) => specs[n] ?? specs.entries.where((e) => e.key.toLowerCase() == n.toLowerCase()).firstOrNull?.value;
}

/// One card: a product family (all sizes of one item from one brand) or a single product.
class ProductGroup {
  ProductGroup(this.title, this.type, this.openId, this.unit, {this.brand = '', this.cls, this.itemKey = ''});
  final String title, type, unit;
  /// Brand, class (Sch 40 / SDR 11…) and the item without them ("pipe", "coupler") — to offer the same item from
  /// other brands and classes on the product page.
  final String brand, itemKey;
  final String? cls;
  int openId;
  final items = <CatalogItem>[];
  String? imageUrl;
  double minPrice = double.infinity, maxDiscount = 0;
  bool inStock = false;
}

String _strip(String s, String? word, {bool end = false}) {
  if (word == null || word.isEmpty) return s;
  final w = RegExp.escape(word);
  return s.replaceFirst(RegExp(end ? '\\s+$w\$' : '^$w\\s+', caseSensitive: false), '');
}

/// "King CPVC Coupler SDR 11" − brand − material − class → "coupler".
String _itemKey(CatalogItem i, String? material, String? cls) {
  var f = (i.family ?? i.name.split(' – ').first).trim();
  f = _strip(f, i.brandName);
  f = _strip(f, material);
  f = _strip(f, cls, end: true);
  return f.trim().toLowerCase();
}

/// Size in mm when the size starts with millimetres ("15 mm (½")", "80×65 mm").
double? sizeMm(CatalogItem i) {
  final s = (i.spec('Size') ?? i.variantLabel ?? '').trim();
  final m = RegExp(r'^(\d+(?:\.\d+)?)\s*(?:[×x]\s*\d+(?:\.\d+)?\s*)?mm', caseSensitive: false).firstMatch(s);
  return m == null ? null : double.parse(m.group(1)!);
}

/// Same grouping as the website: by material (pipes & fittings) when most items have one, else by sub category.
List<ProductGroup> buildGroups(List<CatalogItem> items) {
  final byMaterial = items.where((i) => i.spec('Material') != null).length > items.length / 2;
  final groups = <String, ProductGroup>{};
  for (final i in items) {
    final key = i.family != null ? 'f:${i.family}' : 'p:${i.id}';
    final g = groups.putIfAbsent(key, () {
      final material = i.spec('Material');
      final cls = i.spec('Class') ?? i.spec('SDR') ?? i.spec('Schedule');
      return ProductGroup(i.family ?? i.name, byMaterial ? (material?.toUpperCase() ?? 'Other') : (i.subCategoryName ?? 'Other'), i.id, i.unit,
          brand: i.brandName, cls: cls, itemKey: _itemKey(i, byMaterial ? material : null, cls));
    });
    g.items.add(i);
    if (g.imageUrl == null && i.imageUrl != null && !i.imageUrl!.startsWith('/files/mock/')) g.imageUrl = i.imageUrl;
    if (i.price < g.minPrice) g.minPrice = i.price;
    if (i.discountPercent > g.maxDiscount) g.maxDiscount = i.discountPercent;
    if (i.inStock && !g.inStock) {
      g.inStock = true;
      g.openId = i.id;
    }
  }
  return groups.values.toList();
}

final categoryItemsProvider = FutureProvider.autoDispose.family<List<CatalogItem>, int>((ref, id) async {
  final list = await ref.read(apiProvider).get<List<dynamic>>('/api/catalog/categories/$id/items');
  return list.map((e) => CatalogItem.fromJson(e as Json)).toList();
});

/// Category screen in the design kit's Pipes & Fittings layout: types in a left rail, one card per product family.
class CategoryBrowseScreen extends ConsumerStatefulWidget {
  const CategoryBrowseScreen({super.key, required this.categoryId, required this.title});
  final int categoryId;
  final String title;
  @override
  ConsumerState<CategoryBrowseScreen> createState() => _CategoryBrowseState();
}

enum _Sort { recommended, priceLow, priceHigh, discount }

class _CategoryBrowseState extends ConsumerState<CategoryBrowseScreen> {
  String? _type;
  int? _brand;
  _Sort _sort = _Sort.recommended;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final res = ref.watch(categoryItemsProvider(widget.categoryId));
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: Text(widget.title, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(tooltip: 'Search', icon: const Icon(Icons.search_rounded), onPressed: () => context.push('/products', extra: CatalogQuery(categoryId: widget.categoryId))),
          IconButton(tooltip: 'Cart', icon: const Icon(Icons.shopping_cart_outlined), onPressed: () => context.push('/cart')),
        ],
      ),
      body: res.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(categoryItemsProvider(widget.categoryId))),
        data: (items) {
          final all = buildGroups(items);
          final types = <String, int>{};
          for (final g in all) {
            types[g.type] = (types[g.type] ?? 0) + 1;
          }
          final brands = <int, String>{for (final i in items) i.brandId: i.brandName};
          var groups = all.where((g) => (_type == null || g.type == _type) && (_brand == null || g.items.any((i) => i.brandId == _brand))).toList();
          switch (_sort) {
            case _Sort.priceLow:
              groups.sort((a, b) => a.minPrice.compareTo(b.minPrice));
            case _Sort.priceHigh:
              groups.sort((a, b) => b.minPrice.compareTo(a.minPrice));
            case _Sort.discount:
              groups.sort((a, b) => b.maxDiscount.compareTo(a.maxDiscount));
            case _Sort.recommended:
              break;
          }
          if (all.isEmpty) return const EmptyView(icon: Icons.inventory_2_outlined, title: 'No products here yet');
          return Column(children: [
            // Filter row: sort and brand, as dropdown pills.
            Container(
              color: AppColors.surface,
              padding: const EdgeInsets.fromLTRB(AppSpacing.space3, 0, AppSpacing.space3, AppSpacing.space2),
              child: Row(children: [
                _Pill<_Sort>(
                  label: switch (_sort) { _Sort.recommended => 'Sort by', _Sort.priceLow => 'Price ↑', _Sort.priceHigh => 'Price ↓', _Sort.discount => 'Discount' },
                  options: const {_Sort.recommended: 'Recommended', _Sort.priceLow: 'Price (lowest first)', _Sort.priceHigh: 'Price (highest first)', _Sort.discount: 'Discount'},
                  onSelected: (v) => setState(() => _sort = v),
                ),
                const SizedBox(width: AppSpacing.space2),
                _Pill<int?>(
                  label: _brand == null ? 'Brand' : brands[_brand]!,
                  options: {null: 'All brands', for (final e in brands.entries) e.key: e.value},
                  onSelected: (v) => setState(() => _brand = v),
                ),
              ]),
            ),
            const Divider(height: 1),
            Expanded(
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (types.length > 1)
                  Container(
                    width: 96,
                    color: AppColors.surface,
                    child: ListView(children: [
                      _TypeRow(label: 'All', count: all.length, selected: _type == null, onTap: () => setState(() => _type = null), art: widget.title),
                      for (final e in types.entries)
                        _TypeRow(label: e.key, count: e.value, selected: _type == e.key, onTap: () => setState(() => _type = e.key), art: '${widget.title} ${e.key}'),
                    ]),
                  ),
                Expanded(
                  child: groups.isEmpty
                      ? const EmptyView(icon: Icons.filter_alt_off_outlined, title: 'Nothing matches these filters')
                      : GridView.builder(
                          padding: const EdgeInsets.all(AppSpacing.space3),
                          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                              maxCrossAxisExtent: 200, mainAxisExtent: 236, crossAxisSpacing: AppSpacing.space3, mainAxisSpacing: AppSpacing.space3),
                          itemCount: groups.length,
                          itemBuilder: (_, i) => _GroupCard(groups[i], categoryName: widget.title),
                        ),
                ),
              ]),
            ),
          ]);
        },
      ),
    );
  }
}

class _TypeRow extends StatelessWidget {
  const _TypeRow({required this.label, required this.count, required this.selected, required this.onTap, required this.art});
  final String label, art;
  final int count;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.space3, horizontal: AppSpacing.space2),
          decoration: BoxDecoration(
            color: selected ? AppColors.primarySidebarSelected : null,
            border: Border(left: BorderSide(color: selected ? AppColors.primary : Colors.transparent, width: 3)),
          ),
          child: Column(children: [
            ClipRRect(borderRadius: AppRadius.smAll, child: SizedBox(width: 48, height: 48, child: CategoryArt(name: art))),
            const SizedBox(height: AppSpacing.space1),
            Text(label, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: selected ? AppColors.primary : AppColors.onSurface, fontWeight: selected ? FontWeight.w700 : FontWeight.w500)),
            Text('$count', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.outline)),
          ]),
        ),
      );
}

class _GroupCard extends StatelessWidget {
  const _GroupCard(this.g, {required this.categoryName});
  final ProductGroup g;
  final String categoryName;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final many = g.items.length > 1;
    return Material(
      color: AppColors.surface,
      borderRadius: AppRadius.mdAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/product/${g.openId}'),
        child: Container(
          decoration: BoxDecoration(borderRadius: AppRadius.mdAll, border: Border.all(color: AppColors.divider)),
          padding: const EdgeInsets.all(AppSpacing.space2),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Stack(children: [
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: AppRadius.smAll,
                    child: ColoredBox(
                      color: AppColors.surfaceContainer,
                      child: g.imageUrl != null ? NetImage(g.imageUrl, fit: BoxFit.contain) : CategoryArt(name: '$categoryName ${g.type}', fit: BoxFit.contain),
                    ),
                  ),
                ),
                Positioned(
                  right: 4,
                  bottom: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space2, vertical: 3),
                    decoration: BoxDecoration(
                      color: g.inStock ? AppColors.accentGreenContainer : AppColors.surfaceVariant,
                      borderRadius: AppRadius.smAll,
                      border: Border.all(color: g.inStock ? AppColors.accentGreen : AppColors.outlineVariant),
                    ),
                    child: Column(children: [
                      Text(g.inStock ? 'ADD' : 'SOLD OUT',
                          style: theme.textTheme.labelMedium?.copyWith(color: g.inStock ? AppColors.onAccentGreenContainer : AppColors.outline, fontWeight: FontWeight.w800)),
                      Text(many ? '${g.items.length} sizes' : '1 product', style: theme.textTheme.labelSmall?.copyWith(fontSize: 9, color: AppColors.onSurfaceVariant)),
                    ]),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: AppSpacing.space2),
            Text.rich(TextSpan(children: [
              if (many) TextSpan(text: 'from ', style: theme.textTheme.labelSmall?.copyWith(color: AppColors.outline)),
              TextSpan(text: money(g.minPrice), style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
              TextSpan(text: ' /${g.unit}', style: theme.textTheme.labelSmall?.copyWith(color: AppColors.outline)),
            ])),
            Text(g.maxDiscount > 0 ? 'discount ${qty(g.maxDiscount.roundToDouble())}%' : ' ',
                style: theme.textTheme.labelSmall?.copyWith(color: AppColors.success, fontWeight: FontWeight.w600)),
            Text(g.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}

class _Pill<T> extends StatelessWidget {
  const _Pill({required this.label, required this.options, required this.onSelected});
  final String label;
  final Map<T, String> options;
  final ValueChanged<T> onSelected;
  @override
  Widget build(BuildContext context) => PopupMenuButton<T>(
        onSelected: onSelected,
        itemBuilder: (_) => [for (final e in options.entries) PopupMenuItem<T>(value: e.key, child: Text(e.value))],
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space3),
          decoration: BoxDecoration(borderRadius: AppRadius.smAll, border: Border.all(color: AppColors.primary)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 120),
              child: Text(label, overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w600)),
            ),
            const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: AppColors.primary),
          ]),
        ),
      );
}
