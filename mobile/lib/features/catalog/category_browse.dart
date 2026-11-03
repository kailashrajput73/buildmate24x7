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
  ProductGroup(this.title, this.type, this.openId, this.unit);
  final String title, type, unit;
  int openId;
  final items = <CatalogItem>[];
  String? imageUrl;
  double minPrice = double.infinity, maxDiscount = 0;
  bool inStock = false;
}

String catalogClass(CatalogItem i) {
  for (final key in ['Class', 'SDR', 'Schedule']) {
    final value = i.spec(key)?.trim();
    if (value != null && value.isNotEmpty) {
      if (RegExp(r'^(class|sdr|sch)', caseSensitive: false).hasMatch(value)) return value;
      return '${key == 'Schedule' ? 'Sch' : key} $value';
    }
  }
  return '';
}
int compareSizes(String a, String b) {
  double number(String s) => double.tryParse(RegExp(r'\d+(?:\.\d+)?').firstMatch(s)?.group(0) ?? '') ?? double.infinity;
  final order = number(a).compareTo(number(b));
  return order == 0 ? a.compareTo(b) : order;
}

/// One card per explicit family; the rail follows the configured subcategories.
List<ProductGroup> buildGroups(List<CatalogItem> items) {
  final groups = <String, ProductGroup>{};
  for (final i in items) {
    final key = i.family != null ? 'f:${i.brandId}:${i.family}' : 'p:${i.id}';
    final g = groups.putIfAbsent(key, () {
      return ProductGroup(i.family ?? i.name, i.subCategoryName ?? 'Other', i.id, i.unit);
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

/// Category screen in the design kit's Pipes & Fittings layout: filter pills on top, types (and their
/// sub-categories) in a left rail, one card per product family. Data: the paginated family listing
/// (GET /api/catalog/products?collapse=true), Types and facets from the server.
class CategoryBrowseScreen extends ConsumerStatefulWidget {
  const CategoryBrowseScreen({super.key, required this.categoryId, required this.title});
  final int categoryId;
  final String title;
  @override
  ConsumerState<CategoryBrowseScreen> createState() => _CategoryBrowseState();
}

class _CategoryBrowseState extends ConsumerState<CategoryBrowseScreen> {
  Map<String, dynamic> _filters = {};
  int _page = 1;
  late Future<(Paged<ProductCard>, List<Json>, Json)> _result;
  @override
  void initState() { super.initState(); _load(); }
  @override
  void didUpdateWidget(covariant CategoryBrowseScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.categoryId != widget.categoryId) {
      _filters = {};
      _page = 1;
      _load();
    }
  }
  void _load() {
    final api = ref.read(apiProvider);
    final query = {'categoryId': widget.categoryId, ..._filters};
    _result = Future.wait<dynamic>([
      api.get<Json>('/api/catalog/products', {...query, 'collapse': true, 'page': _page, 'pageSize': 24}),
      api.get<List<dynamic>>('/api/catalog/types', {'categoryId': widget.categoryId}),
      api.get<Json>('/api/catalog/facets', query),
    ]).then((r) => (Paged.fromJson(r[0] as Json, ProductCard.fromJson), (r[1] as List).cast<Json>(), r[2] as Json));
  }
  void _set(Map<String, dynamic> patch, {bool reset = false}) => setState(() { _filters = {...(reset ? <String, dynamic>{} : _filters), ...patch}..removeWhere((k, v) => v == null || v == ''); _page = 1; _load(); });

  /// A dropdown pill (design kit filter button) over a facet list.
  Widget _facetPill(String key, String label, List<Json> options, {bool ids = false}) {
    final current = _filters[key];
    final matchName = options.where((o) => o['id'] == current).firstOrNull?['name'];
    final currentLabel = current == null ? null : (ids ? matchName : current);
    return Padding(
      padding: const EdgeInsets.only(right: AppSpacing.space2),
      child: _Pill<String>(
        label: currentLabel == null ? label : '$currentLabel',
        options: {'': 'All ${label.toLowerCase()}', for (final o in options) '${o[ids ? 'id' : 'value']}': '${o[ids ? 'name' : 'value']}'},
        onSelected: (v) => _set({key: ids && v.isNotEmpty ? int.parse(v) : v, if (key == 'brandId') ...{'class': null, 'size': null, 'length': null}}),
      ),
    );
  }

  static const _sorts = {'': 'Recommended', 'price_asc': 'Price (lowest first)', 'price_desc': 'Price (highest first)', 'newest': 'What’s New'};

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final category = ref.watch(categoriesProvider).valueOrNull?.where((c) => c.id == widget.categoryId).firstOrNull;
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
      body: FutureBuilder<(Paged<ProductCard>, List<Json>, Json)>(future: _result, builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError) return ErrorView(snapshot.error!, onRetry: () => setState(_load));
        final (page, types, facets) = snapshot.data!;
        final type = types.where((t) => t['id'] == _filters['typeId']).firstOrNull;
        final subs = (category?.subCategories ?? []).where((s) => type == null || (type['subCategoryIds'] as List).contains(s.id)).toList();
        // "Color" for Electrical › Cable (from the Type), otherwise "Class".
        final classLabel = '${type?['classLabel'] ?? 'Class'}';
        List<Json> facet(String key) => (facets[key] as List? ?? []).cast<Json>();
        final sort = '${_filters['sort'] ?? ''}';
        return Column(children: [
          // Filter row: sort, brand, class, size, length — dropdown pills.
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.fromLTRB(AppSpacing.space3, 0, AppSpacing.space3, AppSpacing.space2),
            child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
              Padding(
                padding: const EdgeInsets.only(right: AppSpacing.space2),
                child: _Pill<String>(label: sort.isEmpty ? 'Sort by' : _sorts[sort] ?? 'Sort by', options: _sorts, onSelected: (v) => _set({'sort': v})),
              ),
              if (facet('brands').length > 1 || _filters.containsKey('brandId')) _facetPill('brandId', 'Brand', facet('brands'), ids: true),
              if (facet('classes').isNotEmpty) _facetPill('class', classLabel, facet('classes')),
              if (facet('sizes').isNotEmpty) _facetPill('size', 'Size', facet('sizes')),
              if (facet('lengths').isNotEmpty) _facetPill('length', 'Length', facet('lengths')),
              if (_filters.keys.any((k) => k != 'typeId' && k != 'subCategoryId'))
                TextButton(onPressed: () => _set({'typeId': _filters['typeId'], 'subCategoryId': _filters['subCategoryId']}, reset: true), child: const Text('Clear')),
            ])),
          ),
          const Divider(height: 1),
          Expanded(
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 96,
                color: AppColors.surface,
                child: ListView(children: [
                  _TypeRow(label: 'All', count: category?.productCount ?? 0, selected: !_filters.containsKey('typeId'), art: widget.title, onTap: () => _set({}, reset: true)),
                  for (final t in types)
                    _TypeRow(label: '${t['name']}', count: (facet('types').where((f) => f['id'] == t['id']).firstOrNull?['count'] as num?)?.toInt() ?? 0,
                        selected: t['id'] == _filters['typeId'], art: '${widget.title} ${t['name']}', onTap: () => _set({'typeId': t['id']}, reset: true)),
                  if (subs.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(AppSpacing.space2, AppSpacing.space3, AppSpacing.space2, AppSpacing.space1),
                      child: Text('Sub-category', style: theme.textTheme.labelSmall?.copyWith(color: AppColors.outline, fontWeight: FontWeight.w700)),
                    ),
                    _SubRow(key: const ValueKey('all-subcategories'), label: 'All', selected: !_filters.containsKey('subCategoryId'), onTap: () => _set({'typeId': _filters['typeId']}, reset: true)),
                    for (final sub in subs)
                      _SubRow(label: sub.name, selected: _filters['subCategoryId'] == sub.id, onTap: () => _set({'typeId': _filters['typeId'], 'subCategoryId': sub.id}, reset: true)),
                  ],
                ]),
              ),
              Expanded(
                child: page.items.isEmpty
                    ? EmptyView(icon: Icons.filter_alt_off_outlined, title: category?.productCount == 0 ? 'Coming Soon' : 'Nothing matches these filters', body: 'Try another type or clear a filter.')
                    : Column(children: [
                        Expanded(
                          child: GridView.builder(
                            padding: const EdgeInsets.all(AppSpacing.space3),
                            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                                maxCrossAxisExtent: 200, mainAxisExtent: 236, crossAxisSpacing: AppSpacing.space3, mainAxisSpacing: AppSpacing.space3),
                            itemCount: page.items.length,
                            itemBuilder: (_, i) => _FamilyCard(page.items[i], categoryName: widget.title),
                          ),
                        ),
                        if (page.total > page.pageSize)
                          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                            IconButton(tooltip: 'Previous page', onPressed: _page <= 1 ? null : () => setState(() { _page--; _load(); }), icon: const Icon(Icons.chevron_left_rounded)),
                            Text('Page $_page', style: theme.textTheme.labelMedium),
                            IconButton(tooltip: 'Next page', onPressed: !page.hasMore ? null : () => setState(() { _page++; _load(); }), icon: const Icon(Icons.chevron_right_rounded)),
                          ]),
                      ]),
              ),
            ]),
          ),
        ]);
      }),
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

