import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/cart_controller.dart';
import '../../../../core/state/quotation_controller.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/app_icons.dart';
import '../../domain/models/catalog_models.dart';

/// Checkout step 1 of 4 — review cart items, apply a coupon, see totals.
class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  static const double _maxContentWidth = 720;

  final _summaryKey = GlobalKey();
  var _summaryHighlighted = false;
  Timer? _highlightTimer;

  @override
  void dispose() {
    _highlightTimer?.cancel();
    super.dispose();
  }

  Future<void> _scrollToSummary() async {
    final target = _summaryKey.currentContext;
    if (target == null) return;
    await Scrollable.ensureVisible(
      target,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
      alignment: 0.1,
    );
    if (!mounted) return;
    setState(() => _summaryHighlighted = true);
    _highlightTimer?.cancel();
    _highlightTimer = Timer(const Duration(milliseconds: 1500), () {
      if (mounted) setState(() => _summaryHighlighted = false);
    });
  }

  void _showSnack(String message, {SnackBarAction? action}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          action: action,
        ),
      );
  }

  void _removeItem(CartController cart, CartItem item) {
    final index = cart.items.indexOf(item);
    cart.remove(item.variantId);
    _showSnack(
      '${item.variant.productName} removed',
      action: SnackBarAction(
        label: 'Undo',
        onPressed: () => cart.restore(item, index),
      ),
    );
  }

  Future<void> _confirmClearAll(CartController cart) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear cart?'),
        content: const Text('All items will be removed from your cart.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Clear All'),
          ),
        ],
      ),
    );
    if (confirmed == true) cart.clear();
  }

  void _goToAddress() =>
      Navigator.of(context).pushNamed(AppRoutes.selectAddress);

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _CheckoutHeader(
            cartCount: cart.totalQuantity,
            showStepper: !cart.isEmpty,
          ),
          Expanded(
            child: cart.isEmpty
                ? const _EmptyCart()
                : ListView(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.space4,
                      AppSpacing.space5,
                      AppSpacing.space4,
                      AppSpacing.space6,
                    ),
                    children: [
                      _constrained(
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _ReviewItemsHeader(
                              count: cart.items.length,
                              onClearAll: () => _confirmClearAll(cart),
                            ),
                            const SizedBox(height: AppSpacing.space3),
                            for (final item in cart.items) ...[
                              _CartItemCard(
                                key: ValueKey(item.variantId),
                                item: item,
                                onIncrease: () => cart.increase(item.variantId),
                                onDecrease: () => cart.decrease(item.variantId),
                                onRemove: () => _removeItem(cart, item),
                              ),
                              const SizedBox(height: AppSpacing.space3),
                            ],
                            const SizedBox(height: AppSpacing.space1),
                            _PromoCouponBox(onMessage: _showSnack),
                            const SizedBox(height: AppSpacing.space4),
                            _PriceSummaryCard(
                              key: _summaryKey,
                              cart: cart,
                              highlighted: _summaryHighlighted,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
      bottomNavigationBar: cart.isEmpty
          ? null
          : _CheckoutBottomBar(
              total: cart.grandTotal,
              enabled: true,
              maxWidth: _maxContentWidth,
              onShowSummary: _scrollToSummary,
              onProceed: _goToAddress,
            ),
    );
  }

  Widget _constrained(Widget child) => Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: _maxContentWidth),
      child: child,
    ),
  );
}

// ── Header + stepper ────────────────────────────────────────────────────

class _CheckoutHeader extends StatelessWidget {
  const _CheckoutHeader({required this.cartCount, required this.showStepper});

  final int cartCount;
  final bool showStepper;

  static const _steps = ['Cart', 'Address', 'Payment', 'Confirm'];
  static const _currentStep = 0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canPop = Navigator.of(context).canPop();

