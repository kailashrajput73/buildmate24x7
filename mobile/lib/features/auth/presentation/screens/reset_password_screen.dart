import 'package:flutter/material.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../services/auth_service.dart';
import '../../services/mock_auth_service.dart';
import '../widgets/auth_primary_button.dart';
import '../widgets/auth_text_field.dart';
import '../widgets/auth_validators.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({
    super.key,
    required this.args,
    this.authService,
  });

  final ResetPasswordArgs args;
  final AuthService? authService;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  late final AuthService _auth;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _auth = widget.authService ?? MockAuthService();
  }

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    final result = await _auth.resetPassword(
      identifier: widget.args.identifier,
      newPassword: _passwordController.text,
    );
    if (!mounted) return;
    setState(() => _loading = false);

    if (!result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.message ?? 'Could not update password'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoutes.passwordUpdated,
      (_) => false,
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
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  icon: const Icon(Icons.arrow_back_rounded, size: 18),
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
                    Icons.password_rounded,
                    size: AppSpacing.space8,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: AppSpacing.space6),
                Text('Reset Password', style: theme.textTheme.headlineMedium),
                const SizedBox(height: AppSpacing.space2),
                Text(
                  'Create a new password for your BuildMate 24x7 account.',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.space8),
                AuthTextField(
                  label: 'New Password',
                  controller: _passwordController,
                  obscureText: true,
                  showVisibilityToggle: true,
                  prefixIcon: Icons.lock_rounded,
                  validator: AuthValidators.password,
                ),
                const SizedBox(height: AppSpacing.space4),
                AuthTextField(
                  label: 'Confirm New Password',
                  controller: _confirmController,
                  obscureText: true,
                  showVisibilityToggle: true,
                  prefixIcon: Icons.lock_rounded,
                  validator: (v) => AuthValidators.confirmPassword(
                    v,
                    _passwordController.text,
                  ),
                ),
                const SizedBox(height: AppSpacing.space8),
                AuthPrimaryButton(
                  label: 'Update Password',
                  icon: Icons.check_circle_rounded,
                  loading: _loading,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
