import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/app_constants.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';

class AuthOtpFields extends StatefulWidget {
  const AuthOtpFields({
    super.key,
    required this.onCompleted,
    required this.onChanged,
    this.hasError = false,
  });

  final ValueChanged<String> onCompleted;
  final ValueChanged<String> onChanged;
  final bool hasError;

  @override
  State<AuthOtpFields> createState() => AuthOtpFieldsState();
}

class AuthOtpFieldsState extends State<AuthOtpFields> {
  final List<TextEditingController> _controllers =
      List.generate(AppConstants.otpLength, (_) => TextEditingController());
  final List<FocusNode> _nodes =
      List.generate(AppConstants.otpLength, (_) => FocusNode());

  String get code => _controllers.map((c) => c.text).join();

  void clear() {
    for (final c in _controllers) {
      c.clear();
    }
    _nodes.first.requestFocus();
    widget.onChanged('');
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final n in _nodes) {
      n.dispose();
    }
    super.dispose();
  }

  void _handleChange(int index, String value) {
    if (value.length > 1) {
      final digits = value.replaceAll(RegExp(r'\D'), '');
      for (var i = 0; i < AppConstants.otpLength; i++) {
        _controllers[i].text = i < digits.length ? digits[i] : '';
      }
      final focusIndex = digits.length.clamp(0, AppConstants.otpLength - 1);
      _nodes[focusIndex].requestFocus();
    } else if (value.isNotEmpty) {
      if (index < AppConstants.otpLength - 1) {
        _nodes[index + 1].requestFocus();
      } else {
        _nodes[index].unfocus();
      }
    }

    final current = code;
    widget.onChanged(current);
    if (current.length == AppConstants.otpLength) {
      widget.onCompleted(current);
    }
    setState(() {});
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event, int index) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        _controllers[index].text.isEmpty &&
        index > 0) {
      _controllers[index - 1].clear();
      _nodes[index - 1].requestFocus();
      widget.onChanged(code);
      setState(() {});
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(AppConstants.otpLength, (index) {
        final filled = _controllers[index].text.isNotEmpty;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(
              right: index == AppConstants.otpLength - 1
                  ? 0
                  : AppSpacing.space3,
            ),
            child: Focus(
              onKeyEvent: (node, event) => _onKey(node, event, index),
              child: TextField(
                controller: _controllers[index],
                focusNode: _nodes[index],
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                maxLength: AppConstants.otpLength,
                autofillHints: index == 0 ? const [AutofillHints.oneTimeCode] : null,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.onSurface,
                    ),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                  counterText: '',
                  filled: true,
                  fillColor: filled
                      ? AppColors.primaryContainer
                      : AppColors.surfaceContainer,
                  contentPadding: EdgeInsets.zero,
                  enabledBorder: OutlineInputBorder(
                    borderRadius: AppRadius.mdAll,
                    borderSide: BorderSide(
                      color: widget.hasError
                          ? AppColors.error
                          : filled
                              ? AppColors.primary
                              : AppColors.outlineVariant,
                      width: 2,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: AppRadius.mdAll,
                    borderSide: BorderSide(
                      color:
                          widget.hasError ? AppColors.error : AppColors.primary,
                      width: 2,
                    ),
                  ),
                ),
                onChanged: (value) => _handleChange(index, value),
              ),
            ),
          ),
        );
      }),
    );
  }
}
