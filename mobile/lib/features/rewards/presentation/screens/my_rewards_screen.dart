import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/state/reward_controller.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/models/reward_models.dart';

class MyRewardsScreen extends StatefulWidget {
  const MyRewardsScreen({super.key});

  @override
  State<MyRewardsScreen> createState() => _MyRewardsScreenState();
}

class _MyRewardsScreenState extends State<MyRewardsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  Future<void> _refresh() async {
    final userId = context.read<SessionController>().user.id;
    await context.read<RewardController>().refreshForUser(userId);
  }

  String _formatPoints(int points) {
    return points.toString().replaceAllMapped(
          RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
          (m) => '${m[1]},',
        );
  }

  String _formatInr(double value) {
    final n = value.toStringAsFixed(0);
    final withCommas = n.replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
    return '₹$withCommas';
  }

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
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    final rewards = context.watch<RewardController>();
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text('Rewards'),
        actions: [
          IconButton(
            onPressed: _refresh,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.space4),
          children: [
            _RewardPointsCard(
              balance: rewards.balance,
              totalEarned: rewards.entries
                  .where((e) => e.isEarned)
                  .fold(0, (sum, e) => sum + e.points),
              totalRedeemed: rewards.entries
                  .where((e) => !e.isEarned)
                  .fold(0, (sum, e) => sum + e.points),
              formatPoints: _formatPoints,
            ),
            const SizedBox(height: AppSpacing.space6),
            Row(
              children: [
                const Icon(
                  Icons.history_rounded,
                  size: 20,
                  color: AppColors.primary,
                ),
                const SizedBox(width: AppSpacing.space2),
                Text('Reward History', style: theme.textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: AppSpacing.space3),
            if (rewards.entries.isEmpty)
              Container(
                padding: const EdgeInsets.all(AppSpacing.space5),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: AppRadius.lgAll,
                  border: Border.all(color: AppColors.divider),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.space4),
                      decoration: const BoxDecoration(
                        color: AppColors.primaryContainer,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.stars_rounded,
                        size: 32,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space3),
                    Text(
                      'No reward points earned yet.',
                      style: theme.textTheme.titleSmall,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.space1),
                    Text(
                      'Complete a purchase to start earning rewards.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.outline,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              )
            else
              ...rewards.entries.map((entry) => _RewardHistoryTile(
                    entry: entry,
                    formatPoints: _formatPoints,
                    formatInr: _formatInr,
                    formatDate: _formatDate,
                  )),
          ],
        ),
      ),
    );
  }
}

class _RewardPointsCard extends StatelessWidget {
  const _RewardPointsCard({
    required this.balance,
    required this.totalEarned,
    required this.totalRedeemed,
    required this.formatPoints,
  });

  final int balance;
  final int totalEarned;
  final int totalRedeemed;
  final String Function(int) formatPoints;

  static const _gold = Color(0xFFFBBF24);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadius.xlAll,
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: AppRadius.xlAll,
        child: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF0B1F4D),
                Color(0xFF1A3F9E),
                AppColors.primary,
              ],
              stops: [0.0, 0.55, 1.0],
            ),
          ),
          child: Stack(
            children: [
              // Decorative glows.
              Positioned(
                top: -60,
                right: -40,
                child: _GlowCircle(
                  size: 180,
                  color: _gold.withValues(alpha: 0.22),
                ),
              ),
              Positioned(
                bottom: -70,
                left: -50,
                child: _GlowCircle(
                  size: 170,
                  color: Colors.white.withValues(alpha: 0.08),
                ),
              ),
              Positioned(
                top: 18,
                right: 20,
                child: Icon(
                  Icons.workspace_premium_rounded,
                  size: 64,
                  color: _gold.withValues(alpha: 0.9),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.space5),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.space3,
                        vertical: AppSpacing.space1,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        borderRadius: AppRadius.pillAll,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.stars_rounded,
                            size: 16,
                            color: _gold,
                          ),
                          const SizedBox(width: AppSpacing.space1),
                          Text(
                            'Reward Points',
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space4),
                    Text(
                      'Available balance',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.7),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space1),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          formatPoints(balance),
                          style: theme.textTheme.headlineMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 44,
                            height: 1.0,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.space2),
                        Text(
                          'pts',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: _gold,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.space5),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.space4,
                        vertical: AppSpacing.space3,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: AppRadius.lgAll,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.15),
                        ),
                      ),
                      child: IntrinsicHeight(
                        child: Row(
                          children: [
                            Expanded(
                              child: _PointsStat(
                                icon: Icons.trending_up_rounded,
                                iconColor: const Color(0xFF4ADE80),
                                label: 'Total earned',
                                value: formatPoints(totalEarned),
                              ),
                            ),
                            VerticalDivider(
                              width: AppSpacing.space6,
                              thickness: 1,
                              color: Colors.white.withValues(alpha: 0.2),
                            ),
                            Expanded(
                              child: _PointsStat(
                                icon: Icons.redeem_rounded,
                                iconColor: _gold,
                                label: 'Redeemed',
                                value: formatPoints(totalRedeemed),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GlowCircle extends StatelessWidget {
  const _GlowCircle({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [color, color.withValues(alpha: 0)],
        ),
      ),
    );
  }
}

class _PointsStat extends StatelessWidget {
  const _PointsStat({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.18),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 16, color: iconColor),
        ),
        const SizedBox(width: AppSpacing.space2),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.7),
                ),
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                '$value pts',
                style: theme.textTheme.titleSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RewardHistoryTile extends StatelessWidget {
  const _RewardHistoryTile({
    required this.entry,
    required this.formatPoints,
    required this.formatInr,
    required this.formatDate,
  });

  final RewardLedgerEntry entry;
  final String Function(int) formatPoints;
  final String Function(double) formatInr;
  final String Function(DateTime) formatDate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final positive = entry.isEarned;
    final accent = positive ? AppColors.success : AppColors.error;
    final accentContainer =
        positive ? AppColors.successContainer : AppColors.errorContainer;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.space3),
      padding: const EdgeInsets.all(AppSpacing.space4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: AppColors.divider),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.space3),
            decoration: BoxDecoration(
              color: accentContainer,
              shape: BoxShape.circle,
            ),
            child: Icon(
              positive
                  ? Icons.arrow_upward_rounded
                  : Icons.arrow_downward_rounded,
              size: 18,
              color: accent,
            ),
          ),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        'Quotation #${entry.quotationDisplayId.isEmpty ? entry.quotationId : entry.quotationDisplayId}',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      positive
                          ? '+${formatPoints(entry.points)}'
                          : '-${formatPoints(entry.points)}',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: accent,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  entry.description.isEmpty
                      ? 'Sale confirmed'
                      : entry.description,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.outline,
                  ),
                ),
                if (entry.quotationGrandTotal > 0)
                  Text(
                    '${formatInr(entry.quotationGrandTotal)} quotation',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.outline,
                    ),
                  ),
                const SizedBox(height: AppSpacing.space2),
                Text(
                  formatDate(entry.createdAt),
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: AppColors.onSurfaceVariant,
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
