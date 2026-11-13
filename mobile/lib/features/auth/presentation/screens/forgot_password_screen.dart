import 'package:flutter/material.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../services/auth_service.dart';
import '../../services/auth_service.dart';
import '../widgets/auth_primary_button.dart';
import '../widgets/auth_text_field.dart';
import '../widgets/auth_validators.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, this.authService});

  final AuthService? authService;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _mobileController = TextEditingController();
  late final AuthService _auth;

  bool _isEmail = true;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _auth = widget.authService ?? PhoneAuthService.instance;
  }

  @override
  void dispose() {
    _emailController.dispose();
    _mobileController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);
    final identifier = _isEmail
        ? _emailController.text.trim()
        : _mobileController.text.trim();
    final result = await _auth.sendPasswordResetCode(
      identifier: identifier,
      isEmail: _isEmail,
    );
    if (!mounted) return;
    setState(() => _loading = false);

    if (!result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.message ?? 'Failed to send reset code'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    Navigator.of(context).pushNamed(
      AppRoutes.otpVerification,
      arguments: OtpVerificationArgs(
        contactDisplay: _isEmail
            ? identifier
            : AuthValidators.formatMobileDisplay(identifier),
        purpose: OtpPurpose.passwordReset,
        resetIdentifier: identifier,
        resetIsEmail: _isEmail,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.space6,
            AppSpacing.space6,
            AppSpacing.space6,
            AppSpacing.space10,
          ),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextButton.icon(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.arrow_back_rounded),
                  label: Text(
                    'Back to Login',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: AppColors.onSurface,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.onSurface,
                    padding: EdgeInsets.zero,
                  ),
                ),
                const SizedBox(height: AppSpacing.space8),
                Container(
                  width: AppSpacing.space16,
                  height: AppSpacing.space16,
                  decoration: BoxDecoration(
                    color: AppColors.primaryContainer,
                    borderRadius: AppRadius.xlAll,
                  ),
                  child: const Icon(
                    Icons.lock_reset_rounded,
                    size: AppSpacing.space8,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: AppSpacing.space6),
                Text('Forgot Password?', style: theme.textTheme.headlineMedium),
                const SizedBox(height: AppSpacing.space2),
                Text(
                  "Enter your registered email address or mobile number. We'll send you a verification code.",
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.space8),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.space1),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainer,
                    borderRadius: AppRadius.mdAll,
                  ),
                  child: Row(
                    children: [
                      _TabChip(
                        label: 'Email Address',
                        selected: _isEmail,
                        onTap: () => setState(() => _isEmail = true),
                      ),
                      _TabChip(
                        label: 'Mobile Number',
                        selected: !_isEmail,
                        onTap: () => setState(() => _isEmail = false),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.space5),
                if (_isEmail)
                  AuthTextField(
                    label: 'Registered Email Address',
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    prefixIcon: Icons.email_rounded,
                    validator: AuthValidators.email,
                  )
                else
                  AuthTextField(
                    label: 'Registered Mobile Number',
                    controller: _mobileController,
                    keyboardType: TextInputType.phone,
                    prefixIcon: Icons.phone_rounded,
                    validator: AuthValidators.mobile,
                  ),
                const SizedBox(height: AppSpacing.space6),
                AuthPrimaryButton(
                  label: 'Send Reset Code',
                  icon: Icons.send_rounded,
                  loading: _loading,
                  onPressed: _submit,
                ),
                const SizedBox(height: AppSpacing.space5),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space4,
                    vertical: AppSpacing.space3,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.infoContainer,
                    borderRadius: AppRadius.mdAll,
                    border: Border.all(
                      color: AppColors.info.withValues(alpha: 0.12),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.info_rounded,
                        size: AppSpacing.space5,
                        color: AppColors.info,
                      ),
                      const SizedBox(width: AppSpacing.space3),
                      Expanded(
                        child: Text(
                          'Check your inbox or messages folder. The code expires in 10 minutes.',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  const _TabChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Material(
        color: selected ? AppColors.surface : Colors.transparent,
        borderRadius: AppRadius.mdAll,
        elevation: selected ? AppElevation.level1 : AppElevation.level0,
        shadowColor: AppColors.shadow,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.mdAll,
          child: SizedBox(
            height: AppSpacing.space10,
            child: Center(
              child: Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                  color: selected
                      ? AppColors.primary
                      : AppColors.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
