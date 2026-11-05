import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/state/catalog_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import '../../features/catalog/domain/models/catalog_models.dart';

class CatalogFilterState {
  const CatalogFilterState({
    this.subCategoryId,
    this.brandId,
    this.size,
    this.material,
    this.sort = ProductSort.popularity,
  });

  final String? subCategoryId;
  final String? brandId;
  final String? size;
  final String? material;
  final ProductSort sort;

  CatalogFilterState copyWith({
    String? subCategoryId,
    String? brandId,
    String? size,
    String? material,
    ProductSort? sort,
    bool clearSubCategory = false,
    bool clearBrand = false,
    bool clearSize = false,
    bool clearMaterial = false,
  }) {
    return CatalogFilterState(
      subCategoryId: clearSubCategory ? null : (subCategoryId ?? this.subCategoryId),
      brandId: clearBrand ? null : (brandId ?? this.brandId),
      size: clearSize ? null : (size ?? this.size),
      material: clearMaterial ? null : (material ?? this.material),
      sort: sort ?? this.sort,
    );
  }

  bool get hasActiveFilters =>
      subCategoryId != null ||
      brandId != null ||
      size != null ||
      material != null ||
      sort != ProductSort.popularity;
}

Future<CatalogFilterState?> showCatalogFilterSheet({
  required BuildContext context,
  required CatalogFilterState initial,
  String? categoryId,
  List<SubCategory> subCategories = const [],
  List<Brand> brands = const [],
}) {
  return showModalBottomSheet<CatalogFilterState>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (context) {
      return _CatalogFilterSheet(
        initial: initial,
        categoryId: categoryId,
        subCategories: subCategories,
        brands: brands,
      );
    },
  );
}

class _CatalogFilterSheet extends StatefulWidget {
  const _CatalogFilterSheet({
    required this.initial,
    this.categoryId,
    this.subCategories = const [],
    this.brands = const [],
  });

  final CatalogFilterState initial;
  final String? categoryId;
  final List<SubCategory> subCategories;
  final List<Brand> brands;

  @override
  State<_CatalogFilterSheet> createState() => _CatalogFilterSheetState();
}

class _CatalogFilterSheetState extends State<_CatalogFilterSheet> {
  late CatalogFilterState _state;

  @override
  void initState() {
    super.initState();
    _state = widget.initial;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final catalog = context.read<CatalogController>();
    final sizes = widget.categoryId == null
        ? const <String>[]
        : catalog.sizeOptionsForCategory(widget.categoryId!);
    final materials = widget.categoryId == null
        ? const <String>[]
        : catalog.attributeOptionsForCategory(
            widget.categoryId!,
            'Material',
          );
    final media = MediaQuery.of(context);

    return SafeArea(
      child: SizedBox(
        height: media.size.height * 0.78,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.space4,
                AppSpacing.space4,
                AppSpacing.space4,
                AppSpacing.space2,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Filter / Sort',
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.space4),
                children: [
                  if (widget.subCategories.isNotEmpty) ...[
                    Text('Subcategory', style: theme.textTheme.titleSmall),
                    const SizedBox(height: AppSpacing.space2),
                    Wrap(
                      spacing: AppSpacing.space2,
                      runSpacing: AppSpacing.space2,
                      children: [
                        ChoiceChip(
                          label: const Text('All'),
                          selected: _state.subCategoryId == null,
                          onSelected: (_) => setState(
                            () => _state = _state.copyWith(clearSubCategory: true),
                          ),
                        ),
                        for (final sub in widget.subCategories)
                          ChoiceChip(
                            label: Text(sub.name),
                            selected: _state.subCategoryId == sub.id,
                            onSelected: (_) => setState(
                              () => _state = _state.copyWith(
                                subCategoryId: sub.id,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.space4),
                  ],
                  if (sizes.isNotEmpty) ...[
                    Text('Size', style: theme.textTheme.titleSmall),
                    const SizedBox(height: AppSpacing.space2),
                    Wrap(
                      spacing: AppSpacing.space2,
                      runSpacing: AppSpacing.space2,
                      children: [
                        ChoiceChip(
                          label: const Text('All'),
                          selected: _state.size == null,
                          onSelected: (_) => setState(
                            () => _state = _state.copyWith(clearSize: true),
                          ),
                        ),
                        for (final size in sizes)
                          ChoiceChip(
                            label: Text(size),
                            selected: _state.size == size,
                            onSelected: (_) => setState(
                              () => _state = _state.copyWith(size: size),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.space4),
                  ],
                  if (materials.isNotEmpty) ...[
                    Text('Material', style: theme.textTheme.titleSmall),
                    const SizedBox(height: AppSpacing.space2),
                    Wrap(
                      spacing: AppSpacing.space2,
                      runSpacing: AppSpacing.space2,
                      children: [
                        ChoiceChip(
                          label: const Text('All'),
                          selected: _state.material == null,
                          onSelected: (_) => setState(
                            () =>
                                _state = _state.copyWith(clearMaterial: true),
                          ),
                        ),
                        for (final material in materials)
                          ChoiceChip(
                            label: Text(material),
                            selected: _state.material == material,
                            onSelected: (_) => setState(
                              () =>
                                  _state = _state.copyWith(material: material),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.space4),
                  ],
                  if (widget.brands.isNotEmpty) ...[
                    Text('Brand', style: theme.textTheme.titleSmall),
                    const SizedBox(height: AppSpacing.space2),
                    Wrap(
                      spacing: AppSpacing.space2,
                      runSpacing: AppSpacing.space2,
                      children: [
                        ChoiceChip(
                          label: const Text('All'),
                          selected: _state.brandId == null,
                          onSelected: (_) => setState(
                            () => _state = _state.copyWith(clearBrand: true),
                          ),
                        ),
                        for (final brand in widget.brands)
                          ChoiceChip(
                            label: Text(brand.name),
                            selected: _state.brandId == brand.id,
                            onSelected: (_) => setState(
                              () =>
                                  _state = _state.copyWith(brandId: brand.id),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.space4),
                  ],
                  Text('Sort by', style: theme.textTheme.titleSmall),
                  const SizedBox(height: AppSpacing.space2),
                  Wrap(
                    spacing: AppSpacing.space2,
                    runSpacing: AppSpacing.space2,
                    children: [
                      for (final sort in ProductSort.values)
                        ChoiceChip(
                          label: Text(_sortLabel(sort)),
                          selected: _state.sort == sort,
                          onSelected: (_) => setState(
                            () => _state = _state.copyWith(sort: sort),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.space4),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        setState(() {
                          _state = const CatalogFilterState();
                        });
                      },
                      child: const Text('Reset'),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.space3),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.pop(context, _state),
                      child: const Text('Apply Filters'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _sortLabel(ProductSort sort) {
    switch (sort) {
      case ProductSort.popularity:
        return 'Popularity';
      case ProductSort.priceLowHigh:
        return 'Price Low → High';
      case ProductSort.priceHighLow:
        return 'Price High → Low';
      case ProductSort.newest:
        return 'Newest';
      case ProductSort.brandAz:
        return 'Brand A → Z';
    }
  }
}
