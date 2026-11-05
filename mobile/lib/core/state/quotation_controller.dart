import 'package:flutter/foundation.dart';

import '../../features/catalog/domain/models/catalog_models.dart';

/// In-memory quotation store for the demo.
class QuotationController extends ChangeNotifier {
  QuotationController() {
    _seedDemoQuotations();
  }

  final List<QuotationDraft> _quotations = [];
  int _sequence = 3;

  List<QuotationDraft> get quotations => List.unmodifiable(_quotations);

  QuotationDraft? byId(String id) {
    for (final q in _quotations) {
      if (q.id == id) return q;
    }
    return null;
  }

  List<QuotationDraft> forRequester(String requesterId) =>
      _quotations.where((q) => q.requesterId == requesterId).toList();

  QuotationDraft createFromCart({
    required List<CartItem> items,
    required String requesterId,
    required String customerName,
    String customerPhone = '',
    String notes = '',
  }) {
    _sequence += 1;
    final draft = QuotationDraft(
      id: 'qt-${DateTime.now().millisecondsSinceEpoch}',
      displayId: 'QT-2026-${_sequence.toString().padLeft(3, '0')}',
      items: List<CartItem>.from(items),
      createdAt: DateTime.now(),
      requesterId: requesterId,
      customerName: customerName,
      customerPhone: customerPhone,
      notes: notes,
      status: QuotationStatus.pending,
      soldAt: null,
    );
    _quotations.insert(0, draft);
    notifyListeners();
    return draft;
  }

  /// Returns updated quotation, or null if missing / already sold.
  QuotationDraft? markSold({
    required String quotationId,
    required DateTime soldAt,
  }) {
    final index = _quotations.indexWhere((q) => q.id == quotationId);
    if (index < 0) return null;
    final current = _quotations[index];
    if (current.isSold) return null;

    final updated = current.copyWith(
      status: QuotationStatus.sold,
      soldAt: soldAt,
    );
    _quotations[index] = updated;
    notifyListeners();
    return updated;
  }

  void _seedDemoQuotations() {
    CartItem stub({
      required String id,
      required String name,
      required String brand,
      required double price,
      required int qty,
    }) {
      final variant = ProductVariant(
        id: id,
        productId: 'seed-$id',
        productName: name,
        sku: 'SEED-$id',
        brandId: 'brand-astral',
        brandName: brand,
        categoryId: 'cat-pipes-tubing',
        categoryName: 'Pipes & Tubing',
        subCategoryId: 'cat-pipes-tubing__upvc',
        subCategoryName: 'UPVC',
        description: 'Demo quotation line',
        price: price,
        unit: 'pcs',
        icon: 'plumbing',
        rating: 4.5,
        reviewCount: 10,
        stockStatus: StockStatus.inStock,
        specifications: const {},
      );
      return CartItem(variant: variant, quantity: qty);
    }

    // Quotation 1 — demo user (Rajesh) — ₹1,43,000 → 1,430 pts when sold
    _quotations.add(
      QuotationDraft(
        id: 'qt-demo-143000',
        displayId: 'QT-2026-001',
        requesterId: AppUserProfile.demo.id,
        customerName: 'Rajesh Kumar',
        customerPhone: '+91 98765 43210',
        createdAt: DateTime(2026, 8, 10, 11, 30),
        status: QuotationStatus.pending,
        items: [
          stub(
            id: 'seed-v1a',
            name: 'Project pipe & fitting package',
            brand: 'Astral',
            price: 143000,
            qty: 1,
          ),
        ],
      ),
    );

    // Quotation 2 — demo user — ₹50,000 → 500 pts
    _quotations.add(
      QuotationDraft(
        id: 'qt-demo-50000',
        displayId: 'QT-2026-002',
        requesterId: AppUserProfile.demo.id,
        customerName: 'Rajesh Kumar',
        customerPhone: '+91 98765 43210',
        createdAt: DateTime(2026, 8, 12, 15, 0),
        status: QuotationStatus.pending,
        items: [
          stub(
            id: 'seed-v2a',
            name: 'Sanitaryware bulk order',
            brand: 'Cera',
            price: 50000,
            qty: 1,
          ),
        ],
      ),
    );

    // Quotation 3 — another user — ₹25,000
    _quotations.add(
      QuotationDraft(
        id: 'qt-demo-25000',
        displayId: 'QT-2026-003',
        requesterId: 'user-amit',
        customerName: 'Amit Kumar',
        customerPhone: '+91 99887 76655',
        createdAt: DateTime(2026, 8, 14, 9, 45),
        status: QuotationStatus.pending,
        items: [
          stub(
            id: 'seed-v3a',
            name: 'CP fittings package',
            brand: 'Jaquar',
            price: 25000,
            qty: 1,
          ),
        ],
      ),
    );
  }
}
