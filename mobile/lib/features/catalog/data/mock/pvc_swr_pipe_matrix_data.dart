import '../../domain/models/catalog_models.dart';
import 'catalog_mock_data.dart';

/// PVC SWR (drainage) pipe price matrix mock data — sizes lifted from the
/// product spreadsheet's size dropdown (Brand × Type × Size → MRP).
abstract final class PvcSwrPipeMatrixData {
  static const _length = '3 Mtr';
  static const _discountRate = 0.10;

  static const _sizes = <({int mm, String label, String type})>[
    (mm: 20, label: '20MM_(½")', type: 'Type A'),
    (mm: 25, label: '25 MM_(¾")', type: 'Type A'),
    (mm: 25, label: '25MM_(¾")', type: 'Type A'),
    (mm: 32, label: '32 MM (1")', type: 'Type A'),
    (mm: 32, label: '32MM_(1")', type: 'Type A'),
    (mm: 40, label: '40MM_(1¼")', type: 'Type A'),
    (mm: 40, label: '40 MM(1½")_6', type: '6 kg/cm2'),
    (mm: 50, label: '50MM_(1½")', type: 'Type A'),
    (mm: 63, label: '63MM_(2")', type: 'Type A'),
    (mm: 75, label: '75MM_(2½")', type: 'Type A'),
    (mm: 75, label: '75 MM(2½")_6', type: '6 kg/cm2'),
    (mm: 90, label: '90MM_(3")', type: 'Type A'),
    (mm: 110, label: '110MM_(4")', type: 'Type A'),
    (mm: 110, label: '110 MM(4")_6', type: '6 kg/cm2'),
    (mm: 125, label: '125MM_(4½")', type: 'Type A'),
    (mm: 140, label: '140MM_(5")', type: 'Type A'),
    (mm: 160, label: '160MM_(6")', type: 'Type A'),
    (mm: 180, label: '180MM_(7")', type: 'Type A'),
    (mm: 200, label: '200MM_(8")', type: 'Type A'),
    (mm: 225, label: '225MM_(9")', type: 'Type A'),
    (mm: 250, label: '250MM_(10")', type: 'Type A'),
    (mm: 280, label: '280MM_(11")', type: 'Type A'),
    (mm: 315, label: '315MM_(12")', type: 'Type A'),
    (mm: 355, label: '355MM_(14")', type: 'Type A'),
    (mm: 400, label: '400MM_(16")', type: 'Type A'),
  ];

  /// Placeholder MRP curve (Rs/pc) — scales with pipe diameter; the "6
  /// kg/cm2" pressure class carries a premium over the plain Type A size.
  static double _mrpFor(int mm, String type) {
    final base = 8 * mm + 0.9 * mm * mm / 10;
    final factor = type == '6 kg/cm2' ? 1.2 : 1.0;
    return double.parse((base * factor).toStringAsFixed(2));
  }

  static List<ProductVariant> buildVariants() {
    final variants = <ProductVariant>[];
    const brandId = 'brand-astral';
    const brandName = 'Astral';

    for (var i = 0; i < _sizes.length; i++) {
      final size = _sizes[i];
      final mrp = _mrpFor(size.mm, size.type);
      final typeCode = size.type == '6 kg/cm2' ? 'K6' : 'TA';
      final productCode = 'PVCSWR$typeCode${size.mm.toString().padLeft(3, '0')}_$i';
      final productName =
          '${productCode}_PVC SWR Pipe, ${size.type}, ${size.label}, $_length Pipe $brandName';
      final selling = mrp - (mrp * _discountRate);

      variants.add(
        ProductVariant(
          id: 'pvc-swr-matrix__${brandId}__${size.type}__${size.mm}__$i',
          productId: 'pvc-swr-pipe-unified',
          productName: productName,
          sku: productCode,
          brandId: brandId,
          brandName: brandName,
          categoryId: CatalogMockData.pipesTubingCategoryId,
          categoryName: 'Pipes & Tubing',
          subCategoryId: CatalogMockData.pvcSwrPipesSubCategoryId,
          subCategoryName: 'PVC SWR',
          description: productName,
          price: selling,
          unit: 'pcs',
          icon: 'plumbing',
          imageAsset: CatalogMockData.pipeSummaryImageAsset,
          rating: 4.4,
          reviewCount: 12,
          stockStatus: StockStatus.inStock,
          specifications: {
            'Size': size.label,
            'Type': size.type,
            'Length': _length,
            'SKU': productCode,
          },
          specSummary: '${size.type} · ${size.label}',
          pipeType: size.type,
          mrp: mrp,
          discountRate: _discountRate,
        ),
      );
    }

    return variants;
  }
}
