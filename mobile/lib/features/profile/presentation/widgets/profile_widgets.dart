import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../catalog/domain/models/catalog_models.dart';
import '../../../checkout/domain/models/order_models.dart';
import '../../domain/models/profile_models.dart';

const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/// `d MMM yyyy`, e.g. 10 Mar 2026.
String formatProfileDate(DateTime dt) =>
    '${dt.day} ${_months[dt.month - 1]} ${dt.year}';

/// Blue gradient header with avatar, title and subtitle.
class ProfileHeader extends StatelessWidget {
  const ProfileHeader({
    super.key,
    required this.initials,
    required this.showBackButton,
    required this.onAvatarTap,
  });

  final String initials;
  final bool showBackButton;
  final VoidCallback onAvatarTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.primaryPressed],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(AppRadius.xl),
          bottomRight: Radius.circular(AppRadius.xl),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.space4,
            showBackButton ? AppSpacing.space1 : AppSpacing.space5,
            AppSpacing.space4,
            AppSpacing.space6,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (showBackButton)
                IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.arrow_back_ios_new_rounded),
                  color: AppColors.onPrimary,
                  tooltip: 'Back',
                  padding: EdgeInsets.zero,
                  alignment: Alignment.centerLeft,
                ),
              Row(
                children: [
                  _Avatar(initials: initials, onTap: onAvatarTap),
                  const SizedBox(width: AppSpacing.space4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'My Profile',
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: AppColors.onPrimary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.space1),
                        Text(
                          'Manage your personal and business details',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.onPrimary.withValues(alpha: 0.85),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.initials, required this.onTap});

  final String initials;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 76,
      height: 76,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.primaryContainer,
              border: Border.all(color: AppColors.onPrimary, width: 3),
            ),
            alignment: Alignment.center,
            child: Text(
              initials,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          Positioned(
            right: -2,
            bottom: -2,
            child: Material(
              color: AppColors.onPrimary,
              shape: const CircleBorder(),
              elevation: 1,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onTap,
                child: const Padding(
                  padding: EdgeInsets.all(5),
                  child: Icon(
                    Icons.photo_camera_rounded,
                    size: 15,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Info banner shown while any KYC section awaits backend approval.
class ProfileApprovalBanner extends StatelessWidget {
  const ProfileApprovalBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.space3),
      decoration: BoxDecoration(
        color: AppColors.infoContainer,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded, size: 20, color: AppColors.info),
          const SizedBox(width: AppSpacing.space2),
          Expanded(
            child: Text(
              'Some details are pending for approval. Once approved by the '
              'backend team, they cannot be changed.',
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.info),
            ),
          ),
        ],
      ),
    );
  }
}

/// Card for one profile section: icon, title, optional status, chevron.
class ProfileSectionCard extends StatelessWidget {
  const ProfileSectionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.onTap,
    required this.children,
    this.status,
  });

  final IconData icon;
  final String title;
  final VerificationStatus? status;
  final VoidCallback onTap;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.space3),
      child: Material(
        color: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.lgAll,
          side: const BorderSide(color: AppColors.divider),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.space4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.primaryContainer,
                        borderRadius: AppRadius.smAll,
                      ),
                      child: Icon(icon, size: 20, color: AppColors.primary),
                    ),
                    const SizedBox(width: AppSpacing.space3),
                    Expanded(
                      child: Text(
                        title,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (status != null) VerificationStatusBadge(status: status!),
                    const SizedBox(width: AppSpacing.space1),
                    Icon(
                      status?.isLocked == true
                          ? Icons.lock_outline_rounded
                          : Icons.chevron_right_rounded,
                      size: status?.isLocked == true ? 18 : 22,
                      color: status?.isLocked == true
                          ? AppColors.outline
                          : AppColors.primary,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.space3),
                const Divider(height: 1),
                const SizedBox(height: AppSpacing.space2),
                ...children,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Label/value row inside a [ProfileSectionCard].
class ProfileInfoRow extends StatelessWidget {
  const ProfileInfoRow({
    super.key,
    required this.label,
    required this.value,
    this.trailing,
  });

  final String label;
  final String value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.space1 + 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 128,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.outline),
            ),
          ),
          Expanded(
            child: Wrap(
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space1,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  value.isEmpty ? '—' : value,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: AppColors.onSurface,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                ?trailing,
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// "Supporting Document" row: PDF icon, file name, upload date, view button.
class ProfileDocumentRow extends StatelessWidget {
  const ProfileDocumentRow({super.key, this.document, this.onView});

  final ProfileDocument? document;
  final VoidCallback? onView;

  @override
  Widget build(BuildContext context) {
    if (document == null) return const SizedBox.shrink();
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.space1 + 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 128,
            child: Text(
              'Supporting Document',
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.outline),
            ),
          ),
          Expanded(
            child: ProfileDocumentTile(document: document!, onView: onView),
          ),
        ],
      ),
    );
  }
}

/// PDF icon + file name + "Uploaded on …" + optional eye (view) button.
class ProfileDocumentTile extends StatelessWidget {
  const ProfileDocumentTile({super.key, required this.document, this.onView});

