import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Local brand logo with initials fallback.
class BrandLogo extends StatelessWidget {
  const BrandLogo({
    super.key,
    required this.logoAsset,
    required this.abbreviation,
    required this.color,
    this.size = 40,
  });

  final String logoAsset;
  final String abbreviation;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final fallback = CircleAvatar(
      radius: size / 2,
      backgroundColor: color.withValues(alpha: 0.12),
      child: Text(
        abbreviation,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: size * 0.28,
        ),
      ),
    );

    if (logoAsset.isEmpty) return fallback;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.divider),
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: EdgeInsets.all(size * 0.12),
        child: Image.asset(
          logoAsset,
          fit: BoxFit.contain,
          // Medium (mipmapped) sampling emits a texture() LOD-bias shader
          // that fails to compile under CanvasKit on some web GPUs; decode
          // at display size instead so bilinear sampling stays crisp.
          filterQuality: FilterQuality.low,
          cacheWidth:
              (size * 0.76 * MediaQuery.devicePixelRatioOf(context)).round(),
          errorBuilder: (context, error, stackTrace) => fallback,
        ),
      ),
    );
  }
}
