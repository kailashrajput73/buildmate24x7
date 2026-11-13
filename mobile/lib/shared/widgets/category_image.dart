import 'package:flutter/material.dart';

import '../../features/catalog/data/mappers/catalog_api_mapper.dart';

/// Shows only server-provided imagery — never local artwork or another item's
/// image. Absent or unavailable images stay blank, or show a neutral
/// placeholder when [placeholder] is true (categories and types).
class CategoryImage extends StatelessWidget {
  const CategoryImage({
    super.key,
    this.imageAsset = '',
    this.imageUrl,
    required this.fallbackIcon,
    required this.fallbackIconColor,
    required this.fallbackBackground,
    this.width,
    this.height,
    this.borderRadius,
    this.fit = BoxFit.cover,
    this.iconSize,
    this.placeholder = false,
  });

  final String imageAsset;
  final String? imageUrl;
  final String fallbackIcon;
  final Color fallbackIconColor;
  final Color fallbackBackground;
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;
  final BoxFit fit;
  final double? iconSize;

  /// Neutral placeholder (background + image icon) when there is no image.
  final bool placeholder;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.zero;
    final remote = CatalogApiMapper.resolveImageUrl(imageUrl);
    if (remote != null && remote.isNotEmpty) {
      return ClipRRect(
        borderRadius: radius,
        child: SizedBox(
          width: width,
          height: height,
          child: Image.network(
            remote,
            fit: fit,
            width: width,
            height: height,
            errorBuilder: (context, error, stackTrace) =>
                placeholder ? _placeholder() : const SizedBox.shrink(),
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null) return child;
              return const SizedBox.shrink();
            },
          ),
        ),
      );
    }

    return ClipRRect(
      borderRadius: radius,
      child: SizedBox(
        width: width,
        height: height,
        child: placeholder ? _placeholder() : null,
      ),
    );
  }

  Widget _placeholder() {
    return ColoredBox(
      color: fallbackBackground,
      child: Center(
        child: Icon(
          Icons.image_outlined,
          size: iconSize ?? 24,
          color: fallbackIconColor.withValues(alpha: 0.7),
        ),
      ),
    );
  }
}
