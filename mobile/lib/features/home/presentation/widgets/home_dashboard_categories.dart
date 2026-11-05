import '../../../../core/theme/app_colors.dart';
import '../../../catalog/domain/models/catalog_models.dart';
import '../../domain/models/home_models.dart';

/// Bondite-style home category grid: priority row + full catalog.
abstract final class HomeDashboardCategories {
  static const _assetRoot = 'assets/images/categories/';

  static String _normalize(String value) {
    return value
        .toLowerCase()
        .replaceAll('&', 'and')
        .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  static bool _matches(String name, List<String> needles) {
    final n = _normalize(name);
    return needles.any((k) => n.contains(k));
  }

  static Category? _takeMatch(
    List<Category> pool,
    List<String> needles,
  ) {
    final index = pool.indexWhere((c) => _matches(c.name, needles));
    if (index < 0) return null;
    return pool.removeAt(index);
  }

  static Category _mergeSeed(Category? api, _CategorySeed seed) {
    final base = api ?? seed.toCategory();
    final displayName =
        api != null && api.name.isNotEmpty ? api.name : seed.name;
    return Category(
      id: api != null && api.id.isNotEmpty ? api.id : seed.id,
      name: displayName,
      icon: api != null && api.icon.isNotEmpty ? api.icon : seed.icon,
      itemCount: api?.itemCount ?? 0,
      iconColor: api?.iconColor ?? base.iconColor,
      iconBackground: api?.iconBackground ?? base.iconBackground,
      imageAsset: _imageAssetForName(displayName, seed: seed),
      imageUrl: api?.imageUrl,
      description: api?.description ?? '',
      subCategoryIds: api?.subCategoryIds ?? const [],
    );
  }

  /// Home grid order: first four fixed, then remaining Bondite-style categories.
  static List<HomeCategory> forDashboard(List<Category> apiCategories) {
    final pool = List<Category>.from(apiCategories);
    final ordered = <Category>[];

    for (final seed in _homeCategorySeeds) {
      final api = _takeMatch(pool, seed.matchers);
      ordered.add(_mergeSeed(api, seed));
    }

    for (final extra in pool) {
      ordered.add(extra);
    }

    return [
      for (final c in ordered) _toHomeCategory(c),
    ];
  }

  static HomeCategory _toHomeCategory(Category c) {
    return HomeCategory(
      id: c.id,
      name: c.name,
      itemCount: c.itemCount,
      icon: c.icon,
      iconColor: c.iconColor,
      iconBackground: c.iconBackground,
      imageAsset: c.imageAsset.isNotEmpty
          ? c.imageAsset
          : _imageAssetForName(c.name),
      imageUrl: c.imageUrl,
    );
  }

  static String _imageAssetForName(String name, {_CategorySeed? seed}) {
    if (seed?.imageAsset != null && seed!.imageAsset!.isNotEmpty) {
      return seed.imageAsset!;
    }
    if (_matches(name, ['furniture'])) {
      return '${_assetRoot}locks_handles.png';
    }
    if (_matches(name, ['valve', 'valves'])) {
      return '${_assetRoot}valves_controls.png';
    }
    if (_matches(name, ['sanitary', 'sanitaryware', 'bath'])) {
      return '${_assetRoot}sanitary_wares.png';
    }
    if (_matches(name, ['plywood', 'mdf'])) {
      return '${_assetRoot}consumables.png';
    }
    if (_matches(name, ['waterproof', 'repair'])) {
      return '${_assetRoot}paints_putty.png';
    }
    if (_matches(name, ['safety', 'ppe'])) {
      return '${_assetRoot}hardware_tools.png';
    }
    if (_matches(name, ['construction', 'sand', 'aggregate'])) {
      return '${_assetRoot}cement_plaster.png';
    }
    if (_isPlumbingCategory(name)) {
      return '${_assetRoot}plumbing_pipes_fittings.png';
    }
    if (_matches(name, ['electr'])) {
      return '${_assetRoot}electricals_lights.png';
    }
    if (_matches(name, ['cement', 'plaster'])) {
      return '${_assetRoot}cement_plaster.png';
    }
    if (_matches(name, ['til', 'grout', 'tile'])) {
      return '${_assetRoot}tiling_grouts.png';
    }
    if (_matches(name, ['paint', 'putty'])) {
      return '${_assetRoot}paints_putty.png';
    }
    if (_matches(name, ['fevicol', 'adhesive', 'glue'])) {
      return '${_assetRoot}fevicol_adhesives.png';
    }
    if (_matches(name, ['lock', 'handle'])) {
      return '${_assetRoot}locks_handles.png';
    }
    if (_matches(name, ['hardware', 'tool'])) {
      return '${_assetRoot}hardware_tools.png';
    }
    return '';
  }

  static bool _isPlumbingCategory(String name) {
    if (_matches(name, ['furniture'])) return false;
    return _matches(name, ['pipe', 'plumb']) ||
        (_matches(name, ['fitting']) && !_matches(name, ['furniture']));
  }

  static const List<_CategorySeed> _homeCategorySeeds = [
    // Priority sequence (user request).
    _CategorySeed(
      id: 'cat-pipes-tubing',
      name: 'Pipes & Fitting',
      icon: 'plumbing',
      imageAsset: '${_assetRoot}plumbing_pipes_fittings.png',
      matchers: ['pipe', 'fitting', 'plumb'],
    ),
    _CategorySeed(
      id: 'cat-electricals-lights',
      name: 'Electricals',
      icon: 'electrical_services',
      imageAsset: '${_assetRoot}electricals_lights.png',
      matchers: ['electrical', 'electric'],
    ),
    _CategorySeed(
      id: 'cat-valves-controls',
      name: 'Valves & Controls',
      icon: 'settings_input_component',
      imageAsset: '${_assetRoot}valves_controls.png',
      matchers: ['valve', 'valves'],
    ),
    _CategorySeed(
      id: 'cat-sanitary-wares',
      name: 'Sanitarywares',
      icon: 'water_drop',
      imageAsset: '${_assetRoot}sanitary_wares.png',
      matchers: ['sanitary', 'sanitaryware', 'bath fitting'],
    ),
    // Remaining categories (reference grid).
    _CategorySeed(
      id: 'cat-cement-plaster',
      name: 'Cement & Plaster',
      icon: 'inventory_2',
      imageAsset: '${_assetRoot}cement_plaster.png',
      matchers: ['cement', 'plaster'],
    ),
    _CategorySeed(
      id: 'cat-tiling-grouts',
      name: 'Tiling & Grouts',
      icon: 'grid_view',
      imageAsset: '${_assetRoot}tiling_grouts.png',
      matchers: ['tiling', 'grout', 'tile'],
    ),
    _CategorySeed(
      id: 'cat-paints-putty',
      name: 'Paints & Putty',
      icon: 'palette',
      imageAsset: '${_assetRoot}paints_putty.png',
      matchers: ['paint', 'putty'],
    ),
    _CategorySeed(
      id: 'cat-plywood-mdf',
      name: 'Plywood & MDF',
      icon: 'layers',
      imageAsset: '${_assetRoot}consumables.png',
      matchers: ['plywood', 'mdf', 'wood'],
    ),
    _CategorySeed(
      id: 'cat-fevicol-adhesives',
      name: 'Fevicol & Adhesives',
      icon: 'science',
      imageAsset: '${_assetRoot}fevicol_adhesives.png',
      matchers: ['fevicol', 'adhesive', 'glue'],
    ),
    _CategorySeed(
      id: 'cat-furniture-fittings',
      name: 'Furniture Fittings',
      icon: 'chair',
      imageAsset: '${_assetRoot}locks_handles.png',
      matchers: ['furniture'],
    ),
    _CategorySeed(
      id: 'cat-locks-handles',
      name: 'Locks & Handles',
      icon: 'lock',
      imageAsset: '${_assetRoot}locks_handles.png',
      matchers: ['lock', 'handle'],
    ),
    _CategorySeed(
      id: 'cat-hardware-tools',
      name: 'Hardware & Tools',
      icon: 'handyman',
      imageAsset: '${_assetRoot}hardware_tools.png',
      matchers: ['hardware', 'tool'],
    ),
    _CategorySeed(
      id: 'cat-waterproofing',
      name: 'Waterproofing & Repair',
      icon: 'water_damage',
      imageAsset: '${_assetRoot}paints_putty.png',
      matchers: ['waterproof', 'repair'],
    ),
    _CategorySeed(
      id: 'cat-safety-gear',
      name: 'Safety Gear',
      icon: 'health_and_safety',
      imageAsset: '${_assetRoot}hardware_tools.png',
      matchers: ['safety', 'ppe'],
    ),
    _CategorySeed(
      id: 'cat-construction-materials',
      name: 'Construction Materials',
      icon: 'landscape',
      imageAsset: '${_assetRoot}cement_plaster.png',
      matchers: ['construction', 'sand', 'aggregate'],
    ),
  ];
}

final class _CategorySeed {
  const _CategorySeed({
    required this.id,
    required this.name,
    required this.icon,
    required this.matchers,
    this.imageAsset,
  });

  final String id;
  final String name;
  final String icon;
  final List<String> matchers;
  final String? imageAsset;

  Category toCategory() {
    return Category(
      id: id,
      name: name,
      icon: icon,
      itemCount: 0,
      iconColor: AppColors.primary.toARGB32(),
      iconBackground: AppColors.primaryContainer.toARGB32(),
      imageAsset: imageAsset ?? '',
    );
  }
}
