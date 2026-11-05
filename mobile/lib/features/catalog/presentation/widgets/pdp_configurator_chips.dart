import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';

/// Compact square option used for Brand / Class / Size on the PDP configurator.
class FilterPillChip extends StatelessWidget {
  const FilterPillChip({
    super.key,
    required this.label,
    required this.selected,
    this.enabled = true,
    this.onTap,
    this.subtitle,
    this.expand = false,
  });

  final String label;
  final String? subtitle;
  final bool selected;
  final bool enabled;
  final VoidCallback? onTap;
  final bool expand;

  static const double _cellHeight = 44;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final borderColor = !enabled
        ? AppColors.outlineVariant.withValues(alpha: 0.55)
        : selected
        ? AppColors.accentGreen
        : AppColors.outlineVariant;

    final background = !enabled
        ? AppColors.surfaceContainer.withValues(alpha: 0.35)
        : selected
        ? AppColors.accentGreenContainer.withValues(alpha: 0.35)
        : AppColors.surface;

    final titleColor = !enabled
        ? AppColors.onSurfaceVariant.withValues(alpha: 0.65)
        : AppColors.onBackground;

    final titleStyle = theme.textTheme.labelSmall?.copyWith(
      fontWeight: FontWeight.w600,
      color: titleColor,
      height: 1.15,
    );

    final subtitleStyle = theme.textTheme.labelSmall?.copyWith(
      fontSize: 10,
      height: 1.1,
      color: AppColors.onSurfaceVariant.withValues(alpha: 0.85),
    );

    final hasSubtitle = subtitle != null && subtitle!.isNotEmpty;
    final minCellHeight = hasSubtitle ? 54.0 : _cellHeight;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: AppRadius.smAll,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: minCellHeight,
          ),
          child: Ink(
            width: expand ? double.infinity : null,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.space1,
              vertical: AppSpacing.space1,
            ),
            decoration: BoxDecoration(
              color: background,
              borderRadius: AppRadius.smAll,
              border: Border.all(
                color: borderColor,
                width: selected && enabled ? 1.5 : 1,
                strokeAlign: BorderSide.strokeAlignInside,
              ),
            ),
            child: Center(
              child: hasSubtitle
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          label,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: titleStyle,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          subtitle!,
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: subtitleStyle,
                        ),
                      ],
                    )
                  : Text(
                      label,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: titleStyle,
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Brand, class, and size filters — same 4-column square grid on the PDP.
class ConfiguratorOptionGrid extends StatelessWidget {
  const ConfiguratorOptionGrid({
    super.key,
    required this.options,
    required this.selectedOption,
    required this.onOptionSelected,
    required this.emptyMessage,
    this.isOptionEnabled,
    this.subtitleForOption,
    this.isSelected,
    this.columns = 4,
  });

  final List<String> options;
  final String? selectedOption;
  final ValueChanged<String> onOptionSelected;
  final String emptyMessage;
  final bool Function(String option)? isOptionEnabled;
  final String? Function(String option)? subtitleForOption;
  final bool Function(String option, String? selected)? isSelected;
  final int columns;

  bool _optionSelected(String option) {
    if (isSelected != null) {
      return isSelected!(option, selectedOption);
    }
    return selectedOption == option;
  }

  @override
  Widget build(BuildContext context) {
    if (options.isEmpty) {
      return Text(
        emptyMessage,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: AppColors.onSurfaceVariant,
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final spacing = AppSpacing.space2;
        final itemWidth =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final option in options)
              SizedBox(
                width: itemWidth,
                child: FilterPillChip(
                  label: option,
                  subtitle: subtitleForOption?.call(option),
                  selected: _optionSelected(option),
                  enabled: isOptionEnabled?.call(option) ?? true,
                  expand: true,
                  onTap: () => onOptionSelected(option),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Bottom sheet listing all sizes in the same grid as the PDP.
class SizeMoreBottomSheet extends StatelessWidget {
  const SizeMoreBottomSheet({
    super.key,
    required this.productFamilyTitle,
    required this.sizes,
    required this.selectedSize,
    required this.isSizeEnabled,
    required this.onSizeSelected,
    this.stockLabelForSize,
  });

  final String productFamilyTitle;
  final List<String> sizes;
  final String? selectedSize;
  final bool Function(String size) isSizeEnabled;
  final ValueChanged<String> onSizeSelected;
  final String? Function(String size)? stockLabelForSize;

  static Future<void> show({
    required BuildContext context,
    required String productFamilyTitle,
    required List<String> sizes,
    required String? selectedSize,
    required bool Function(String size) isSizeEnabled,
    required ValueChanged<String> onSizeSelected,
    String? Function(String size)? stockLabelForSize,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: false,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (context) => SizeMoreBottomSheet(
        productFamilyTitle: productFamilyTitle,
        sizes: sizes,
        selectedSize: selectedSize,
        isSizeEnabled: isSizeEnabled,
        stockLabelForSize: stockLabelForSize,
        onSizeSelected: (size) {
          Navigator.of(context).pop();
          onSizeSelected(size);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final maxHeight = MediaQuery.sizeOf(context).height * 0.55;
    final labelFor = stockLabelForSize ?? (_) => null;

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: AppSpacing.space2),
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.outlineVariant,
                  borderRadius: AppRadius.pillAll,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.space4,
                AppSpacing.space3,
                AppSpacing.space4,
                AppSpacing.space1,
              ),
              child: Text('More', style: theme.textTheme.titleLarge),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
              child: Text(
                productFamilyTitle.toUpperCase(),
                style: theme.textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.4,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.space3),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.space4,
                  0,
                  AppSpacing.space4,
                  AppSpacing.space4,
                ),
                child: ConfiguratorOptionGrid(
                  options: sizes,
                  selectedOption: selectedSize,
                  isOptionEnabled: isSizeEnabled,
                  subtitleForOption: labelFor,
                  onOptionSelected: onSizeSelected,
                  emptyMessage: 'No sizes available',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
