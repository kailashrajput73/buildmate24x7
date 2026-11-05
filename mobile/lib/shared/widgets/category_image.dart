import 'package:flutter/material.dart';

import '../../features/catalog/data/mappers/catalog_api_mapper.dart';
import 'app_icons.dart';

/// Local category product image with graceful icon fallback.
/// Supports local assets and remote `http(s)` URLs.
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

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.zero;
    final fallback = ColoredBox(
      color: fallbackBackground,
      child: Center(
        child: Icon(
          appIcon(fallbackIcon),
          color: fallbackIconColor,
          size: iconSize,
        ),
      ),
    );

    if (imageAsset.isNotEmpty) {
      return ClipRRect(
        borderRadius: radius,
        child: SizedBox(
          width: width,
          height: height,
          child: Image.asset(
            imageAsset,
            fit: fit,
            width: width,
            height: height,
            errorBuilder: (context, error, stackTrace) => fallback,
          ),
        ),
      );
    }

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
            errorBuilder: (context, error, stackTrace) => fallback,
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null) return child;
              return fallback;
            },
          ),
        ),
      );
    }

    return ClipRRect(
      borderRadius: radius,
      child: SizedBox(width: width, height: height, child: fallback),
    );
  }

}
