import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
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

/// Category screen in the design kit's Pipes & Fittings layout: types in a left rail, one card per product family.
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
  Widget _select(String key, String label, List<Json> options, {bool ids = false}) => DropdownButton<String>(
    value: _filters[key]?.toString(), hint: Text(label),
    items: [DropdownMenuItem(value: '', child: Text('All $label')), for (final option in options) DropdownMenuItem(value: '${option[ids ? 'id' : 'value']}', child: Text('${option[ids ? 'name' : 'value']}'))],
    onChanged: (v) => _set({key: ids && v != null && v.isNotEmpty ? int.parse(v) : v, if (key == 'brandId') ...{'class': null, 'size': null, 'length': null}}),
  );
  @override
  Widget build(BuildContext context) {
    final category = ref.watch(categoriesProvider).valueOrNull?.where((c) => c.id == widget.categoryId).firstOrNull;
    return Scaffold(backgroundColor: AppColors.background, appBar: AppBar(title: Text(widget.title), actions: [IconButton(onPressed: () => context.push('/cart'), icon: const Icon(Icons.shopping_cart_outlined))]),
      body: FutureBuilder<(Paged<ProductCard>, List<Json>, Json)>(future: _result, builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError) return ErrorView(snapshot.error!, onRetry: () => setState(_load));
        final (page, types, facets) = snapshot.data!;
        final type = types.where((t) => t['id'] == _filters['typeId']).firstOrNull;
        final subs = (category?.subCategories ?? []).where((s) => type == null || (type['subCategoryIds'] as List).contains(s.id));
        List<Json> facet(String key) => (facets[key] as List? ?? []).cast<Json>();
        return Row(children: [
          SizedBox(width: 105, child: Material(color: AppColors.surface, child: ListView(children: [
            _TypeRow(label: 'All', count: category?.productCount ?? 0, selected: !_filters.containsKey('typeId'), art: widget.title, onTap: () => _set({}, reset: true)),
            for (final t in types) _TypeRow(label: '${t['name']}', count: (facet('types').where((f) => f['id'] == t['id']).firstOrNull?['count'] as num?)?.toInt() ?? 0, selected: t['id'] == _filters['typeId'], art: '${t['name']}', onTap: () => _set({'typeId': t['id']}, reset: true)),
            const Padding(padding: EdgeInsets.all(8), child: Text('Sub-Category')),
            ListTile(key: const ValueKey('all-subcategories'), dense: true, selected: !_filters.containsKey('subCategoryId'), title: const Text('All'), onTap: () => _set({'typeId': _filters['typeId']}, reset: true)),
            for (final sub in subs) ListTile(dense: true, selected: _filters['subCategoryId'] == sub.id, title: Text(sub.name), onTap: () => _set({'typeId': _filters['typeId'], 'subCategoryId': sub.id}, reset: true)),
          ]))),
          Expanded(child: Column(children: [
            SingleChildScrollView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 8), child: Row(children: [
              _select('brandId', 'Brand', facet('brands'), ids: true), const SizedBox(width: 12),
              _select('class', 'Class', facet('classes')), const SizedBox(width: 12),
              _select('size', 'Size', facet('sizes')), const SizedBox(width: 12),
              _select('length', 'Length', facet('lengths')),
              TextButton(onPressed: () => _set({}, reset: true), child: const Text('Clear')),
            ])),
            Expanded(child: page.items.isEmpty ? EmptyView(icon: Icons.inventory_2_outlined, title: category?.productCount == 0 ? 'Coming Soon' : 'No matching products', body: 'Try another filter.') : GridView.builder(padding: const EdgeInsets.all(12), gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 230, mainAxisExtent: 350, crossAxisSpacing: 10, mainAxisSpacing: 10), itemCount: page.items.length, itemBuilder: (_, i) => ProductTile(page.items[i]))),
            Wrap(alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center, children: [TextButton(onPressed: _page <= 1 ? null : () => setState(() { _page--; _load(); }), child: const Text('Previous')), Text('$_page · ${page.total} families'), TextButton(onPressed: !page.hasMore ? null : () => setState(() { _page++; _load(); }), child: const Text('Next'))]),
          ])),
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