    return Material(
      color: AppColors.surface,
      elevation: 0,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            SizedBox(
              height: AppSpacing.space14,
              child: Padding(
                padding: EdgeInsets.only(
                  left: canPop ? AppSpacing.space1 : AppSpacing.space4,
                  right: AppSpacing.space2,
                ),
                child: Row(
                  children: [
                    if (canPop)
                      IconButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        tooltip: 'Back',
                        icon: const Icon(Icons.arrow_back_rounded),
                      ),
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
                    if (showStepper) ...[
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
                          'Step ${_currentStep + 1} of ${_steps.length}',
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
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
            if (showStepper)
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
                        for (var i = 0; i < _steps.length; i++)
                          Expanded(
                            child: Text(
                              '${i + 1}. ${_steps[i]}',
                              textAlign: switch (i) {
                                0 => TextAlign.left,
                                3 => TextAlign.right,
                                _ => TextAlign.center,
                              },
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: i <= _currentStep
                                    ? AppColors.primary
                                    : AppColors.outline,
                                fontWeight: i == _currentStep
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
                        begin: 0,
                        end: (_currentStep + 1) / _steps.length,
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

// ── Items ───────────────────────────────────────────────────────────────

class _ReviewItemsHeader extends StatelessWidget {
  const _ReviewItemsHeader({required this.count, required this.onClearAll});

  final int count;
  final VoidCallback onClearAll;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Expanded(
          child: Text(
            'Review Items ($count)',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        TextButton(
          onPressed: onClearAll,
          style: TextButton.styleFrom(
            foregroundColor: AppColors.primary,
            visualDensity: VisualDensity.compact,
          ),
          child: const Text('Clear All'),
        ),
      ],
    );
  }
}

class _CartItemCard extends StatelessWidget {
  const _CartItemCard({
    super.key,
    required this.item,
    required this.onIncrease,
    required this.onDecrease,
    required this.onRemove,
  });

  final CartItem item;
  final VoidCallback onIncrease;
  final VoidCallback onDecrease;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final variant = item.variant;

    return Container(
      decoration: _cardDecoration,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.space3,
        AppSpacing.space3,
        AppSpacing.space1,
        AppSpacing.space3,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ItemTile(variant: variant),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.space1),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              variant.displayName,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              variant.priceWithUnit,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: AppColors.outline,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: onRemove,
                      tooltip: 'Remove',
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(
                        Icons.delete_outline_rounded,
                        size: 20,
                        color: AppColors.outline,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.space2),
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.space2),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          formatInr(item.totalPrice),
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _QuantityStepper(
                        quantity: item.quantity,
                        onIncrease: item.quantity < CartController.maxQuantity
                            ? onIncrease
                            : null,
                        onDecrease: item.quantity > 1 ? onDecrease : null,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Colored square with the category icon and a short category label.
class _ItemTile extends StatelessWidget {
  const _ItemTile({required this.variant});

  final ProductVariant variant;

  static const double _size = 68;
  static const _palette = [
    AppColors.primary,
    AppColors.secondary,
    AppColors.tertiary,
    AppColors.info,
    AppColors.onSurfaceVariant,
  ];

  @override
  Widget build(BuildContext context) {
    final key = variant.categoryId.isEmpty ? variant.id : variant.categoryId;
    final hash = key.codeUnits.fold<int>(0, (sum, c) => sum + c);
    final color = _palette[hash % _palette.length];
    final label = variant.categoryName.split(RegExp(r'[\s&/,]+')).first;

    return Container(
      width: _size,
      height: _size,
      decoration: BoxDecoration(
        borderRadius: AppRadius.mdAll,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color, Color.lerp(color, Colors.black, 0.18)!],
        ),
      ),
      padding: const EdgeInsets.all(AppSpacing.space1),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(appIcon(variant.icon), color: Colors.white, size: 24),
          if (label.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.onIncrease,
    required this.onDecrease,
  });

  final int quantity;
  final VoidCallback? onIncrease;
  final VoidCallback? onDecrease;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      height: 34,
      decoration: BoxDecoration(
        color: AppColors.surfaceContainer,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepperButton(
            icon: Icons.remove_rounded,
            tooltip: 'Decrease quantity',
            onPressed: onDecrease,
          ),
          SizedBox(
            width: 30,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              transitionBuilder: (child, animation) =>
                  ScaleTransition(scale: animation, child: child),
              child: Text(
                '$quantity',
                key: ValueKey(quantity),
                textAlign: TextAlign.center,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          _StepperButton(
            icon: Icons.add_rounded,
            tooltip: 'Increase quantity',
            onPressed: onIncrease,
          ),
        ],
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkResponse(
        onTap: onPressed,
        radius: 18,
        child: SizedBox(
          width: 32,
          height: 32,
          child: Icon(
            icon,
            size: 18,
            color: onPressed == null ? AppColors.disabled : AppColors.primary,
          ),
        ),
      ),
    );
  }
}

// ── Coupon ──────────────────────────────────────────────────────────────

class _PromoCouponBox extends StatefulWidget {
  const _PromoCouponBox({required this.onMessage});

  final void Function(String message) onMessage;

  @override
  State<_PromoCouponBox> createState() => _PromoCouponBoxState();
}

class _PromoCouponBoxState extends State<_PromoCouponBox> {
  final _controller = TextEditingController();
  var _expanded = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _apply(CartController cart) {
    final code = _controller.text;
    if (code.trim().isEmpty) {
      setState(() => _error = 'Enter a coupon code');
      return;
    }
    final coupon = cart.applyCoupon(code);
    if (coupon == null) {
      setState(() => _error = 'Invalid coupon code');
      return;
    }
    FocusScope.of(context).unfocus();
    _controller.clear();
    setState(() {
      _error = null;
      _expanded = false;
    });
    widget.onMessage(coupon.successMessage);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cart = context.watch<CartController>();
    final applied = cart.coupon;

    if (applied != null) {
      final saving = applied == CartCoupon.build10
          ? 'You save ${formatInr(cart.discount)}'
          : 'Shipping is on us';
      return Container(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.space4,
          AppSpacing.space2,
          AppSpacing.space1,
          AppSpacing.space2,
        ),
        decoration: BoxDecoration(
          color: AppColors.successContainer,
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: AppColors.success.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: AppColors.success),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${applied.code} applied',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    saving,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.success,
                    ),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: cart.removeCoupon,
              style: TextButton.styleFrom(foregroundColor: AppColors.error),
              child: const Text('Remove'),
            ),
          ],
        ),
      );
    }

    return AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.space4,
          AppSpacing.space2,
          AppSpacing.space2,
          AppSpacing.space2,
        ),
        decoration: BoxDecoration(
          color: AppColors.warningContainer.withValues(alpha: 0.6),
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: AppColors.secondary.withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.local_offer_rounded,
                  size: 20,
                  color: AppColors.secondary,
                ),
                const SizedBox(width: AppSpacing.space3),
                Expanded(
                  child: Text(
                    'Have a promo coupon?',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() {
                    _expanded = !_expanded;
                    _error = null;
                  }),
                  child: Text(_expanded ? 'Cancel' : 'Apply'),
                ),
              ],
            ),
            if (_expanded) ...[
              const SizedBox(height: AppSpacing.space1),
              Padding(
                padding: const EdgeInsets.only(right: AppSpacing.space2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        autofocus: true,
                        textCapitalization: TextCapitalization.characters,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _apply(cart),
                        onChanged: (_) {
                          if (_error != null) setState(() => _error = null);
                        },
                        decoration: InputDecoration(
                          hintText: 'Enter code, e.g. BUILD10',
                          errorText: _error,
                          isDense: true,
                          filled: true,
                          fillColor: AppColors.surface,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.space2),
                    FilledButton(
                      onPressed: () => _apply(cart),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 48),
                      ),
                      child: const Text('Apply'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.space2),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Summary ─────────────────────────────────────────────────────────────

class _PriceSummaryCard extends StatelessWidget {
  const _PriceSummaryCard({
    super.key,
    required this.cart,
    this.highlighted = false,
  });

  final CartController cart;

  /// Briefly true after the bottom bar's total is tapped, to draw the eye.
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final shippingFree = cart.shipping == 0;
    final toFreeShipping = CartController.freeShippingThreshold - cart.subtotal;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
      decoration: highlighted
          ? _cardDecoration.copyWith(
              color: AppColors.primaryContainer.withValues(alpha: 0.35),
              border: Border.all(color: AppColors.primary, width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.25),
                  blurRadius: 16,
                  offset: const Offset(0, 2),
                ),
              ],
            )
          : _cardDecoration,
      padding: const EdgeInsets.all(AppSpacing.space4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Price Details',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.space3),
            child: Divider(height: 1, color: AppColors.divider),
          ),
          _SummaryRow(label: 'Subtotal', value: formatInr(cart.subtotal)),
          if (cart.discount > 0)
            _SummaryRow(
              label: 'Coupon (${cart.coupon!.code})',
              value: '−${formatInr(cart.discount)}',
              valueColor: AppColors.success,
            ),
          _SummaryRow(
            label: 'Shipping Charges',
            value: shippingFree ? 'FREE' : formatInr(cart.shipping),
            valueColor: shippingFree ? AppColors.success : null,
          ),
          if (!shippingFree && toFreeShipping > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.space2),
              child: Text(
                'Add ${formatInr(toFreeShipping)} more for free shipping',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.info,
                ),
              ),
            ),
          _SummaryRow(
            label: 'Tax (GST ${(CartController.gstRate * 100).round()}%)',
            value: formatInr(cart.gst),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.space2),
            child: Divider(height: 1, color: AppColors.divider),
          ),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Total Amount',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                formatInr(cart.grandTotal),
                style: theme.textTheme.headlineSmall?.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.space2),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ),
          Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: valueColor ?? AppColors.onSurface,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Bottom bar ──────────────────────────────────────────────────────────

