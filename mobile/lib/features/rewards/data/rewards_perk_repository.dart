import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import '../domain/models/reward_perk_models.dart';

/// Loads the display-only rewards tiers/perks mock data from
/// assets/data/rewards_mock_data.json. Does not affect the real
/// points balance or ledger — those still come from [RewardService].
abstract final class RewardsPerkRepository {
  static const String _assetPath = 'assets/data/rewards_mock_data.json';

  static List<RewardTier>? _tiersCache;
  static List<RewardPerk>? _perksCache;

  static Future<(List<RewardTier>, List<RewardPerk>)> load() async {
    final cachedTiers = _tiersCache;
    final cachedPerks = _perksCache;
    if (cachedTiers != null && cachedPerks != null) {
      return (cachedTiers, cachedPerks);
    }

    final raw = await rootBundle.loadString(_assetPath);
    final json = jsonDecode(raw) as Map<String, dynamic>;

    final tiers = (json['tiers'] as List<dynamic>)
        .map((e) => RewardTier.fromJson(e as Map<String, dynamic>))
        .toList();
    final perks = (json['redeemOptions'] as List<dynamic>)
        .map((e) => RewardPerk.fromJson(e as Map<String, dynamic>))
        .toList();

    _tiersCache = tiers;
    _perksCache = perks;
    return (tiers, perks);
  }
}
