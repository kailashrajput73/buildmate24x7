import 'dart:convert';

import 'package:flutter/services.dart';

import '../domain/models/pipes_fitting_catalog_models.dart';

/// Offline demo trees when the live API returns 401 (server admin-only catalog).
abstract final class CatalogFallbackLoader {
  static const _pipesAsset = 'assets/data/pipes_fitting_mock_data.json';
  static const _electricalsAsset = 'assets/data/electricals_mock_data.json';

  static Future<({PipesFittingCatalog pipes, PipesFittingCatalog electricals})?>
      loadBundledTrees() async {
    try {
      final pipesRaw = await rootBundle.loadString(_pipesAsset);
      final pipesJson = jsonDecode(pipesRaw) as Map<String, dynamic>;
      final pipes = PipesFittingCatalog.fromJson(pipesJson);
      if (pipes.types.isEmpty) return null;

      final elecRaw = await rootBundle.loadString(_electricalsAsset);
      final elecJson = jsonDecode(elecRaw) as Map<String, dynamic>;
      final electricals = _electricalsFromLegacyMock(elecJson);
      if (electricals.types.isEmpty) return null;

      return (pipes: pipes, electricals: electricals);
    } catch (_) {
      return null;
    }
  }

  static PipesFittingCatalog _electricalsFromLegacyMock(
    Map<String, dynamic> json,
  ) {
    final category = json['category']?.toString() ?? 'Electricals';
    final categories = json['categories'] as List<dynamic>? ?? const [];

    final types = <PipesFittingType>[];
    for (final cat in categories) {
      if (cat is! Map<String, dynamic>) continue;
      final typeName =
          cat['shortName']?.toString() ?? cat['name']?.toString() ?? 'General';
      final groups = cat['groups'] as List<dynamic>? ?? const [];

      final subCategories = <PipesFittingSubCategory>[];
      for (final group in groups) {
        if (group is! Map<String, dynamic>) continue;
        final subName = group['name']?.toString() ?? 'Products';
        final products = <PipesFittingProduct>[];
        for (final row in group['products'] as List<dynamic>? ?? const []) {
          if (row is! Map<String, dynamic>) continue;
          final name = row['productName']?.toString() ?? 'Product';
          final variant = row['variant']?.toString();
          final displayName =
              variant == null || variant.isEmpty ? name : '$name · $variant';
          products.add(
            PipesFittingProduct(
              id: row['catalogueNo']?.toString(),
              brand: row['brand']?.toString() ?? 'Electrical',
              productName: displayName,
              productCode: row['catalogueNo']?.toString(),
              mrp: (row['price'] as num?)?.toDouble() ?? 0,
              unit: row['unit']?.toString() ?? 'pcs',
              productClass: 'All',
            ),
          );
        }
        if (products.isEmpty) continue;
        subCategories.add(
          PipesFittingSubCategory(
            subCategory: subName,
            classes: [
              PipesFittingClass(className: 'All', products: products),
            ],
          ),
        );
      }

      if (subCategories.isEmpty) continue;
      types.add(PipesFittingType(type: typeName, subCategories: subCategories));
    }

    return PipesFittingCatalog(category: category, types: types);
  }
}
