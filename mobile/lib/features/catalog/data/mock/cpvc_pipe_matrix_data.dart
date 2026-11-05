import '../../domain/models/catalog_models.dart';
import 'catalog_mock_data.dart';

/// CPVC pipe price matrix mock data (Brand × SDR schedule × Size → MRP).
abstract final class CpvcPipeMatrixData {
  static const _length = '3 Mtr';
  static const _discountRate = 0.10;

  static const _sizes = <({int mm, String label})>[
    (mm: 15, label: '15 MM (1/2")'),
    (mm: 20, label: '20 MM (3/4")'),
    (mm: 25, label: '25 MM (1")'),
    (mm: 32, label: '32 MM (1 1/4")'),
    (mm: 40, label: '40 MM (1 1/2")'),
    (mm: 50, label: '50 MM (2")'),
    (mm: 65, label: '65 MM (2 1/2")'),
    (mm: 80, label: '80 MM (3")'),
    (mm: 100, label: '100 MM (4")'),
    (mm: 150, label: '150 MM (6")'),
    (mm: 200, label: '200 MM (8")'),
  ];

  /// Astral SDR11 MRP (Rs/pc) — mock reference values.
  static const _astralSdr11Mrp = <int, double>{
    15: 195,
    20: 268,
    25: 348,
    32: 512,
    40: 685,
    50: 985,
    65: 1465,
    80: 1985,
    100: 3285,
    150: 6985,
    200: 10985,
  };

  static const _astralSdr135Mrp = <int, double>{
    15: 178,
    20: 245,
    25: 318,
    32: 468,
    40: 625,
    50: 895,
    65: 1335,
    80: 1805,
    100: 2985,
    150: 6345,
    200: 9985,
  };

  static const _finolexSdr11Mrp = <int, double>{
    15: 188,
    20: 258,
    25: 335,
    32: 492,
    40: 658,
    50: 945,
    65: 1408,
    80: 1908,
    100: 3158,
    150: 6708,
    200: 10558,
  };

  static const _finolexSdr135Mrp = <int, double>{
    15: 172,
    20: 236,
    25: 306,
    32: 450,
    40: 602,
    50: 862,
    65: 1285,
    80: 1738,
    100: 2875,
    150: 6108,
    200: 9608,
  };

  static String? sizeLabelFor(double mm) {
    final asInt = mm.round();
    for (final size in _sizes) {
      if (size.mm == asInt) return size.label;
    }
    return null;
  }

  static List<ProductVariant> buildVariants() {
    final variants = <ProductVariant>[];
    final rows = [
      ('brand-astral', 'Astral', 'SDR11', _astralSdr11Mrp, 'AS'),
      ('brand-astral', 'Astral', 'SDR13.5', _astralSdr135Mrp, 'AS'),
      ('brand-finolex', 'Finolex', 'SDR11', _finolexSdr11Mrp, 'FX'),
      ('brand-finolex', 'Finolex', 'SDR13.5', _finolexSdr135Mrp, 'FX'),
    ];

    for (final row in rows) {
      final brandId = row.$1;
      final brandName = row.$2;
      final schedule = row.$3;
      final mrpMap = row.$4;
      final brandCode = row.$5;

      for (final size in _sizes) {
        final mrp = mrpMap[size.mm];
        if (mrp == null) continue;

        final scheduleCode = schedule.replaceAll('.', '').replaceAll('SDR', '');
        final productCode =
            'C$scheduleCode${size.mm.toString().padLeft(3, '0')}$brandCode';
        final productName =
            '${productCode}_CPVC Pipe, $schedule, ${size.label}, $_length Pipe $brandName';
        final selling = mrp - (mrp * _discountRate);

        variants.add(
          ProductVariant(
            id: 'cpvc-matrix__${brandId}__${scheduleCode}__${size.mm}',
            productId: 'cpvc-pipe-unified',
            productName: productName,
            sku: productCode,
            brandId: brandId,
            brandName: brandName,
            categoryId: CatalogMockData.pipesTubingCategoryId,
            categoryName: 'Pipes & Tubing',
            subCategoryId: CatalogMockData.cpvcPipesSubCategoryId,
            subCategoryName: 'CPVC',
            description: productName,
            price: selling,
            unit: 'pcs',
            icon: 'plumbing',
            imageAsset: CatalogMockData.pipeSummaryImageAsset,
            rating: 4.5,
            reviewCount: 18,
            stockStatus: StockStatus.inStock,
            specifications: {
              'Size': size.label,
              'Type': schedule,
              'Length': _length,
              'SKU': productCode,
            },
            specSummary: '$schedule · ${size.label}',
            pipeType: schedule,
            mrp: mrp,
            discountRate: _discountRate,
          ),
        );
      }
    }

    return variants;
  }
}
