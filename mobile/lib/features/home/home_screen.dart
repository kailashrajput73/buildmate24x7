import 'delivery_location_bar.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

/// Home in the design kit's layout: brand bar, delivery location, search, "Shop by Category" grid, then the
/// store's banners and product rails from the admin.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(trProvider);
    final feed = ref.watch(homeProvider);
    final auth = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(children: [
        const _HomeAppBar(),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(homeProvider);
              if (auth.user?.userType == 'Partner') ref.invalidate(profileProvider);
              await ref.read(homeProvider.future);
            },
            child: feed.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(homeProvider)),
              data: (f) => ListView(padding: const EdgeInsets.only(bottom: AppSpacing.space6), children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.space4, AppSpacing.space3, AppSpacing.space4, 0),
                  child: Column(children: [
                    const DeliveryLocationBar(),
                    const SizedBox(height: AppSpacing.space3),
                    _SearchBar(hint: t('home.search')),
                  ]),
                ),
                if (auth.user?.userType == 'Partner') const _KycOrPoints(),
                if (f.banners.isNotEmpty) Padding(padding: const EdgeInsets.only(top: AppSpacing.space4), child: _BannerStrip(f.banners)),
                _SectionHeader('Shop by Category', onMore: () => context.go('/shop')),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
                  child: LayoutBuilder(builder: (context, c) {
                    const gap = AppSpacing.space3;
                    final w = (c.maxWidth - gap * 3) / 4;
                    return Wrap(spacing: gap, runSpacing: gap, children: [
                      for (final cat in f.categories)
                        SizedBox(width: w, child: _CategoryTile(cat)),
                    ]);
                  }),
                ),
                for (final s in f.sections)
                  if (s.products.isNotEmpty) ...[
                    _SectionHeader(s.title, onMore: () => context.push('/products?title=${Uri.encodeComponent(s.title)}', extra: switch (s.type) {
                          'ProductGroup' => CatalogQuery(groupId: s.referenceId),
                          'Category' => CatalogQuery(categoryId: s.referenceId),
                          'Brand' => CatalogQuery(brandId: s.referenceId),
                          'NewArrivals' => const CatalogQuery(sort: 'newest'),
                          _ => const CatalogQuery(),
                        })),
                    SizedBox(
                      height: 268,
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
                        scrollDirection: Axis.horizontal,
                        itemCount: s.products.length,
                        separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.space3),
                        itemBuilder: (_, i) => SizedBox(width: 156, child: ProductTile(s.products[i])),
                      ),
                    ),
                  ],
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.space4),
                  child: Text('${f.store.storeName} · ${f.store.openingHours}', textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.outline)),
                ),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