  final ProfileDocument document;
  final VoidCallback? onView;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(
          document.isPdf ? Icons.picture_as_pdf_rounded : Icons.image_rounded,
          size: 22,
          color: document.isPdf ? AppColors.error : AppColors.primary,
        ),
        const SizedBox(width: AppSpacing.space2),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                document.fileName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.onSurface,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                'Uploaded on ${formatProfileDate(document.uploadedOn)}',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: AppColors.outline,
                ),
              ),
            ],
          ),
        ),
        if (onView != null)
          IconButton(
            onPressed: onView,
            icon: const Icon(Icons.visibility_outlined, size: 20),
            color: AppColors.primary,
            tooltip: 'View document',
            visualDensity: VisualDensity.compact,
          ),
      ],
    );
  }
}

/// Approved (green) / Pending for Approval (red) pill.
class VerificationStatusBadge extends StatelessWidget {
  const VerificationStatusBadge({super.key, required this.status});

  final VerificationStatus status;

  @override
  Widget build(BuildContext context) {
    final approved = status == VerificationStatus.approved;
    final fg = approved ? AppColors.success : AppColors.error;
    final bg = approved ? AppColors.successContainer : AppColors.errorContainer;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space2,
        vertical: AppSpacing.space1,
      ),
      decoration: BoxDecoration(color: bg, borderRadius: AppRadius.pillAll),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            approved ? Icons.check_circle_rounded : Icons.schedule_rounded,
            size: 14,
            color: fg,
          ),
          const SizedBox(width: AppSpacing.space1),
          Text(
            status.label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: fg,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

/// Grey "Not Editable" chip with a lock icon (mobile number).
class NotEditableChip extends StatelessWidget {
  const NotEditableChip({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space2,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: AppRadius.xsAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.lock_outline_rounded, size: 12, color: AppColors.outline),
          const SizedBox(width: 2),
          Text(
            'Not Editable',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.outline,
                ),
          ),
        ],
      ),
    );
  }
}

/// Expandable order history block shown above the Account section on profile.
class ProfileOrderHistorySection extends StatefulWidget {
  const ProfileOrderHistorySection({super.key, required this.orders});

  final List<PlacedOrder> orders;

  @override
  State<ProfileOrderHistorySection> createState() =>
      _ProfileOrderHistorySectionState();
}

class _ProfileOrderHistorySectionState extends State<ProfileOrderHistorySection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final orders = widget.orders;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.space3),
      child: Material(
        color: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.lgAll,
          side: const BorderSide(color: AppColors.divider),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            InkWell(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.space4),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.primaryContainer,
                        borderRadius: AppRadius.smAll,
                      ),
                      child: const Icon(
                        Icons.receipt_long_rounded,
                        size: 20,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.space3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Order History',
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (orders.isEmpty)
                            Text(
                              'No previous orders',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: AppColors.onSurfaceVariant,
                              ),
                            )
                          else
                            Text(
                              '${orders.length} ${orders.length == 1 ? 'order' : 'orders'}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: AppColors.onSurfaceVariant,
                              ),
                            ),
                        ],
                      ),
                    ),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      color: AppColors.primary,
                    ),
                  ],
                ),
              ),
            ),
            if (_expanded) ...[
              const Divider(height: 1),
              if (orders.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.space4),
                  child: Text(
                    'When you place an order, it will appear here.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                )
              else
                for (var i = 0; i < orders.length; i++)
                  _OrderHistoryEntry(
                    order: orders[i],
                    showDivider: i < orders.length - 1,
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

class _OrderHistoryEntry extends StatefulWidget {
  const _OrderHistoryEntry({
    required this.order,
    required this.showDivider,
  });

  final PlacedOrder order;
  final bool showDivider;

  @override
  State<_OrderHistoryEntry> createState() => _OrderHistoryEntryState();
}

class _OrderHistoryEntryState extends State<_OrderHistoryEntry> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final order = widget.order;

    return Column(
      children: [
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.space4,
              AppSpacing.space3,
              AppSpacing.space4,
              AppSpacing.space3,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.orderId,
                        style: theme.textTheme.labelLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${formatProfileDate(order.placedAt)} · '
                        '${order.itemCount} ${order.itemCount == 1 ? 'item' : 'items'}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  formatInr(order.total),
                  style: theme.textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: AppSpacing.space1),
                Icon(
                  _expanded
                      ? Icons.expand_less_rounded
                      : Icons.expand_more_rounded,
                  size: 22,
                  color: AppColors.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
        if (_expanded)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.space4,
              0,
              AppSpacing.space4,
              AppSpacing.space3,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ProfileInfoRow(
                  label: 'Payment',
                  value: order.paymentStatus,
                ),
                ProfileInfoRow(
                  label: 'Delivery',
                  value: order.delivery.label,
                ),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  'Items',
                  style: theme.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                for (final line in order.lines)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.space2),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            '${line.name} × ${line.quantity}',
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                        Text(
                          formatInr(line.total),
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        if (widget.showDivider)
          const Divider(height: 1, indent: 16, endIndent: 16),
      ],
    );
  }
}
