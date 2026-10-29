import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api.dart';
import '../core/i18n.dart';
import '../core/phone_auth.dart';
import 'models.dart';

// ---------------------------------------------------------------- Auth

enum AuthStatus { unknown, loggedOut, loggedIn }

class AuthState {
  final AuthStatus status;
  final AuthUser? user;
  const AuthState(this.status, [this.user]);
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this.ref) : super(const AuthState(AuthStatus.unknown)) {
    ref.listen(sessionExpiredProvider, (_, __) => state = const AuthState(AuthStatus.loggedOut));
  }
  final Ref ref;
  Api get _api => ref.read(apiProvider);

  Future<void> bootstrap() async {
    final tokens = ref.read(tokenStoreProvider);
    await tokens.load();
    if (!tokens.hasSession) {
      state = const AuthState(AuthStatus.loggedOut);
      return;
    }
    try {
      final me = AuthUser.fromJson(await _api.get<Json>('/api/auth/me'));
      state = AuthState(AuthStatus.loggedIn, me);
    } on ApiException catch (e) {
      // Offline: keep the user in with the cached session; screens show their own errors.
      if (e.status == 0) {
        state = const AuthState(AuthStatus.loggedIn);
      } else {
        await tokens.clear();
        state = const AuthState(AuthStatus.loggedOut);
      }
    }
  }

  PhoneAuth get phone => ref.read(phoneAuthProvider);

  /// Exchanges the phone proof for a BuildMate session. [audience] is set when creating an account
  /// ('Customer' or 'Partner'); without it the API signs in to whichever account the number already has.
  /// Throws [SignupRequired] when the number has no account yet.
  Future<AuthUser> signIn(PhoneProof proof, {String? audience, String? name, String? email, String? partnerType}) async {
    final extra = {
      if (audience != null) 'audience': audience,
      if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
      if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
      if (partnerType != null) 'partnerType': partnerType,
    };
    final Json r;
    try {
      r = switch (proof) {
        FirebaseProof p => await _api.post<Json>('/api/auth/firebase', {'idToken': p.idToken, ...extra}),
        OtpProof p => await _api.post<Json>('/api/auth/otp/verify', {'phone': p.phone, 'code': p.code, ...extra}),
      };
    } on ApiException catch (e) {
      if (e.status == 409 && e.code != null && e.code!.contains('signup_required')) throw SignupRequired(proof);
      rethrow;
    }
    await ref.read(tokenStoreProvider).save(r['accessToken'] as String, r['refreshToken'] as String);
    final user = AuthUser.fromJson(r['user'] as Json);
    if (user.preferredLanguage != ref.read(langProvider)) await ref.read(langProvider.notifier).set(user.preferredLanguage);
    state = AuthState(AuthStatus.loggedIn, user);
    return user;
  }

  Future<void> refreshMe() async {
    try {
      state = AuthState(AuthStatus.loggedIn, AuthUser.fromJson(await _api.get<Json>('/api/auth/me')));
    } catch (_) {}
  }

  Future<void> logout() async {
    final tokens = ref.read(tokenStoreProvider);
    if (tokens.refresh != null) {
      try {
        await _api.post('/api/auth/logout', {'refreshToken': tokens.refresh});
      } catch (_) {}
    }
    await tokens.clear();
    await phone.signOut();
    state = const AuthState(AuthStatus.loggedOut);
  }
}

/// The number has no account yet: ask for name and profession, then call [AuthController.signIn] with an audience.
class SignupRequired implements Exception {
  SignupRequired(this.proof);
  final PhoneProof proof;
}

final phoneAuthProvider = Provider<PhoneAuth>((ref) => PhoneAuth(ref.read(apiProvider)));

final authProvider = StateNotifierProvider<AuthController, AuthState>((ref) => AuthController(ref));

// ---------------------------------------------------------------- Partner profile & KYC

final profileProvider = FutureProvider.autoDispose<PartnerProfile>((ref) async {
  ref.watch(authProvider.select((s) => s.user?.id));
  return PartnerProfile.fromJson(await ref.read(apiProvider).get<Json>('/api/partner/profile'));
});

class KycRepo {
  KycRepo(this.api);
  final Api api;

  Future<PartnerProfile> saveProfile(Json body) async => PartnerProfile.fromJson(await api.put<Json>('/api/partner/profile', body));

  Future<void> uploadDocument(String type, String? number, String filePath) async {
    final form = FormData.fromMap({
      'type': type,
      if (number != null && number.isNotEmpty) 'number': number,
      'file': await MultipartFile.fromFile(filePath, filename: filePath.split('/').last),
    });
    await api.upload<Json>('/api/partner/kyc/documents', form);
  }

  Future<PartnerProfile> submit() async => PartnerProfile.fromJson(await api.post<Json>('/api/partner/kyc/submit'));
}

