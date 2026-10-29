import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../core/app_constants.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';

/// Brand-blue accent used across the 4-step login flow.
abstract final class LoginFlowColors {
  static const Color accent = Color(0xFF2F5FE0);
  static const Color accentDeep = Color(0xFF1A3FB0);
  static const Color accentMuted = Color(0xFFDCE6FF);
  static const Color link = Color(0xFF2F5FE0);
  static const Color fieldBorder = Color(0xFFD1D5DB);
  static const Color disabledButton = Color(0xFFE5E7EB);
  static const Color disabledText = Color(0xFF9CA3AF);

  static const List<Color> accentGradient = [Color(0xFF4C7BFF), accent];
  static const List<Color> backdropGradient = [
    Color(0xFFEEF3FF),
    Color(0xFFFFFFFF),
  ];
}

class LoginFlowContinueButton extends StatelessWidget {
  const LoginFlowContinueButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.enabled = true,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool enabled;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final active = enabled && !loading;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: double.infinity,
      height: 52,
      decoration: BoxDecoration(
        borderRadius: AppRadius.mdAll,
        gradient: active
            ? const LinearGradient(
                colors: LoginFlowColors.accentGradient,
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              )
            : null,
        color: active ? null : LoginFlowColors.disabledButton,
        boxShadow: active
            ? [
                BoxShadow(
                  color: LoginFlowColors.accent.withValues(alpha: 0.35),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                ),
              ]
            : null,
      ),
      child: ElevatedButton(
        onPressed: active ? onPressed : null,
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          foregroundColor: active ? Colors.white : LoginFlowColors.disabledText,
          disabledBackgroundColor: Colors.transparent,
          disabledForegroundColor: LoginFlowColors.disabledText,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
          textStyle: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(label),
      ),
    );
  }
}

class LoginFlowTermsFooter extends StatelessWidget {
  const LoginFlowTermsFooter({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text.rich(
      TextSpan(
        style: theme.textTheme.bodySmall?.copyWith(
          color: AppColors.onSurfaceVariant,
          height: 1.4,
        ),
        children: [
          const TextSpan(text: 'By continuing, you agree to our '),
          TextSpan(
            text: 'Terms of Services & Privacy Policy',
            style: theme.textTheme.bodySmall?.copyWith(
              color: LoginFlowColors.link,
              decoration: TextDecoration.underline,
              fontWeight: FontWeight.w500,
            ),
            recognizer: TapGestureRecognizer()..onTap = () {},
          ),
        ],
      ),
      textAlign: TextAlign.center,
    );
  }
}

/// Segmented Login / Sign Up switch.
///
/// Uses a single sliding pill behind the labels (rather than two
/// independently-animated buttons) so toggling never shows both options
/// highlighted at once mid-transition.
class LoginFlowModeToggle extends StatelessWidget {
  const LoginFlowModeToggle({
    super.key,
    required this.isLogin,
    required this.onChanged,
  });

