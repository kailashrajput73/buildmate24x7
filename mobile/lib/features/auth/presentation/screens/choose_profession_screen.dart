import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../services/auth_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/models/auth_models.dart';
import '../widgets/login_flow_widgets.dart';

/// Step 4 — profession selection before entering the app.
class ChooseProfessionScreen extends StatefulWidget {
  const ChooseProfessionScreen({super.key, required this.args});

  final SignupFlowArgs args;

  @override
  State<ChooseProfessionScreen> createState() => _ChooseProfessionScreenState();
}

class _ProfessionOption {
  const _ProfessionOption({
    required this.title,
    required this.subtitle,
    required this.role,
  });

  final String title;
  final String subtitle;
  final UserRole role;
}

class _ChooseProfessionScreenState extends State<ChooseProfessionScreen> {
  static const _options = [
    _ProfessionOption(
      title: 'Contractor',
      subtitle: 'Building & construction',
      role: UserRole.contractor,
    ),
    _ProfessionOption(
      title: 'Plumber',
      subtitle: 'Pipes, bathrooms & Fittings',
      role: UserRole.dealer,
    ),
    _ProfessionOption(
      title: 'Electrician',
      subtitle: 'Wiring, switches & lighting',
      role: UserRole.builder,
    ),
    _ProfessionOption(
      title: 'Flooring',
      subtitle: 'Tiles & Adhesives',
      role: UserRole.dealer,
    ),
    _ProfessionOption(
      title: 'Home Owner',
      subtitle: 'Buying for my own house',
      role: UserRole.individualCustomer,
    ),
  ];

  int? _selectedIndex;
  bool _saving = false;

  Future<void> _continue() async {
    if (_selectedIndex == null || _saving) return;
    final option = _options[_selectedIndex!];

    setState(() => _saving = true);
    try {
      final result = await PhoneAuthService.instance.completeSignup(
        mobileNumber: widget.args.mobileNumber,
        fullName: widget.args.fullName,
        email: widget.args.email,
        audience: option.role == UserRole.individualCustomer
            ? 'Customer'
            : 'Partner',
        partnerType: switch (option.title) {
          'Plumber' => 'Plumber',
          'Electrician' => 'Electrician',
          'Flooring' => 'Flooring',
          'Builder' => 'Builder',
          _ => 'Contractor',
        },
        referralCode: widget.args.referralCode,
      );
      if (!result.success || result.user == null) {
        throw Exception(result.message ?? 'Could not create your account.');
      }
      if (!mounted) return;
      await context.read<SessionController>().setFromAuth(result.user!);

      if (!mounted) return;
      await Navigator.of(
        context,
        rootNavigator: true,
      ).pushNamedAndRemoveUntil(AppRoutes.homePlaceholder, (_) => false);
    } catch (e, st) {
      debugPrint('ChooseProfession continue failed: $e\n$st');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.space6,
            AppSpacing.space6,
            AppSpacing.space6,
            AppSpacing.space4,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LoginFlowBackButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  const SizedBox(width: AppSpacing.space4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Choose your profession',
                          style: theme.textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.space2),
                        Text(
                          'Pick what best describes you so we can personalize your experience.',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.space6),
              Expanded(
                child: ListView.separated(
                  itemCount: _options.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.space3),
                  itemBuilder: (context, index) {
                    final option = _options[index];
                    final selected = _selectedIndex == index;
                    return InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => setState(() => _selectedIndex = index),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.space4,
                          vertical: AppSpacing.space3,
                        ),
                        decoration: BoxDecoration(
                          color: selected
                              ? LoginFlowColors.accentMuted
                              : AppColors.surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: selected
                                ? LoginFlowColors.accent
                                : LoginFlowColors.fieldBorder,
                            width: selected ? 1.5 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: LoginFlowColors.fieldBorder,
                                ),
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.space4),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    option.title,
                                    style: theme.textTheme.titleMedium
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: AppSpacing.space1),
                                  Text(
                                    option.subtitle,
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      color: AppColors.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: AppSpacing.space2),
                            _SelectionIndicator(selected: selected),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: AppSpacing.space4),
              LoginFlowContinueButton(
                label: 'Continue',
                enabled: _selectedIndex != null && !_saving,
                loading: _saving,
                onPressed: _continue,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectionIndicator extends StatelessWidget {
  const _SelectionIndicator({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? LoginFlowColors.accent : Colors.transparent,
        border: Border.all(
          color: selected
              ? LoginFlowColors.accent
              : LoginFlowColors.fieldBorder,
          width: 1.5,
        ),
      ),
      child: selected
          ? const Icon(Icons.check, size: 16, color: Colors.white)
          : null,
    );
  }
}