final kycRepoProvider = Provider((ref) => KycRepo(ref.watch(apiProvider)));

// ---------------------------------------------------------------- Catalogue

final homeProvider = FutureProvider.autoDispose<HomeFeed>((ref) async {
  ref.watch(langProvider);
  return HomeFeed.fromJson(await ref.read(apiProvider).get<Json>('/api/catalog/home'));
});

final categoriesProvider = FutureProvider<List<ProductCategory>>((ref) async {
  ref.watch(langProvider);
  final list = await ref.read(apiProvider).get<List<dynamic>>('/api/catalog/categories');
  return list.map((e) => ProductCategory.fromJson(e as Json)).toList();
});

final brandsProvider = FutureProvider<List<({int id, String name})>>((ref) async {
  final list = await ref.read(apiProvider).get<List<dynamic>>('/api/catalog/brands');
  return list.map((e) => (id: (e['id'] as num).toInt(), name: e['name'] as String)).toList();
});

final productProvider = FutureProvider.autoDispose.family<ProductDetail, int>((ref, id) async {
  ref.watch(langProvider);
  return ProductDetail.fromJson(await ref.read(apiProvider).get<Json>('/api/catalog/products/$id'));
});

/// Search filters; equality matters because it's a provider family key.
class CatalogQuery {
  final String q;
  final int? categoryId, subCategoryId, brandId, groupId;
  final String sort;
  final bool inStock;
  const CatalogQuery({this.q = '', this.categoryId, this.subCategoryId, this.brandId, this.groupId, this.sort = '', this.inStock = false});

  CatalogQuery copyWith({String? q, int? Function()? categoryId, int? Function()? subCategoryId, int? Function()? brandId, String? sort, bool? inStock}) =>
      CatalogQuery(
        q: q ?? this.q,
        categoryId: categoryId != null ? categoryId() : this.categoryId,
        subCategoryId: subCategoryId != null ? subCategoryId() : this.subCategoryId,
        brandId: brandId != null ? brandId() : this.brandId,
        groupId: groupId,
        sort: sort ?? this.sort,
        inStock: inStock ?? this.inStock,
      );

  Map<String, dynamic> toParams(int page) => {
        'q': q, 'categoryId': categoryId, 'subCategoryId': subCategoryId, 'brandId': brandId, 'groupId': groupId,
        'sort': sort, 'inStock': inStock ? 'true' : null, 'page': page, 'pageSize': 30, 'collapse': 'true',
      };

  @override
  bool operator ==(Object o) => o is CatalogQuery && o.q == q && o.categoryId == categoryId && o.subCategoryId == subCategoryId &&
      o.brandId == brandId && o.groupId == groupId && o.sort == sort && o.inStock == inStock;
  @override
  int get hashCode => Object.hash(q, categoryId, subCategoryId, brandId, groupId, sort, inStock);
}

/// Infinite-scroll product list for a query.
class ProductListController extends StateNotifier<AsyncValue<Paged<ProductCard>>> {
  ProductListController(this.ref, this.query) : super(const AsyncValue.loading()) {
    load();
  }
  final Ref ref;
  final CatalogQuery query;
  bool _loadingMore = false;

  Future<void> load() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async =>
        Paged.fromJson(await ref.read(apiProvider).get<Json>('/api/catalog/products', query.toParams(1)), ProductCard.fromJson));
  }

  Future<void> more() async {
    final cur = state.valueOrNull;
    if (cur == null || !cur.hasMore || _loadingMore) return;
    _loadingMore = true;
    try {
      final next = Paged.fromJson(await ref.read(apiProvider).get<Json>('/api/catalog/products', query.toParams(cur.page + 1)), ProductCard.fromJson);
      state = AsyncValue.data(Paged([...cur.items, ...next.items], next.total, next.page, next.pageSize));
    } catch (_) {
    } finally {
      _loadingMore = false;
    }
  }
}

final productListProvider = StateNotifierProvider.autoDispose.family<ProductListController, AsyncValue<Paged<ProductCard>>, CatalogQuery>(
    (ref, q) => ProductListController(ref, q));

// ---------------------------------------------------------------- Cart

class CartController extends StateNotifier<AsyncValue<Cart>> {
  CartController(this.ref) : super(const AsyncValue.loading()) {
    reload();
  }
  final Ref ref;
  Api get _api => ref.read(apiProvider);

  Future<void> reload({String? fulfilment}) async {
    if (!ref.read(tokenStoreProvider).hasSession) {
      state = AsyncValue.error(ApiException(401, 'Log in to use your cart.'), StackTrace.current);
      return;
    }
    state = await AsyncValue.guard(() async => Cart.fromJson(await _api.get<Json>('/api/cart', {'fulfilment': fulfilment})));
  }

