import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/glass.dart';
import '../../core/theme.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

class RewardsScreen extends ConsumerWidget {
  const RewardsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(trProvider);
    final sum = ref.watch(rewardsProvider);
    final history = ref.watch(rewardHistoryProvider);
    return Scaffold(
      appBar: AppBar(title: Text(t('rewards.title'))),
      body: sum.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(rewardsProvider)),
        data: (s) => RefreshIndicator(
          onRefresh: () async { ref.invalidate(rewardsProvider); ref.invalidate(rewardHistoryProvider); },
          child: ListView(padding: const EdgeInsets.all(16), children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(gradient: const LinearGradient(colors: [BM.leaf, Color(0xFF2E9B3E)]), borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Available points', style: TextStyle(color: Colors.white70)),
                Text(qty(s.balance), style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w800)),
                Text('Worth about ${money(s.balance * s.pointValueRupees)} at the store', style: const TextStyle(color: Colors.white)),
              ]),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _stat('This month', '+${qty(s.thisMonthEarned)}')),
              const SizedBox(width: 10),
              Expanded(child: _stat('All time', qty(s.lifetimeEarned))),
            ]),
            const SizedBox(height: 12),
            const Text('Points are credited when your order is handed over or delivered. Redeem them at the counter — the store adjusts them in your account.',
                style: TextStyle(color: BM.inkSoft, fontSize: 13)),
            const SizedBox(height: 20),
            Text('History', style: Theme.of(context).textTheme.titleMedium),
            ...(history.valueOrNull ?? s.recent).map((r) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(r.orderNo != null ? 'Order ${r.orderNo}' : (r.note ?? r.type)),
                  subtitle: Text(dateTime(r.createdAt)),
                  trailing: Text('${r.points > 0 ? '+' : ''}${qty(r.points)}',
                      style: TextStyle(fontWeight: FontWeight.w800, color: r.points > 0 ? BM.leaf : BM.brick, fontSize: 16)),
                )),
          ]),
        ),
      ),
    );
  }

  Widget _stat(String k, String v) => Container(
        padding: const EdgeInsets.all(14),
        decoration: glassDecoration(radius: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(k, style: const TextStyle(color: BM.inkSoft, fontSize: 12)),
          Text(v, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
        ]),
      );
}
