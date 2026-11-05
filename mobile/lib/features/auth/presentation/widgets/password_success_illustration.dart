import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

class PasswordSuccessIllustration extends StatelessWidget {
  const PasswordSuccessIllustration({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 200,
      height: 180,
      child: CustomPaint(painter: _SuccessPainter()),
    );
  }
}

class _SuccessPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 200;
    final sy = size.height / 180;
    canvas.scale(sx, sy);

    canvas.drawCircle(
      const Offset(100, 90),
      76,
      Paint()..color = AppColors.tertiary.withValues(alpha: 0.06),
    );
    canvas.drawCircle(
      const Offset(100, 90),
      62,
      Paint()..color = AppColors.tertiary.withValues(alpha: 0.09),
    );
    canvas.drawCircle(
      const Offset(100, 90),
      50,
      Paint()..color = AppColors.tertiaryContainer,
    );

    final shieldOuter = Path()
      ..moveTo(100, 50)
      ..lineTo(128, 62)
      ..lineTo(128, 88)
      ..cubicTo(128, 108, 100, 124, 100, 124)
      ..cubicTo(100, 124, 72, 108, 72, 88)
      ..lineTo(72, 62)
      ..close();
    canvas.drawPath(
      shieldOuter,
      Paint()..color = AppColors.tertiary.withValues(alpha: 0.8),
    );

    final shieldInner = Path()
      ..moveTo(100, 56)
      ..lineTo(122, 66)
      ..lineTo(122, 88)
      ..cubicTo(122, 105, 100, 119, 100, 119)
      ..cubicTo(100, 119, 78, 105, 78, 88)
      ..lineTo(78, 66)
      ..close();
    canvas.drawPath(shieldInner, Paint()..color = AppColors.tertiary);

    final check = Path()
      ..moveTo(86, 90)
      ..lineTo(96, 100)
      ..lineTo(116, 78);
    canvas.drawPath(
      check,
      Paint()
        ..color = AppColors.onTertiary
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    canvas.drawCircle(
      const Offset(100, 46),
      12,
      Paint()..color = AppColors.tertiaryContainer,
    );
    canvas.drawCircle(
      const Offset(100, 46),
      12,
      Paint()
        ..color = AppColors.tertiary
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    final sparkles = [
      (38.0, 40.0, 4.0),
      (162.0, 45.0, 3.0),
      (30.0, 120.0, 3.0),
      (168.0, 115.0, 4.0),
      (55.0, 30.0, 2.5),
      (148.0, 30.0, 2.5),
    ];
    for (final s in sparkles) {
      canvas.drawCircle(
        Offset(s.$1, s.$2),
        s.$3,
        Paint()..color = AppColors.tertiary.withValues(alpha: 0.4),
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
