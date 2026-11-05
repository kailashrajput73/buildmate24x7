import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';

class GoogleSignInButton extends StatelessWidget {
  const GoogleSignInButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: AppSpacing.buttonHeight,
      child: OutlinedButton(
        onPressed: loading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.onSurface,
          side: const BorderSide(color: AppColors.outlineVariant, width: 1.5),
          elevation: AppElevation.level0,
          shadowColor: AppColors.shadow,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
        child: loading
            ? const SizedBox(
                width: AppSpacing.space5,
                height: AppSpacing.space5,
                child: CircularProgressIndicator(strokeWidth: 2.4),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const _GoogleLogo(size: AppSpacing.space5),
                  const SizedBox(width: AppSpacing.space3),
                  Text(
                    label,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: AppColors.onSurface,
                        ),
                  ),
                ],
              ),
      ),
    );
  }
}

class SocialAuthButton extends StatelessWidget {
  const SocialAuthButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
    this.iconColor,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: AppSpacing.buttonHeight,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.onSurface,
          side: const BorderSide(color: AppColors.outlineVariant, width: 1.5),
          elevation: AppElevation.level0,
          shadowColor: AppColors.shadow,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: AppSpacing.space5,
              color: iconColor ?? AppColors.primary,
            ),
            const SizedBox(width: AppSpacing.space3),
            Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.onSurface,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GoogleLogo extends StatelessWidget {
  const _GoogleLogo({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _GoogleLogoPainter()),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    final pathBlue = Path()
      ..moveTo(size.width * 0.94, size.height * 0.51)
      ..lineTo(size.width * 0.5, size.height * 0.51)
      ..lineTo(size.width * 0.5, size.height * 0.69)
      ..lineTo(size.width * 0.75, size.height * 0.69)
      ..cubicTo(
        size.width * 0.73,
        size.height * 0.78,
        size.width * 0.68,
        size.height * 0.85,
        size.width * 0.59,
        size.height * 0.9,
      )
      ..lineTo(size.width * 0.74, size.height)
      ..cubicTo(
        size.width * 0.91,
        size.height * 0.88,
        size.width,
        size.height * 0.71,
        size.width,
        size.height * 0.51,
      )
      ..close();
    paint.color = const Color(0xFF4285F4);
    canvas.drawPath(pathBlue, paint);

    final pathGreen = Path()
      ..moveTo(size.width * 0.5, size.height)
      ..cubicTo(
        size.width * 0.62,
        size.height,
        size.width * 0.73,
        size.height * 0.96,
        size.width * 0.8,
        size.height * 0.89,
      )
      ..lineTo(size.width * 0.65, size.height * 0.77)
      ..cubicTo(
        size.width * 0.61,
        size.height * 0.8,
        size.width * 0.56,
        size.height * 0.82,
        size.width * 0.5,
        size.height * 0.82,
      )
      ..cubicTo(
        size.width * 0.38,
        size.height * 0.82,
        size.width * 0.28,
        size.height * 0.74,
        size.width * 0.24,
        size.height * 0.63,
      )
      ..lineTo(size.width * 0.09, size.height * 0.75)
      ..cubicTo(
        size.width * 0.17,
        size.height * 0.9,
        size.width * 0.32,
        size.height,
        size.width * 0.5,
        size.height,
      )
      ..close();
    paint.color = const Color(0xFF34A853);
    canvas.drawPath(pathGreen, paint);

    final pathYellow = Path()
      ..moveTo(size.width * 0.24, size.height * 0.37)
      ..cubicTo(
        size.width * 0.23,
        size.height * 0.4,
        size.width * 0.22,
        size.height * 0.45,
        size.width * 0.22,
        size.height * 0.5,
      )
      ..cubicTo(
        size.width * 0.22,
        size.height * 0.55,
        size.width * 0.23,
        size.height * 0.6,
        size.width * 0.24,
        size.height * 0.63,
      )
      ..lineTo(size.width * 0.09, size.height * 0.75)
      ..cubicTo(
        size.width * 0.06,
        size.height * 0.68,
        size.width * 0.04,
        size.height * 0.59,
        size.width * 0.04,
        size.height * 0.5,
      )
      ..cubicTo(
        size.width * 0.04,
        size.height * 0.41,
        size.width * 0.06,
        size.height * 0.32,
        size.width * 0.09,
        size.height * 0.25,
      )
      ..close();
    paint.color = const Color(0xFFFBBC05);
    canvas.drawPath(pathYellow, paint);

    final pathRed = Path()
      ..moveTo(size.width * 0.5, size.height * 0.18)
      ..cubicTo(
        size.width * 0.57,
        size.height * 0.18,
        size.width * 0.63,
        size.height * 0.2,
        size.width * 0.68,
        size.height * 0.25,
      )
      ..lineTo(size.width * 0.81, size.height * 0.12)
      ..cubicTo(
        size.width * 0.73,
        size.height * 0.04,
        size.width * 0.62,
        0,
        size.width * 0.5,
        0,
      )
      ..cubicTo(
        size.width * 0.32,
        0,
        size.width * 0.17,
        size.height * 0.1,
        size.width * 0.09,
        size.height * 0.25,
      )
      ..lineTo(size.width * 0.24, size.height * 0.37)
      ..cubicTo(
        size.width * 0.28,
        size.height * 0.26,
        size.width * 0.38,
        size.height * 0.18,
        size.width * 0.5,
        size.height * 0.18,
      )
      ..close();
    paint.color = const Color(0xFFEA4335);
    canvas.drawPath(pathRed, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
