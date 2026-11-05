import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_elevation.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/app_icons.dart';

class HomeSearchBar extends StatefulWidget {
  const HomeSearchBar({
    super.key,
    this.onSearch,
    this.onVoice,
    this.onScan,
    this.initialQuery = '',
  });

  /// Opens the search screen with the current query.
  final ValueChanged<String>? onSearch;
  final VoidCallback? onVoice;
  final VoidCallback? onScan;
  final String initialQuery;

  @override
  State<HomeSearchBar> createState() => _HomeSearchBarState();
}

class _HomeSearchBarState extends State<HomeSearchBar> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialQuery);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit([String? value]) {
    widget.onSearch?.call((value ?? _controller.text).trim());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: AppColors.surface,
      elevation: AppElevation.level2,
      shadowColor: AppColors.shadow,
      borderRadius: AppRadius.lgAll,
      child: Container(
        height: AppSpacing.space14,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4),
        decoration: BoxDecoration(
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.22)),
          color: AppColors.surface,
        ),
        child: Row(
          children: [
            GestureDetector(
              onTap: () => _submit(),
              child: Icon(appIcon('search'), color: AppColors.primary),
            ),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: TextField(
                controller: _controller,
                textInputAction: TextInputAction.search,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.onSurface,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  hintText: 'Search products, brands or categories',
                  hintStyle: theme.textTheme.bodyMedium?.copyWith(
                    color: AppColors.outline,
                  ),
                  contentPadding: EdgeInsets.zero,
                ),
                onSubmitted: _submit,
              ),
            ),
            IconButton(
              onPressed: widget.onVoice ?? () => _submit(),
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(
                minWidth: AppSpacing.space8,
                minHeight: AppSpacing.space8,
              ),
              icon: Icon(appIcon('mic'), color: AppColors.onSurfaceVariant),
            ),
            IconButton(
              onPressed: widget.onScan ?? () => _submit(),
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(
                minWidth: AppSpacing.space8,
                minHeight: AppSpacing.space8,
              ),
              icon: Icon(
                appIcon('qr_code_scanner'),
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