class _CheckoutBottomBar extends StatelessWidget {
  const _CheckoutBottomBar({
    required this.total,
    required this.enabled,
    required this.maxWidth,
    required this.onShowSummary,
    required this.onProceed,
  });

  final double total;
  final bool enabled;
  final double maxWidth;
  final VoidCallback onShowSummary;
  final VoidCallback onProceed;

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
            constraints: BoxConstraints(maxWidth: maxWidth),
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
                    onTap: enabled ? onShowSummary : null,
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
                          if (enabled)
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
                      onPressed: enabled ? onProceed : null,
                      style: FilledButton.styleFrom(
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadius.mdAll,
                        ),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Flexible(
                            child: Text(
                              'Proceed to Address',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          SizedBox(width: AppSpacing.space2),
                          Icon(Icons.arrow_forward_rounded, size: 20),
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

// ── Empty state ─────────────────────────────────────────────────────────

class _EmptyCart extends StatelessWidget {
  const _EmptyCart();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.space6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: const BoxDecoration(
                color: AppColors.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.shopping_cart_outlined,
                size: 44,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: AppSpacing.space5),
            Text(
              'Your cart is empty',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.space2),
            Text(
              'Add cement, bricks, steel and more to get started.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: AppSpacing.space5),
            OutlinedButton.icon(
              onPressed: () =>
                  Navigator.of(context).pushNamed(AppRoutes.categoryBrowse),
              icon: const Icon(Icons.storefront_rounded),
              label: const Text('Browse materials'),
            ),
          ],
        ),
      ),
    );
  }
}

