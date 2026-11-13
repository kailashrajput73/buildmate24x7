import '../../../catalog/domain/models/catalog_models.dart';
import '../../domain/models/home_models.dart';

abstract final class HomeDashboardCategories {
  static List<HomeCategory> forDashboard(List<Category> categories) => [
    for (final category in categories)
      HomeCategory(
        id: category.id,
        name: category.name,
        itemCount: category.itemCount,
        icon: category.icon,
        iconColor: category.iconColor,
        iconBackground: category.iconBackground,
        imageAsset: '',
        imageUrl: category.imageUrl,
      ),
  ];
}
