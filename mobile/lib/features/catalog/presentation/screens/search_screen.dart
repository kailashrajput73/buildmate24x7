import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/catalog_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/category_image.dart';
import '../../data/mappers/catalog_api_mapper.dart';
import '../../domain/models/catalog_models.dart';

/// Global product / category search backed by live [CatalogController] data.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.initialQuery});

  final String? initialQuery;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  late final TextEditingController _controller;
  var _query = '';

  // Server search results (product IDs, most relevant first) for [_resultsFor].
  List<String> _resultIds = const [];
  String _resultsFor = '';
  bool _searching = false;
  String? _searchError;
  Timer? _debounce;
  int _searchSeq = 0;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialQuery?.trim() ?? '';
    _controller = TextEditingController(text: initial);
    _query = initial;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final catalog = context.read<CatalogController>();
      if (catalog.pipeVariants.isEmpty || catalog.homeCategories.isEmpty) {
        catalog.refreshHomeCatalog(
          showLoading: catalog.pipeVariants.isEmpty,
        );
      }
      _search(_query, immediate: true);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    setState(() => _query = value);
    _search(value);
  }

  /// Asks the server for products matching [value] (after a short pause while
  /// typing). Only the latest search's answer is shown.
  void _search(String value, {bool immediate = false}) {
    _debounce?.cancel();
    final term = value.trim().replaceAll(RegExp(r'\s+'), ' ');
    final seq = ++_searchSeq;
    if (term.isEmpty) {
      setState(() {
        _resultIds = const [];
        _resultsFor = '';
        _searching = false;
        _searchError = null;
      });
      return;
    }
    setState(() {
      _searching = true;
      _searchError = null;
    });
    _debounce = Timer(Duration(milliseconds: immediate ? 0 : 300), () async {
      if (!mounted) return;
      final catalog = context.read<CatalogController>();
      try {
        final ids = await catalog.searchProductIds(term);
        if (!mounted || seq != _searchSeq) return;
        setState(() {
          _resultIds = ids;
          _resultsFor = term;
          _searching = false;
        });
      } catch (_) {
        if (!mounted || seq != _searchSeq) return;
        setState(() {
          _resultIds = const [];
          _resultsFor = term;
          _searching = false;
          _searchError = 'Could not search right now. Check your internet connection and try again.';
        });
      }
    });
  }

  void _openVariant(ProductVariant variant) {
    Navigator.of(context).pushNamed(
      AppRoutes.productDetail,
      arguments: ProductDetailArgs(
        productId: variant.productId,
        variantId: variant.id,
      ),
    );
  }

  void _openCategory(Category category) {
    Navigator.of(context).pushNamed(
      AppRoutes.categoryBrowse,
      arguments: CategoryBrowseArgs(
        categoryId: category.id,
        categoryName: category.name,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogController>();
    final theme = Theme.of(context);
    // Only results for exactly what is typed now (never the previous search's).
    final current = _query.trim().replaceAll(RegExp(r'\s+'), ' ');
    final variants = catalog.variantsByIds(
      _resultsFor == current ? _resultIds : const [],
    );
    final categories = catalog.searchCategories(_query);
    final hasQuery = _query.trim().isNotEmpty;
    final waiting = hasQuery &&
        (_searching || _resultsFor != current || catalog.isHomeLoading || catalog.isLoading) &&
        variants.isEmpty &&
        _searchError == null;
    final isEmptyResults =
        hasQuery && !waiting && variants.isEmpty && categories.isEmpty;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: TextField(
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          style: theme.textTheme.bodyLarge,
          decoration: InputDecoration(
            hintText: 'Search products, brands or categories',
            hintStyle: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.outline,
            ),
            border: InputBorder.none,
          ),
          onChanged: _onQueryChanged,
          onSubmitted: (v) => _search(v, immediate: true),
        ),
        actions: [
          if (_query.isNotEmpty)
            IconButton(
              tooltip: 'Clear',
              onPressed: () {
                _controller.clear();
                _onQueryChanged('');
              },
              icon: const Icon(Icons.close_rounded),
            ),
        ],
      ),
      body: !hasQuery
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.space6),
                child: Text(
                  catalog.isHomeLoading || catalog.isLoading
                      ? 'Loading catalog…'
                      : 'Type to search products, brands or categories',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: AppColors.outline,
                  ),
                ),
              ),
            )
          : waiting || (_searchError != null && categories.isEmpty)
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.space6),
                    child: Text(
                      _searchError ?? 'Searching…',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.outline,
                      ),
                    ),
                  ),
                )
          : isEmptyResults
              ? Center(
                  child: Text(
                    'No results for “$_query”',
                    style: theme.textTheme.bodyMedium,
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.space4),
                  children: [
                    if (categories.isNotEmpty) ...[
                      Text(
                        'Categories',
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: AppColors.onSurfaceVariant,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.space2),
                      ...categories.map(
                        (c) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: SizedBox(
                            width: 44,
                            height: 44,
                            child: CategoryImage(
                              imageUrl: c.imageUrl,
                              imageAsset: c.imageAsset,
                              fallbackIcon: c.icon,
                              fallbackIconColor: AppColors.outline,
                              fallbackBackground: AppColors.surfaceContainer,
                              borderRadius: BorderRadius.circular(10),
                              iconSize: 22,
                              placeholder: true,
                            ),
                          ),
                          title: Text(c.name, style: theme.textTheme.titleSmall),
                          subtitle: Text(
                            '${c.itemCount} products',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: AppColors.outline,
                            ),
                          ),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () => _openCategory(c),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.space4),
                    ],
                    if (variants.isNotEmpty) ...[
                      Text(
                        'Products',
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: AppColors.onSurfaceVariant,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.space2),
                      ...variants.map((v) {
                        final product =
                            CatalogApiMapper.productFromVariant(v);
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: SizedBox(
                            width: 48,
                            height: 48,
                            child: CategoryImage(
                              imageUrl: v.imageUrl,
                              imageAsset: v.imageAsset,
                              fallbackIcon: v.icon,
                              fallbackIconColor: AppColors.primary,
                              fallbackBackground: AppColors.surfaceContainer,
                              borderRadius: BorderRadius.circular(10),
                              iconSize: 22,
                            ),
                          ),
                          title: Text(
                            product.name,
                            style: theme.textTheme.titleSmall,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            '${v.brandName} · ${v.categoryName}'
                            '${v.sku.isNotEmpty ? ' · ${v.sku}' : ''}',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: AppColors.outline,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          trailing: Text(
                            '₹${v.price.toStringAsFixed(0)}',
                            style: theme.textTheme.titleSmall?.copyWith(
                              color: AppColors.primary,
                            ),
                          ),
                          onTap: () => _openVariant(v),
                        );
                      }),
                    ],
                  ],
                ),
    );
  }
}
