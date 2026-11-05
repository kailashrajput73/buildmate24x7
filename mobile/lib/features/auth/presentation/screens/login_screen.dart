import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../services/auth_service.dart' as phone_auth;
import '../../services/auth_service.dart';
import '../widgets/auth_validators.dart';
import '../widgets/login_flow_widgets.dart';

/// Step 1 — phone number entry.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.authService});

  final AuthService? authService;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _mobileController = TextEditingController();
  late final AuthService _auth;
  bool _loading = false;
  bool _isLogin = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _auth = widget.authService ?? phone_auth.PhoneAuthService.instance;
  }

  @override
  void dispose() {
    _mobileController.dispose();
    super.dispose();
  }

  bool get _canContinue =>
      AuthValidators.mobile(_mobileController.text) == null;

  Future<void> _continue() async {
    final mobile = _mobileController.text.trim();
    if (AuthValidators.mobile(mobile) != null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    final result = await _auth.sendOtp(mobileNumber: mobile);
    if (!mounted) return;
    setState(() => _loading = false);

    if (!result.success) {
      setState(() {
        _error = result.message ?? 'Could not send OTP. Please try again.';
      });
      return;
    }

    final user = result.user;
    if (user != null && user.id != 'pending' && user.id.isNotEmpty) {
      await context.read<SessionController>().setFromAuth(user);
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil(
        AppRoutes.homePlaceholder,
        (_) => false,
      );
      return;
    }

    Navigator.of(context).pushNamed(
      AppRoutes.otpVerification,
      arguments: OtpVerificationArgs(
        contactDisplay: AuthValidators.formatMobileDisplay(mobile),
        purpose: _isLogin ? OtpPurpose.mobileLogin : OtpPurpose.registration,
        mobileNumber: mobile,
      ),
    );
  }

  Future<void> _skipLogin() async {
    final result = await _auth.continueAsGuest();
    if (!mounted) return;
    if (result.success && result.user != null) {
      await context.read<SessionController>().setFromAuth(result.user!);
      if (!mounted) return;
      Navigator.of(
        context,
      ).pushNamedAndRemoveUntil(AppRoutes.homePlaceholder, (_) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: LoginFlowColors.backdropGradient,
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.space6,
              AppSpacing.space4,
              AppSpacing.space6,
              AppSpacing.space6,
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight,
                    ),
                    child: IntrinsicHeight(
                      child: Column(
                        children: [
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: _skipLogin,
                              style: TextButton.styleFrom(
                                foregroundColor: AppColors.onSurfaceVariant,
                                backgroundColor: AppColors.surface,
                                shape: RoundedRectangleBorder(
                                  borderRadius: AppRadius.pillAll,
                                  side: const BorderSide(
                                    color: LoginFlowColors.fieldBorder,
                                  ),
                                ),
                                minimumSize: const Size(0, 34),
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.space4,
                                  vertical: AppSpacing.space1,
                                ),
                                textStyle: theme.textTheme.labelLarge?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              child: const Text('Skip login'),
                            ),
                          ),
                          const Spacer(flex: 2),
                          const Center(
                            child: LoginFlowIconBadge(
                              imageAsset: AppConstants.appLogoAsset,
                              size: 104,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.space5),
                          Text(
                            loginAppDisplayName,
                            textAlign: TextAlign.center,
                            style: theme.textTheme.headlineLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.space2),
                          Text(
                            _isLogin
                                ? 'Welcome back! Login to continue'
                                : 'Create an account to get started',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: AppColors.onSurfaceVariant,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.space8),
                          LoginFlowModeToggle(
                            isLogin: _isLogin,
                            onChanged: (value) =>
                                setState(() => _isLogin = value),
                          ),
                          const SizedBox(height: AppSpacing.space6),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'Mobile Number',
                              style: theme.textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.space2),
                          LoginFlowPhoneField(
                            controller: _mobileController,
                            onChanged: (_) => setState(() {}),
                          ),
                          const SizedBox(height: AppSpacing.space2),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'We\'ll send a 6-digit OTP to verify this number',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: AppColors.onSurfaceVariant,
                              ),
                            ),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: AppSpacing.space2),
                            Text(
                              _error!,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: AppColors.error,
                              ),
                            ),
                          ],
                          const SizedBox(height: AppSpacing.space6),
                          LoginFlowContinueButton(
                            label: 'Send OTP',
                            enabled: _canContinue,
                            loading: _loading,
                            onPressed: _continue,
                          ),
                          const Spacer(flex: 3),
                          const LoginFlowTermsFooter(),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
