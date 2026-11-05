import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/cart_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/app_icons.dart';

class MaterialCalculatorScreen extends StatelessWidget {
  const MaterialCalculatorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: const Text('Material Calculator'),
      ),
      body: cart.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.space6),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.calculate_rounded,
                      size: 48,
                      color: AppColors.outline,
                    ),
                    const SizedBox(height: AppSpacing.space4),
                    Text(
                      'No materials selected',
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.space2),
                    Text(
                      'Add products to cart, then return here to estimate costs and generate a quotation.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppSpacing.space4),
                    FilledButton(
                      onPressed: () =>
                          Navigator.of(context).pushNamed(AppRoutes.cart),
                      child: const Text('Open Cart'),
                    ),
                  ],
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.space4),
              children: [
                Text(
                  'Selected materials (from cart)',
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.space3),
                ...cart.items.map(
                  (item) => Card(
                    child: ListTile(
                      leading: Icon(
                        appIcon(item.variant.icon),
                        color: AppColors.primary,
                      ),
                      title: Text(item.variant.displayName),
                      subtitle: Text(
                        '${item.quantity} ${item.variant.unit} × ${item.variant.priceLabel}',
                      ),
                      trailing: Text(
                        '₹${item.totalPrice.toStringAsFixed(0)}',
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.space4),
                Row(
                  children: [
                    Text('Estimated Total', style: theme.textTheme.titleSmall),
                    const Spacer(),
                    Text(
                      '₹${cart.estimatedTotal.toStringAsFixed(0)}',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.space2),
                Text(
                  'Construction formulas can be plugged into this layer later.',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: AppSpacing.space6),
                FilledButton(
                  onPressed: () => Navigator.of(context)
                      .pushNamed(AppRoutes.quotationReview),
                  child: const Text('Generate Quotation'),
                ),
              ],
            ),
    );
  }
}