  final bool isLogin;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainer,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: LoginFlowColors.fieldBorder),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final segmentWidth = constraints.maxWidth / 2;
          return Stack(
            children: [
              AnimatedAlign(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                alignment: isLogin ? Alignment.centerLeft : Alignment.centerRight,
                child: Container(
                  width: segmentWidth,
                  height: double.infinity,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: LoginFlowColors.accentGradient,
                    ),
                    borderRadius: AppRadius.mdAll,
                    boxShadow: [
                      BoxShadow(
                        color: LoginFlowColors.accent.withValues(alpha: 0.3),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: _ModeToggleOption(
                      label: 'Login',
                      selected: isLogin,
                      onTap: () => onChanged(true),
                    ),
                  ),
                  Expanded(
                    child: _ModeToggleOption(
                      label: 'Sign Up',
                      selected: !isLogin,
                      onTap: () => onChanged(false),
                    ),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ModeToggleOption extends StatelessWidget {
  const _ModeToggleOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        splashFactory: NoSplash.splashFactory,
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        child: Align(
          alignment: Alignment.center,
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            style: (theme.textTheme.titleSmall ?? const TextStyle()).copyWith(
              fontWeight: FontWeight.w700,
              color: selected ? Colors.white : AppColors.onSurfaceVariant,
            ),
            child: Text(label),
          ),
        ),
      ),
    );
  }
}

class LoginFlowPhoneField extends StatefulWidget {
  const LoginFlowPhoneField({
    super.key,
    required this.controller,
    this.onChanged,
  });

  final TextEditingController controller;
  final ValueChanged<String>? onChanged;

  @override
  State<LoginFlowPhoneField> createState() => _LoginFlowPhoneFieldState();
}

class _LoginFlowPhoneFieldState extends State<LoginFlowPhoneField> {
  final _focusNode = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      setState(() => _focused = _focusNode.hasFocus);
    });
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      height: AppSpacing.inputHeight,
      decoration: BoxDecoration(
        borderRadius: AppRadius.mdAll,
        border: Border.all(
          color: _focused ? LoginFlowColors.accent : LoginFlowColors.fieldBorder,
          width: _focused ? 2 : 1.5,
        ),
        color: AppColors.surface,
        boxShadow: _focused
            ? [
                BoxShadow(
                  color: LoginFlowColors.accent.withValues(alpha: 0.18),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
      child: Row(
        children: [
          Text(
            '+91',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          Container(
            width: 1,
            height: 28,
            margin: const EdgeInsets.symmetric(horizontal: AppSpacing.space3),
            color: LoginFlowColors.fieldBorder,
          ),
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focusNode,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              onChanged: widget.onChanged,
              decoration: const InputDecoration(
                counterText: '',
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                errorBorder: InputBorder.none,
                focusedErrorBorder: InputBorder.none,
                filled: false,
                fillColor: Colors.transparent,
                isDense: true,
                contentPadding: EdgeInsets.zero,
                hintText: '',
              ),
              style: theme.textTheme.titleMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class LoginFlowOutlinedField extends StatelessWidget {
  const LoginFlowOutlinedField({
    super.key,
    required this.label,
    required this.controller,
    this.validator,
    this.hintText = 'Enter your full name',
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.prefixIcon,
    this.textInputAction = TextInputAction.done,
  });

  final String label;
  final TextEditingController controller;
  final String? Function(String?)? validator;
  final String hintText;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final IconData? prefixIcon;
  final TextInputAction textInputAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.space2),
        Container(
          decoration: BoxDecoration(
            borderRadius: AppRadius.mdAll,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: TextFormField(
            controller: controller,
            validator: validator,
            keyboardType: keyboardType,
            textCapitalization: textCapitalization,
            textInputAction: textInputAction,
            decoration: InputDecoration(
              hintText: hintText,
              hintStyle: theme.textTheme.bodyLarge?.copyWith(
                color: LoginFlowColors.disabledText,
              ),
              prefixIcon: prefixIcon != null
                  ? Icon(prefixIcon, color: AppColors.onSurfaceVariant, size: 20)
                  : null,
              filled: true,
              fillColor: AppColors.surface,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.space4,
                vertical: AppSpacing.space3,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: const BorderSide(
                  color: LoginFlowColors.fieldBorder,
                  width: 1.5,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: const BorderSide(
                  color: LoginFlowColors.accent,
                  width: 2,
                ),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: const BorderSide(color: AppColors.error),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Rounded accent icon badge used to soften headers across the auth flow.
class LoginFlowIconBadge extends StatelessWidget {
  const LoginFlowIconBadge({
    super.key,
    this.icon,
    this.imageAsset,
    this.size = 64,
  }) : assert(icon != null || imageAsset != null);

  final IconData? icon;
  final String? imageAsset;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [
            LoginFlowColors.accentMuted,
            LoginFlowColors.accentMuted.withValues(alpha: 0.4),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: LoginFlowColors.accent.withValues(alpha: 0.28),
            blurRadius: 28,
            spreadRadius: 2,
            offset: const Offset(0, 10),
          ),
          const BoxShadow(
            color: Colors.black12,
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Center(
        child: imageAsset != null
            ? Container(
                width: size * 0.78,
                height: size * 0.78,
                padding: EdgeInsets.all(size * 0.12),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Image.asset(imageAsset!, fit: BoxFit.contain),
              )
            : Container(
                width: size * 0.66,
                height: size * 0.66,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: LoginFlowColors.accentGradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Icon(icon, color: Colors.white, size: size * 0.34),
              ),
      ),
    );
  }
}

/// Line-art OTP illustration for the verification screen.
class LoginFlowOtpIcon extends StatelessWidget {
  const LoginFlowOtpIcon({super.key, this.size = 100});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _LoginFlowOtpIconPainter(color: LoginFlowColors.link),
      ),
    );
  }
}

class _LoginFlowOtpIconPainter extends CustomPainter {
  const _LoginFlowOtpIconPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final fill = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final w = size.width;
    final h = size.height;
    final cx = w / 2;

    // Message bubble outline.
    final bubble = RRect.fromRectAndRadius(
      Rect.fromLTWH(w * 0.12, h * 0.1, w * 0.76, h * 0.52),
      Radius.circular(w * 0.08),
    );
    canvas.drawRRect(bubble, stroke);

    // Bubble tail.
    final tail = Path()
      ..moveTo(cx - w * 0.06, h * 0.62)
      ..lineTo(cx, h * 0.78)
      ..lineTo(cx + w * 0.06, h * 0.62);
    canvas.drawPath(tail, stroke);

    // Three text lines inside the bubble.
    for (var i = 0; i < 3; i++) {
      final y = h * (0.24 + i * 0.12);
      final lineW = w * (0.42 - i * 0.06);
      canvas.drawLine(
        Offset(cx - lineW / 2, y),
        Offset(cx + lineW / 2, y),
        stroke,
      );
    }

    // Six OTP digit boxes.
    final boxSize = w * 0.09;
    final gap = w * 0.025;
    final rowW = boxSize * 6 + gap * 5;
    final startX = cx - rowW / 2;
    final boxY = h * 0.84;

    for (var i = 0; i < 6; i++) {
      final x = startX + i * (boxSize + gap);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(x, boxY, boxSize, boxSize),
          Radius.circular(boxSize * 0.22),
        ),
        stroke,
      );
      canvas.drawCircle(
        Offset(x + boxSize / 2, boxY + boxSize / 2),
        boxSize * 0.12,
        fill,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _LoginFlowOtpIconPainter oldDelegate) =>
      oldDelegate.color != color;
}

class LoginFlowBackButton extends StatelessWidget {
  const LoginFlowBackButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: InkWell(
        onTap: onPressed,
        borderRadius: AppRadius.mdAll,
        child: Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: LoginFlowColors.fieldBorder),
          ),
          child: const Icon(Icons.arrow_back_rounded, size: 16),
        ),
      ),
    );
  }
}

String get loginAppDisplayName => AppConstants.appName;
