/// Row from `GET /api/subcategories` (material: UPVC, CPVC, PVC, …).
class ApiSubCategory {
  const ApiSubCategory({
    required this.id,
    required this.name,
    this.categoryId,
    this.categoryName,
    this.imageUrl,
    this.productCount = 0,
  });

  final String id;
  final String name;
  final String? categoryId;
  final String? categoryName;
  final String? imageUrl;
  final int productCount;

  factory ApiSubCategory.fromJson(Map<String, dynamic> json) {
    return ApiSubCategory(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      categoryId: json['categoryId']?.toString() ?? json['category_id']?.toString(),
      categoryName: json['category']?.toString(),
      imageUrl: _nullableString(json['imageUrl'] ?? json['image_url']),
      productCount: _toInt(json['productCount']) ?? 0,
    );
  }

  static String? _nullableString(dynamic value) {
    if (value == null) return null;
    final text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  static int? _toInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString().trim());
  }
}
