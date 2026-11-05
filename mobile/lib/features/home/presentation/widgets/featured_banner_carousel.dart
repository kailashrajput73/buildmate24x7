import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../shared/widgets/app_icons.dart';
import '../../domain/models/home_models.dart';

class FeaturedBannerCarousel extends StatefulWidget {
  const FeaturedBannerCarousel({
    super.key,
    required this.banners,
    this.onCta,
  });

  final List<HomeBanner> banners;
  final void Function(HomeBanner banner)? onCta;

  @override
  State<FeaturedBannerCarousel> createState() => _FeaturedBannerCarouselState();
}

class _FeaturedBannerCarouselState extends State<FeaturedBannerCarousel> {
  late final PageController _controller;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController(viewportFraction: 1);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double _carouselHeight() {
    return widget.banners.any((b) => b.referralStyle) ? 172 : 168;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.banners.isEmpty) return const SizedBox.shrink();

    final showDots = widget.banners.length > 1;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: _carouselHeight(),
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.banners.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (context, i) {
              return _BannerCard(
                banner: widget.banners[i],
                onCta: () => widget.onCta?.call(widget.banners[i]),
              );
            },
          ),
        ),
        if (showDots) ...[
          const SizedBox(height: AppSpacing.space3),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(widget.banners.length, (i) {
              final active = i == _index;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.space1),
                height: AppSpacing.space2,
                width: active ? AppSpacing.space6 : AppSpacing.space2,
                decoration: BoxDecoration(
                  color: active ? AppColors.primary : AppColors.outlineVariant,
                  borderRadius: AppRadius.xsAll,
                ),
              );
            }),
          ),
        ],
      ],
    );
  }
}

class _BannerCard extends StatelessWidget {
  const _BannerCard({required this.banner, this.onCta});

  final HomeBanner banner;
  final VoidCallback? onCta;

  static const _referralBackground = Color(0xFFE8F5B0);
  static const _referralHeadline = Color(0xFF1B4332);
  static const _referralBody = Color(0xFF2D3436);

  @override
  Widget build(BuildContext context) {
    if (banner.referralStyle) {
      return _referralCard(context);
    }
    return _gradientCard(context);
  }

  Widget _referralCard(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: _referralBackground,
        borderRadius: AppRadius.xlAll,
      ),
      clipBehavior: Clip.antiAlias,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.space3,
        AppSpacing.space3,
        AppSpacing.space1,
        AppSpacing.space3,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  banner.headline,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: _referralHeadline,
                    fontWeight: FontWeight.w800,
                    height: 1.12,
                  ),
                ),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  banner.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: _referralBody.withValues(alpha: 0.9),
                    height: 1.3,
                    fontSize: 11.5,
                  ),
                ),
                const SizedBox(height: AppSpacing.space2),
                FilledButton(
                  onPressed: onCta,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF1A1A1A),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 32),
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.space4,
                    ),
                    visualDensity: VisualDensity.compact,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: const StadiumBorder(),
                    textStyle: theme.textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(banner.ctaLabel),
                      const SizedBox(width: 4),
                      const Icon(Icons.arrow_forward_rounded, size: 16),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space1),
          const _ReferralBannerArt(),
        ],
      ),
    );
  }

  Widget _gradientCard(BuildContext context) {
    final theme = Theme.of(context);
    final start = Color(banner.gradientStart);
    final end = Color(banner.gradientEnd);

    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadius.xlAll,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [start, end],
        ),
      ),
      clipBehavior: Clip.antiAlias,
      padding: const EdgeInsets.all(AppSpacing.space4),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (banner.eyebrow.isNotEmpty) ...[
                  Text(
                    banner.eyebrow,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.labelSmallMono(
                      color: AppColors.onPrimary.withValues(alpha: 0.9),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space1),
                ],
                Text(
                  banner.headline,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: AppColors.onPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.space1),
                Expanded(
                  child: Text(
                    banner.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.onPrimary.withValues(alpha: 0.85),
                    ),
                  ),
                ),
                FilledButton(
                  onPressed: onCta,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.surface,
                    foregroundColor: start,
                    minimumSize: const Size(0, AppSpacing.space8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.space4,
                    ),
                    visualDensity: VisualDensity.compact,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: const StadiumBorder(),
                    textStyle: theme.textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  child: Text(banner.ctaLabel),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space3),
          Container(
            width: AppSpacing.space14,
            height: AppSpacing.space14,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.onPrimary.withValues(alpha: 0.12),
            ),
            child: Icon(
              appIcon(banner.icon),
              size: AppSpacing.space8,
              color: AppColors.onPrimary.withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
  }
}

/// Decorative refer-and-earn artwork (reference: people + ₹ coins).
class _ReferralBannerArt extends StatelessWidget {
  const _ReferralBannerArt();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 92,
      height: 118,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: 4,
            top: 18,
            child: _coinBadge(),
          ),
          Positioned(
            right: 36,
            top: 4,
            child: _coinBadge(size: 28),
          ),
          Positioned(
            right: 0,
            bottom: 28,
            child: Icon(
              Icons.autorenew_rounded,
              size: 52,
              color: const Color(0xFF74C947).withValues(alpha: 0.45),
            ),
          ),
          Positioned(
            left: 8,
            bottom: 8,
            child: _personTile(Icons.person_rounded, const Color(0xFF5C6BC0)),
          ),
          Positioned(
            right: 12,
            bottom: 0,
            child: _personTile(Icons.person_outline_rounded, const Color(0xFFE57373)),
          ),
        ],
      ),
    );
  }

  Widget _coinBadge({double size = 34}) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: const Color(0xFFFFD54F),
        border: Border.all(color: const Color(0xFFF9A825), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        '₹',
        style: TextStyle(
          fontSize: size * 0.42,
          fontWeight: FontWeight.w800,
          color: const Color(0xFF5D4037),
        ),
      ),
    );
  }

  Widget _personTile(IconData icon, Color color) {
    return Container(
      width: 44,
      height: 60,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 2),
          Container(
            width: 20,
            height: 26,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Icon(Icons.smartphone_rounded, size: 13, color: Color(0xFF37474F)),
          ),
        ],
      ),
    );
  }
}
