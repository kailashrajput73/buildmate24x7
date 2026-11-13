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
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
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
    final variants = catalog.searchVariants(_query);
    final categories = catalog.searchCategories(_query);
    final hasQuery = _query.trim().isNotEmpty;
    final isEmptyResults =
        hasQuery && variants.isEmpty && categories.isEmpty;

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
          onChanged: (v) => setState(() => _query = v),
          onSubmitted: (v) => setState(() => _query = v),
        ),
        actions: [
          if (_query.isNotEmpty)
            IconButton(
              tooltip: 'Clear',
              onPressed: () {
                _controller.clear();
                setState(() => _query = '');
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
