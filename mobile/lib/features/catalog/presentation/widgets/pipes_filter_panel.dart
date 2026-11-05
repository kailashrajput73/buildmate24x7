import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/models/catalog_models.dart';
import '../../domain/models/pipes_fitting_catalog_models.dart';

enum PipeFilterTab { sort, size, brand }

enum PipeModuleSort {
  all,
  discount,
  priceLowHigh,
  whatsNew,
  priceHighLow,
  ratings,
}

/// Wireframe size options — left and right columns.
abstract final class PipeFilterSizes {
  static const leftColumn = [
    '15 mm',
    '20 mm',
    '25 mm',
    '32 mm',
    '40 mm',
    '50 mm',
    '65 mm',
    '80 mm',
    '100 mm',
    '150 mm',
  ];

  static const rightColumn = [
    '200 mm',
    '250 mm',
    '300 mm',
  ];

  static const all = [...leftColumn, ...rightColumn];
}

/// Distinct brand names from live catalog data (no hardcoded list).
abstract final class PipeFilterBrands {
  static List<String> fromPipesCatalog(PipesFittingCatalog catalog) {
    final brands = <String>{};
    for (final type in catalog.types) {
      for (final sub in type.subCategories) {
        for (final cls in sub.classes) {
          for (final product in cls.products) {
            final name = product.brand.trim();
            if (name.isNotEmpty) brands.add(name);
          }
        }
      }
    }
    return _sorted(brands);
  }

  static List<String> fromVariants(List<ProductVariant> variants) {
    final brands = <String>{};
    for (final variant in variants) {
      final name = variant.brandName.trim();
      if (name.isNotEmpty) brands.add(name);
    }
    return _sorted(brands);
  }

  static List<String> _sorted(Set<String> brands) {
    final list = brands.toList();
    list.sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
    return list;
  }
}

/// Class matching shared by the live Pipes & Fitting catalog filters.
abstract final class PipeFilterClasses {
  /// Case- and space-insensitive match, so "4kg" equals "4 kg".
  static bool matches(String a, String b) =>
      a.replaceAll(' ', '').toLowerCase() == b.replaceAll(' ', '').toLowerCase();
}

/// Bottom filter area — sheet + tab bar matching the pipes module wireframe.
class PipesFilterChrome extends StatelessWidget {
  const PipesFilterChrome({
    super.key,
    required this.activeTab,
    required this.onTabSelected,
    required this.onClose,
    required this.sort,
    required this.selectedSize,
    required this.selectedBrand,
    required this.onSortChanged,
    required this.onSizeChanged,
    required this.onBrandChanged,
    required this.availableBrands,
    this.showBrandTab = true,
  });

