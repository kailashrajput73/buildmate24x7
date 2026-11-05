import 'package:flutter/material.dart';

/// A membership tier threshold, e.g. Silver at 0 pts, Gold at 500 pts.
class RewardTier {
  const RewardTier({required this.name, required this.minPoints});

  final String name;
  final int minPoints;

  factory RewardTier.fromJson(Map<String, dynamic> json) => RewardTier(
        name: json['name'] as String,
        minPoints: (json['minPoints'] as num).toInt(),
      );
}

/// A redeemable perk shown on the rewards screen.
/// Sourced from mock data (assets/data/rewards_mock_data.json) — display only.
class RewardPerk {
  const RewardPerk({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.cost,
    required this.icon,
    required this.color,
  });

  final String id;
  final String title;
  final String subtitle;
  final int cost;
  final IconData icon;
  final Color color;

  factory RewardPerk.fromJson(Map<String, dynamic> json) => RewardPerk(
        id: json['id'] as String,
        title: json['title'] as String,
        subtitle: json['subtitle'] as String,
        cost: (json['cost'] as num).toInt(),
        icon: _iconFor(json['icon'] as String? ?? ''),
        color: _colorFrom(json['color'] as String? ?? '#1A56DB'),
      );

  static IconData _iconFor(String key) {
    switch (key) {
      case 'delivery':
        return Icons.local_shipping_rounded;
      case 'discount':
        return Icons.sell_rounded;
      case 'support':
        return Icons.support_agent_rounded;
      case 'install':
        return Icons.handyman_rounded;
      default:
        return Icons.card_giftcard_rounded;
    }
  }

  static Color _colorFrom(String hex) {
    final cleaned = hex.replaceFirst('#', '');
    final value = int.parse(cleaned, radix: 16);
    return Color(0xFF000000 | value);
  }
}
