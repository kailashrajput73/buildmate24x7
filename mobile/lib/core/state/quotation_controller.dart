import 'package:flutter/foundation.dart';

import '../../features/catalog/domain/models/catalog_models.dart';

/// Client-side quotation state for the Provider-based checkout flow.
class QuotationController extends ChangeNotifier {
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
}
