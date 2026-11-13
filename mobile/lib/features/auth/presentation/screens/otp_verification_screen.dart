import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../services/auth_service.dart';
import '../../services/auth_service.dart' as auth_contract;
import '../widgets/auth_otp_fields.dart';
import '../widgets/login_flow_widgets.dart';

/// Step 2 — OTP verification (login flow + password reset).
class OtpVerificationScreen extends StatefulWidget {
  const OtpVerificationScreen({
    super.key,
    required this.args,
    this.authService,
  });

  final OtpVerificationArgs args;
  final auth_contract.AuthService? authService;

  @override
  State<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen> {
  final _otpKey = GlobalKey<AuthOtpFieldsState>();
  late final auth_contract.AuthService _auth;
  late String _contact;

  String _otp = '';
  int _seconds = AppConstants.otpResendSeconds;
  Timer? _timer;
  bool _loading = false;
  String? _error;

  bool get _isPasswordReset => widget.args.purpose == OtpPurpose.passwordReset;

  String get _rawMobile =>
      widget.args.mobileNumber ??
      _contact.replaceAll(RegExp(r'\D'), '').replaceFirst(RegExp(r'^91'), '');

  @override
  void initState() {
    super.initState();
    _auth = widget.authService ?? PhoneAuthService.instance;
    _contact = widget.args.contactDisplay;
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _seconds = AppConstants.otpResendSeconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_seconds <= 1) {
        timer.cancel();
        setState(() => _seconds = 0);
      } else {
        setState(() => _seconds--);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _verify([String? code]) async {
    final otp = code ?? _otp;
    if (otp.length != AppConstants.otpLength) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    final result = await _auth.verifyOtp(mobileNumber: _rawMobile, otp: otp);
    if (!mounted) return;
    setState(() => _loading = false);

    if (!result.success) {
      setState(() => _error = result.message ?? 'Invalid OTP');
      _otpKey.currentState?.clear();
      return;
    }

    switch (widget.args.purpose) {
      case OtpPurpose.passwordReset:
        Navigator.of(context).pushReplacementNamed(
          AppRoutes.resetPassword,
          arguments: ResetPasswordArgs(
            identifier: widget.args.resetIdentifier ?? _contact,
            isEmail: widget.args.resetIsEmail,
          ),
        );
        return;
      case OtpPurpose.mobileLogin:
        if (result.user?.id == PhoneAuthService.pendingUserId) {
          Navigator.of(context).pushReplacementNamed(
            AppRoutes.createAccount,
            arguments: SignupFlowArgs(mobileNumber: _rawMobile, fullName: ''),
          );
          return;
        }
        await context.read<SessionController>().setFromAuth(result.user!);
        if (!mounted) return;
        Navigator.of(
          context,
        ).pushNamedAndRemoveUntil(AppRoutes.homePlaceholder, (_) => false);
        return;
      case OtpPurpose.registration:
        if (result.user?.id != PhoneAuthService.pendingUserId &&
            result.user != null) {
          await context.read<SessionController>().setFromAuth(result.user!);
          if (!mounted) return;
          Navigator.of(
            context,
          ).pushNamedAndRemoveUntil(AppRoutes.homePlaceholder, (_) => false);
          return;
        }
        final mobile =
            widget.args.mobileNumber ??
            _contact
                .replaceAll(RegExp(r'\D'), '')
                .replaceFirst(RegExp(r'^91'), '');
        Navigator.of(context).pushReplacementNamed(
          AppRoutes.createAccount,
          arguments: SignupFlowArgs(mobileNumber: mobile, fullName: ''),
        );
        return;
    }
  }

  Future<void> _resend() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await _auth.sendOtp(mobileNumber: _rawMobile);
    if (!mounted) return;
    setState(() => _loading = false);
    if (!result.success) {
      setState(() => _error = result.message ?? 'Could not resend OTP.');
      return;
    }
    _otpKey.currentState?.clear();
    _startTimer();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('A new verification code has been sent.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = _isPasswordReset ? 'Verify Code' : 'Verify your number';
    final canSubmit = _otp.length == AppConstants.otpLength;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.space6,
            AppSpacing.space4,
            AppSpacing.space6,
            AppSpacing.space6,
          ),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  LoginFlowBackButton(
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  Expanded(
                    child: Text(
                      title,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 44),
                ],
              ),
              const SizedBox(height: AppSpacing.space10),
              const Center(child: LoginFlowOtpIcon()),
              const SizedBox(height: AppSpacing.space8),
              Text(
                'We\'ve sent a 6-digit code to',
                textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: AppSpacing.space1),
              Text(
                _contact,
                textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.space8),
              AuthOtpFields(
                key: _otpKey,
                hasError: _error != null,
                onChanged: (value) => setState(() {
                  _otp = value;
                  _error = null;
                }),
                onCompleted: _verify,
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.space2),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.error,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.space3),
              Text(
                'Tap the boxes to enter or paste your code',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: AppSpacing.space8),
              LoginFlowContinueButton(
                label: 'Enter 6-digit code',
                enabled: canSubmit,
                loading: _loading,
                onPressed: () => _verify(),
              ),
              const SizedBox(height: AppSpacing.space8),
              Center(
                child: _seconds > 0
                    ? Text.rich(
                        TextSpan(
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: AppColors.onSurfaceVariant,
                          ),
                          children: [
                            const TextSpan(text: 'Didn\'t receive the code? '),
                            TextSpan(
                              text:
                                  'Resend OTP in 0:${_seconds.toString().padLeft(2, '0')}',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: AppColors.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                        textAlign: TextAlign.center,
                      )
                    : Text.rich(
                        TextSpan(
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: AppColors.onSurfaceVariant,
                          ),
                          children: [
                            const TextSpan(text: 'Didn\'t receive the code? '),
                            TextSpan(
                              text: 'Resend OTP',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: LoginFlowColors.link,
                                decoration: TextDecoration.underline,
                                fontWeight: FontWeight.w600,
                              ),
                              recognizer: TapGestureRecognizer()
                                ..onTap = _resend,
                            ),
                          ],
                        ),
                        textAlign: TextAlign.center,
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