  /// Throws [ApiException] so the caller can show the message (e.g. not enough stock).
  Future<void> add(int productId, double qty) async =>
      state = AsyncValue.data(Cart.fromJson(await _api.post<Json>('/api/cart/items', {'productId': productId, 'quantity': qty})));

  Future<void> setQty(int productId, double qty) async =>
      state = AsyncValue.data(Cart.fromJson(await _api.put<Json>('/api/cart/items', {'productId': productId, 'quantity': qty})));

  Future<void> remove(int productId) async => state = AsyncValue.data(Cart.fromJson(await _api.delete<Json>('/api/cart/items/$productId')));
}

final cartProvider = StateNotifierProvider<CartController, AsyncValue<Cart>>((ref) {
  ref.watch(authProvider.select((s) => s.user?.id));
  return CartController(ref);
});

// ---------------------------------------------------------------- Orders, rewards, account

final ordersProvider = FutureProvider.autoDispose<List<OrderSummary>>((ref) async {
  final j = await ref.read(apiProvider).get<Json>('/api/orders', {'pageSize': 50});
  return Paged.fromJson(j, OrderSummary.fromJson).items;
});

final orderProvider = FutureProvider.autoDispose.family<OrderDetail, int>((ref, id) async =>
    OrderDetail.fromJson(await ref.read(apiProvider).get<Json>('/api/orders/$id')));

final rewardsProvider = FutureProvider.autoDispose<RewardSummary>((ref) async =>
    RewardSummary.fromJson(await ref.read(apiProvider).get<Json>('/api/partner/rewards')));

final rewardHistoryProvider = FutureProvider.autoDispose<List<RewardTxn>>((ref) async =>
    Paged.fromJson(await ref.read(apiProvider).get<Json>('/api/partner/rewards/history'), RewardTxn.fromJson).items);

final addressesProvider = FutureProvider.autoDispose<List<Address>>((ref) async {
  final list = await ref.read(apiProvider).get<List<dynamic>>('/api/account/addresses');
  return list.map((e) => Address.fromJson(e as Json)).toList();
});

final notificationsProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) async =>
    Paged.fromJson(await ref.read(apiProvider).get<Json>('/api/account/notifications'), AppNotification.fromJson).items);

final unreadCountProvider = FutureProvider.autoDispose<int>((ref) async =>
    ((await ref.read(apiProvider).get<Json>('/api/account/notifications/unread-count'))['count'] as num).toInt());

final storeInfoProvider = FutureProvider<StoreInfo>((ref) async => StoreInfo.fromJson(await ref.read(apiProvider).get<Json>('/api/catalog/store')));

// ---------------------------------------------------------------- Wishlist (kept on this phone)

class WishlistController extends StateNotifier<List<int>> {
  WishlistController() : super(const []) {
    _load();
  }
  static const _key = 'wishlist';

  Future<void> _load() async {
    final p = await SharedPreferences.getInstance();
    state = (p.getStringList(_key) ?? const []).map(int.tryParse).whereType<int>().toList();
  }

  Future<void> toggle(int productId) async {
    state = state.contains(productId) ? state.where((x) => x != productId).toList() : [productId, ...state];
    final p = await SharedPreferences.getInstance();
    await p.setStringList(_key, state.map((e) => '$e').toList());
  }
}

final wishlistProvider = StateNotifierProvider<WishlistController, List<int>>((ref) => WishlistController());

/// Current prices for the saved products.
final wishlistProductsProvider = FutureProvider.autoDispose<List<ProductCard>>((ref) async {
  final ids = ref.watch(wishlistProvider);
  if (ids.isEmpty) return const [];
  final list = await ref.read(apiProvider).post<List<dynamic>>('/api/catalog/products/batch', ids);
  final cards = list.map((e) => ProductCard.fromJson(e as Json)).toList();
  return [for (final id in ids) ...cards.where((c) => c.id == id)];
});

// ---------------------------------------------------------------- Quotations

final quotationsProvider = FutureProvider.autoDispose<List<QuotationSummary>>((ref) async =>
    Paged.fromJson(await ref.read(apiProvider).get<Json>('/api/quotations', {'pageSize': 50}), QuotationSummary.fromJson).items);

final quotationProvider = FutureProvider.autoDispose.family<Quotation, int>((ref, id) async =>
    Quotation.fromJson(await ref.read(apiProvider).get<Json>('/api/quotations/$id')));

/// Product groups set up in admin (e.g. "Bathroom fittings kit") — a browse filter in the app.
final productGroupsProvider = FutureProvider<List<({int id, String name})>>((ref) async {
  final list = await ref.read(apiProvider).get<List<dynamic>>('/api/catalog/groups');
  return list.map((e) => (id: (e['id'] as num).toInt(), name: e['name'] as String)).toList();
});
