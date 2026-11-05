/// Demo user — replace with authenticated user later.
class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    this.email,
    String? initials,
  }) : _initialsOverride = initials;

  final String id;
  final String name;
  final String? email;
  final String? _initialsOverride;

  /// Initials derived from [name] unless explicitly provided.
  String get initials {
    final override = _initialsOverride;
    if (override != null && override.trim().isNotEmpty) {
      return override.trim().toUpperCase();
    }
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      final w = parts.first;
      return (w.length >= 2 ? w.substring(0, 2) : w).toUpperCase();
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}

class HomeBanner {
  const HomeBanner({
    required this.id,
    required this.eyebrow,
    required this.headline,
    required this.description,
    required this.ctaLabel,
    required this.routeName,
    required this.icon,
    required this.gradientStart,
    required this.gradientEnd,
    this.referralStyle = false,
  });

  final String id;
  final String eyebrow;
  final String headline;
  final String description;
  final String ctaLabel;
  final String routeName;
  final String icon;
  final int gradientStart;
  final int gradientEnd;

  /// Lime promo layout (refer & earn) instead of gradient hero card.
  final bool referralStyle;
}

class QuickAction {
  const QuickAction({
    required this.id,
    required this.title,
    required this.icon,
    required this.routeName,
    required this.iconColor,
    required this.iconBackground,
  });

  final String id;
  final String title;
  final String icon;
  final String routeName;
  final int iconColor;
  final int iconBackground;
}

class HomeCategory {
  const HomeCategory({
    required this.id,
    required this.name,
    required this.itemCount,
    required this.icon,
    required this.iconColor,
    required this.iconBackground,
    this.imageAsset = '',
    this.imageUrl,
  });

  final String id;
  final String name;
  final int itemCount;
  final String icon;
  final int iconColor;
  final int iconBackground;
  /// Local asset path for category product imagery (empty = use [icon]).
  final String imageAsset;
  /// Remote category image from backend (preferred over [imageAsset]).
  final String? imageUrl;
}

class HomeProduct {
  const HomeProduct({
    required this.id,
    required this.name,
    required this.brand,
    required this.spec,
    required this.price,
    required this.rating,
    required this.inStock,
    required this.categoryKey,
    required this.icon,
  });

  final String id;
  final String name;
  final String brand;
  final String spec;
  final String price;
  final double rating;
  final bool inStock;
  final String categoryKey;
  final String icon;
}

class HomeBrand {
  const HomeBrand({
    required this.id,
    required this.name,
    required this.productCount,
    required this.abbreviation,
    required this.color,
    this.logoAsset = '',
  });

  final String id;
  final String name;
  final int productCount;
  final String abbreviation;
  final int color;
  /// Local brand logo asset path (empty = use [abbreviation]).
  final String logoAsset;
}

class HomeOffer {
  const HomeOffer({
    required this.id,
    required this.discountLabel,
    required this.title,
    required this.subtitle,
    required this.endsOn,
    required this.ctaLabel,
    required this.routeName,
  });

  final String id;
  final String discountLabel;
  final String title;
  final String subtitle;
  final String endsOn;
  final String ctaLabel;
  final String routeName;
}

class ConstructionTool {
  const ConstructionTool({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.routeName,
  });

  final String id;
  final String title;
  final String subtitle;
  final String icon;
  final String routeName;
}