final _cardDecoration = BoxDecoration(
  color: AppColors.surface,
  borderRadius: AppRadius.lgAll,
  border: Border.all(color: AppColors.divider),
  boxShadow: const [
    BoxShadow(color: AppColors.shadow, blurRadius: 10, offset: Offset(0, 2)),
  ],
);

class QuotationReviewScreen extends StatefulWidget {
  const QuotationReviewScreen({super.key});

  @override
  State<QuotationReviewScreen> createState() => _QuotationReviewScreenState();
}

class _QuotationReviewScreenState extends State<QuotationReviewScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _notes = TextEditingController();
  var _seeded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_seeded) return;
    final user = context.read<SessionController>().user;
    _name.text = user.name;
    _phone.text = user.phone ?? '';
    _seeded = true;
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: const Text('Quotation Review'),
      ),
      body: cart.isEmpty
          ? const Center(child: Text('Add materials to cart first.'))
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.space4),
              children: [
                Text('Materials', style: theme.textTheme.titleMedium),
                const SizedBox(height: AppSpacing.space3),
                ...cart.items.map(
                  (item) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(item.variant.productName),
                    subtitle: Text(
                      '${item.variant.brandName} · ${item.quantity} ${item.variant.unit}',
                    ),
                    trailing: Text(
                      '₹${item.totalPrice.toStringAsFixed(0)}',
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                const Divider(),
                Row(
                  children: [
                    Text('Estimated Total', style: theme.textTheme.titleSmall),
                    const Spacer(),
                    Text(
                      '₹${cart.estimatedTotal.toStringAsFixed(0)}',
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.space5),
                Text(
                  'Customer information',
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.space3),
                TextField(
                  controller: _name,
                  decoration: const InputDecoration(labelText: 'Name'),
                ),
                const SizedBox(height: AppSpacing.space3),
                TextField(
                  controller: _phone,
                  decoration: const InputDecoration(labelText: 'Phone'),
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: AppSpacing.space3),
                TextField(
                  controller: _notes,
                  decoration: const InputDecoration(
                    labelText: 'Notes (optional)',
                  ),
                  maxLines: 3,
                ),
                const SizedBox(height: AppSpacing.space6),
                FilledButton(
                  onPressed: () {
                    final user = context.read<SessionController>().user;
                    context.read<QuotationController>().createFromCart(
                      items: cart.items,
                      requesterId: user.id,
                      customerName: _name.text.trim().isEmpty
                          ? user.name
                          : _name.text.trim(),
                      customerPhone: _phone.text.trim(),
                      notes: _notes.text.trim(),
                    );
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Quotation enquiry saved locally (pending — no rewards yet)',
                        ),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                    Navigator.of(context).pop();
                  },
                  child: const Text('Submit Enquiry'),
                ),
              ],
            ),
    );
  }
}
