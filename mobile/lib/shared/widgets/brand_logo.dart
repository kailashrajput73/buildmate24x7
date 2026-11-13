import 'package:flutter/material.dart';

import '../../core/config.dart';

/// Shows a server-provided brand logo or remains blank.
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
    if (logoAsset.isEmpty) return SizedBox(width: size, height: size);
    final imageUrl = AppConfig.imageUrl(logoAsset);
    if (Uri.tryParse(imageUrl)?.path.startsWith('/files/mock/') ?? false) {
      return SizedBox(width: size, height: size);
    }

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
        child: Image.network(
          imageUrl,
          fit: BoxFit.contain,
          // Medium (mipmapped) sampling emits a texture() LOD-bias shader
          // that fails to compile under CanvasKit on some web GPUs; decode
          // at display size instead so bilinear sampling stays crisp.
          filterQuality: FilterQuality.low,
          cacheWidth: (size * 0.76 * MediaQuery.devicePixelRatioOf(context))
              .round(),
          errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
        ),
      ),
    );
  }
}
