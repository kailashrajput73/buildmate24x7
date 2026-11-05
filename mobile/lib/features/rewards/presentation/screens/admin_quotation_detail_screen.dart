import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/state/quotation_controller.dart';
import '../../../../core/state/reward_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../catalog/domain/models/catalog_models.dart';
import '../../domain/models/reward_models.dart';

class AdminQuotationDetailScreen extends StatefulWidget {
  const AdminQuotationDetailScreen({super.key, required this.quotationId});

  final String quotationId;

  @override
  State<AdminQuotationDetailScreen> createState() =>
      _AdminQuotationDetailScreenState();
}

class _AdminQuotationDetailScreenState extends State<AdminQuotationDetailScreen> {
  var _busy = false;

  String _formatDate(DateTime dt) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final h = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';
    final m = dt.minute.toString().padLeft(2, '0');
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}, $h:$m $ampm';
  }

  String _formatInr(double value) {
    final n = value.toStringAsFixed(0);
    final withCommas = n.replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
    return '₹$withCommas';
  }

  String _formatPoints(int points) {
    return points.toString().replaceAllMapped(
          RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
          (m) => '${m[1]},',
        );
  }

  Future<void> _markSold(QuotationDraft quotation) async {
    if (_busy) return;
    setState(() => _busy = true);
    final rewards = context.read<RewardController>();
    try {
      final result = await rewards.markQuotationAsSold(
        quotationId: quotation.id,
        customerDisplayName: quotation.customerName,
      );
      if (!mounted) return;
      final pts = _formatPoints(result.pointsCredited);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.pointsCredited > 0
                ? 'Marked as sold — $pts points credited to ${quotation.customerName}.'
                : 'Marked as sold — no points credited (total under ₹100).',
          ),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.success,
        ),
      );
      setState(() {});
    } on RewardException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.error,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not mark quotation as sold. Please try again.'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final quotation =
        context.watch<QuotationController>().byId(widget.quotationId);
    final theme = Theme.of(context);

    if (quotation == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Quotation')),
        body: const Center(child: Text('Quotation not found.')),
      );
    }

    final previewPoints =
        context.read<RewardController>().service.calculatePoints(
              quotation.grandTotal,
            );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: Text(quotation.quotationLabel),
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.space4),
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.space4),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: AppColors.divider),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Status: ${quotation.status.toUpperCase()}',
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: quotation.isSold
                        ? AppColors.success
                        : AppColors.secondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.space2),
                Text('Customer: ${quotation.customerName}'),
                Text('Phone: ${quotation.customerPhone}'),
                Text('Requester ID: ${quotation.requesterId}'),
                Text('Created: ${_formatDate(quotation.createdAt)}'),
                if (quotation.soldAt != null)
                  Text('Sold At: ${_formatDate(quotation.soldAt!)}'),
                const SizedBox(height: AppSpacing.space2),
                Text(
                  'Grand Total: ${_formatInr(quotation.grandTotal)}',
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (quotation.isSold && previewPoints > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.space2),
                    child: Text(
                      'Reward Points: ${_formatPoints(previewPoints)} credited',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.success,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.space4),
          Text('Materials', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.space2),
          ...quotation.items.map(
            (item) => ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(item.variant.productName),
              subtitle: Text(
                '${item.variant.brandName} · ${item.quantity} × ${_formatInr(item.unitPrice)}',
              ),
              trailing: Text(_formatInr(item.totalPrice)),
            ),
          ),
          const SizedBox(height: AppSpacing.space6),
          if (quotation.isPending)
            FilledButton(
              onPressed: _busy ? null : () => _markSold(quotation),
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      'Mark as Sold (${_formatPoints(previewPoints)} pts)',
                    ),
            )
          else
            Container(
              padding: const EdgeInsets.all(AppSpacing.space3),
              decoration: BoxDecoration(
                color: AppColors.successContainer,
                borderRadius: AppRadius.lgAll,
              ),
              child: Text(
                'This quotation is sold. Reward points have already been processed.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.success,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
