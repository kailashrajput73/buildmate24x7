import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/state/delivery_controller.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';

/// For every Add to Cart / Buy action: true when the selected delivery PIN code is serviceable. Otherwise opens the
/// "Choose delivery location" sheet with the reason and returns false (nothing is added).
bool ensureDeliverable(BuildContext context) {
  final delivery = context.read<DeliveryController>();
  if (delivery.canPurchase) return true;
  final selected = delivery.selected;
  showDeliveryPinSheet(
    context,
    note: selected == null
        ? 'Enter your delivery PIN code to check that we deliver there.'
        : '${selected.message} Choose a serviceable delivery PIN code to add items to your cart.',
  );
  return false;
}

/// "Choose delivery location": enter a 6-digit PIN code, see whether the store delivers there. No GPS needed.
Future<void> showDeliveryPinSheet(BuildContext context, {String? note}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (_) => _DeliveryPinSheet(note: note),
  );
}

class _DeliveryPinSheet extends StatefulWidget {
  const _DeliveryPinSheet({this.note});
  final String? note;

  @override
  State<_DeliveryPinSheet> createState() => _DeliveryPinSheetState();
}

class _DeliveryPinSheetState extends State<_DeliveryPinSheet> {
  late final TextEditingController _pin;
  DeliveryCheck? _result;
  String? _error;

  @override
  void initState() {
    super.initState();
    final selected = context.read<DeliveryController>().selected;
    _pin = TextEditingController(text: selected?.pincode ?? '');
    _result = selected;
  }

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  Future<void> _check() async {
    final pin = _pin.text.trim();
    setState(() => _error = null);
    if (!DeliveryController.isValidPin(pin)) {
      setState(() => _error = 'Enter a valid 6-digit PIN code.');
      return;
    }
    try {
      final r = await context.read<DeliveryController>().choose(pin);
      if (!mounted) return;
      setState(() {
        if (r.isValid) {
          _result = r;
        } else {
          _error = r.message;
        }
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not check this PIN code. Check your internet connection and try again.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final checking = context.watch<DeliveryController>().checking;
    final shown = _result != null && _result!.pincode == _pin.text.trim() ? _result : null;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.space4,
        AppSpacing.space4,
        AppSpacing.space4,
        AppSpacing.space4 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.location_on_rounded, color: AppColors.primary),
                const SizedBox(width: AppSpacing.space2),
                Expanded(
                  child: Text(
                    'Choose delivery location',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            if (widget.note != null) ...[
              Container(
                padding: const EdgeInsets.all(AppSpacing.space3),
                decoration: BoxDecoration(
                  color: AppColors.warningContainer,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Text(widget.note!, style: theme.textTheme.bodySmall),
              ),
              const SizedBox(height: AppSpacing.space3),
            ],
            Text(
              'Enter the PIN code where you want your order delivered. You can shop from anywhere — only the delivery PIN code matters.',
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.space3),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _pin,
                    autofocus: true,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    textInputAction: TextInputAction.done,
                    onChanged: (_) => setState(() => _error = null),
                    onSubmitted: (_) => _check(),
                    decoration: const InputDecoration(
                      hintText: '6-digit PIN code',
                      counterText: '',
                      prefixIcon: Icon(Icons.pin_drop_outlined),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.space2),
                FilledButton(
                  onPressed: checking || _pin.text.trim().length != 6 ? null : _check,
                  child: checking
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Check'),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.space2),
              Text(_error!, style: theme.textTheme.bodySmall?.copyWith(color: AppColors.error)),
            ],
            if (shown != null) ...[
              const SizedBox(height: AppSpacing.space3),
              Container(
                padding: const EdgeInsets.all(AppSpacing.space3),
                decoration: BoxDecoration(
                  color: shown.serviceable ? AppColors.successContainer : AppColors.errorContainer,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      shown.serviceable ? '✓ Delivery available' : '✕ Delivery not available',
                      style: theme.textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: shown.serviceable ? AppColors.success : AppColors.error,
                      ),
                    ),
                    if (shown.place.isNotEmpty) Text(shown.place, style: theme.textTheme.bodySmall),
                    if (!shown.serviceable)
                      Text(
                        '${shown.message} You can still browse; try another PIN code to order.',
                        style: theme.textTheme.bodySmall?.copyWith(color: AppColors.error),
                      ),
                  ],
                ),
              ),
              if (shown.serviceable) ...[
                const SizedBox(height: AppSpacing.space3),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Continue shopping'),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

/// Small note under Add to Cart when the selected delivery PIN code is not serviceable.
class DeliveryBlockedNote extends StatelessWidget {
  const DeliveryBlockedNote({super.key});

  @override
  Widget build(BuildContext context) {
    final delivery = context.watch<DeliveryController>();
    if (!delivery.blocked) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.space2),
      child: InkWell(
        onTap: () => showDeliveryPinSheet(context),
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.space3),
          decoration: BoxDecoration(
            color: AppColors.errorContainer,
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Text.rich(
            TextSpan(children: [
              TextSpan(text: '${delivery.selected!.message} '),
              const TextSpan(
                text: 'Change PIN code',
                style: TextStyle(fontWeight: FontWeight.w700, decoration: TextDecoration.underline),
              ),
            ]),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.error),
          ),
        ),
      ),
    );
  }
}
