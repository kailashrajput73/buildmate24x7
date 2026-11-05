import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/quotation_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';

class AdminQuotationsScreen extends StatelessWidget {
  const AdminQuotationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final quotations = context.watch<QuotationController>().quotations;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: const Text('Admin · Quotations'),
      ),
      body: quotations.isEmpty
          ? Center(
              child: Text(
                'No quotations yet.',
                style: theme.textTheme.bodyMedium,
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.space4),
              itemCount: quotations.length,
              separatorBuilder: (_, _) =>
                  const SizedBox(height: AppSpacing.space3),
              itemBuilder: (context, index) {
                final q = quotations[index];
                return Material(
                  color: AppColors.surface,
                  borderRadius: AppRadius.lgAll,
                  child: ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.lgAll,
                    ),
                    title: Text(q.quotationLabel),
                    subtitle: Text(
                      '${q.customerName}\n₹${q.grandTotal.toStringAsFixed(0)} · ${q.status.toUpperCase()}',
                    ),
                    isThreeLine: true,
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () {
                      Navigator.of(context).pushNamed(
                        AppRoutes.adminQuotationDetail,
                        arguments: AdminQuotationDetailArgs(
                          quotationId: q.id,
                        ),
                      );
                    },
                  ),
                );
              },
            ),
    );
  }
}
