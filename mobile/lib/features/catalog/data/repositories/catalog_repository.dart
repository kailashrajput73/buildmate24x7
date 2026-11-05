import 'package:flutter/foundation.dart' hide Category;

import '../../../../core/network/api_client.dart';
import '../../domain/models/catalog_models.dart';
import '../mappers/catalog_api_mapper.dart';
import '../models/api_catalog_product.dart';

class CatalogRepository {
  CatalogRepository({ApiClient? apiClient})
      : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  /// The ASP.NET API returns a direct category array; only active categories
  /// are included by the backend.
  Future<List<Category>> fetchCategories({bool activeOnly = true}) async {
    final rows = _asList(await _apiClient.getJson('/catalog/categories'));
    return rows
        .map((row) => CatalogApiMapper.categoryFromJson(row))
        .where((category) => category.id.isNotEmpty && category.name.isNotEmpty)
        .toList();
  }

  /// ProductType DTOs are a direct array with numeric IDs and category IDs.
  Future<Map<String, String>> fetchProductTypes({
    required String categoryId,
  }) async {
    final rows = _asList(
      await _apiClient.getJson(
        '/catalog/types',
        queryParameters: {'categoryId': categoryId},
      ),
    );
    return {
      for (final row in rows)
        if (_string(row['id']).isNotEmpty && _string(row['name']).isNotEmpty)
          _string(row['id']): _string(row['name']),
    };
  }

  /// Loads live products for the two on-device catalogue modules. The search
  /// endpoint is paginated; category-items supplies the sub-category IDs and
  /// specification map needed by the existing filters and product cards.
  Future<List<ApiCatalogProduct>> fetchCatalogSkus({
    List<Category> categories = const [],
  }) async {
    final sourceCategories = categories.isEmpty
        ? await fetchCategories()
        : categories;
    final relevant = sourceCategories
        .where((category) =>
            CatalogApiMapper.isPipesCategory(category.name) ||
            CatalogApiMapper.isElectricalCategory(category.name))
        .toList();

    final results = await Future.wait(
      relevant.map(_fetchCategoryProducts),
    );
    final byId = <String, ApiCatalogProduct>{};
    for (final products in results) {
      for (final product in products) {
        if (product.id.isNotEmpty) byId[product.id] = product;
      }
    }
    return byId.values.toList();
  }

  Future<List<ApiCatalogProduct>> _fetchCategoryProducts(
    Category category,
  ) async {
    final categoryId = category.id;
    final responses = await Future.wait([
      _fetchProductCards(categoryId),
      _fetchCategoryItems(categoryId),
      fetchProductTypes(categoryId: categoryId),
    ]);

    final cards = responses[0] as Map<String, Map<String, dynamic>>;
    final details = responses[1] as List<Map<String, dynamic>>;
    final types = responses[2] as Map<String, String>;
    final detailById = <String, Map<String, dynamic>>{
      for (final detail in details)
        if (_string(detail['id']).isNotEmpty) _string(detail['id']): detail,
    };
    final ids = {...cards.keys, ...detailById.keys};

    return ids.map((id) {
      final card = cards[id] ?? const <String, dynamic>{};
      final detail = detailById[id] ?? const <String, dynamic>{};
      final merged = <String, dynamic>{...card, ...detail};
      merged.putIfAbsent('categoryId', () => int.tryParse(categoryId));
      merged.putIfAbsent('categoryName', () => category.name);
      merged.putIfAbsent('category', () => category.name);

      final catalog = Map<String, dynamic>.from(
        (merged['catalog'] as Map?)?.cast<String, dynamic>() ?? const {},
      );
      final typeId = _string(catalog['typeId']);
      if (_string(catalog['typeName']).isEmpty && types[typeId] != null) {
        catalog['typeName'] = types[typeId];
      }
      merged['catalog'] = catalog;

      return ApiCatalogProduct.fromJson(merged);
    }).toList();
  }

  Future<Map<String, Map<String, dynamic>>> _fetchProductCards(
    String categoryId,
  ) async {
    const pageSize = 200; // ASP.NET PageRequest accepts at most 200.
    var page = 1;
    var total = 0;
    final products = <String, Map<String, dynamic>>{};

    do {
      final response = await _apiClient.getJson(
        '/catalog/products',
        queryParameters: {
          'categoryId': categoryId,
          'page': '$page',
          'pageSize': '$pageSize',
        },
      );
      final rows = _asList(response);
      final responseMap = _asMap(response);
      total = _int(responseMap?['total']) ?? rows.length;
      for (final row in rows) {
        final id = _string(row['id']);
        if (id.isNotEmpty) products[id] = row;
      }
      if (rows.isEmpty || rows.length < pageSize) break;
      page++;
    } while ((page - 1) * pageSize < total);

    return products;
  }

  Future<List<Map<String, dynamic>>> _fetchCategoryItems(
    String categoryId,
  ) async {
    final response = await _apiClient.getJson(
      '/catalog/categories/$categoryId/items',
    );
    return _asList(response);
  }

  static List<Map<String, dynamic>> _asList(dynamic response) {
    dynamic value = response;
    if (value is Map) {
      value = value['items'] ?? value['data'] ?? value;
    }
    if (value is! List) {
      throw ApiException('Expected a JSON array from the catalogue API');
    }
    return value
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  static Map<String, dynamic>? _asMap(dynamic response) {
    if (response is Map) return Map<String, dynamic>.from(response);
    return null;
  }

  static String _string(dynamic value) => value?.toString().trim() ?? '';

  static int? _int(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(_string(value));
  }

  void dispose() => _apiClient.dispose();
}
