import 'package:flutter/material.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/state/cart_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/app_icons.dart';
import '../../../catalog/domain/models/catalog_models.dart';
import '../../domain/models/address_models.dart';

/// Max width of checkout content on wide (web / tablet) layouts.
const double kCheckoutMaxContentWidth = 720;

// ── Header + stepper ────────────────────────────────────────────────────

/// Brand header with "Step N of 4" pill, cart badge and progress stepper.
class CheckoutStepHeader extends StatelessWidget {
  const CheckoutStepHeader({
    super.key,
    required this.currentStep,
    required this.cartCount,
    this.showBack = true,
  });

  /// Zero-based index into [steps].
  final int currentStep;
  final int cartCount;

  /// False once the order is placed and there is nothing to go back to.
  final bool showBack;

  static const steps = ['Cart', 'Address', 'Payment', 'Confirm'];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: AppColors.surface,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            SizedBox(
              height: AppSpacing.space14,
              child: Padding(
                padding: const EdgeInsets.only(
                  left: AppSpacing.space1,
                  right: AppSpacing.space2,
                ),
                child: Row(
                  children: [
                    if (showBack)
                      IconButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        tooltip: 'Back',
                        icon: const Icon(Icons.arrow_back_rounded),
                      )
                    else
                      const SizedBox(width: AppSpacing.space3),
                    SizedBox(
                      width: AppSpacing.space6,
                      height: AppSpacing.space6,
                      child: Image.asset(
                        AppConstants.appLogoAsset,
                        fit: BoxFit.contain,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.space2),
                    Expanded(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: AppConstants.appNameLead,
                              style: theme.textTheme.titleMedium?.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            TextSpan(
                              text: AppConstants.appNameTail,
                              style: theme.textTheme.titleMedium?.copyWith(
                                color: AppColors.onSurface,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.space2),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.space3,
                        vertical: AppSpacing.space1,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primaryContainer,
                        borderRadius: AppRadius.pillAll,
                      ),
                      child: Text(
                        'Step ${currentStep + 1} of ${steps.length}',
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: null,
                      tooltip: 'Cart',
                      icon: Badge(
                        isLabelVisible: cartCount > 0,
                        backgroundColor: AppColors.secondary,
                        label: Text(
                          cartCount > 99 ? '99+' : '$cartCount',
                          style: const TextStyle(
                            fontSize: 10,
                            color: AppColors.onSecondary,
                          ),
                        ),
                        child: Icon(
                          appIcon('shopping_cart'),
                          color: AppColors.onSurface,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.space4,
                0,
                AppSpacing.space4,
                AppSpacing.space3,
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      for (var i = 0; i < steps.length; i++)
                        Expanded(
                          child: Text(
                            '${i + 1}. ${steps[i]}',
                            textAlign: switch (i) {
                              0 => TextAlign.left,
                              3 => TextAlign.right,
                              _ => TextAlign.center,
                            },
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: i <= currentStep
                                  ? AppColors.primary
                                  : AppColors.outline,
                              fontWeight: i == currentStep
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.space2),
                  TweenAnimationBuilder<double>(
                    tween: Tween(
                      begin: currentStep / steps.length,
                      end: (currentStep + 1) / steps.length,
                    ),
                    duration: const Duration(milliseconds: 600),
                    curve: Curves.easeOutCubic,
                    builder: (context, value, _) => LinearProgressIndicator(
                      value: value,
                      minHeight: 6,
                      borderRadius: AppRadius.pillAll,
                      color: AppColors.primary,
                      backgroundColor: AppColors.surfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.divider),
          ],
        ),
      ),
    );
  }
}

// ── Sections ────────────────────────────────────────────────────────────

class CheckoutSectionTitle extends StatelessWidget {
  const CheckoutSectionTitle({
    super.key,
    required this.icon,
    required this.title,
    this.action,
  });

  final IconData icon;
  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        left: AppSpacing.space1,
        bottom: AppSpacing.space2,
      ),
      child: SizedBox(
        height: 40,
        child: Row(
          children: [
            Icon(icon, size: 18, color: AppColors.primary),
            const SizedBox(width: AppSpacing.space2),
            Expanded(
              child: Text(
                title.toUpperCase(),
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: AppColors.onSurfaceVariant,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                ),
              ),
            ),
            ?action,
          ],
        ),
      ),
    );
  }
}

/// Card with a leading radio dot and a highlighted border when selected.
///
/// [expanded] is shown under the main row only while selected.
class CheckoutSelectableCard extends StatelessWidget {
  const CheckoutSelectableCard({
    super.key,
    required this.selected,
    required this.onTap,
    required this.child,
    this.expanded,
    this.crossAxisAlignment = CrossAxisAlignment.start,
  });

