import 'package:dio/dio.dart';
import 'package:buildmate_app/core/api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:go_router/go_router.dart';
import 'package:buildmate_app/features/home/home_screen.dart';
import 'package:buildmate_app/widgets/auth/auth_otp_fields.dart';
import 'package:buildmate_app/core/scan_code.dart';
import 'package:buildmate_app/data/models.dart';
import 'package:buildmate_app/data/providers.dart';
import 'package:buildmate_app/data/search_history.dart';
import 'package:buildmate_app/features/catalog/catalog_screens.dart';
import 'package:buildmate_app/features/catalog/category_browse.dart';

class GuestAuth extends AuthController {
  GuestAuth(super.ref) {
    state = const AuthState(AuthStatus.loggedOut);
  }
}

class CatalogTestApi extends Api {
  CatalogTestApi() : super(Dio());
  final calls = <(String, Map<String, dynamic>)>[];
  @override
  Future<T> get<T>(String path, [Map<String, dynamic>? query]) async {
    calls.add((path, {...?query}));
    dynamic result;
    if (path.endsWith('/types')) {
      result = [{'id': 7, 'name': 'UPVC', 'subCategoryIds': [3]}];
    } else if (path.endsWith('/facets')) {
      result = {'types': [{'id': 7, 'count': 2}], 'brands': [], 'classes': [], 'sizes': [], 'lengths': []};
    } else {
      result = {'items': [{'id': 10, 'code': 'P10', 'name': 'Elbow family', 'brandName': 'Astral', 'unit': 'pcs', 'price': 45, 'variantCount': 3}], 'total': 1, 'page': 1, 'pageSize': 24};
    }
    return result as T;
  }
}