/// White top bar: logo mark and "BuildMate 24x7"; rewards (partners), cart, notifications and profile.
class _HomeAppBar extends ConsumerWidget {
  const _HomeAppBar();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final auth = ref.watch(authProvider);
    final loggedIn = auth.status == AuthStatus.loggedIn;
    final cartCount = loggedIn ? (ref.watch(cartProvider).valueOrNull?.count ?? 0) : 0;
    final unread = loggedIn ? (ref.watch(unreadCountProvider).valueOrNull ?? 0) : 0;
    final name = auth.user?.name ?? '';
    final initials = name.trim().isEmpty ? '' : name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();
    return Material(
      color: AppColors.surface,
      child: SafeArea(
        bottom: false,
        child: SizedBox(
          height: AppSpacing.space14,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
            child: Row(children: [
              Image.asset('assets/images/branding/AppLogo.png', height: AppSpacing.space8),
              const SizedBox(width: AppSpacing.space2),
              Expanded(
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: 'BuildMate', style: theme.textTheme.titleMedium?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700)),
                    TextSpan(text: ' 24x7', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w400)),
                  ]),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              IconButton(
                tooltip: 'Cart',
                onPressed: () => context.push('/cart'),
                icon: Badge(isLabelVisible: cartCount > 0, label: Text('$cartCount'), child: const Icon(Icons.shopping_cart_outlined, color: AppColors.onSurfaceVariant)),
              ),
              IconButton(
                tooltip: 'Notifications',
                onPressed: () => context.push('/notifications'),
                icon: Badge(isLabelVisible: unread > 0, label: Text(unread > 99 ? '99+' : '$unread'), child: const Icon(Icons.notifications_outlined, color: AppColors.onSurfaceVariant)),
              ),
              IconButton(tooltip: 'My Rewards', onPressed: () => context.push('/rewards'), icon: const Icon(Icons.stars_rounded, color: AppColors.onSurfaceVariant)),
              const SizedBox(width: AppSpacing.space1),
              InkWell(
                customBorder: const CircleBorder(),
                onTap: () => loggedIn ? context.go('/account') : context.push('/login'),
                child: CircleAvatar(
                  radius: 17,
                  backgroundColor: AppColors.primaryContainer,
                  child: initials.isEmpty
                      ? const Icon(Icons.person_outline, size: 18, color: AppColors.primary)
                      : Text(initials, style: theme.textTheme.labelLarge?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700)),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.hint});
  final String hint;
  @override
  Widget build(BuildContext context) => Material(
        color: AppColors.surface,
        borderRadius: AppRadius.mdAll,
        elevation: AppElevation.level1,
        shadowColor: AppColors.shadow,
        child: InkWell(
          borderRadius: AppRadius.mdAll,
          onTap: () => context.push('/products', extra: const CatalogQuery()),
          child: Container(
            height: 52,
            padding: const EdgeInsets.only(left: AppSpacing.space4),
            decoration: BoxDecoration(borderRadius: AppRadius.mdAll, border: Border.all(color: AppColors.primarySidebarSelected)),
            child: Row(children: [
              const Icon(Icons.search_rounded, color: AppColors.primary),
              const SizedBox(width: AppSpacing.space3),
              Expanded(child: Text(hint, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.outline))),
              TextButton.icon(
                label: const Text('Scan'),
                onPressed: () => context.push('/scan'),
                icon: const Icon(Icons.qr_code_scanner_rounded, color: AppColors.onSurfaceVariant),
              ),
            ]),
          ),
        ),
      );
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile(this.c);
  final ProductCategory c;
  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: AppRadius.mdAll,
        onTap: () => c.productCount == 0 ? toast(context, 'Coming soon. We are adding these products.') : context.push('/category/${c.id}', extra: c.name),
        child: Column(children: [
          AspectRatio(
            aspectRatio: 1,
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.mdAll, border: Border.all(color: AppColors.divider)),
              child: CategoryAvailabilityArt(c),
            ),
          ),
          const SizedBox(height: AppSpacing.space2),
          Text(c.name, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(color: AppColors.onSurface, fontWeight: FontWeight.w600)),
        ]),
      );
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title, {this.onMore});
  final String title;
  final VoidCallback? onMore;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.space4, AppSpacing.space6, AppSpacing.space2, AppSpacing.space3),
        child: Row(children: [
          Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
          if (onMore != null)
            TextButton(
              onPressed: onMore,
              child: const Row(mainAxisSize: MainAxisSize.min, children: [Text('View All'), Icon(Icons.chevron_right_rounded, size: 18)]),
            ),
        ]),
      );
}

/// Partners: KYC status until approved, then the reward points card.
class _KycOrPoints extends ConsumerWidget {
  const _KycOrPoints();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(trProvider);
    final p = ref.watch(profileProvider).valueOrNull;
    if (p == null) return const SizedBox.shrink();
    final theme = Theme.of(context);
    if (!p.approved) {
      final rejected = p.kycStatus == 'Rejected';
      return Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.space4, AppSpacing.space4, AppSpacing.space4, 0),
        child: Material(
          color: rejected ? AppColors.errorContainer : AppColors.secondaryContainer,
          borderRadius: AppRadius.mdAll,
          child: ListTile(
            shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
            leading: Icon(rejected ? Icons.error_outline : p.kycStatus == 'Pending' ? Icons.hourglass_top : Icons.upload_file,
                color: rejected ? AppColors.error : AppColors.secondary),
            title: Text(rejected ? t('kyc.rejected') : p.kycStatus == 'Pending' ? t('kyc.pending') : t('kyc.title'), style: theme.textTheme.titleSmall),
            subtitle: Text(p.kycStatus == 'Pending' ? t('kyc.pendingBody') : 'Upload Aadhaar or PAN to unlock partner prices and points.'),
            onTap: () => context.push('/kyc'),
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.space4, AppSpacing.space4, AppSpacing.space4, 0),
      child: InkWell(
        onTap: () => context.push('/rewards'),
        borderRadius: AppRadius.lgAll,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.space4),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFF0B1F4D), Color(0xFF1A3F9E), AppColors.primary]),
            borderRadius: AppRadius.lgAll,
          ),
          child: Row(children: [
            const Icon(Icons.workspace_premium_rounded, color: Color(0xFFFBBF24), size: 34),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t('home.points'), style: theme.textTheme.bodySmall?.copyWith(color: Colors.white70)),
                Text('${qty(p.rewardBalance)} pts', style: theme.textTheme.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w700)),
              ]),
            ),
            const Icon(Icons.chevron_right_rounded, color: Colors.white),
          ]),
        ),
      ),
    );
  }
}

