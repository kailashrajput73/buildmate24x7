import '../../../catalog/domain/models/catalog_models.dart';

enum RewardLedgerType { earned, redeemed }

class RewardLedgerEntry {
  const RewardLedgerEntry({
    required this.id,
    required this.requesterId,
    required this.quotationId,
    required this.points,
    required this.type,
    required this.createdAt,
    this.quotationDisplayId = '',
    this.quotationGrandTotal = 0,
    this.description = '',
    this.title,
  });

  final String id;
  final String requesterId;
  final String quotationId;
  final int points;
  final RewardLedgerType type;
  final DateTime createdAt;
  final String quotationDisplayId;
  final double quotationGrandTotal;
  final String description;

  /// Heading for a server reward transaction ("Order #…", "Referral"); null
  /// keeps the quotation heading.
  final String? title;

  bool get isEarned => type == RewardLedgerType.earned;
}

class RewardMarkSoldResult {
  const RewardMarkSoldResult({
    required this.quotation,
    required this.pointsCredited,
    this.ledgerEntry,
  });

  final QuotationDraft quotation;
  final int pointsCredited;
  final RewardLedgerEntry? ledgerEntry;
}

class RewardException implements Exception {
  RewardException(this.message);
  final String message;

  @override
  String toString() => message;
}