void main() {
  test('Delivery coverage follows server settings', () {
    final restricted = StoreInfo.fromJson({'homeDeliveryEnabled': true, 'deliveryPincodes': ['370421']});
    expect(restricted.deliversTo('370421'), isTrue);
    expect(restricted.deliversTo('400001'), isFalse);
    expect(StoreInfo.fromJson({'homeDeliveryEnabled': false}).deliversTo('370421'), isFalse);
    expect(StoreInfo.fromJson({}).deliversTo('370421'), isTrue);
  });
  test('QR accepts codes and URL codes, rejects unrelated links', () {
    expect(parseProductCode(' c1115ckg '), 'C1115CKG');
    expect(
      parseProductCode('https://buildmate24x7.com/product/c1115ckg'),
      'C1115CKG',
    );
    expect(
      parseProductCode('https://buildmate24x7.com/?code=c1115ckg'),
      'C1115CKG',
    );
    expect(parseProductCode('https://example.test/login'), isNull);
    expect(parseProductCode('javascript:alert(1)'), isNull);
    expect(parseProductCode('1234567890123'), '1234567890123');
  });
  CatalogItem item(int id, String sub, String size) => CatalogItem.fromJson({
    'id': id,
    'name': 'Coupler',
    'brandName': 'King',
    'brandId': 1,
    'unit': 'pcs',
    'subCategoryName': sub,
    'family': 'family$id',
    'mrp': 10,
    'price': 10,
    'discountPercent': 0,
    'specs': {'Material': 'CPVC', 'SDR': '11', 'Size': size},
  });
  test(
    'Rail uses subcategories, class is normalized, sizes sort numerically',
    () {
      final groups = buildGroups([
        item(1, 'CPVC Pipes', '20 mm'),
        item(2, 'CPVC Fittings', '100 mm'),
      ]);
      expect(groups.map((g) => g.type), ['CPVC Pipes', 'CPVC Fittings']);
      expect(catalogClass(groups.first.items.first), 'SDR 11');
      expect(['100 mm', '20 mm', '9 mm']..sort(compareSizes), [
        '9 mm',
        '20 mm',
        '100 mm',
      ]);
    },
  );
  test('Catalog package metadata and cart purchase units survive JSON parsing', () {
    final p = ProductCard.fromJson({'id': 1, 'code': 'P1', 'name': 'Elbow', 'brandName': 'Astral', 'unit': 'pcs', 'catalog': {'typeId': 2, 'familyId': 7, 'class': 'SDR 11', 'size': '4 sqmm', 'length': '3 m', 'packSize': 20, 'packMrp': 1000, 'boxPrice': 900}});
    expect(p.catalog!.familyId, 7);
    expect(p.catalog!.size, '4 sqmm');
    expect(p.catalog!.boxPrice, 900);
    final cart = CartLine.fromJson({'productId': 1, 'code': 'P1', 'name': 'Elbow', 'brandName': 'Astral', 'unit': 'box', 'purchaseUnit': 'Box', 'packSize': 20, 'quantity': 1, 'unitPrice': 900, 'lineTotal': 900});
    expect(cart.quantity, 1); expect(cart.packSize, 20); expect(cart.purchaseUnit, 'Box'); expect(cart.lineTotal, 900);
  });
  test('Legacy explicit families remain separated by brand', () {
    Json row(int id, int brand) => {'id': id, 'name': 'Elbow', 'brandName': 'Brand $brand', 'brandId': brand, 'unit': 'pcs', 'family': 'Elbow', 'mrp': 50, 'price': 45, 'discountPercent': 0};
    final groups = buildGroups([CatalogItem.fromJson(row(1, 1)), CatalogItem.fromJson(row(2, 1)), CatalogItem.fromJson(row(3, 2))]);
    expect(groups.length, 2); expect(groups.first.items.length, 2);
  });
  test('Recent searches deduplicate and persist after reopening', () async {
    SharedPreferences.setMockInitialValues({});
    final history = SearchHistory();
    await Future<void>.delayed(Duration.zero);
    await history.remember(' cpvc ');
    await history.remember('CPVC');
    expect(history.state, ['CPVC']);
    final reopened = SearchHistory();
    await Future<void>.delayed(Duration.zero);
    expect(reopened.state, ['CPVC']);
    await reopened.clear();
    expect(reopened.state, isEmpty);
    history.dispose();
    reopened.dispose();
  });
  testWidgets('Empty categories stay visible and tapping shows coming soon', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          categoriesProvider.overrideWith(
            (ref) async => [ProductCategory(1, 'Hardware', null, 0, [])],
          ),
          brandsProvider.overrideWith((ref) async => []),
          productGroupsProvider.overrideWith((ref) async => []),
        ],
        child: const MaterialApp(home: CategoriesScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Hardware'), findsOneWidget);
    expect(find.text('Coming soon'), findsOneWidget);
    await tester.tap(find.text('Hardware'));
    await tester.pump();
    expect(
      find.text('Coming soon. We are adding these products.'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'Home fits a narrow phone and exposes guest location, scan and rewards',
    (tester) async {
      tester.view.physicalSize = const Size(320, 740);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final store = StoreInfo.fromJson({});
      final router = GoRouter(
        initialLocation: '/home',
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authProvider.overrideWith((ref) => GuestAuth(ref)),
            storeInfoProvider.overrideWith((ref) async => store),
            homeProvider.overrideWith(
              (ref) async => HomeFeed(
                [],
                [ProductCategory(1, 'Hardware', null, 0, [])],
                [],
                [],
                store,
              ),
            ),
          ],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Deliver to'), findsOneWidget);
      expect(find.text('Scan'), findsOneWidget);
      expect(find.byTooltip('My Rewards'), findsOneWidget);
      expect(find.text('Coming soon'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('Category uses predefined Type and Sub-Category with paginated family requests', (tester) async {
    tester.view.physicalSize = const Size(320, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = CatalogTestApi();
    await tester.pumpWidget(ProviderScope(overrides: [
      apiProvider.overrideWithValue(api),
      categoriesProvider.overrideWith((ref) async => [ProductCategory(1, 'Pipes', null, 2, [(id: 3, name: 'Fitting')])]),
      authProvider.overrideWith((ref) => GuestAuth(ref)),
    ], child: const MaterialApp(home: CategoryBrowseScreen(categoryId: 1, title: 'Pipes'))));
    await tester.pumpAndSettle();
    expect(find.text('Elbow family'), findsOneWidget);
    await tester.tap(find.text('UPVC')); await tester.pumpAndSettle();
    await tester.tap(find.text('Fitting')); await tester.pumpAndSettle();
    final query = api.calls.lastWhere((c) => c.$1.endsWith('/products')).$2;
    expect(query['typeId'], 7); expect(query['subCategoryId'], 3); expect(query['collapse'], true); expect(query['pageSize'], 24);
    await tester.tap(find.byKey(const ValueKey('all-subcategories')));
    await tester.pumpAndSettle();
    final cleared = api.calls.lastWhere((c) => c.$1.endsWith('/products')).$2;
    expect(cleared['typeId'], 7);
    expect(cleared.containsKey('subCategoryId'), false);
    expect(api.calls.any((c) => c.$1.endsWith('/items')), false);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Changing category reloads products and clears the previous type', (tester) async {
    final api = CatalogTestApi();
    var categoryId = 1;
    late StateSetter changeCategory;
    await tester.pumpWidget(ProviderScope(overrides: [
      apiProvider.overrideWithValue(api),
      categoriesProvider.overrideWith((ref) async => []),
      authProvider.overrideWith((ref) => GuestAuth(ref)),
    ], child: MaterialApp(home: StatefulBuilder(builder: (context, setState) {
      changeCategory = setState;
      return CategoryBrowseScreen(categoryId: categoryId, title: 'Category $categoryId');
    }))));
    await tester.pumpAndSettle();
    await tester.tap(find.text('UPVC'));
    await tester.pumpAndSettle();
    changeCategory(() => categoryId = 2);
    await tester.pumpAndSettle();
    final query = api.calls.lastWhere((c) => c.$1.endsWith('/products')).$2;
    expect(query['categoryId'], 2);
    expect(query['page'], 1);
    expect(query.containsKey('typeId'), false);
    expect(tester.takeException(), isNull);
  });
  testWidgets('OTP accepts a complete pasted or autofilled code', (
    tester,
  ) async {
    String? completed;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AuthOtpFields(
            onCompleted: (s) => completed = s,
            onChanged: (_) {},
          ),
        ),
      ),
    );
    await tester.enterText(find.byType(TextField).first, '123456');
    await tester.pump();
    expect(completed, '123456');
  });
}
