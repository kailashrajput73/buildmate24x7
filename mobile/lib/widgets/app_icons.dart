import 'package:flutter/material.dart';

/// Maps design-token icon keys to Material Icons.
IconData appIcon(String key) {
  return switch (key) {
    'inventory_2' => Icons.inventory_2_rounded,
    'plumbing' => Icons.plumbing_rounded,
    'local_offer' => Icons.local_offer_rounded,
    'request_quote' => Icons.request_quote_rounded,
    'storefront' => Icons.storefront_rounded,
    'business' => Icons.business_rounded,
    'bolt' => Icons.bolt_rounded,
    'grid_view' => Icons.grid_view_rounded,
    'palette' => Icons.palette_rounded,
    'water_drop' => Icons.water_drop_rounded,
    'electrical_services' => Icons.electrical_services_rounded,
    'handyman' => Icons.handyman_rounded,
    'science' => Icons.science_rounded,
    'add_road' => Icons.add_road_rounded,
    'roofing' => Icons.roofing_rounded,
    'health_and_safety' => Icons.health_and_safety_rounded,
    'calculate' => Icons.calculate_rounded,
    'swap_horiz' => Icons.swap_horiz_rounded,
    'architecture' => Icons.architecture_rounded,
    'description' => Icons.description_rounded,
    'home' => Icons.home_rounded,
    'category' => Icons.category_rounded,
    'favorite' => Icons.favorite_rounded,
    'favorite_border' => Icons.favorite_border_rounded,
    'person' => Icons.person_rounded,
    'notifications' => Icons.notifications_outlined,
    'shopping_cart' => Icons.shopping_cart_outlined,
    'search' => Icons.search_rounded,
    'mic' => Icons.mic_none_rounded,
    'qr_code_scanner' => Icons.qr_code_scanner_rounded,
    'compare_arrows' => Icons.compare_arrows_rounded,
    _ => Icons.circle_outlined,
  };
}
