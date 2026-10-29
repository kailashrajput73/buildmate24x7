import 'package:flutter/material.dart';

import 'theme.dart';

// The app used "Liquid Glass" surfaces before it moved to the design kit's flat look. These helpers keep their
// names so screens didn't need rewriting, but now draw plain white cards with a hairline border.

/// Page background. Kept so main.dart's builder still works; it's just the kit's background colour.
class GlassBackdrop extends StatelessWidget {
  const GlassBackdrop({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => ColoredBox(color: AppColors.background, child: child);
}

/// White card: 16px corners, hairline border, faint shadow.
BoxDecoration glassDecoration({double radius = AppRadius.lg, double opacity = 1, bool shadow = true}) => BoxDecoration(
      borderRadius: BorderRadius.circular(radius > AppRadius.xl ? AppRadius.lg : radius),
      color: AppColors.surface,
      border: Border.all(color: AppColors.divider),
      boxShadow: shadow ? const [BoxShadow(color: Color(0x0D000000), blurRadius: 3, offset: Offset(0, 1))] : null,
    );

/// A raised white (or navy, when [dark]) surface.
class Glass extends StatelessWidget {
  const Glass({super.key, required this.child, this.radius = AppRadius.lg, this.opacity = 1, this.padding, this.dark = false});
  final Widget child;
  final double radius, opacity;
  final EdgeInsetsGeometry? padding;
  final bool dark;

  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        clipBehavior: Clip.antiAlias,
        decoration: dark
            ? BoxDecoration(color: BM.pipeDark, borderRadius: BorderRadius.circular(radius > AppRadius.xl ? AppRadius.lg : radius))
            : glassDecoration(radius: radius),
        child: child,
      );
}
