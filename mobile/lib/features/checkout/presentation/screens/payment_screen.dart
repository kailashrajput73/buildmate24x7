import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/cart_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../catalog/domain/models/catalog_models.dart';
import '../../domain/models/payment_models.dart';
import '../widgets/checkout_widgets.dart';

/// Checkout step 3 of 4. This legacy flow is not connected to the live payment API.
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key, required this.args});

  final PaymentArgs args;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _upi = TextEditingController();
  final _cardNumber = TextEditingController();
  final _expiry = TextEditingController();
  final _cvv = TextEditingController();
  final _cardName = TextEditingController();

  var _method = PaymentMethod.upi;
  String? _bank;

  @override
  void dispose() {
    _upi.dispose();
    _cardNumber.dispose();
    _expiry.dispose();
    _cvv.dispose();
    _cardName.dispose();
    super.dispose();
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
  }

  void _select(PaymentMethod method) {
    if (method == _method) return;
    FocusScope.of(context).unfocus();
    setState(() => _method = method);
  }

  void _placeOrder() {
    _showSnack(
      'Live payment is not connected in this checkout flow. No order has been placed.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();
    final delivery = widget.args.delivery;
    final total = cart.grandTotal + delivery.fee;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          CheckoutStepHeader(currentStep: 2, cartCount: cart.totalQuantity),
          Expanded(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.space4,
                  AppSpacing.space5,
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
                          const CheckoutSectionTitle(
                            icon: Icons.credit_card_rounded,
                            title: 'Select Payment Method',
                          ),
                          for (final method in PaymentMethod.values) ...[
                            CheckoutSelectableCard(
                              selected: method == _method,
                              onTap: () => _select(method),
                              crossAxisAlignment: CrossAxisAlignment.center,
                              expanded: _details(method, total),
                              child: _MethodTile(
                                method: method,
                                selected: method == _method,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.space3),
                          ],
                          const SizedBox(height: AppSpacing.space1),
                          const _SecureNote(),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: CheckoutTotalBar(
        total: total,
        label: 'Payment Unavailable',
        icon: Icons.cloud_off_rounded,
        loading: false,
        onShowSummary: () =>
            showCheckoutPriceBreakdown(context, cart: cart, delivery: delivery),
        onPressed: _placeOrder,
      ),
    );
  }

  Widget _details(PaymentMethod method, double total) {
    return switch (method) {
      PaymentMethod.upi => TextFormField(
        controller: _upi,
        keyboardType: TextInputType.emailAddress,
        autocorrect: false,
        textInputAction: TextInputAction.done,
        validator: PaymentValidators.upiId,
        decoration: _inputDecoration('Enter UPI ID (e.g. 9876543210@paytm)'),
      ),
      PaymentMethod.card => Column(
        children: [
          TextFormField(
            controller: _cardNumber,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            validator: PaymentValidators.cardNumber,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(16),
              _CardNumberFormatter(),
            ],
            decoration: _inputDecoration('Card number'),
          ),
          const SizedBox(height: AppSpacing.space3),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextFormField(
                  controller: _expiry,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  validator: (v) => PaymentValidators.expiry(v),
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                    _ExpiryFormatter(),
                  ],
                  decoration: _inputDecoration('Expiry (MM/YY)'),
                ),
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: TextFormField(
                  controller: _cvv,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  obscureText: true,
                  validator: PaymentValidators.cvv,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                  ],
                  decoration: _inputDecoration('CVV'),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space3),
          TextFormField(
            controller: _cardName,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.done,
            validator: PaymentValidators.cardName,
            decoration: _inputDecoration('Name on card'),
          ),
        ],
      ),
      PaymentMethod.netBanking => DropdownButtonFormField<String>(
        initialValue: _bank,
        isExpanded: true,
        decoration: _inputDecoration('Select your bank'),
        items: [
          for (final bank in kNetBankingBanks)
            DropdownMenuItem(value: bank, child: Text(bank)),
        ],
        onChanged: (bank) => setState(() => _bank = bank),
      ),
      PaymentMethod.cod => _CodNote(total: total),
    };
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      isDense: true,
      filled: true,
      fillColor: AppColors.surface,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space3,
        vertical: AppSpacing.space3,
      ),
      border: OutlineInputBorder(
        borderRadius: AppRadius.smAll,
        borderSide: const BorderSide(color: AppColors.outlineVariant),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: AppRadius.smAll,
        borderSide: const BorderSide(color: AppColors.outlineVariant),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: AppRadius.smAll,
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
    );
  }
}

// ── Method card content ─────────────────────────────────────────────────

class _MethodTile extends StatelessWidget {
  const _MethodTile({required this.method, required this.selected});

  final PaymentMethod method;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: selected ? AppColors.surface : AppColors.surfaceContainer,
            borderRadius: AppRadius.smAll,
            border: Border.all(color: AppColors.divider),
          ),
          child: Icon(
            method.icon,
            size: 20,
            color: selected ? AppColors.primary : AppColors.onSurfaceVariant,
          ),
        ),
        const SizedBox(width: AppSpacing.space3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                method.label,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                method.subtitle,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CodNote extends StatelessWidget {
  const _CodNote({required this.total});

  final double total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.space3),
      decoration: BoxDecoration(
        color: AppColors.warningContainer,
        borderRadius: AppRadius.smAll,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline_rounded,
            size: 18,
            color: AppColors.warning,
          ),
          const SizedBox(width: AppSpacing.space2),
          Expanded(
            child: Text(
              'Keep ${formatInr(total)} ready in cash or pay by UPI to the '
              'delivery partner.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SecureNote extends StatelessWidget {
  const _SecureNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space4,
        vertical: AppSpacing.space3,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainer,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.verified_user_rounded,
            size: 20,
            color: AppColors.success,
          ),
          const SizedBox(width: AppSpacing.space2),
          Expanded(
            child: Text(
              'Guaranteed 256-bit SSL encrypted safe checkout',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Input formatters ────────────────────────────────────────────────────

/// "4111111111111111" → "4111 1111 1111 1111". Expects digits only.
class _CardNumberFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text;
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && i % 4 == 0) buffer.write(' ');
      buffer.write(digits[i]);
    }
    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// "1228" → "12/28". Expects digits only.
class _ExpiryFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text;
    final text = digits.length > 2
        ? '${digits.substring(0, 2)}/${digits.substring(2)}'
        : digits;
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
