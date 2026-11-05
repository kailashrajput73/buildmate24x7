import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/state/cart_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../catalog/domain/models/catalog_models.dart';
import '../../domain/models/order_models.dart';
import '../widgets/checkout_widgets.dart';

/// Checkout step 4 of 4 — order placed.
///
/// Shown after payment with the checkout routes removed underneath, so both
/// "Continue Shopping" and system back return to where the user shopped.
class OrderConfirmationScreen extends StatelessWidget {
  const OrderConfirmationScreen({super.key, required this.order});

  final PlacedOrder order;

  void _continueShopping(BuildContext context) {
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final cartCount = context.watch<CartController>().totalQuantity;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _continueShopping(context);
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: Column(
          children: [
            CheckoutStepHeader(
              currentStep: 3,
              cartCount: cartCount,
              showBack: false,
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.space4,
                  AppSpacing.space6,
                  AppSpacing.space4,
                  AppSpacing.space6,
                ),
                children: [
                  Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(
                        maxWidth: kCheckoutMaxContentWidth,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _SuccessHero(order: order),
                          const SizedBox(height: AppSpacing.space5),
                          _DeliveryCard(order: order),
                          const SizedBox(height: AppSpacing.space3),
                          _SummaryCard(order: order),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: _ContinueBar(
          onPressed: () => _continueShopping(context),
        ),
      ),
    );
  }
}

// ── Hero ────────────────────────────────────────────────────────────────

class _SuccessHero extends StatelessWidget {
  const _SuccessHero({required this.order});

  final PlacedOrder order;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.6, end: 1),
          duration: const Duration(milliseconds: 500),
          curve: Curves.elasticOut,
          builder: (context, scale, child) =>
              Transform.scale(scale: scale, child: child),
          child: Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.successContainer.withValues(alpha: 0.5),
            ),
            alignment: Alignment.center,
            child: Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.successContainer,
              ),
              child: const Icon(
                Icons.check_rounded,
                size: 34,
                color: AppColors.success,
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.space5),
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space3,
            vertical: AppSpacing.space1,
          ),
          decoration: BoxDecoration(
            color: AppColors.successContainer,
            borderRadius: AppRadius.pillAll,
          ),
          child: Text(
            'ORDER PLACED SUCCESSFULLY',
            style: theme.textTheme.labelSmall?.copyWith(
              color: AppColors.success,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.space3),
        Text(
          'Thank You, ${order.customerFirstName}!',
          textAlign: TextAlign.center,
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.space1),
        Text.rich(
          TextSpan(
            text: 'Order ID: ',
            children: [
              TextSpan(
                text: order.orderId,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurface,
                ),
              ),
            ],
          ),
          style: theme.textTheme.bodyMedium?.copyWith(
            color: AppColors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

// ── Cards ───────────────────────────────────────────────────────────────

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space4,
        vertical: AppSpacing.space2,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final Widget value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.space2),
      child: Row(
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: AppColors.onSurfaceVariant),
          ),
          const SizedBox(width: AppSpacing.space4),
          Expanded(
            child: Align(alignment: Alignment.centerRight, child: value),
          ),
        ],
      ),
    );
  }
}

class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard({required this.order});

  final PlacedOrder order;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final address = order.address;
    final statusColor = order.isPaid ? AppColors.success : AppColors.warning;

    return _InfoCard(
      children: [
        _InfoRow(
          label: 'Estimated Delivery',
          value: Text(
            _titleCase(order.delivery.eta),
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const Divider(height: 1, color: AppColors.divider),
        _InfoRow(
          label: 'Shipping To',
          value: Text(
            '${address.label}, ${address.house}, ${address.city}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodyMedium,
          ),
        ),
        _InfoRow(
          label: 'Payment Status',
          value: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                order.isPaid
                    ? Icons.check_circle_rounded
                    : Icons.schedule_rounded,
                size: 16,
                color: statusColor,
              ),
              const SizedBox(width: AppSpacing.space1),
              Flexible(
                child: Text(
                  order.paymentStatus,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// "3 - 5 business days" → "3 - 5 Business Days".
  static String _titleCase(String text) => text
      .split(' ')
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.order});

  final PlacedOrder order;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final count = order.itemCount;

    return _InfoCard(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.space2),
          child: Text(
            'Order Summary ($count ${count == 1 ? 'item' : 'items'})',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const Divider(height: 1, color: AppColors.divider),
        const SizedBox(height: AppSpacing.space1),
        for (final line in order.lines)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.space1),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    '${line.quantity}x ${line.name}',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.space3),
                Text(formatInr(line.total), style: theme.textTheme.bodyMedium),
              ],
            ),
          ),
        const SizedBox(height: AppSpacing.space1),
        const Divider(height: 1, color: AppColors.divider),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.space3),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  order.isPaid ? 'Total Amount Paid' : 'Amount Payable',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                formatInr(order.total),
                style: theme.textTheme.titleLarge?.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Bottom bar ──────────────────────────────────────────────────────────

class _ContinueBar extends StatelessWidget {
  const _ContinueBar({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.divider)),
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
              padding: const EdgeInsets.all(AppSpacing.space4),
              child: SizedBox(
                width: double.infinity,
                height: AppSpacing.buttonHeight,
                child: FilledButton(
                  onPressed: onPressed,
                  style: FilledButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.mdAll,
                    ),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Continue Shopping'),
                      SizedBox(width: AppSpacing.space2),
                      Icon(Icons.home_rounded, size: 20),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
