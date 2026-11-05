import 'dart:convert';

import 'package:customerapp/core/network/api_client.dart';
import 'package:customerapp/features/catalog/data/mappers/catalog_api_mapper.dart';
import 'package:customerapp/features/catalog/data/models/api_catalog_product.dart';
import 'package:customerapp/features/catalog/data/repositories/catalog_repository.dart';
import 'package:customerapp/features/catalog/domain/models/catalog_models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class _RecordingApiClient extends ApiClient {
  _RecordingApiClient(this.responses);

  final Map<String, dynamic> responses;
  final calls = <(String, Map<String, String>?)>[];

  @override
  Future<dynamic> getJson(
    String path, {
    Map<String, String>? queryParameters,
    Duration timeout = const Duration(seconds: 15),
    bool authenticate = true,
  }) async {
    calls.add((path, queryParameters));
    final response = responses[path];
    if (response == null) throw StateError('Unexpected API request: $path');
    return response;
  }
}

void main() {
  test('ASP.NET category arrays and nested subcategory IDs map directly', () async {
    final api = ApiClient(
      client: MockClient((request) async {
        expect(request.url.path, '/api/catalog/categories');
        expect(request.headers['x-client'], 'app');
        return http.Response(
          jsonEncode([
            {
              'id': 2,
              'name': 'Electrical',
              'imageUrl': 'https://images.example/electrical.webp',
              'productCount': 320,
              'subCategories': [
                {'id': 9, 'name': 'CCTV'},
              ],
            },
          ]),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );
    addTearDown(api.dispose);

    final json = await api.getJson('/catalog/categories') as List<dynamic>;
    final category = CatalogApiMapper.categoryFromJson(
      Map<String, dynamic>.from(json.single as Map),
    );

    expect(category.id, '2');
    expect(category.name, 'Electrical');
    expect(category.itemCount, 320);
    expect(category.subCategoryIds, ['9']);
  });

  test('ASP.NET product card and category item preserve live fields', () {
    final product = ApiCatalogProduct.fromJson({
      'id': 1804,
      'code': 'CCC31W180M',
      'name': 'CCTV Cable White FL-3+1, 180 m',
      'categoryId': 2,
      'categoryName': 'Electrical',
      'subCategoryId': 9,
      'subCategoryName': 'CCTV',
      'brandId': 1,
      'brandName': 'Ultravolt',
      'unit': 'Nos',
      'mrp': 10320,
      'listPrice': 9288,
      'price': 9288,
      'discountPercent': 0,
      'inStock': false,
      'imageUrl': 'https://images.example/cable.webp',
      'specs': {'Conductor': 'Copper', 'Core': '3+1'},
      'catalog': {
        'typeId': 4,
        'typeName': 'Cable',
        'class': 'White',
        'familyId': 218,
        'productFamily': 'CCTV Cable White FL-3+1',
        'length': '180 m',
      },
    });

    expect(product.id, '1804');
    expect(product.productCode, 'CCC31W180M');
    expect(product.categoryId, '2');
    expect(product.subcategoryId, '9');
    expect(product.subcategory, 'CCTV');
    expect(product.brandId, '1');
    expect(product.brand, 'Ultravolt');
    expect(product.resolvedMrp, 10320);
    expect(product.resolvedSelling, 9288);
    expect(product.inStock, isFalse);
    expect(product.imageUrl, 'https://images.example/cable.webp');
    expect(product.specs, {'Conductor': 'Copper', 'Core': '3+1'});
    expect(product.type, 'Cable');
    expect(product.productClass, 'White');
  });

  test('Electrical repository uses ASP.NET routes and category ID filters', () async {
    final category = Category(
      id: '2',
      name: 'Electrical',
      icon: 'electrical',
      itemCount: 1,
      iconColor: 0,
      iconBackground: 0,
      subCategoryIds: const ['9'],
    );
    final api = _RecordingApiClient({
      '/catalog/products': {
        'items': [
          {
            'id': 1804,
            'code': 'CCC31W180M',
            'name': 'CCTV Cable White FL-3+1, 180 m',
            'brandName': 'Ultravolt',
            'categoryId': 2,
            'unit': 'Nos',
            'mrp': 10320,
            'listPrice': 9288,
            'price': 9288,
            'inStock': false,
            'catalog': {'typeId': 4, 'typeName': 'Cable', 'class': 'White'},
          },
        ],
        'total': 1,
        'page': 1,
        'pageSize': 200,
      },
      '/catalog/categories/2/items': [
        {
          'id': 1804,
          'code': 'CCC31W180M',
          'name': 'CCTV Cable White FL-3+1, 180 m',
          'brandId': 1,
          'brandName': 'Ultravolt',
          'subCategoryId': 9,
          'subCategoryName': 'CCTV',
          'unit': 'Nos',
          'mrp': 10320,
          'listPrice': 9288,
          'price': 9288,
          'inStock': false,
          'specs': {'Conductor': 'Copper'},
          'catalog': {'typeId': 4, 'typeName': 'Cable', 'class': 'White'},
        },
      ],
      '/catalog/types': [
        {'id': 4, 'categoryId': 2, 'name': 'Cable'},
      ],
    });
    final repository = CatalogRepository(apiClient: api);
    addTearDown(repository.dispose);

    final products = await repository.fetchCatalogSkus(categories: [category]);
    final electrical = CatalogApiMapper.filterElectricalItems(products);
    final tree = CatalogApiMapper.toElectricalsCatalog(electrical);

    expect(electrical, hasLength(1));
    expect(electrical.single.categoryId, '2');
    expect(electrical.single.subcategoryId, '9');
    expect(electrical.single.specs['Conductor'], 'Copper');
    expect(tree.productCount, 1);
    expect(
      api.calls.map((call) => call.$1).toSet(),
      {
        '/catalog/products',
        '/catalog/categories/2/items',
        '/catalog/types',
      },
    );
    expect(
      api.calls.firstWhere((call) => call.$1 == '/catalog/products').$2,
      {'categoryId': '2', 'page': '1', 'pageSize': '200'},
    );
    expect(
      api.calls.firstWhere((call) => call.$1 == '/catalog/types').$2,
      {'categoryId': '2'},
    );
    expect(api.calls.map((call) => call.$1), isNot(contains('/catalog')));
  });

  test('HTTP failures retain status and the server problem message', () async {
    final api = ApiClient(
      client: MockClient((_) async => http.Response(
        jsonEncode({
          'status': 503,
          'title': 'Catalogue temporarily unavailable',
          'detail': 'Please retry shortly.',
        }),
        503,
        headers: {'content-type': 'application/problem+json'},
      )),
    );
    addTearDown(api.dispose);

    await expectLater(
      api.getJson('/catalog/products'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 503)
            .having(
              (e) => e.message,
              'message',
              'Catalogue temporarily unavailable: Please retry shortly.',
            ),
      ),
    );
  });
}
