import '../../domain/models/catalog_models.dart';
import 'catalog_mock_data.dart';

/// UPVC pipe price matrix from the product spreadsheet (Brand × Sch × Size → MRP).
abstract final class UpvcPipeMatrixData {
  static const _length = '6 Mtr';
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
    (mm: 250, label: '250 MM (10")'),
    (mm: 300, label: '300 MM (12")'),
  ];

  /// Astral Sch 40 MRP (Rs/pc) — spreadsheet reference values.
  static const _astralSch40Mrp = <int, double>{
    15: 486,
    20: 635,
    25: 825,
    32: 1085,
    40: 1385,
    50: 1785,
    65: 2425,
    80: 3185,
    100: 6312,
    150: 13850,
    200: 21450,
    250: 27850,
    300: 32424,
  };

  static const _astralSch80Mrp = <int, double>{
    15: 612,
    20: 798,
    25: 1040,
    32: 1368,
    40: 1748,
    50: 2256,
    65: 3068,
    80: 4032,
    100: 10584,
    150: 23220,
    200: 35964,
    250: 46704,
    300: 54312,
  };

  static const _kingSch40Mrp = <int, double>{
    15: 378.54,
    20: 494.85,
    25: 642.82,
    32: 845.52,
    40: 1079.45,
    50: 1390.97,
    65: 1890.33,
    80: 2482.19,
    100: 4918.46,
    150: 10790.05,
    200: 16724.09,
    250: 21705.55,
    300: 25267.99,
  };

  static const _kingSch80Mrp = <int, double>{
    15: 453.78,
    20: 591.72,
    25: 770.64,
    32: 1014.58,
    40: 1295.85,
    50: 1672.18,
    65: 2276.42,
    80: 2990.11,
    100: 7848.02,
    150: 17216.13,
    200: 26649.17,
    250: 34608.82,
    300: 40225.39,
  };

  static String? sizeLabelFor(double mm) {
    final asInt = mm.round();
    for (final size in _sizes) {
      if (size.mm == asInt) return size.label;
    }
    return null;
  }

  static int? sizeMmFromLabel(String label) {
    final match = RegExp(r'(\d+)\s*MM', caseSensitive: false).firstMatch(label);
    return match != null ? int.tryParse(match.group(1)!) : null;
  }

  static int compareSizeLabels(String a, String b) {
    final mmA = sizeMmFromLabel(a) ?? 0;
    final mmB = sizeMmFromLabel(b) ?? 0;
    return mmA.compareTo(mmB);
  }

  /// Scales a base MRP table by [factor], used to derive placeholder
  /// pricing for pressure-class ("kg/cm2") type variants.
  static Map<int, double> _scaleMrp(Map<int, double> base, double factor) =>
      base.map((mm, mrp) => MapEntry(mm, double.parse((mrp * factor).toStringAsFixed(2))));

  static List<ProductVariant> buildVariants() {
    final variants = <ProductVariant>[];
    final rows = [
      ('brand-astral', 'Astral', 'Sch 40', _astralSch40Mrp, 'AS'),
      ('brand-astral', 'Astral', 'Sch 80', _astralSch80Mrp, 'AS'),
      ('brand-astral', 'Astral', '4 kg', _scaleMrp(_astralSch40Mrp, 0.85), 'AS'),
      ('brand-astral', 'Astral', '6 kg', _astralSch40Mrp, 'AS'),
      ('brand-astral', 'Astral', '8 kg', _scaleMrp(_astralSch40Mrp, 1.15), 'AS'),
      ('brand-astral', 'Astral', '10 kg', _astralSch80Mrp, 'AS'),
      ('brand-king', 'King', 'Sch 40', _kingSch40Mrp, 'KG'),
      ('brand-king', 'King', 'Sch 80', _kingSch80Mrp, 'KG'),
      ('brand-king', 'King', '4 kg', _scaleMrp(_kingSch40Mrp, 0.85), 'KG'),
      ('brand-king', 'King', '6 kg', _kingSch40Mrp, 'KG'),
      ('brand-king', 'King', '8 kg', _scaleMrp(_kingSch40Mrp, 1.15), 'KG'),
      ('brand-king', 'King', '10 kg', _kingSch80Mrp, 'KG'),
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

        final isSchedule = schedule.toLowerCase().startsWith('sch');
        final typeDigits =
            RegExp(r'\d+').firstMatch(schedule)?.group(0) ?? '0';
        final typeToken = '${isSchedule ? 'U' : 'C'}$typeDigits';
        final productCode =
            '$typeToken${size.mm.toString().padLeft(3, '0')}$brandCode';
        final productName =
            '${productCode}_UPVC Pipe, $schedule, ${size.label}, $_length Pipe $brandName';
        final selling = mrp - (mrp * _discountRate);

        variants.add(
          ProductVariant(
            id: 'upvc-matrix__${brandId}__${typeToken}__${size.mm}',
            productId: 'upvc-pipe-unified',
            productName: productName,
            sku: productCode,
            brandId: brandId,
            brandName: brandName,
            categoryId: CatalogMockData.pipesTubingCategoryId,
            categoryName: 'Pipes & Tubing',
            subCategoryId: CatalogMockData.upvcPipesSubCategoryId,
            subCategoryName: 'UPVC',
            description: productName,
            price: selling,
            unit: 'pcs',
            icon: 'plumbing',
            imageAsset: CatalogMockData.pipeSummaryImageAsset,
            rating: 4.6,
            reviewCount: 24,
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