/// Sub-category under the types, in the rail's style.
class _SubRow extends StatelessWidget {
  const _SubRow({super.key, required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.space2, horizontal: AppSpacing.space2),
          decoration: BoxDecoration(
            color: selected ? AppColors.primarySidebarSelected : null,
            border: Border(left: BorderSide(color: selected ? AppColors.primary : Colors.transparent, width: 3)),
          ),
          child: Text(label, maxLines: 2, overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: selected ? AppColors.primary : AppColors.onSurfaceVariant, fontWeight: selected ? FontWeight.w700 : FontWeight.w500)),
        ),
      );
}

/// One product family card (all its sizes; for pipes & cables all brands — "CPVC PIPE").
class _FamilyCard extends StatelessWidget {
  const _FamilyCard(this.p, {required this.categoryName});
  final ProductCard p;
  final String categoryName;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final many = p.variantCount > 1;
    final hasImage = p.imageUrl != null && p.imageUrl!.isNotEmpty && !p.imageUrl!.startsWith('/files/mock/');
    return Material(
      color: AppColors.surface,
      borderRadius: AppRadius.mdAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/product/${p.id}'),
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
                      child: hasImage ? NetImage(p.imageUrl, fit: BoxFit.contain, fallbackName: p.name) : CategoryArt(name: '$categoryName ${p.catalog?.typeName ?? ''}', fit: BoxFit.contain),
                    ),
                  ),
                ),
                Positioned(
                  right: 4,
                  bottom: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space2, vertical: 3),
                    decoration: BoxDecoration(
                      color: p.inStock ? AppColors.accentGreenContainer : AppColors.surfaceVariant,
                      borderRadius: AppRadius.smAll,
                      border: Border.all(color: p.inStock ? AppColors.accentGreen : AppColors.outlineVariant),
                    ),
                    child: Column(children: [
                      Text(p.inStock ? 'ADD' : 'SOLD OUT',
                          style: theme.textTheme.labelMedium?.copyWith(color: p.inStock ? AppColors.onAccentGreenContainer : AppColors.outline, fontWeight: FontWeight.w800)),
                      Text(many ? '${p.variantCount} sizes' : '1 product', style: theme.textTheme.labelSmall?.copyWith(fontSize: 9, color: AppColors.onSurfaceVariant)),
                    ]),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: AppSpacing.space2),
            Text.rich(TextSpan(children: [
              if (many) TextSpan(text: 'from ', style: theme.textTheme.labelSmall?.copyWith(color: AppColors.outline)),
              TextSpan(text: money(p.fromPrice ?? p.price), style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
              TextSpan(text: ' /${p.unit}', style: theme.textTheme.labelSmall?.copyWith(color: AppColors.outline)),
            ])),
            Text(!many && p.discountPercent > 0 ? 'discount ${qty(p.discountPercent.roundToDouble())}%' : ' ',
                style: theme.textTheme.labelSmall?.copyWith(color: AppColors.success, fontWeight: FontWeight.w600)),
            Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
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