  final PipeFilterTab? activeTab;
  final ValueChanged<PipeFilterTab> onTabSelected;
  final VoidCallback onClose;
  final PipeModuleSort sort;
  final String? selectedSize;
  final String? selectedBrand;
  final ValueChanged<PipeModuleSort> onSortChanged;
  final ValueChanged<String?> onSizeChanged;
  final ValueChanged<String?> onBrandChanged;
  final List<String> availableBrands;
  final bool showBrandTab;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
            if (activeTab != null) ...[
              _FilterSheet(
                tab: activeTab!,
                sort: sort,
                selectedSize: selectedSize,
                selectedBrand: selectedBrand,
                availableBrands: availableBrands,
                onSortChanged: onSortChanged,
                onSizeChanged: onSizeChanged,
                onBrandChanged: onBrandChanged,
                onClose: onClose,
              ),
              const SizedBox(height: AppSpacing.space2),
            ],
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              boxShadow: [
                BoxShadow(
                  color: AppColors.shadow,
                  blurRadius: 12,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: _FilterTabBar(
              activeTab: activeTab,
              onSort: () => onTabSelected(PipeFilterTab.sort),
              onSize: () => onTabSelected(PipeFilterTab.size),
              onBrand: () => onTabSelected(PipeFilterTab.brand),
              showBrandTab: showBrandTab,
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterSheet extends StatelessWidget {
  const _FilterSheet({
    required this.tab,
    required this.sort,
    required this.selectedSize,
    required this.selectedBrand,
    required this.onSortChanged,
    required this.onSizeChanged,
    required this.onBrandChanged,
    required this.onClose,
    required this.availableBrands,
  });

  final PipeFilterTab tab;
  final PipeModuleSort sort;
  final String? selectedSize;
  final String? selectedBrand;
  final List<String> availableBrands;
  final ValueChanged<PipeModuleSort> onSortChanged;
  final ValueChanged<String?> onSizeChanged;
  final ValueChanged<String?> onBrandChanged;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final maxSheetHeight = MediaQuery.sizeOf(context).height * 0.42;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxSheetHeight),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: AppSpacing.space2),
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.outlineVariant,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.space5,
                AppSpacing.space4,
                AppSpacing.space3,
                AppSpacing.space2,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _title,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Material(
                    color: AppColors.surfaceContainer,
                    shape: const CircleBorder(),
                    child: InkWell(
                      onTap: onClose,
                      customBorder: const CircleBorder(),
                      child: const SizedBox(
                        width: 32,
                        height: 32,
                        child: Icon(Icons.close_rounded, size: 18),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.only(bottom: AppSpacing.space4),
                child: switch (tab) {
                  PipeFilterTab.sort => _SortOptions(
                      sort: sort,
                      onChanged: onSortChanged,
                    ),
                  PipeFilterTab.size => _SizeOptions(
                      selectedSize: selectedSize,
                      onChanged: onSizeChanged,
                    ),
                  PipeFilterTab.brand => _BrandOptions(
                      brands: availableBrands,
                      selectedBrand: selectedBrand,
                      onChanged: onBrandChanged,
                    ),
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  String get _title {
    switch (tab) {
      case PipeFilterTab.sort:
        return 'Sort By';
      case PipeFilterTab.size:
        return 'Size';
      case PipeFilterTab.brand:
        return 'Brands';
    }
  }
}

class _SortOptions extends StatelessWidget {
  const _SortOptions({
    required this.sort,
    required this.onChanged,
  });

  final PipeModuleSort sort;
  final ValueChanged<PipeModuleSort> onChanged;

  static const _options = [
    (PipeModuleSort.all, 'All'),
    (PipeModuleSort.discount, 'Discount'),
    (PipeModuleSort.priceLowHigh, 'Price (lowest first)'),
    (PipeModuleSort.whatsNew, 'What’s New'),
    (PipeModuleSort.priceHighLow, 'Price (highest first)'),
    (PipeModuleSort.ratings, 'Ratings'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final option in _options)
          _FilterOptionTile(
            label: option.$2,
            selected: sort == option.$1,
            useSquareIndicator: true,
            onTap: () => onChanged(option.$1),
          ),
      ],
    );
  }
}

class _SizeOptions extends StatelessWidget {
  const _SizeOptions({
    required this.selectedSize,
    required this.onChanged,
  });

  final String? selectedSize;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              children: [
                for (final size in PipeFilterSizes.leftColumn)
                  _FilterOptionTile(
                    label: size,
                    selected: selectedSize == size,
                    compact: true,
                    onTap: () => onChanged(selectedSize == size ? null : size),
                  ),
              ],
            ),
          ),
          Expanded(
            child: Column(
              children: [
                for (final size in PipeFilterSizes.rightColumn)
                  _FilterOptionTile(
                    label: size,
                    selected: selectedSize == size,
                    compact: true,
                    onTap: () => onChanged(selectedSize == size ? null : size),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BrandOptions extends StatelessWidget {
  const _BrandOptions({
    required this.brands,
    required this.selectedBrand,
    required this.onChanged,
  });

  final List<String> brands;
  final String? selectedBrand;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    if (brands.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space5),
        child: Text(
          'No brands in catalog',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppColors.onSurfaceVariant,
          ),
        ),
      );
    }

    return Column(
      children: [
        for (final brand in brands)
          _FilterOptionTile(
            label: brand,
            selected: _brandEquals(selectedBrand, brand),
            onTap: () => onChanged(
              _brandEquals(selectedBrand, brand) ? null : brand,
            ),
          ),
      ],
    );
  }
}

bool _brandEquals(String? a, String b) =>
    a != null && a.toLowerCase() == b.toLowerCase();

class _FilterOptionTile extends StatelessWidget {
  const _FilterOptionTile({
    required this.label,
    required this.selected,
    required this.onTap,
    this.useSquareIndicator = false,
    this.compact = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool useSquareIndicator;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: selected ? AppColors.primaryContainer.withValues(alpha: 0.35) : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacing.space5,
            vertical: compact ? AppSpacing.space2 : AppSpacing.space3,
          ),
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: selected ? AppColors.primary : Colors.transparent,
                  shape: useSquareIndicator ? BoxShape.rectangle : BoxShape.circle,
                  borderRadius:
                      useSquareIndicator ? BorderRadius.circular(6) : null,
                  border: Border.all(
                    color: selected ? AppColors.primary : AppColors.outlineVariant,
                    width: 1.5,
                  ),
                ),
                child: selected
                    ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
                    : null,
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Text(
                  label,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    fontSize: compact ? 15 : null,
                    color: selected ? AppColors.onBackground : AppColors.onSurface,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterTabBar extends StatelessWidget {
  const _FilterTabBar({
    required this.activeTab,
    required this.onSort,
    required this.onSize,
    required this.onBrand,
    this.showBrandTab = true,
  });

  final PipeFilterTab? activeTab;
  final VoidCallback onSort;
  final VoidCallback onSize;
  final VoidCallback onBrand;
  final bool showBrandTab;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.space2,
        AppSpacing.space2,
        AppSpacing.space2,
        AppSpacing.space3,
      ),
      child: Row(
        children: [
          Expanded(
            child: _FilterTab(
              icon: Icons.sort_rounded,
              label: 'Sort By',
              selected: activeTab == PipeFilterTab.sort,
              onTap: onSort,
              textStyle: theme.textTheme.labelLarge,
            ),
          ),
          Expanded(
            child: _FilterTab(
              icon: Icons.open_in_full_rounded,
              label: 'Size',
              selected: activeTab == PipeFilterTab.size,
              onTap: onSize,
              textStyle: theme.textTheme.labelLarge,
            ),
          ),
          if (showBrandTab)
            Expanded(
              child: _FilterTab(
                icon: Icons.sell_outlined,
                label: 'Brand',
                selected: activeTab == PipeFilterTab.brand,
                onTap: onBrand,
                textStyle: theme.textTheme.labelLarge,
              ),
            ),
        ],
      ),
    );
  }
}

class _FilterTab extends StatelessWidget {
  const _FilterTab({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    required this.textStyle,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final TextStyle? textStyle;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.primary : AppColors.onSurfaceVariant;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space1),
      child: Material(
        color: selected ? AppColors.primaryContainer.withValues(alpha: 0.4) : Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              vertical: AppSpacing.space3,
              horizontal: AppSpacing.space2,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 22, color: color),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: textStyle?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Extracts numeric mm from labels like `15 mm` or raw spec values.
double? pipeSizeMmValue(String raw) {
  final match = RegExp(r'(\d+(?:\.\d+)?)').firstMatch(raw.trim());
  return match != null ? double.tryParse(match.group(1)!) : null;
}

/// Sort key for pipe size labels (`15 MM (½")`, `1"`, etc.).
double? pipeSizeSortMm(String raw) {
  final upper = raw.trim().toUpperCase();
  final mmInLabel = RegExp(r'(\d+(?:\.\d+)?)\s*MM').firstMatch(upper);
  if (mmInLabel != null) {
    return double.tryParse(mmInLabel.group(1)!);
  }
  return pipeSizeMmValue(raw);
}

/// Inch-only label for UI chips (e.g. `40 MM (1½")` → `1½"`).
String pipeSizeInchDisplayLabel(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return trimmed;

  final paren = RegExp(r'\(([^)]+)\)').firstMatch(trimmed);
  if (paren != null) {
    var inch = paren.group(1)!.trim().replaceAll('”', '"');
    if (!inch.endsWith('"')) inch = '$inch"';
    return inch;
  }

  final normalized = trimmed.replaceAll('”', '"');
  if (normalized.contains('"')) return normalized;
  return trimmed;
}

void sortPipeSizesAscending(List<String> sizes) {
  sizes.sort((a, b) {
    final aMm = pipeSizeSortMm(a);
    final bMm = pipeSizeSortMm(b);
    if (aMm != null && bMm != null) return aMm.compareTo(bMm);
    if (aMm != null) return -1;
    if (bMm != null) return 1;
    return a.compareTo(b);
  });
}

/// Whether a product variant matches a wireframe size label.
bool variantMatchesPipeSize(ProductVariant variant, String sizeLabel) {
  final targetMm = pipeSizeMmValue(sizeLabel);
  if (targetMm == null) return false;

  final specSize = variant.specifications['Size'] ?? '';
  final specMm = pipeSizeMmValue(specSize);
  if (specMm != null && specMm == targetMm) return true;

  return specSize.toLowerCase().contains('${targetMm.toInt()}');
}

/// Whether a product variant matches a wireframe brand label.
bool variantMatchesPipeBrand(ProductVariant variant, String brandName) {
  return variant.brandName.toLowerCase() == brandName.toLowerCase();
}
