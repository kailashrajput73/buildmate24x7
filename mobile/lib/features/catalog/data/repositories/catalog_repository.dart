import 'package:flutter/foundation.dart' hide Category;

import '../../../../core/network/api_client.dart';
import '../../domain/models/catalog_models.dart';
import '../mappers/catalog_api_mapper.dart';
import '../models/api_catalog_product.dart';
import '../models/api_subcategory.dart';

class CatalogRepository {
  CatalogRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  /// Fetches active categories from `GET /api/categories`.
  Future<List<Category>> fetchCategories({bool activeOnly = true}) async {
    final envelope = await _apiClient.getJson(
      '/categories',
      queryParameters: {
        if (activeOnly) 'active_only': 'true',
      },
    );

    final data = envelope['data'] ?? envelope['items'] ?? envelope;
    if (data is! List) return const [];

    return data
        .whereType<Map<String, dynamic>>()
        .map(CatalogApiMapper.categoryFromJson)
        .where((c) => c.id.isNotEmpty && c.name.isNotEmpty)
        .toList();
  }

  /// Sub-categories for a pipes category (UPVC, CPVC, PVC, …) including `imageUrl`.
  Future<List<ApiSubCategory>> fetchSubcategories({String? categoryId}) async {
    final envelope = await _apiClient.getJson(
      '/subcategories',
      queryParameters: {
        if (categoryId != null && categoryId.isNotEmpty)
          'category_id': categoryId,
      },
    );

    final data = envelope['data'] ?? envelope['items'] ?? envelope;
    if (data is! List) return const [];

    return data
        .whereType<Map<String, dynamic>>()
        .map(ApiSubCategory.fromJson)
        .where((s) => s.id.isNotEmpty && s.name.isNotEmpty)
        .toList();
  }

  /// Raw SKU rows from `GET /api/catalog`.
  ///
  /// Loads the unfiltered catalog first so pipes, electricals, and all material
  /// types share one payload. If that is empty, merges every known category
  /// query (deduped by SKU id) instead of stopping at the first pipes hit.
  Future<List<ApiCatalogProduct>> fetchCatalogSkus({
    List<Category> categories = const [],
  }) async {
    Object? lastError;

    try {
      final full = await _fetchCatalogRows();
      if (full.isNotEmpty) return _dedupeCatalogById(full);
    } catch (e) {
      lastError = e;
      if (kDebugMode) {
        print('Catalog full fetch failed: $e');
      }
    }

    final queries = CatalogApiMapper.catalogQueryCandidates(categories);
    final merged = <String, ApiCatalogProduct>{};

    for (final category in queries) {
      try {
        final items = await _fetchCatalogRows(categoryQuery: category);
        for (final item in items) {
          if (item.id.isEmpty) continue;
          merged[item.id] = item;
        }
      } catch (e) {
        lastError = e;
        if (kDebugMode) {
          print('Catalog fetch failed for category="$category": $e');
        }
      }
    }

    if (merged.isNotEmpty) return merged.values.toList();

    if (lastError != null) {
      throw ApiException(
        'Unable to load catalog from server',
        statusCode: lastError is ApiException ? lastError.statusCode : null,
        body: lastError.toString(),
      );
    }

    throw ApiException('Catalog response was empty');
  }

  static List<ApiCatalogProduct> _dedupeCatalogById(
    List<ApiCatalogProduct> items,
  ) {
    final byId = <String, ApiCatalogProduct>{};
    for (final item in items) {
      if (item.id.isEmpty) continue;
      byId[item.id] = item;
    }
    return byId.values.toList();
  }

  /// Fetches active pipe catalog items from the live backend.
  Future<List<ApiCatalogProduct>> fetchPipeCatalog({
    List<Category> categories = const [],
  }) async {
    final items = await fetchCatalogSkus(categories: categories);
    return CatalogApiMapper.filterPipeItems(items);
  }

  /// Fetches active electrical catalog items from the live backend.
  Future<List<ApiCatalogProduct>> fetchElectricalCatalog({
    List<Category> categories = const [],
  }) async {
    final items = await fetchCatalogSkus(categories: categories);
    return CatalogApiMapper.filterElectricalItems(items);
  }

  Future<List<ApiCatalogProduct>> _fetchCatalogRows({
    String? categoryQuery,
  }) async {
    final envelope = await _apiClient.getJson(
      '/catalog',
      queryParameters: {
        if (categoryQuery != null && categoryQuery.isNotEmpty)
          'category': categoryQuery,
      },
    );

    final data = envelope['data'] ?? envelope['items'] ?? envelope;
    if (data is! List) return const [];

    return data
        .whereType<Map<String, dynamic>>()
        .map(ApiCatalogProduct.fromJson)
        .toList();
  }

  /// Sidebar **Type** images (UPVC, CPVC, PVC) from `GET /api/catalog/tree`.
  Future<Map<String, String>> fetchPipeTypeImagesFromTree({
    bool activeOnly = true,
  }) async {
    try {
      final envelope = await _apiClient.getJson(
        '/catalog/tree',
        queryParameters: {
          if (activeOnly) 'active_only': 'true',
        },
      );
      return CatalogApiMapper.materialImagesFromCatalogTree(envelope);
    } catch (e) {
      if (kDebugMode) {
        print('Catalog tree fetch failed: $e');
      }
      return const {};
    }
  }

  void dispose() => _apiClient.dispose();
}