  final bool selected;
  final VoidCallback onTap;
  final Widget child;
  final Widget? expanded;
  final CrossAxisAlignment crossAxisAlignment;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      inMutuallyExclusiveGroup: true,
      button: true,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primaryContainer.withValues(alpha: 0.35)
              : AppColors.surface,
          borderRadius: AppRadius.lgAll,
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.divider,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Material(
          type: MaterialType.transparency,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              InkWell(
                borderRadius: AppRadius.lgAll,
                onTap: onTap,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.space4),
                  child: Row(
                    crossAxisAlignment: crossAxisAlignment,
                    children: [
                      CheckoutRadioDot(selected: selected),
                      const SizedBox(width: AppSpacing.space3),
                      Expanded(child: child),
                    ],
                  ),
                ),
              ),
              if (expanded != null)
                AnimatedSize(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOutCubic,
                  alignment: Alignment.topCenter,
                  child: selected
                      ? Padding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.space4,
                            0,
                            AppSpacing.space4,
                            AppSpacing.space4,
                          ),
                          child: expanded,
                        )
                      : const SizedBox(width: double.infinity),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class CheckoutRadioDot extends StatelessWidget {
  const CheckoutRadioDot({super.key, required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: 20,
      height: 20,
      margin: const EdgeInsets.only(top: 1),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: selected ? AppColors.primary : AppColors.outline,
          width: 2,
        ),
      ),
      alignment: Alignment.center,
      child: AnimatedScale(
        duration: const Duration(milliseconds: 180),
        scale: selected ? 1 : 0,
        child: Container(
          width: 10,
          height: 10,
          decoration: const BoxDecoration(
            color: AppColors.primary,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}

// ── Price breakdown ─────────────────────────────────────────────────────

void showCheckoutPriceBreakdown(
  BuildContext context, {
  required CartController cart,
  required DeliveryOption delivery,
}) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) => _PriceBreakdownSheet(cart: cart, delivery: delivery),
  );
}

class _PriceBreakdownSheet extends StatelessWidget {
  const _PriceBreakdownSheet({required this.cart, required this.delivery});

  final CartController cart;
  final DeliveryOption delivery;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    Widget row(String label, String value, {bool bold = false, Color? color}) {
      final style =
          (bold
                  ? theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    )
                  : theme.textTheme.bodyMedium)
              ?.copyWith(color: color);
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.space1),
        child: Row(
          children: [
            Expanded(child: Text(label, style: style)),
            Text(value, style: style),
          ],
        ),
      );
    }

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.space5,
          0,
          AppSpacing.space5,
          AppSpacing.space5,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Price Details',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.space3),
            row('Subtotal', formatInr(cart.subtotal)),
            if (cart.discount > 0)
              row(
                'Discount',
                '- ${formatInr(cart.discount)}',
                color: AppColors.success,
              ),
            row(
              'Shipping',
              cart.shipping == 0 ? 'FREE' : formatInr(cart.shipping),
            ),
            row('GST (18%)', formatInr(cart.gst)),
            row(
              delivery.label,
              delivery.fee == 0 ? 'FREE' : formatInr(delivery.fee),
            ),
            const Divider(height: AppSpacing.space6, color: AppColors.divider),
            row(
              'Total Amount',
              formatInr(cart.grandTotal + delivery.fee),
              bold: true,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Bottom bar ──────────────────────────────────────────────────────────

/// Sticky footer: tappable "Total Amount" row + primary action button.
class CheckoutTotalBar extends StatelessWidget {
  const CheckoutTotalBar({
    super.key,
    required this.total,
    required this.label,
    required this.icon,
    required this.onShowSummary,
    required this.onPressed,
    this.loading = false,
  });

  final double total;
  final String label;
  final IconData icon;
  final VoidCallback onShowSummary;
  final VoidCallback onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: kCheckoutMaxContentWidth,
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.space4,
                AppSpacing.space2,
                AppSpacing.space4,
                AppSpacing.space3,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  InkWell(
                    onTap: onShowSummary,
                    borderRadius: AppRadius.smAll,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.space1,
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.receipt_long_rounded,
                            size: 18,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: AppSpacing.space2),
                          Text(
                            'Total Amount: ',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: AppColors.onSurfaceVariant,
                            ),
                          ),
                          Expanded(
                            child: Text(
                              formatInr(total),
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          const Icon(
                            Icons.keyboard_arrow_up_rounded,
                            color: AppColors.outline,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space2),
                  SizedBox(
                    width: double.infinity,
                    height: AppSpacing.buttonHeight,
                    child: FilledButton(
                      onPressed: loading ? null : onPressed,
                      style: FilledButton.styleFrom(
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadius.mdAll,
                        ),
                      ),
                      child: loading
                          ? const SizedBox.square(
                              dimension: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: AppColors.primary,
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Flexible(
                                  child: Text(
                                    label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.space2),
                                Icon(icon, size: 20),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