class _BannerStrip extends StatefulWidget {
  const _BannerStrip(this.banners);
  final List<PromoBanner> banners;
  @override
  State<_BannerStrip> createState() => _BannerStripState();
}

class _BannerStripState extends State<_BannerStrip> {
  final _pc = PageController(viewportFraction: 0.92);
  int _i = 0;

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  void _open(PromoBanner b) {
    final v = int.tryParse(b.linkValue ?? '');
    switch (b.linkType) {
      case 'Product' when v != null:
        context.push('/product/$v');
      case 'Category' when v != null:
        context.push('/category/$v', extra: b.title);
      case 'Brand' when v != null:
        context.push('/products?title=${Uri.encodeComponent(b.title)}', extra: CatalogQuery(brandId: v));
      case 'ProductGroup' when v != null:
        context.push('/products?title=${Uri.encodeComponent(b.title)}', extra: CatalogQuery(groupId: v));
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) => Column(children: [
        SizedBox(
          height: 160,
          child: PageView.builder(
            controller: _pc,
            itemCount: widget.banners.length,
            onPageChanged: (i) => setState(() => _i = i),
            itemBuilder: (_, i) {
              final b = widget.banners[i];
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: GestureDetector(
                  onTap: () => _open(b),
                  child: ClipRRect(
                    borderRadius: AppRadius.lgAll,
                    child: Stack(fit: StackFit.expand, children: [
                      // Brand gradient underneath: shows while the picture loads, or if it can't be loaded.
                      const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF0B3E86), Color(0xFF1A63C7)]))),
                      _BannerImage(b.mobileImageUrl ?? b.imageUrl),
                      // Darker on the left so the white title stays readable on any picture.
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [Color(0xB3000000), Color(0x33000000), Color(0x00000000)], stops: [0, 0.55, 1]),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(AppSpacing.space4),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                          SizedBox(width: 220, child: Text(b.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 19, height: 1.15))),
                          if (b.subtitle != null)
                            Padding(padding: const EdgeInsets.only(top: 6), child: SizedBox(width: 220, child: Text(b.subtitle!, maxLines: 2, style: const TextStyle(color: Colors.white70, fontSize: 12)))),
                        ]),
                      ),
                    ]),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: AppSpacing.space2),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          for (var i = 0; i < widget.banners.length; i++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: i == _i ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(color: i == _i ? AppColors.primary : AppColors.divider, borderRadius: BorderRadius.circular(3)),
            ),
        ]),
      ]);
}


/// Banner picture without the grey placeholder box, so the gradient behind it shows until the picture arrives.
class _BannerImage extends StatelessWidget {
  const _BannerImage(this.url);
  final String? url;

  @override
  Widget build(BuildContext context) {
    final u = AppConfig.imageUrl(url);
    if (u.isEmpty) return const SizedBox.shrink();
    if (u.toLowerCase().endsWith('.svg')) {
      return SvgPicture.network(u, fit: BoxFit.cover, alignment: Alignment.centerRight, placeholderBuilder: (_) => const SizedBox.shrink());
    }
    return CachedNetworkImage(
      imageUrl: u,
      fit: BoxFit.cover,
      placeholder: (_, __) => const SizedBox.shrink(),
      errorWidget: (_, __, ___) => const SizedBox.shrink(),
    );
  }
}
